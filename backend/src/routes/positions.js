/**
 * Position Routes
 * Handles position management endpoints
 * Part of Phase 3: Trading Lifecycle Management v3.0
 */

const express = require('express');
const positionController = require('../controllers/positionController');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Joi = require('joi');

const router = express.Router();

/**
 * Validation schemas
 */
const openPositionSchema = Joi.object({
  signalId: Joi.string().uuid().optional(),
  pair: Joi.string()
    .pattern(/^[A-Z]{3}\/[A-Z]{3}$/)
    .required()
    .messages({
      'string.pattern.base': 'Currency pair must be in format XXX/XXX (e.g., EUR/USD)',
    }),
  action: Joi.string().valid('buy', 'sell').required().messages({
    'any.only': 'Action must be either "buy" or "sell"',
  }),
  entryPrice: Joi.number().positive().required(),
  positionSize: Joi.number().min(0).max(100).optional(),
  stopLoss: Joi.number().positive().optional(),
  takeProfit: Joi.number().positive().optional(),
  notes: Joi.string().max(1000).optional(),
});

const closePositionSchema = Joi.object({
  positionId: Joi.string().uuid().required(),
  exitPrice: Joi.number().positive().required(),
  exitPercentage: Joi.number().min(1).max(100).default(100),
  notes: Joi.string().max(1000).optional(),
});

const adjustPositionSchema = Joi.object({
  stopLoss: Joi.number().positive().optional(),
  takeProfit: Joi.number().positive().optional(),
}).or('stopLoss', 'takeProfit');

const getUserPositionsSchema = Joi.object({
  status: Joi.string().valid('open', 'closed', 'all').default('all'),
  pair: Joi.string().pattern(/^[A-Z]{3}\/[A-Z]{3}$/).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  limit: Joi.number().min(1).max(100).default(50),
  offset: Joi.number().min(0).default(0),
});

/**
 * Validation middleware
 */
const validateOpenPosition = (req, res, next) => {
  const { error, value } = openPositionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      data: null,
      error: error.details[0].message,
      timestamp: new Date().toISOString(),
    });
  }
  req.body = value;
  next();
};

const validateClosePosition = (req, res, next) => {
  const { error, value } = closePositionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      data: null,
      error: error.details[0].message,
      timestamp: new Date().toISOString(),
    });
  }
  req.body = value;
  next();
};

const validateAdjustPosition = (req, res, next) => {
  const { error, value } = adjustPositionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      data: null,
      error: error.details[0].message,
      timestamp: new Date().toISOString(),
    });
  }
  req.body = value;
  next();
};

const validateGetUserPositions = (req, res, next) => {
  const { error, value } = getUserPositionsSchema.validate(req.query);
  if (error) {
    return res.status(400).json({
      success: false,
      data: null,
      error: error.details[0].message,
      timestamp: new Date().toISOString(),
    });
  }
  req.query = value;
  next();
};

/**
 * @route   POST /api/v1/positions/open
 * @desc    Open a new position
 * @access  Private
 * @example POST /api/v1/positions/open
 *          Body: {
 *            "pair": "EUR/USD",
 *            "action": "buy",
 *            "entryPrice": 1.0850,
 *            "positionSize": 15,
 *            "stopLoss": 1.0820,
 *            "takeProfit": 1.0900,
 *            "signalId": "optional-signal-id"
 *          }
 */
router.post('/open', authenticate, validateOpenPosition, asyncHandler(positionController.openPosition));

/**
 * @route   POST /api/v1/positions/close
 * @desc    Close an existing position
 * @access  Private
 * @example POST /api/v1/positions/close
 *          Body: {
 *            "positionId": "position-uuid",
 *            "exitPrice": 1.0895,
 *            "exitPercentage": 100,
 *            "notes": "Taking profit"
 *          }
 */
router.post('/close', authenticate, validateClosePosition, asyncHandler(positionController.closePosition));

/**
 * @route   PUT /api/v1/positions/:id/adjust
 * @desc    Adjust stop loss and/or take profit for a position
 * @access  Private
 * @example PUT /api/v1/positions/123e4567-e89b-12d3-a456-426614174000/adjust
 *          Body: {
 *            "stopLoss": 1.0860,
 *            "takeProfit": 1.0920
 *          }
 */
router.put('/:id/adjust', authenticate, validateAdjustPosition, asyncHandler(positionController.adjustPosition));

/**
 * @route   GET /api/v1/positions/:id
 * @desc    Get single position by ID with monitoring data
 * @access  Private
 * @example GET /api/v1/positions/123e4567-e89b-12d3-a456-426614174000?includeMonitoring=true&monitoringLimit=10
 */
router.get('/:id', authenticate, asyncHandler(positionController.getPosition));

/**
 * @route   GET /api/v1/positions/:id/monitor
 * @desc    Get monitoring history for a position
 * @access  Private
 * @example GET /api/v1/positions/123e4567-e89b-12d3-a456-426614174000/monitor?limit=100
 */
router.get('/:id/monitor', authenticate, asyncHandler(positionController.getMonitoringHistory));

/**
 * @route   GET /api/v1/positions/user/:userId
 * @desc    Get all positions for a user
 * @access  Private
 * @example GET /api/v1/positions/user/123e4567-e89b-12d3-a456-426614174000?status=open&pair=EUR/USD&limit=50&offset=0
 */
router.get(
  '/user/:userId',
  authenticate,
  validateGetUserPositions,
  asyncHandler(positionController.getUserPositions)
);

/**
 * @route   GET /api/v1/positions/user/:userId/statistics
 * @desc    Get position statistics for a user
 * @access  Private
 * @example GET /api/v1/positions/user/123e4567-e89b-12d3-a456-426614174000/statistics?startDate=2025-01-01&endDate=2025-12-31
 */
router.get('/user/:userId/statistics', authenticate, asyncHandler(positionController.getPositionStatistics));

/**
 * @route   GET /api/v1/positions/open
 * @desc    Get all open positions (admin only)
 * @access  Private (Admin)
 * @example GET /api/v1/positions/open?limit=1000
 */
router.get('/open', authenticate, asyncHandler(positionController.getAllOpenPositions));

module.exports = router;
