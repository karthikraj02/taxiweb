const mongoose = require('mongoose');
const logger = require('../utils/logger');
// Ensure the schema is registered before we ask mongoose.model() for it: this
// runs right after connect(), before the route files (which are what
// normally pull models in) have necessarily been required.
require('../models/RefreshToken');

/**
 * One-time cleanup for indexes left over from the pre-rebuild schema.
 *
 * RefreshToken used to store a plaintext `token` field with a unique index.
 * The rebuilt schema replaced it with `tokenHash` and never sets `token`, but
 * the physical Mongo index survived the schema change (Mongoose does not drop
 * indexes on its own). With the field always missing, every document after
 * the very first one collides on the implicit `{ token: null }` duplicate,
 * so every second login/register/OTP-verify anywhere in the app failed with
 * "That token is already registered." (E11000 on refreshtokens.token_1).
 *
 * This finds and drops any index keyed on a field the current schema no
 * longer defines, by comparing to what Mongoose would build. Safe to call on
 * every connection (cold start or long-running): listing + dropping an index
 * that no longer matches the schema is quick and never touches data, and a
 * missing index is not an error.
 */
async function dropLegacyIndexes() {
  const collection = mongoose.connection.collection('refreshtokens');
  let existing;
  try {
    existing = await collection.indexes();
  } catch (err) {
    // Collection does not exist yet on a brand-new database — nothing to clean up.
    if (err.codeName === 'NamespaceNotFound') return;
    throw err;
  }

  const schemaFields = new Set(Object.keys(mongoose.model('RefreshToken').schema.paths));
  for (const index of existing) {
    if (index.name === '_id_') continue;
    const keyFields = Object.keys(index.key);
    const isLegacy = keyFields.some((f) => !schemaFields.has(f));
    if (!isLegacy) continue;
    try {
      await collection.dropIndex(index.name);
      logger.warn('Dropped legacy index no longer used by the schema', { collection: 'refreshtokens', index: index.name, keys: index.key });
    } catch (err) {
      logger.error('Failed to drop legacy index', { index: index.name, error: err.message });
    }
  }
}

module.exports = { dropLegacyIndexes };
