/**
 * LINE Subscriptions API Controller
 * Handles LINE user subscriptions for signal change notifications
 *
 * This controller provides APIs for LINE Bot to manage user subscriptions
 * following the microservices architecture principles (CLAUDE.md)
 */

const { UserLineSubscription } = require('../../../models');
const AppError = require('../../../utils/AppError');
const { Op } = require('sequelize');

/**
 * Subscribe to signal changes
 *
 * @route POST /api/v1/line/subscriptions
 * @access Private (LINE Bot API Key required)
 */
const subscribe = async (req, res, next) => {
  try {
    const { lineUserId, pair, timeframe = '1h', lineDisplayName } = req.body;

    // Validation
    if (!lineUserId || !pair) {
      throw new AppError('lineUserId and pair are required', 400, 'MISSING_PARAMETERS');
    }

    // Validate pair format (XXX/XXX)
    if (!/^[A-Z]{3}\/[A-Z]{3}$/.test(pair)) {
      throw new AppError(
        'Invalid pair format. Expected format: XXX/XXX (e.g., EUR/USD)',
        400,
        'INVALID_PAIR_FORMAT'
      );
    }

    // Validate timeframe
    const validTimeframes = ['15min', '1h', '4h', '1d', '1w'];
    if (!validTimeframes.includes(timeframe)) {
      throw new AppError(
        `Invalid timeframe. Valid options: ${validTimeframes.join(', ')}`,
        400,
        'INVALID_TIMEFRAME'
      );
    }

    // Check if subscription already exists
    const existingSubscription = await UserLineSubscription.findOne({
      where: {
        lineUserId,
        pair,
        timeframe,
      },
    });

    if (existingSubscription) {
      throw new AppError(
        'You are already subscribed to this pair and timeframe',
        409,
        'ALREADY_SUBSCRIBED'
      );
    }

    // Create subscription
    const subscription = await UserLineSubscription.create({
      lineUserId,
      lineDisplayName,
      pair,
      timeframe,
    });

    res.status(201).json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          lineUserId: subscription.lineUserId,
          pair: subscription.pair,
          timeframe: subscription.timeframe,
          createdAt: subscription.createdAt,
        },
        message: 'Subscription created successfully',
      },
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        requestId: req.id,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unsubscribe from signal changes
 *
 * @route POST /api/v1/line/subscriptions/unsubscribe
 * @access Private (LINE Bot API Key required)
 */
const unsubscribe = async (req, res, next) => {
  try {
    const { lineUserId, pair, timeframe = '1h' } = req.body;

    // Validation
    if (!lineUserId || !pair) {
      throw new AppError('lineUserId and pair are required', 400, 'MISSING_PARAMETERS');
    }

    // Find subscription
    const subscription = await UserLineSubscription.findOne({
      where: {
        lineUserId,
        pair,
        timeframe,
      },
    });

    if (!subscription) {
      throw new AppError(
        'Subscription not found. You are not subscribed to this pair and timeframe',
        404,
        'SUBSCRIPTION_NOT_FOUND'
      );
    }

    // Delete subscription
    await subscription.destroy();

    res.status(200).json({
      success: true,
      data: {
        message: 'Subscription removed successfully',
        removed: {
          pair: subscription.pair,
          timeframe: subscription.timeframe,
        },
      },
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        requestId: req.id,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all subscriptions for a LINE user
 *
 * @route GET /api/v1/line/subscriptions/:lineUserId
 * @access Private (LINE Bot API Key required)
 */
const getSubscriptions = async (req, res, next) => {
  try {
    const { lineUserId } = req.params;

    if (!lineUserId) {
      throw new AppError('lineUserId is required', 400, 'MISSING_LINE_USER_ID');
    }

    // Get all subscriptions for this LINE user
    const subscriptions = await UserLineSubscription.findAll({
      where: { lineUserId },
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'pair', 'timeframe', 'createdAt'],
    });

    res.status(200).json({
      success: true,
      data: {
        subscriptions,
        count: subscriptions.length,
      },
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        requestId: req.id,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all LINE subscribers for a specific pair and timeframe
 * Used by signal monitoring service to send notifications
 *
 * @route GET /api/v1/line/subscriptions/subscribers/:pair/:timeframe
 * @access Private (Backend API Key required)
 */
const getSubscribers = async (req, res, next) => {
  try {
    const { pair, timeframe } = req.params;

    if (!pair || !timeframe) {
      throw new AppError('pair and timeframe are required', 400, 'MISSING_PARAMETERS');
    }

    // Get all subscribers for this pair and timeframe
    const subscribers = await UserLineSubscription.findAll({
      where: {
        pair,
        timeframe,
      },
      attributes: ['lineUserId', 'lineDisplayName'],
    });

    res.status(200).json({
      success: true,
      data: {
        subscribers: subscribers.map((sub) => ({
          lineUserId: sub.lineUserId,
          lineDisplayName: sub.lineDisplayName,
        })),
        count: subscribers.length,
      },
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        requestId: req.id,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  subscribe,
  unsubscribe,
  getSubscriptions,
  getSubscribers,
};
