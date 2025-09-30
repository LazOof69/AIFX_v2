/**
 * Validation Middleware
 * Request validation using Joi schemas
 */

const Joi = require('joi');
const AppError = require('../utils/AppError');

/**
 * Generic validation middleware factory
 *
 * @param {object} schema - Joi validation schema
 * @param {string} property - Request property to validate ('body', 'params', 'query')
 * @returns {Function} Express middleware function
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));

      return next(new AppError(
        `Validation failed: ${errors.map(e => e.message).join(', ')}`,
        400,
        'VALIDATION_ERROR'
      ));
    }

    // Replace request property with validated and sanitized value
    req[property] = value;
    next();
  };
};

// Common validation schemas

/**
 * Currency pair validation schema
 */
const currencyPairSchema = Joi.string()
  .pattern(/^[A-Z]{3}\/[A-Z]{3}$/)
  .required()
  .messages({
    'string.pattern.base': 'Currency pair must be in format XXX/YYY (e.g., EUR/USD)',
  });

/**
 * Timeframe validation schema
 */
const timeframeSchema = Joi.string()
  .valid('1min', '5min', '15min', '30min', '1h', '4h', '1d', '1w', '1M')
  .required();

/**
 * UUID validation schema
 */
const uuidSchema = Joi.string()
  .uuid({ version: ['uuidv4'] })
  .required();

/**
 * User registration validation schema
 */
const userRegistrationSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
    }),
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(50)
    .required()
    .messages({
      'string.alphanum': 'Username must only contain letters and numbers',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must be no more than 50 characters long',
    }),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Password confirmation does not match password',
    }),
  firstName: Joi.string()
    .max(50)
    .optional(),
  lastName: Joi.string()
    .max(50)
    .optional(),
});

/**
 * User login validation schema
 */
const userLoginSchema = Joi.object({
  identifier: Joi.string()
    .required()
    .messages({
      'any.required': 'Email or username is required',
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required',
    }),
});

/**
 * Trading preferences validation schema
 */
const tradingPreferencesSchema = Joi.object({
  tradingFrequency: Joi.string()
    .valid('scalping', 'daytrading', 'swing', 'position')
    .optional(),
  riskLevel: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .optional(),
  preferredPairs: Joi.array()
    .items(currencyPairSchema.optional())
    .min(1)
    .max(20)
    .optional()
    .messages({
      'array.min': 'At least one preferred pair is required',
      'array.max': 'Maximum 20 preferred pairs allowed',
    }),
  tradingStyle: Joi.string()
    .valid('trend', 'counter-trend', 'mixed')
    .optional(),
  indicators: Joi.object({
    sma: Joi.object({
      enabled: Joi.boolean().required(),
      period: Joi.number().integer().min(1).max(200).when('enabled', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
    }).optional(),
    rsi: Joi.object({
      enabled: Joi.boolean().required(),
      period: Joi.number().integer().min(2).max(100).when('enabled', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
    }).optional(),
    macd: Joi.object({
      enabled: Joi.boolean().required(),
      fastPeriod: Joi.number().integer().min(1).max(50).when('enabled', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      slowPeriod: Joi.number().integer().min(1).max(100).when('enabled', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      signalPeriod: Joi.number().integer().min(1).max(50).when('enabled', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
    }).optional(),
    bollinger: Joi.object({
      enabled: Joi.boolean().required(),
      period: Joi.number().integer().min(2).max(100).when('enabled', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      standardDeviations: Joi.number().min(0.1).max(5).when('enabled', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
    }).optional(),
    stochastic: Joi.object({
      enabled: Joi.boolean().required(),
      kPeriod: Joi.number().integer().min(1).max(100).when('enabled', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      dPeriod: Joi.number().integer().min(1).max(50).when('enabled', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
    }).optional(),
  }).optional(),
  notificationSettings: Joi.object({
    enableSignals: Joi.boolean().optional(),
    enableMarketUpdates: Joi.boolean().optional(),
    enableNewsAlerts: Joi.boolean().optional(),
    maxSignalsPerDay: Joi.number().integer().min(1).max(100).optional(),
    signalStrengthThreshold: Joi.number().min(0).max(1).optional(),
  }).optional(),
});

/**
 * Trading signal creation validation schema
 */
const tradingSignalSchema = Joi.object({
  pair: currencyPairSchema,
  timeframe: timeframeSchema,
  signal: Joi.string()
    .valid('buy', 'sell', 'hold')
    .required(),
  confidence: Joi.number()
    .min(0)
    .max(1)
    .required(),
  factors: Joi.object({
    technical: Joi.number().min(0).max(1).required(),
    sentiment: Joi.number().min(0).max(1).required(),
    pattern: Joi.number().min(0).max(1).required(),
  }).required(),
  entryPrice: Joi.number()
    .positive()
    .required(),
  stopLoss: Joi.number()
    .positive()
    .optional(),
  takeProfit: Joi.number()
    .positive()
    .optional(),
  positionSize: Joi.number()
    .min(0)
    .max(100)
    .optional(),
  source: Joi.string()
    .valid('ml_engine', 'technical_analysis', 'manual', 'hybrid')
    .optional(),
  signalStrength: Joi.string()
    .valid('weak', 'moderate', 'strong', 'very_strong')
    .optional(),
  marketCondition: Joi.string()
    .valid('trending', 'ranging', 'volatile', 'calm')
    .optional(),
  expiresAt: Joi.date()
    .greater('now')
    .optional(),
});

/**
 * Market data query validation schema
 */
const marketDataQuerySchema = Joi.object({
  pair: currencyPairSchema,
  timeframe: timeframeSchema.optional(),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .optional()
    .default(100),
  startDate: Joi.date()
    .optional(),
  endDate: Joi.date()
    .greater(Joi.ref('startDate'))
    .optional(),
  includeIndicators: Joi.boolean()
    .optional()
    .default(false),
});

/**
 * Pagination validation schema
 */
const paginationSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .optional()
    .default(1),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .default(20),
  sortBy: Joi.string()
    .optional()
    .default('createdAt'),
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .optional()
    .default('desc'),
});

/**
 * Refresh token validation schema
 */
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Refresh token is required',
    }),
});

/**
 * Password reset validation schema
 */
const passwordResetSchema = Joi.object({
  email: Joi.string()
    .email()
    .required(),
});

/**
 * Password change validation schema
 */
const passwordChangeSchema = Joi.object({
  currentPassword: Joi.string()
    .required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'New password must be at least 8 characters long',
      'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Password confirmation does not match new password',
    }),
});

/**
 * Notification settings validation schema
 */
const notificationSettingsSchema = Joi.object({
  discordUserId: Joi.string()
    .optional()
    .allow(null, ''),
  enableSignals: Joi.boolean()
    .optional(),
  enableMarketUpdates: Joi.boolean()
    .optional(),
  enableNewsAlerts: Joi.boolean()
    .optional(),
  maxSignalsPerDay: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional(),
  signalStrengthThreshold: Joi.number()
    .min(0)
    .max(1)
    .optional(),
});

// Export validation middleware functions
const validateUserRegistration = validate(userRegistrationSchema, 'body');
const validateUserLogin = validate(userLoginSchema, 'body');
const validateTradingPreferences = validate(tradingPreferencesSchema, 'body');
const validateTradingSignal = validate(tradingSignalSchema, 'body');
const validateMarketDataQuery = validate(marketDataQuerySchema, 'query');
const validatePagination = validate(paginationSchema, 'query');
const validateRefreshToken = validate(refreshTokenSchema, 'body');
const validatePasswordReset = validate(passwordResetSchema, 'body');
const validatePasswordChange = validate(passwordChangeSchema, 'body');
const validateNotificationSettings = validate(notificationSettingsSchema, 'body');

// Parameter validation
const validateUuidParam = (paramName = 'id') => {
  return validate(Joi.object({
    [paramName]: uuidSchema,
  }), 'params');
};

const validateCurrencyPairParam = validate(Joi.object({
  pair: currencyPairSchema,
}), 'params');

module.exports = {
  validate,
  validateUserRegistration,
  validateUserLogin,
  validateTradingPreferences,
  validateTradingSignal,
  validateMarketDataQuery,
  validatePagination,
  validateRefreshToken,
  validatePasswordReset,
  validatePasswordChange,
  validateNotificationSettings,
  validateUuidParam,
  validateCurrencyPairParam,

  // Export schemas for custom validation
  schemas: {
    userRegistrationSchema,
    userLoginSchema,
    tradingPreferencesSchema,
    tradingSignalSchema,
    marketDataQuerySchema,
    paginationSchema,
    refreshTokenSchema,
    passwordResetSchema,
    passwordChangeSchema,
    notificationSettingsSchema,
    currencyPairSchema,
    timeframeSchema,
    uuidSchema,
  },
};