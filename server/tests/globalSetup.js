/**
 * Runs once, before any test file is loaded.
 *
 * Determines whether a MongoDB instance is reachable and records the URI in
 * process.env so each test file can decide at load time whether to register
 * its database-backed suites. Doing this in setupFilesAfterEach would be too
 * late — `describe` blocks are registered as the file is required.
 */
module.exports = async () => {
  const explicitUri = process.env.MONGODB_TEST_URI;

  if (explicitUri) {
    process.env.__TEST_MONGO_URI__ = explicitUri;
    return;
  }

  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    global.__MONGOD__ = mongod;
    process.env.__TEST_MONGO_URI__ = mongod.getUri();
  } catch (err) {
    process.env.__TEST_MONGO_SKIP__ = err.message.split('\n')[0];
    if (process.env.REQUIRE_DB === 'true') {
      throw new Error(
        `Database-backed tests were required but MongoDB is unreachable: ${err.message}\n` +
        'Set MONGODB_TEST_URI to a running instance.'
      );
    }
    console.warn(
      '\n  \x1b[33mMongoDB unavailable — database-backed suites will be SKIPPED.\x1b[0m\n' +
      `  Reason: ${process.env.__TEST_MONGO_SKIP__}\n` +
      '  To run them: MONGODB_TEST_URI=mongodb://localhost:27017/taxiweb_test npm test\n'
    );
  }
};
