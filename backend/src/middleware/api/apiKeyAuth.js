/**
 * API Key Authentication Middleware
 * For service-to-service authentication (Discord Bot, ML Engine)
 *
 * This middleware validates API keys for microservices communication
 * as defined in the microservices architecture principles (CLAUDE.md)
 */

const AppError = require('../../utils/AppError');

/**
 * Valid API keys for each service
 * In production, these should be stored in environment variables
 * and potentially in a database with metadata (rate limits, permissions, etc.)
 */
const API_KEYS = {
  DISCORD_BOT: process.env.DISCORD_BOT_API_KEY || 'dev_discord_bot_key_replace_in_production',
  LINE_BOT: process.env.LINE_BOT_API_KEY || 'dev_line_bot_key_replace_in_production',
  ML_ENGINE: process.env.ML_ENGINE_API_KEY || 'dev_ml_engine_key_replace_in_production',
};

/**
 * Service names mapped to their API keys
 */
const SERVICE_NAMES = {
  [API_KEYS.DISCORD_BOT]: 'discord-bot',
  [API_KEYS.LINE_BOT]: 'line-bot',
  [API_KEYS.ML_ENGINE]: 'ml-engine',
};

/**
 * Rate limits per service (requests per minute)
 */
const RATE_LIMITS = {
  'discord-bot': 500,
  'line-bot': 500,
  'ml-engine': 1000,
};

/**
 * API Key Authentication Middleware
 *
 * Expected header format:
 * Authorization: Bearer <API_KEY>
 * X-Service-Name: discord-bot (optional, for logging)
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const apiKeyAuth = (req, res, next) => {
  try {
    // Extract Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AppError('Missing Authorization header', 401, 'UNAUTHORIZED');
    }

    // Check Bearer format
    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError('Invalid Authorization header format. Expected: Bearer <API_KEY>', 401, 'INVALID_AUTH_FORMAT');
    }

    // Extract API key
    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!apiKey) {
      throw new AppError('Missing API key', 401, 'MISSING_API_KEY');
    }

    // Validate API key
    const serviceName = SERVICE_NAMES[apiKey];

    if (!serviceName) {
      throw new AppError('Invalid API key', 403, 'INVALID_API_KEY');
    }

    // Attach service information to request
    req.service = {
      name: serviceName,
      apiKey: apiKey,
      rateLimit: RATE_LIMITS[serviceName] || 100,
    };

    // Optional: Verify X-Service-Name header matches
    const declaredServiceName = req.headers['x-service-name'];
    if (declaredServiceName && declaredServiceName !== serviceName) {
      console.warn(`Service name mismatch: declared=${declaredServiceName}, actual=${serviceName}`);
    }

    // Log API access for monitoring
    console.log(`[API Auth] Service: ${serviceName}, Path: ${req.method} ${req.path}, IP: ${req.ip}`);

    next();
  } catch (error) {
    // If error is already AppError, pass it through
    if (error instanceof AppError) {
      return next(error);
    }

    // Otherwise, create a generic auth error
    next(new AppError('Authentication failed', 401, 'AUTH_FAILED'));
  }
};

/**
 * Service-specific rate limiter
 * Creates a rate limiter with service-specific limits
 *
 * @param {Object} options - Rate limiter options
 * @returns {Function} Express rate limiter middleware
 */
const serviceRateLimit = (options = {}) => {
  const rateLimit = require('express-rate-limit');

  return rateLimit({
    windowMs: options.windowMs || 60 * 1000, // 1 minute
    max: (req) => {
      // Use service-specific rate limit if authenticated
      if (req.service && req.service.rateLimit) {
        return req.service.rateLimit;
      }
      // Default limit for unauthenticated requests
      return options.max || 100;
    },
    message: {
      success: false,
      data: null,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this service, please try again later',
      },
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Use service name for rate limiting key (instead of IP)
    keyGenerator: (req) => {
      if (req.service) {
        return `service:${req.service.name}`;
      }
      return req.ip;
    },
  });
};

/**
 * Middleware to check if request is from a specific service
 *
 * @param {string|string[]} allowedServices - Service name(s) allowed
 * @returns {Function} Express middleware
 */
const requireService = (allowedServices) => {
  const allowed = Array.isArray(allowedServices) ? allowedServices : [allowedServices];

  return (req, res, next) => {
    if (!req.service) {
      return next(new AppError('Service authentication required', 401, 'SERVICE_AUTH_REQUIRED'));
    }

    if (!allowed.includes(req.service.name)) {
      return next(new AppError(
        `Access forbidden. This endpoint is only available to: ${allowed.join(', ')}`,
        403,
        'FORBIDDEN_SERVICE'
      ));
    }

    next();
  };
};

/**
 * Generate a new API key (for administrative purposes)
 *
 * @param {string} serviceName - Name of the service
 * @returns {string} Generated API key
 */
const generateApiKey = (serviceName) => {
  const crypto = require('crypto');
  const prefix = serviceName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const randomPart = crypto.randomBytes(32).toString('hex');
  return `${prefix}_${randomPart}`;
};

/**
 * Validate API key format
 *
 * @param {string} apiKey - API key to validate
 * @returns {boolean} Whether the API key format is valid
 */
const isValidApiKeyFormat = (apiKey) => {
  // API keys should be at least 32 characters long
  if (!apiKey || apiKey.length < 32) {
    return false;
  }

  // Should contain only alphanumeric and underscore
  return /^[a-z0-9_]+$/i.test(apiKey);
};

module.exports = {
  apiKeyAuth,
  serviceRateLimit,
  requireService,
  generateApiKey,
  isValidApiKeyFormat,
  API_KEYS, // Export for testing purposes
  SERVICE_NAMES, // Export for testing purposes
};
