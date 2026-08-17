const crypto = require('crypto');

/** Attaches a correlation id to every request, surfaced in errors and audit logs. */
module.exports = function requestId(req, res, next) {
  req.id = req.get('x-request-id') || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
};
