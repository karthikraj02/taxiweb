/**
 * Minimal structured logger with hard redaction (PHASE 55).
 *
 * Anything whose key looks like a credential is replaced before serialisation,
 * so an accidental `logger.info('login', req.body)` cannot leak a password.
 */
const env = require('../config/env');

const REDACT_KEYS = [
  'password', 'newpassword', 'currentpassword', 'confirmpassword',
  'otp', 'otphash', 'token', 'accesstoken', 'refreshtoken', 'driveraccesstoken',
  'authorization', 'cookie', 'jwt', 'secret', 'apikey', 'api_key',
  'razorpaysignature', 'razorpay_signature', 'keysecret', 'key_secret',
  'webhooksecret', 'signature', 'card', 'cardnumber', 'cvv', 'pan',
];

function redact(value, depth = 0) {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (REDACT_KEYS.includes(key.toLowerCase())) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = redact(val, depth + 1);
    }
  }
  return out;
}

function emit(level, message, meta) {
  if (env.isTest && level !== 'error') return;
  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...(meta ? { meta: redact(meta) } : {}),
  };
  const line = env.isProduction ? JSON.stringify(entry) : `[${level}] ${message}${meta ? ' ' + JSON.stringify(redact(meta)) : ''}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

module.exports = {
  debug: (m, meta) => { if (!env.isProduction) emit('debug', m, meta); },
  info: (m, meta) => emit('info', m, meta),
  warn: (m, meta) => emit('warn', m, meta),
  error: (m, meta) => emit('error', m, meta),
  redact,
};
