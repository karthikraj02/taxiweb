const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');
const dns = require('dns');

// Some development machines or networks block SRV DNS lookups used by
// MongoDB Atlas. In non-production environments override the DNS servers
// to reliable public resolvers so `resolveSrv` succeeds.
if (!env.isProduction) {
  try {
    dns.setServers(['1.1.1.1', '8.8.8.8']);
    logger.info('Overrode DNS servers for SRV resolution', { servers: dns.getServers() });
  } catch (err) {
    logger.warn('Failed to override DNS servers for SRV resolution', { error: String(err) });
  }
}

const DEFAULT_DB_NAME = 'taxiweb';

/**
 * Which database to use.
 *
 * A MongoDB URI with no database name (`...mongodb.net/?retryWrites=true`)
 * silently connects to a database called `test`, which is empty, so logins and
 * lookups find nothing and writes may be rejected. Prefer an explicit
 * MONGODB_DB, then the name in the URI, then a safe default.
 * Returns undefined when the URI already names a database.
 */
function resolveDbName(uri, explicit = process.env.MONGODB_DB) {
  if (explicit) return explicit;
  const namesDatabase = /^mongodb(?:\+srv)?:\/\/[^/]+\/[^/?]+/.test(uri || '');
  return namesDatabase ? undefined : DEFAULT_DB_NAME;
}

/**
 * Connect to MongoDB, retrying with backoff.
 *
 * If the database is unreachable after the retry budget the process exits.
 * Serving traffic without a database means every request fails while the
 * platform's health check still passes — a silent outage is worse than a
 * restart loop that is visible in the dashboard.
 */
async function connectDB(uri = env.mongoUri, { retries = 5, delayMs = 3000 } = {}) {
  mongoose.set('strictQuery', true);
  // NOTE: do not enable `sanitizeFilter` globally. It rewrites every nested
  // operator into a literal equality, which breaks this codebase's own queries
  // ($in, $ne, $nin, $gte, $exists) with a CastError. Operator injection is
  // closed off by the Zod validation in middleware/validate.js, which replaces
  // req.body/query/params before any handler builds a filter.

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const dbName = resolveDbName(uri);
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 20,
        ...(dbName ? { dbName } : {}),
      });
      logger.info('MongoDB connected');
      try {
        await require('../services/maintenance').dropLegacyIndexes();
      } catch (cleanupErr) {
        logger.error('Legacy index cleanup failed', { error: cleanupErr.message });
      }
      return mongoose.connection;
    } catch (err) {
      logger.error('MongoDB connection failed', { attempt, retriesLeft: retries - attempt, error: err.message });
      if (attempt === retries) {
        logger.error('Exhausted MongoDB connection retries — exiting');
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

module.exports = connectDB;
module.exports.resolveDbName = resolveDbName;
