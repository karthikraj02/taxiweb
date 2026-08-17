const env = require('../config/env');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Consistent error envelope (PHASE 29).
 *
 *   { success: false, error: { code, message, details? }, requestId }
 *
 * Production never leaks stack traces or raw driver messages. Unexpected
 * errors return a generic message; the detail goes to the log with the same
 * requestId so it can be correlated.
 */
function errorHandler(err, req, res, _next) {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong. Please try again.';
  let details;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ZodError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Some of the submitted values are invalid.';
    details = err.issues?.map(i => ({ field: i.path.join('.'), message: i.message }));
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Some of the submitted values are invalid.';
    details = Object.values(err.errors || {}).map(e => ({ field: e.path, message: e.message }));
  } else if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    message = `That ${field} is already registered.`;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'The supplied identifier is not valid.';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Your session is invalid or has expired.';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'The submitted data is too large.';
  } else if (err.code === 'EBADCSRFTOKEN' || err.code === 'ECSRFTOKEN' || /csrf/i.test(err.message || '')) {
    statusCode = 403;
    code = 'CSRF_FAILED';
    message = 'Your session could not be verified. Please refresh the page and try again.';
  } else if (err.message === 'NOT_ALLOWED_BY_CORS') {
    statusCode = 403;
    code = 'ORIGIN_NOT_ALLOWED';
    message = 'This origin is not permitted to call the API.';
  }

  const logPayload = {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code,
    error: err.message,
  };
  if (statusCode >= 500) {
    logger.error('Unhandled request error', { ...logPayload, stack: err.stack });
  } else {
    logger.warn('Request failed', logPayload);
  }

  const body = {
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
    requestId: req.id,
  };
  // Stack traces only outside production, and only for genuine 500s.
  if (!env.isProduction && statusCode >= 500) {
    body.error.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

/** 404 for unmatched routes, in the same envelope. */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'ROUTE_NOT_FOUND', message: `No route matches ${req.method} ${req.originalUrl}` },
    requestId: req.id,
  });
}

module.exports = errorHandler;
module.exports.errorHandler = errorHandler;
module.exports.notFoundHandler = notFoundHandler;
