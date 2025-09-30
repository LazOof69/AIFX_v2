/**
 * Error Handler Middleware
 * Unified error handling with consistent response format
 */

const AppError = require('../utils/AppError');

/**
 * Handle Sequelize validation errors
 *
 * @param {object} err - Sequelize validation error
 * @returns {AppError} Formatted application error
 */
const handleSequelizeValidationError = (err) => {
  const errors = err.errors.map(error => ({
    field: error.path,
    message: error.message,
    value: error.value,
  }));

  const message = `Validation failed: ${errors.map(e => e.message).join(', ')}`;
  return new AppError(message, 400, 'SEQUELIZE_VALIDATION_ERROR');
};

/**
 * Handle Sequelize unique constraint errors
 *
 * @param {object} err - Sequelize unique constraint error
 * @returns {AppError} Formatted application error
 */
const handleSequelizeUniqueConstraintError = (err) => {
  const field = err.errors[0]?.path || 'field';
  const value = err.errors[0]?.value || 'value';

  const message = `${field} '${value}' already exists`;
  return new AppError(message, 409, 'DUPLICATE_ENTRY');
};

/**
 * Handle Sequelize foreign key constraint errors
 *
 * @param {object} err - Sequelize foreign key constraint error
 * @returns {AppError} Formatted application error
 */
const handleSequelizeForeignKeyConstraintError = (err) => {
  const message = 'Referenced resource does not exist';
  return new AppError(message, 400, 'FOREIGN_KEY_CONSTRAINT');
};

/**
 * Handle Sequelize database connection errors
 *
 * @param {object} err - Sequelize connection error
 * @returns {AppError} Formatted application error
 */
const handleSequelizeConnectionError = (err) => {
  const message = 'Database connection failed';
  return new AppError(message, 503, 'DATABASE_CONNECTION_ERROR');
};

/**
 * Handle JWT errors
 *
 * @param {object} err - JWT error
 * @returns {AppError} Formatted application error
 */
const handleJWTError = (err) => {
  if (err.name === 'TokenExpiredError') {
    return new AppError('Token expired', 401, 'TOKEN_EXPIRED');
  }
  if (err.name === 'JsonWebTokenError') {
    return new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }
  if (err.name === 'NotBeforeError') {
    return new AppError('Token not active', 401, 'TOKEN_NOT_ACTIVE');
  }

  return new AppError('Token verification failed', 401, 'TOKEN_ERROR');
};

/**
 * Handle bcrypt errors
 *
 * @param {object} err - Bcrypt error
 * @returns {AppError} Formatted application error
 */
const handleBcryptError = (err) => {
  return new AppError('Password processing failed', 500, 'PASSWORD_ERROR');
};

/**
 * Handle Redis errors
 *
 * @param {object} err - Redis error
 * @returns {AppError} Formatted application error
 */
const handleRedisError = (err) => {
  if (err.code === 'ECONNREFUSED') {
    return new AppError('Cache service unavailable', 503, 'CACHE_CONNECTION_ERROR');
  }

  return new AppError('Cache service error', 500, 'CACHE_ERROR');
};

/**
 * Handle axios/HTTP errors
 *
 * @param {object} err - Axios error
 * @returns {AppError} Formatted application error
 */
const handleAxiosError = (err) => {
  if (err.code === 'ENOTFOUND') {
    return new AppError('External service unavailable', 503, 'EXTERNAL_SERVICE_UNAVAILABLE');
  }
  if (err.code === 'ECONNABORTED') {
    return new AppError('External service timeout', 504, 'EXTERNAL_SERVICE_TIMEOUT');
  }
  if (err.response) {
    const status = err.response.status;
    if (status === 429) {
      return new AppError('External service rate limit exceeded', 429, 'EXTERNAL_RATE_LIMIT');
    }
    if (status >= 400 && status < 500) {
      return new AppError('External service client error', 400, 'EXTERNAL_CLIENT_ERROR');
    }
    if (status >= 500) {
      return new AppError('External service server error', 502, 'EXTERNAL_SERVER_ERROR');
    }
  }

  return new AppError('External service error', 502, 'EXTERNAL_SERVICE_ERROR');
};

/**
 * Handle multer file upload errors
 *
 * @param {object} err - Multer error
 * @returns {AppError} Formatted application error
 */
const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File size too large', 413, 'FILE_TOO_LARGE');
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return new AppError('Too many files', 400, 'TOO_MANY_FILES');
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Unexpected file field', 400, 'UNEXPECTED_FILE');
  }

  return new AppError('File upload error', 400, 'FILE_UPLOAD_ERROR');
};

/**
 * Handle syntax errors (malformed JSON, etc.)
 *
 * @param {object} err - Syntax error
 * @returns {AppError} Formatted application error
 */
const handleSyntaxError = (err) => {
  if (err.type === 'entity.parse.failed') {
    return new AppError('Invalid JSON format', 400, 'INVALID_JSON');
  }

  return new AppError('Request format error', 400, 'SYNTAX_ERROR');
};

/**
 * Log error for debugging and monitoring
 *
 * @param {object} err - Error object
 * @param {object} req - Express request object
 */
const logError = (err, req) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
      statusCode: err.statusCode,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.userId || null,
    },
    environment: process.env.NODE_ENV,
  };

  // In production, you might want to send this to a logging service
  if (process.env.NODE_ENV === 'development') {
    console.error('🚨 ERROR:', JSON.stringify(errorLog, null, 2));
  } else {
    console.error('ERROR:', JSON.stringify(errorLog));
  }

  // Here you could integrate with external logging services like:
  // - Winston with external transports
  // - Sentry for error tracking
  // - CloudWatch for AWS
  // - Datadog for monitoring
};

/**
 * Send error response in standardized format
 *
 * @param {object} err - Error object
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const sendErrorResponse = (err, req, res) => {
  const { statusCode, message, code } = err;

  // Base response format (as per CLAUDE.md specification)
  const response = {
    success: false,
    data: null,
    error: message,
    timestamp: new Date().toISOString(),
  };

  // Add error code in development or for operational errors
  if (process.env.NODE_ENV === 'development' || err.isOperational) {
    response.code = code;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  // Add request ID if available (useful for debugging)
  if (req.requestId) {
    response.requestId = req.requestId;
  }

  res.status(statusCode).json(response);
};

/**
 * Main error handling middleware
 *
 * @param {object} err - Error object
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Handle different error types
  if (err.name === 'SequelizeValidationError') {
    error = handleSequelizeValidationError(err);
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    error = handleSequelizeUniqueConstraintError(err);
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    error = handleSequelizeForeignKeyConstraintError(err);
  } else if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeAccessDeniedError') {
    error = handleSequelizeConnectionError(err);
  } else if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
    error = handleJWTError(err);
  } else if (err.name === 'BcryptError') {
    error = handleBcryptError(err);
  } else if (err.code && err.code.startsWith('REDIS_')) {
    error = handleRedisError(err);
  } else if (err.isAxiosError) {
    error = handleAxiosError(err);
  } else if (err.name === 'MulterError') {
    error = handleMulterError(err);
  } else if (err.name === 'SyntaxError') {
    error = handleSyntaxError(err);
  } else if (!(error instanceof AppError)) {
    // Handle unknown errors
    error = new AppError(
      process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
      500,
      'INTERNAL_SERVER_ERROR'
    );
  }

  // Set default values if not set
  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';
  error.code = error.code || 'UNKNOWN_ERROR';

  // Log error
  logError(error, req);

  // Send response
  sendErrorResponse(error, req, res);
};

/**
 * Handle unhandled promise rejections
 *
 * @param {object} err - Error object
 */
const handleUnhandledRejection = (err) => {
  console.error('🚨 UNHANDLED PROMISE REJECTION:', err);

  // Close server gracefully
  process.exit(1);
};

/**
 * Handle uncaught exceptions
 *
 * @param {object} err - Error object
 */
const handleUncaughtException = (err) => {
  console.error('🚨 UNCAUGHT EXCEPTION:', err);

  // Close server gracefully
  process.exit(1);
};

/**
 * 404 Not Found handler
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {Function} next - Express next function
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

/**
 * Async error wrapper for route handlers
 *
 * @param {Function} fn - Async function
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleUnhandledRejection,
  handleUncaughtException,
  logError,
  sendErrorResponse,
};