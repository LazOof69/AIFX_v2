/**
 * Subscriptions Controller
 * Manages user subscriptions for signal change notifications
 */

const { UserSubscription } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Create a new subscription
 * POST /api/v1/subscriptions
 */
exports.createSubscription = async (req, res) => {
  try {
    const { discordUserId, discordUsername, pair, timeframe = '1h', channelId } = req.body;

    // Validate required fields
    if (!discordUserId || !pair) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: discordUserId, pair'
      });
    }

    // Validate pair format (XXX/XXX)
    if (!pair.match(/^[A-Z]{3}\/[A-Z]{3}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pair format. Use XXX/XXX (e.g., EUR/USD)'
      });
    }

    // Validate timeframe
    const validTimeframes = ['1h', '4h', '1d'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        success: false,
        error: `Invalid timeframe. Must be one of: ${validTimeframes.join(', ')}`
      });
    }

    // Check subscription limit (5 per user)
    const MAX_SUBSCRIPTIONS = 5;
    const userSubscriptionCount = await UserSubscription.count({
      where: { discordUserId }
    });

    if (userSubscriptionCount >= MAX_SUBSCRIPTIONS) {
      return res.status(429).json({
        success: false,
        error: `Subscription limit reached. Maximum ${MAX_SUBSCRIPTIONS} subscriptions per user.`
      });
    }

    // Check if subscription already exists
    const existing = await UserSubscription.findOne({
      where: {
        discordUserId,
        pair,
        timeframe
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Already subscribed to this pair and timeframe'
      });
    }

    // Create subscription
    const subscription = await UserSubscription.create({
      discordUserId,
      discordUsername,
      pair,
      timeframe,
      channelId
    });

    logger.info(`Subscription created: ${discordUsername} → ${pair} (${timeframe})`);

    res.status(201).json({
      success: true,
      data: subscription
    });

  } catch (error) {
    logger.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subscription'
    });
  }
};

/**
 * Delete a subscription
 * DELETE /api/v1/subscriptions/:id
 */
exports.deleteSubscription = async (req, res) => {
  try {
    const { id } = req.params;

    const subscription = await UserSubscription.findByPk(id);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    await subscription.destroy();

    logger.info(`Subscription deleted: ${subscription.discordUsername} → ${subscription.pair}`);

    res.json({
      success: true,
      message: 'Subscription deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete subscription'
    });
  }
};

/**
 * Delete subscription by user and pair
 * DELETE /api/v1/subscriptions/user/:discordUserId/pair/:pair
 */
exports.deleteSubscriptionByUserAndPair = async (req, res) => {
  try {
    const { discordUserId, pair } = req.params;
    const { timeframe = '1h' } = req.query;

    const subscription = await UserSubscription.findOne({
      where: {
        discordUserId,
        pair,
        timeframe
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    await subscription.destroy();

    logger.info(`Subscription deleted: ${subscription.discordUsername} → ${pair} (${timeframe})`);

    res.json({
      success: true,
      message: 'Subscription deleted successfully',
      data: subscription
    });

  } catch (error) {
    logger.error('Error deleting subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete subscription'
    });
  }
};

/**
 * Get user's subscriptions
 * GET /api/v1/subscriptions/user/:discordUserId
 */
exports.getUserSubscriptions = async (req, res) => {
  try {
    const { discordUserId } = req.params;

    const subscriptions = await UserSubscription.findAll({
      where: { discordUserId },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: subscriptions
    });

  } catch (error) {
    logger.error('Error getting user subscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscriptions'
    });
  }
};

/**
 * Get subscribers for a pair
 * GET /api/v1/subscriptions/pair/:pair
 */
exports.getPairSubscribers = async (req, res) => {
  try {
    const { pair } = req.params;
    const { timeframe = '1h' } = req.query;

    const subscriptions = await UserSubscription.findAll({
      where: {
        pair,
        timeframe
      },
      attributes: ['discordUserId', 'discordUsername'],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: subscriptions
    });

  } catch (error) {
    logger.error('Error getting pair subscribers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscribers'
    });
  }
};

/**
 * Get all subscribed pairs (for monitoring)
 * GET /api/v1/subscriptions/pairs
 */
exports.getSubscribedPairs = async (req, res) => {
  try {
    const subscriptions = await UserSubscription.findAll({
      attributes: ['pair', 'timeframe'],
      group: ['pair', 'timeframe'],
      raw: true
    });

    // Extract unique pair+timeframe combinations
    const pairs = subscriptions.map(s => ({
      pair: s.pair,
      timeframe: s.timeframe
    }));

    res.json({
      success: true,
      data: pairs
    });

  } catch (error) {
    logger.error('Error getting subscribed pairs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscribed pairs'
    });
  }
};
