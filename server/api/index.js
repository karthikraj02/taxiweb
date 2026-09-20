/**
 * Vercel serverless entry point.
 *
 * index.js is a long-running process (connect, then server.listen), which a
 * serverless function cannot use: it never exports a handler, so requests hang
 * until the platform gives up. This file exports the Express app as a handler
 * instead, and reuses one MongoDB connection across warm invocations.
 *
 * Limits of running on Vercel functions:
 *  - No Socket.IO / WebSockets, so live chat and location streaming are off.
 *    (The emit helpers are no-ops when there is no socket server.)
 *  - The disk is read-only/ephemeral, so uploaded driver documents are not kept.
 * Host index.js on a regular Node service (Render, Railway, Fly) for those.
 */
// Anything running on Vercel is a deployed environment. Force production mode
// BEFORE config/env loads, so secure cookies, CSRF settings and the production
// config checks apply even if NODE_ENV was mis-set or left unset in the dashboard.
if (process.env.VERCEL) process.env.NODE_ENV = 'production';

const mongoose = require('mongoose');
const env = require('../config/env');
const logger = require('../utils/logger');
const createApp = require('../app');

let app;
let connecting = null;

function connect() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!connecting) {
    mongoose.set('strictQuery', true);
    connecting = mongoose
      .connect(env.mongoUri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 })
      .catch((err) => {
        connecting = null;           // let the next request retry
        throw err;
      });
  }
  return connecting;
}

module.exports = async function handler(req, res) {
  const isHealth = (req.url || '').startsWith('/api/health');

  if (isHealth) {
    // Always answer health checks, even when the database is down, so the
    // deployment can be diagnosed ("db": "disconnected") instead of hanging.
    connect().catch((err) => logger.error('MongoDB connection failed', { error: err.message }));
  } else {
    try {
      await connect();
    } catch (err) {
      logger.error('MongoDB connection failed', { error: err.message });
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: { code: 'DB_UNAVAILABLE', message: 'The service is temporarily unavailable. Please try again shortly.' },
      }));
      return;
    }
  }

  app = app || createApp();
  return app(req, res);
};
