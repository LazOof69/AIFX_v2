/**
 * Custom application error class for standardized error handling
 *
 * @class AppError
 * @extends Error
 */
class AppError extends Error {
  /**
   * Creates an instance of AppError
   *
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Application specific error code
   */
  constructor(message, statusCode, code) {
    super(message);

    this.statusCode = statusCode;
    this.code = code;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;