/**
 * Authentication Middleware
 * JWT token verification and user authentication
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

/**
 * Verify JWT token and authenticate user
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {Promise<void>}
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next(new AppError('Authorization header missing', 401, 'AUTH_HEADER_MISSING'));
    }

    if (!authHeader.startsWith('Bearer ')) {
      return next(new AppError('Invalid authorization header format', 401, 'INVALID_AUTH_FORMAT'));
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return next(new AppError('Access token missing', 401, 'TOKEN_MISSING'));
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'aifx-v2',
        audience: 'aifx-v2-users',
      });
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return next(new AppError('Access token expired', 401, 'TOKEN_EXPIRED'));
      } else if (jwtError.name === 'JsonWebTokenError') {
        return next(new AppError('Invalid access token', 401, 'INVALID_TOKEN'));
      } else {
        return next(new AppError('Token verification failed', 401, 'TOKEN_VERIFICATION_FAILED'));
      }
    }

    // Check if user still exists
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return next(new AppError('User no longer exists', 401, 'USER_NOT_FOUND'));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new AppError('User account is deactivated', 401, 'ACCOUNT_DEACTIVATED'));
    }

    // Check if user is verified (optional based on requirements)
    if (!user.isVerified) {
      return next(new AppError('User account is not verified', 401, 'ACCOUNT_NOT_VERIFIED'));
    }

    // Attach user to request object
    req.user = user.toSafeObject();
    req.userId = user.id;

    next();
  } catch (error) {
    next(new AppError('Authentication failed', 500, 'AUTH_ERROR'));
  }
};

/**
 * Optional authentication middleware
 * Sets user if token is valid, but doesn't block if no token
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {Promise<void>}
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);

    if (!token) {
      return next(); // Continue without authentication
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.userId);

      if (user && user.isActive && user.isVerified) {
        req.user = user.toSafeObject();
        req.userId = user.id;
      }
    } catch (jwtError) {
      // Ignore JWT errors in optional authentication
    }

    next();
  } catch (error) {
    next(); // Continue even if there's an error
  }
};

/**
 * Generate JWT access token
 *
 * @param {object} payload - Token payload
 * @param {string} expiresIn - Token expiration time
 * @returns {string} JWT token
 */
const generateAccessToken = (payload, expiresIn = null) => {
  const expiry = expiresIn || process.env.JWT_EXPIRES_IN || '1h';

  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {
      expiresIn: expiry,
      issuer: 'aifx-v2',
      audience: 'aifx-v2-users',
    }
  );
};

/**
 * Generate JWT refresh token
 *
 * @param {object} payload - Token payload
 * @param {string} expiresIn - Token expiration time
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (payload, expiresIn = null) => {
  const expiry = expiresIn || process.env.JWT_REFRESH_EXPIRES_IN || '30d';

  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: expiry,
      issuer: 'aifx-v2',
      audience: 'aifx-v2-users',
    }
  );
};

/**
 * Verify refresh token
 *
 * @param {string} token - Refresh token
 * @returns {object} Decoded token payload
 * @throws {Error} If token is invalid
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

/**
 * Middleware to check if user has specific role (if implemented)
 *
 * @param {...string} roles - Required roles
 * @returns {Function} Express middleware function
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }

    // If roles are implemented in User model
    if (req.user.role && !roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
    }

    next();
  };
};

/**
 * Middleware to check if user owns the resource
 *
 * @param {string} userIdField - Field name containing user ID (default: 'userId')
 * @returns {Function} Express middleware function
 */
const requireOwnership = (userIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }

    const resourceUserId = req.params[userIdField] || req.body[userIdField];

    if (!resourceUserId) {
      return next(new AppError(`${userIdField} parameter required`, 400, 'USER_ID_REQUIRED'));
    }

    if (req.userId !== resourceUserId) {
      return next(new AppError('Access denied: resource ownership required', 403, 'OWNERSHIP_REQUIRED'));
    }

    next();
  };
};

/**
 * Rate limiting for authentication endpoints
 *
 * @param {number} maxAttempts - Maximum attempts per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} Express middleware function
 */
const authRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const clientId = req.ip + (req.user ? req.user.id : '');
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old attempts
    for (const [key, value] of attempts.entries()) {
      if (value.timestamp < windowStart) {
        attempts.delete(key);
      }
    }

    // Check current attempts
    const clientAttempts = Array.from(attempts.values())
      .filter(attempt =>
        attempt.clientId === clientId &&
        attempt.timestamp > windowStart
      );

    if (clientAttempts.length >= maxAttempts) {
      return next(new AppError(
        'Too many authentication attempts, please try again later',
        429,
        'AUTH_RATE_LIMIT'
      ));
    }

    // Record this attempt
    attempts.set(`${clientId}-${now}`, {
      clientId,
      timestamp: now,
    });

    next();
  };
};

/**
 * Extract user ID from JWT token without full authentication
 *
 * @param {string} token - JWT token
 * @returns {string|null} User ID or null if invalid
 */
const extractUserIdFromToken = (token) => {
  try {
    const decoded = jwt.decode(token);
    return decoded?.userId || null;
  } catch (error) {
    return null;
  }
};

/**
 * Middleware to validate API key (for external integrations)
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return next(new AppError('API key required', 401, 'API_KEY_REQUIRED'));
  }

  // For now, check against environment variable
  // In production, this should check against a database of valid API keys
  if (apiKey !== process.env.API_KEY) {
    return next(new AppError('Invalid API key', 401, 'INVALID_API_KEY'));
  }

  next();
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  requireRole,
  requireOwnership,
  authRateLimit,
  extractUserIdFromToken,
  validateApiKey,
};