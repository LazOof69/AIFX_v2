/**
 * Notifications Routes
 * Handles notification subscriptions and preferences
 */

const express = require('express');
const notificationService = require('../services/notificationService');
const { asyncHandler } = require('../middleware/errorHandler');
const Joi = require('joi');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Validation schemas
 */
const subscribeSchema = Joi.object({
  discordUserId: Joi.string().required(),
  discordUsername: Joi.string().required(),
  pair: Joi.string()
    .pattern(/^[A-Z]{3}\/[A-Z]{3}$/)
    .required()
    .messages({
      'string.pattern.base': 'Currency pair must be in format XXX/XXX'
    }),
  signalType: Joi.string()
    .valid('all', 'buy', 'sell', 'strong')
    .default('all'),
  channel: Joi.string().valid('discord').default('discord')
});

const unsubscribeSchema = Joi.object({
  discordUserId: Joi.string().required(),
  discordUsername: Joi.string().optional(),
  pair: Joi.string().default('all')
});

const preferencesSchema = Joi.object({
  discordUserId: Joi.string().required(),
  discordUsername: Joi.string().optional(),
  preferences: Joi.object({
    riskLevel: Joi.number().min(1).max(10).optional(),
    tradingStyle: Joi.string().valid('trend', 'counter-trend', 'mixed').optional(),
    minConfidence: Joi.number().min(0).max(1).optional(),
    strongSignalsOnly: Joi.boolean().optional()
  }).required()
});

/**
 * Validation middleware
 */
const validateSubscribe = (req, res, next) => {
  const { error, value } = subscribeSchema.validate(req.body);
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

const validateUnsubscribe = (req, res, next) => {
  const { error, value } = unsubscribeSchema.validate(req.body);
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

const validatePreferences = (req, res, next) => {
  const { error, value } = preferencesSchema.validate(req.body);
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

/**
 * @route   POST /api/v1/notifications/subscribe
 * @desc    Subscribe to trading signal notifications
 * @access  Public (called from Discord bot)
 */
router.post(
  '/subscribe',
  validateSubscribe,
  asyncHandler(async (req, res) => {
    const result = await notificationService.subscribe(req.body);

    res.status(200).json({
      success: true,
      data: result,
      error: null,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route   POST /api/v1/notifications/unsubscribe
 * @desc    Unsubscribe from trading signal notifications
 * @access  Public (called from Discord bot)
 */
router.post(
  '/unsubscribe',
  validateUnsubscribe,
  asyncHandler(async (req, res) => {
    const result = await notificationService.unsubscribe(req.body);

    res.status(200).json({
      success: true,
      data: result,
      error: null,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route   POST /api/v1/notifications/preferences
 * @desc    Update notification preferences
 * @access  Public (called from Discord bot)
 */
router.post(
  '/preferences',
  validatePreferences,
  asyncHandler(async (req, res) => {
    const result = await notificationService.updatePreferences(req.body);

    res.status(200).json({
      success: true,
      data: result,
      error: null,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route   GET /api/v1/notifications/preferences/:discordUserId
 * @desc    Get user preferences
 * @access  Public (called from Discord bot)
 */
router.get(
  '/preferences/:discordUserId',
  asyncHandler(async (req, res) => {
    const { discordUserId } = req.params;

    const result = await notificationService.getPreferences(discordUserId);

    res.status(200).json({
      success: true,
      data: result,
      error: null,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route   GET /api/v1/notifications/subscriptions/:discordUserId
 * @desc    Get user subscriptions
 * @access  Public (called from Discord bot)
 */
router.get(
  '/subscriptions/:discordUserId',
  asyncHandler(async (req, res) => {
    const { discordUserId } = req.params;

    const subscriptions = notificationService.getUserSubscriptions(discordUserId);

    res.status(200).json({
      success: true,
      data: {
        subscriptions,
        count: subscriptions.length
      },
      error: null,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route   POST /api/v1/notifications/send
 * @desc    Send notification to subscribed users (internal use)
 * @access  Private (called internally by trading signal service)
 */
router.post(
  '/send',
  asyncHandler(async (req, res) => {
    const { signal, pair, timeframe } = req.body;

    if (!signal || !pair) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Missing required fields: signal and pair',
        timestamp: new Date().toISOString()
      });
    }

    const result = await notificationService.sendNotification(signal, pair, timeframe);

    res.status(200).json({
      success: true,
      data: result,
      error: null,
      timestamp: new Date().toISOString()
    });
  })
);

module.exports = router;