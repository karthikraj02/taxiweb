/**
 * Per-file setup.
 *
 * Env vars are assigned BEFORE any application module is required, because
 * config/env.js validates and calls process.exit at require time.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_that_is_long_enough_for_production_rules';
process.env.COOKIE_SECRET = 'test_cookie_secret_that_is_long_enough_for_rules';
process.env.CSRF_SECRET = 'test_csrf_secret_that_is_long_enough_for_the_rules';
process.env.BCRYPT_ROUNDS = '4';            // keep the suite fast
process.env.ROUTING_PROVIDER = 'haversine'; // deterministic, no network calls
process.env.OTP_RESEND_COOLDOWN_SECONDS = '0';
process.env.DEMO_MODE = 'false';

const mongoose = require('mongoose');

const uri = process.env.__TEST_MONGO_URI__;

/**
 * `describeDb` registers a suite only when a database is available, so a
 * missing MongoDB produces an explicit skip in the report rather than a pass.
 */
global.dbAvailable = Boolean(uri);
global.describeDb = uri ? describe : describe.skip;

if (uri) {
  beforeAll(async () => {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(m => m.syncIndexes()));
  }, 60000);

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  }, 30000);
}
