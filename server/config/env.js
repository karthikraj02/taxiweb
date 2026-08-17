/**
 * Centralised, validated environment configuration.
 *
 * Production MUST fail to start when a mandatory secret is missing.
 * There are deliberately NO fallback values like `secret_dev` for anything
 * security-relevant — a silent fallback is how staging secrets end up in prod.
 */
const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const errors = [];

function required(name, { minLength = 0 } = {}) {
  const value = process.env[name];
  if (!value) {
    errors.push(`${name} is required`);
    return undefined;
  }
  if (minLength && value.length < minLength) {
    errors.push(`${name} must be at least ${minLength} characters`);
  }
  return value;
}

/** Secrets that are mandatory in production but auto-generated in dev/test. */
function secret(name, { minLength = 32 } = {}) {
  const value = process.env[name];
  if (value) {
    if (isProduction && value.length < minLength) {
      errors.push(`${name} must be at least ${minLength} characters in production`);
    }
    return value;
  }
  if (isProduction) {
    errors.push(`${name} is required in production`);
    return undefined;
  }
  // Dev/test only: ephemeral random secret. Restarting invalidates tokens,
  // which is intentional — it makes the missing config obvious rather than silent.
  const generated = crypto.randomBytes(48).toString('hex');
  if (!isTest) {
    console.warn(`[env] ${name} not set — generated an ephemeral development secret.`);
  }
  return generated;
}

function num(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    errors.push(`${name} must be a number`);
    return fallback;
  }
  return parsed;
}

function bool(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw.toLowerCase() === 'true';
}

function list(name) {
  const raw = process.env[name];
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  isTest,
  port: num('PORT', 5000),

  mongoUri: isTest
    ? (process.env.MONGODB_URI || '')
    : required('MONGODB_URI'),

  // --- Auth ---
  jwtSecret: secret('JWT_SECRET'),
  cookieSecret: secret('COOKIE_SECRET'),
  csrfSecret: secret('CSRF_SECRET'),
  accessTokenTtl: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenTtlDays: num('REFRESH_TOKEN_TTL_DAYS', 7),
  driverAccessTokenTtl: process.env.DRIVER_JWT_EXPIRES_IN || '15m',
  bcryptRounds: num('BCRYPT_ROUNDS', 12),

  // --- OTP policy (PHASE 4) ---
  otp: {
    length: 6,
    expiryMinutes: num('OTP_EXPIRY_MINUTES', 5),
    maxAttempts: num('OTP_MAX_ATTEMPTS', 5),
    resendCooldownSeconds: num('OTP_RESEND_COOLDOWN_SECONDS', 60),
  },

  // --- CORS (PHASE 52) ---
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  allowedOrigins: list('ALLOWED_ORIGINS'),

  // --- Demo mode (PHASE 3 / 12) ---
  // Must be explicitly enabled and is force-disabled in production.
  demoMode: isProduction ? false : bool('DEMO_MODE', false),

  // --- Routing / distance (PHASE 10) ---
  routing: {
    provider: process.env.ROUTING_PROVIDER || 'haversine', // google | osrm | haversine
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    osrmBaseUrl: process.env.OSRM_BASE_URL || 'https://router.project-osrm.org',
    // Multiplier applied to great-circle distance when using the `haversine`
    // provider, to approximate real road distance. Explicit, configured
    // fallback — NOT a random number.
    haversineRoadFactor: num('HAVERSINE_ROAD_FACTOR', 1.3),
    timeoutMs: num('ROUTING_TIMEOUT_MS', 5000),
  },

  // --- Payments (PHASE 11) ---
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    get enabled() {
      return Boolean(this.keyId && this.keySecret);
    },
  },

  // --- Notification providers ---
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    get enabled() {
      return Boolean(this.accountSid && this.authToken && this.phoneNumber);
    },
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num('SMTP_PORT', 587),
    secure: bool('SMTP_SECURE', false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    supportInbox: process.env.SUPPORT_INBOX || '',
    get enabled() {
      return Boolean(this.host && this.user && this.pass);
    },
  },

  // --- Dispatch (PHASE 19) ---
  dispatch: {
    searchRadiusMeters: num('DISPATCH_RADIUS_METERS', 15000),
    maxCandidates: num('DISPATCH_MAX_CANDIDATES', 10),
  },
};

/**
 * Payments cannot be silently disabled in production — that is exactly the
 * bypass this rebuild exists to remove.
 */
if (isProduction && !env.razorpay.enabled) {
  errors.push('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in production');
}
if (isProduction && !env.razorpay.webhookSecret) {
  errors.push('RAZORPAY_WEBHOOK_SECRET is required in production');
}
if (isProduction && env.routing.provider === 'haversine') {
  console.warn(
    '[env] ROUTING_PROVIDER=haversine in production. Distances are estimated ' +
    'from straight-line geometry, not real road routing. Configure google or osrm.'
  );
}
if (isProduction && env.routing.provider === 'google' && !env.routing.googleMapsApiKey) {
  errors.push('GOOGLE_MAPS_API_KEY is required when ROUTING_PROVIDER=google');
}

if (errors.length) {
  console.error('Invalid environment configuration:');
  for (const e of errors) console.error(`  - ${e}`);
  // Fail fast. A misconfigured auth/payment stack must not accept traffic.
  process.exit(1);
}

module.exports = env;
