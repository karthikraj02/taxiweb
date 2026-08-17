const { badRequest } = require('../utils/errors');

/**
 * Zod-backed request validation (PHASE 28).
 *
 * Validated output REPLACES req.body/query/params, so downstream handlers see
 * only stripped, coerced, known-good fields. This also closes the NoSQL
 * operator-injection hole: a body of `{ email: { $ne: null } }` fails the
 * string check instead of reaching `findOne`.
 */
function validate({ body, query, params }) {
  return (req, res, next) => {
    try {
      if (body) req.body = body.parse(req.body ?? {});
      if (query) {
        const parsed = query.parse(req.query ?? {});
        // req.query is a getter-only property on Express 5; assign field-wise.
        Object.defineProperty(req, 'validatedQuery', { value: parsed, writable: true, configurable: true });
        req.query = parsed;
      }
      if (params) req.params = params.parse(req.params ?? {});
      next();
    } catch (err) {
      if (err.name === 'ZodError') {
        return next(badRequest(
          'VALIDATION_ERROR',
          'Some of the submitted values are invalid.',
          err.issues.map(i => ({ field: i.path.join('.') || '(root)', message: i.message }))
        ));
      }
      next(err);
    }
  };
}

module.exports = { validate };
