/**
 * Typed application errors with stable machine-readable codes (PHASE 29).
 * Handlers throw these; the error middleware renders a consistent envelope.
 */
class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const badRequest    = (code, message, details) => new AppError(400, code, message, details);
const unauthorized  = (code = 'UNAUTHENTICATED', message = 'Authentication required') => new AppError(401, code, message);
const forbidden     = (code = 'FORBIDDEN', message = 'You do not have access to this resource') => new AppError(403, code, message);
const notFound      = (code = 'NOT_FOUND', message = 'Resource not found') => new AppError(404, code, message);
const conflict      = (code, message) => new AppError(409, code, message);
const tooManyReq    = (code = 'RATE_LIMITED', message = 'Too many requests') => new AppError(429, code, message);
const serverError   = (code = 'INTERNAL_ERROR', message = 'Internal server error') => new AppError(500, code, message);
const unavailable   = (code = 'SERVICE_UNAVAILABLE', message = 'Upstream service unavailable') => new AppError(503, code, message);

module.exports = {
  AppError,
  badRequest, unauthorized, forbidden, notFound,
  conflict, tooManyReq, serverError, unavailable,
};
