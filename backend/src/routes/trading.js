/**
 * Trading Routes
 * Handles trading signals, analysis, and trading history
 */

const express = require('express');
const tradingSignalService = require('../services/tradingSignalService');
const { authenticate, authenticateFlexible } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Joi = require('joi');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Validation schemas
 */
const signalParamSchema = Joi.object({
  pair: Joi.string()
    .pattern(/^[A-Z]{3}\/[A-Z]{3}$/)
    .required()
    .messages({
      'string.pattern.base': 'Currency pair must be in format XXX/XXX (e.g., EUR/USD)'
    })
});

const signalQuerySchema = Joi.object({
  timeframe: Joi.string()
    .valid('1min', '5min', '15min', '30min', '1h', '4h', '1d', '1w', '1M')
    .default('1h'),
  riskLevel: Joi.number().min(1).max(10).default(5)
});

const analyzeBodySchema = Joi.object({
  pairs: Joi.array()
    .items(Joi.string().pattern(/^[A-Z]{3}\/[A-Z]{3}$/))
    .min(1)
    .max(10)
    .required()
    .messages({
      'array.min': 'At least one currency pair is required',
      'array.max': 'Maximum 10 currency pairs allowed'
    }),
  timeframe: Joi.string()
    .valid('1min', '5min', '15min', '30min', '1h', '4h', '1d', '1w', '1M')
    .default('1h'),
  riskLevel: Joi.number().min(1).max(10).default(5)
});

const historyQuerySchema = Joi.object({
  pair: Joi.string().pattern(/^[A-Z]{3}\/[A-Z]{3}$/).optional(),
  signal: Joi.string().valid('buy', 'sell', 'hold').optional(),
  status: Joi.string().valid('active', 'triggered', 'stopped', 'expired', 'cancelled').optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  limit: Joi.number().min(1).max(100).default(50),
  offset: Joi.number().min(0).default(0)
});

/**
 * Validation middleware
 */
const validateSignalParams = (req, res, next) => {
  const { error } = signalParamSchema.validate(req.params);
  if (error) {
    return res.status(400).json({
      success: false,
      data: null,
      error: error.details[0].message,
      timestamp: new Date().toISOString()
    });
  }
  next();
};

const validateSignalQuery = (req, res, next) => {
  const { error, value } = signalQuerySchema.validate(req.query);
  if (error) {
    return res.status(400).json({
      success: false,
      data: null,
      error: error.details[0].message,
      timestamp: new Date().toISOString()
    });
  }
  req.query = value;
  next();
};

const validateAnalyzeBody = (req, res, next) => {
  const { error, value } = analyzeBodySchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      data: null,
      error: error.details[0].message,
      timestamp: new Date().toISOString()
    });
  }
  req.body = value;
  next();
};

const validateHistoryQuery = (req, res, next) => {
  const { error, value } = historyQuerySchema.validate(req.query);
  if (error) {
    return res.status(400).json({
      success: false,
      data: null,
      error: error.details[0].message,
      timestamp: new Date().toISOString()
    });
  }
  req.query = value;
  next();
};

/**
 * @route   GET /api/v1/trading/signal (query param version)
 * @desc    Get trading signal for a specific currency pair (Discord bot compatible)
 * @access  Private
 * @example GET /api/v1/trading/signal?pair=EUR/USD&timeframe=1h
 */
router.get(
  '/signal',
  authenticateFlexible,
  asyncHandler(async (req, res) => {
    const { pair, timeframe = '1h', riskLevel } = req.query;

    // Validate pair is provided
    if (!pair) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Currency pair is required (e.g., ?pair=EUR/USD)',
        timestamp: new Date().toISOString()
      });
    }

    // Validate pair format
    if (!pair.match(/^[A-Z]{3}\/[A-Z]{3}$/)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Currency pair must be in format XXX/XXX (e.g., EUR/USD)',
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`User ${req.user.id} requesting signal for ${pair}`);

    // Get user preferences
    const userPreferences = req.user.preferences || {};
    if (riskLevel) {
      userPreferences.riskLevel = parseInt(riskLevel);
    }

    // Generate trading signal
    const signal = await tradingSignalService.generateSignal(pair, {
      timeframe: timeframe,
      userPreferences: userPreferences,
      userId: req.user.id
    });

    res.status(200).json({
      success: true,
      data: {
        signal: signal,
        disclaimer: 'This is not financial advice. Trading involves significant risk of loss. Always do your own research and consult with a licensed financial advisor.',
        riskWarning: signal.riskWarning
      },
      error: null,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route   GET /api/v1/trading/signal/:pair (path param version - kept for compatibility)
 * @desc    Get trading signal for a specific currency pair
 * @access  Private
 * @example GET /api/v1/trading/signal/EUR%2FUSD?timeframe=1h&riskLevel=5
 */
router.get(
  '/signal/:pair',
  authenticateFlexible,
  validateSignalParams,
  validateSignalQuery,
  asyncHandler(async (req, res) => {
    const { pair } = req.params;
    const { timeframe, riskLevel } = req.query;

    logger.info(`User ${req.user.id} requesting signal for ${pair}`);

    // Get user preferences from request user object
    const userPreferences = req.user.preferences || {};

    // Override with query parameters
    if (riskLevel) {
      userPreferences.riskLevel = parseInt(riskLevel);
    }

    // Generate trading signal
    const signal = await tradingSignalService.generateSignal(pair, {
      timeframe: timeframe,
      userPreferences: userPreferences,
      userId: req.user.id
    });

    res.status(200).json({
      success: true,
      data: {
        signal: signal,
        disclaimer: 'This is not financial advice. Trading involves significant risk of loss. Always do your own research and consult with a licensed financial advisor.',
        riskWarning: signal.riskWarning
      },
      error: null,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route   POST /api/v1/trading/analyze
 * @desc    Analyze multiple currency pairs and return signals
 * @access  Private
 * @example POST /api/v1/trading/analyze
 *          Body: { "pairs": ["EUR/USD", "GBP/USD"], "timeframe": "1h", "riskLevel": 5 }
 */
router.post(
  '/analyze',
  authenticate,
  validateAnalyzeBody,
  asyncHandler(async (req, res) => {
    const { pairs, timeframe, riskLevel } = req.body;

    logger.info(`User ${req.user.id} requesting analysis for ${pairs.length} pairs`);

    // Get user preferences
    const userPreferences = req.user.preferences || {};

    // Override with request parameters
    if (riskLevel) {
      userPreferences.riskLevel = parseInt(riskLevel);
    }

    // Analyze multiple pairs
    const signals = await tradingSignalService.analyzeMultiplePairs(pairs, {
      timeframe: timeframe,
      userPreferences: userPreferences,
      userId: req.user.id
    });

    // Separate successful signals from errors
    const successfulSignals = signals.filter(s => !s.error);
    const failedPairs = signals.filter(s => s.error);

    res.status(200).json({
      success: true,
      data: {
        signals: successfulSignals,
        failed: failedPairs,
        summary: {
          total: pairs.length,
          successful: successfulSignals.length,
          failed: failedPairs.length,
          buySignals: successfulSignals.filter(s => s.signal === 'buy').length,
          sellSignals: successfulSignals.filter(s => s.signal === 'sell').length,
          holdSignals: successfulSignals.filter(s => s.signal === 'hold').length
        },
        disclaimer: 'This is not financial advice. Trading involves significant risk of loss. Always do your own research and consult with a licensed financial advisor.'
      },
      error: null,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route   GET /api/v1/trading/history
 * @desc    Get trading signal history for the authenticated user
 * @access  Private
 * @example GET /api/v1/trading/history?pair=EUR/USD&signal=buy&limit=20&offset=0
 */
router.get(
  '/history',
  authenticate,
  validateHistoryQuery,
  asyncHandler(async (req, res) => {
    const { pair, signal, status, startDate, endDate, limit, offset } = req.query;

    logger.info(`User ${req.user.id} requesting trading history`);

    // Build filters
    const filters = {
      pair,
      signal,
      status,
      startDate,
      endDate,
      limit,
      offset
    };

    // Get signal history
    const history = await tradingSignalService.getSignalHistory(req.user.id, filters);

    // Calculate statistics
    const stats = {
      totalSignals: history.length,
      activeSignals: history.filter(s => s.status === 'active').length,
      triggeredSignals: history.filter(s => s.status === 'triggered').length,
      buySignals: history.filter(s => s.signal === 'buy').length,
      sellSignals: history.filter(s => s.signal === 'sell').length,
      holdSignals: history.filter(s => s.signal === 'hold').length
    };

    res.status(200).json({
      success: true,
      data: {
        history: history,
        stats: stats,
        pagination: {
          limit: limit,
          offset: offset,
          total: history.length
        }
      },
      error: null,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route   GET /api/v1/trading/pairs
 * @desc    Get list of supported currency pairs
 * @access  Private
 */
router.get(
  '/pairs',
  authenticate,
  asyncHandler(async (req, res) => {
    // List of commonly traded forex pairs
    const majorPairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'];
    const minorPairs = ['EUR/GBP', 'EUR/AUD', 'EUR/JPY', 'GBP/JPY', 'CHF/JPY', 'AUD/JPY', 'AUD/NZD'];
    const exoticPairs = ['USD/TRY', 'USD/ZAR', 'USD/MXN', 'USD/SGD', 'USD/HKD'];

    res.status(200).json({
      success: true,
      data: {
        majorPairs: majorPairs,
        minorPairs: minorPairs,
        exoticPairs: exoticPairs,
        allPairs: [...majorPairs, ...minorPairs, ...exoticPairs],
        total: majorPairs.length + minorPairs.length + exoticPairs.length
      },
      error: null,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route   GET /api/v1/trading/timeframes
 * @desc    Get list of supported timeframes
 * @access  Private
 */
router.get(
  '/timeframes',
  authenticate,
  asyncHandler(async (req, res) => {
    const timeframes = [
      { value: '1min', label: '1 Minute', recommended: false },
      { value: '5min', label: '5 Minutes', recommended: false },
      { value: '15min', label: '15 Minutes', recommended: true },
      { value: '30min', label: '30 Minutes', recommended: true },
      { value: '1h', label: '1 Hour', recommended: true },
      { value: '4h', label: '4 Hours', recommended: true },
      { value: '1d', label: '1 Day', recommended: true },
      { value: '1w', label: '1 Week', recommended: false },
      { value: '1M', label: '1 Month', recommended: false }
    ];

    res.status(200).json({
      success: true,
      data: {
        timeframes: timeframes,
        default: '1h'
      },
      error: null,
      timestamp: new Date().toISOString()
    });
  })
);

module.exports = router;