require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const { doubleCsrf } = require('csrf-csrf');

const env = require('./config/env');
const logger = require('./utils/logger');
const requestId = require('./middleware/requestId');
const { apiLimiter } = require('./middleware/rateLimiters');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

/**
 * Express application, exported without starting a listener so tests can mount
 * it with supertest and index.js can attach the HTTP + Socket.IO server.
 */
function createApp() {
  const app = express();

  // Behind Render/Railway/Fly the client IP arrives in X-Forwarded-For. Without
  // this, every rate limiter keys on the proxy address and one abusive client
  // exhausts the budget for everyone.
  app.set('trust proxy', 1);

  app.use(requestId);

  // ---------------------------------------------------------- PHASE 51
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        // Razorpay checkout is injected as a script and opens an iframe.
        scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
        frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
        connectSrc: ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'"],   // inline styles from the existing UI
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: env.isProduction ? [] : null,
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: env.isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(), camera=(), payment=(self)');
    next();
  });

  // ---------------------------------------------------------- PHASE 52
  const allowedOrigins = [env.clientUrl, ...env.allowedOrigins].filter(Boolean);
  app.use(cors({
    origin(origin, callback) {
      // Same-origin and non-browser callers send no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      logger.warn('Blocked cross-origin request', { origin });
      return callback(new Error('NOT_ALLOWED_BY_CORS'));
    },
    credentials: true,
    exposedHeaders: ['x-request-id'],
  }));

  /**
   * Webhooks mount BEFORE express.json() and before CSRF.
   *
   * The Razorpay signature is computed over the raw bytes, so the body must not
   * be parsed and re-serialised first. Webhooks are also server-to-server and
   * authenticated by that signature, so a CSRF token is neither available nor
   * meaningful.
   */
  app.use('/api/webhooks', require('./routes/webhooks'));

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser(env.cookieSecret));

  // Request logging with secrets redacted (PHASE 55).
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      logger.info('request', {
        requestId: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - started,
      });
    });
    next();
  });

  // Uploaded documents. nosniff plus a restrictive CSP stops a crafted upload
  // from being served back as executable content.
  app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    dotfiles: 'deny',
    index: false,
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Content-Disposition', 'inline');
    },
  }));

  app.use('/api', apiLimiter);

  // ------------------------------------------------------------- CSRF
  const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => env.csrfSecret,
    // Bind the CSRF cookie to the session so a token minted for one user
    // cannot be replayed against another. The previous build used the literal
    // string 'common_session' for every visitor, which defeats the binding.
    getSessionIdentifier: (req) =>
      req.cookies?.accessToken || req.cookies?.driverAccessToken || req.ip || 'anonymous',
    cookieName: env.isProduction ? '__Host-csrf' : 'x-csrf-token',
    cookieOptions: {
      httpOnly: true,
      sameSite: env.isProduction ? 'none' : 'lax',
      secure: env.isProduction,
      path: '/',
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  });

  app.get('/api/csrf-token', (req, res) => {
    res.json({ success: true, data: { csrfToken: generateCsrfToken(req, res) } });
  });

  if (!env.isTest) {
    app.use('/api', doubleCsrfProtection);
  }

  // ----------------------------------------------------------- routes
  app.get('/api/health', (req, res) => {
    const mongoose = require('mongoose');
    const mailer = require('./services/mailer');
    res.json({
      success: true,
      data: {
        status: 'ok',
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        demoMode: env.demoMode,
        timestamp: new Date().toISOString(),
        // Deployment facts for diagnosing a misconfigured environment. No
        // secrets: only which build is running, which database *name* it is
        // using, and which email provider (if any) is configured.
        deployment: {
          version: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
          environment: env.nodeEnv,
          database: mongoose.connection.name || null,
          email: mailer.isEnabled() ? (env.resend.enabled ? 'resend' : 'smtp') : 'none',
        },
      },
    });
  });

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/bookings', require('./routes/bookings'));
  app.use('/api/pricing', require('./routes/pricing'));
  app.use('/api/payments', require('./routes/payments'));
  app.use('/api/drivers', require('./routes/drivers'));
  app.use('/api/driver-auth', require('./routes/driverAuth'));
  app.use('/api/driver', require('./routes/driverDashboard'));
  app.use('/api/contact', require('./routes/contact'));
  app.use('/api/reviews', require('./routes/reviews'));
  app.use('/api/admin', require('./routes/admin'));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
