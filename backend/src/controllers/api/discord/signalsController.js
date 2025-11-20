/**
 * Discord Signals API Controller
 * Handles Discord Bot requests for trading signals
 *
 * This controller provides APIs for Discord Bot to fetch and manage trading signals
 * following the microservices architecture principles (CLAUDE.md)
 */

const { TradingSignal, UserDiscordSettings, User } = require('../../../models');
const { Op } = require('sequelize');
const AppError = require('../../../utils/AppError');

/**
 * Get pending trading signals for Discord notifications
 *
 * @route GET /api/v1/discord/signals
 * @query status - Signal status (default: 'active')
 * @query limit - Maximum number of signals to return (default: 50, max: 100)
 * @query offset - Offset for pagination (default: 0)
 * @access Private (Discord Bot API Key required)
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
const getPendingSignals = async (req, res, next) => {
  try {
    const {
      status = 'active',
      limit = 50,
      offset = 0,
    } = req.query;

    // Validate limit
    const parsedLimit = Math.min(parseInt(limit, 10) || 50, 100);
    const parsedOffset = parseInt(offset, 10) || 0;

    // Query for active signals that haven't been notified yet or need re-notification
    const where = {
      status: status,
      isNotified: false, // Only get signals that haven't been notified
    };

    // Get signals
    const { count, rows: signals } = await TradingSignal.findAndCountAll({
      where,
      limit: parsedLimit,
      offset: parsedOffset,
      order: [['createdAt', 'DESC']],
      attributes: [
        'id',
        'pair',
        'timeframe',
        'signal',
        'confidence',
        'factors',
        'entryPrice',
        'stopLoss',
        'takeProfit',
        'riskRewardRatio',
        'source',
        'signalStrength',
        'marketCondition',
        'technicalData',
        'createdAt',
        'expiresAt',
      ],
    });

    // For each signal, find users who should receive notification
    const signalsWithUsers = await Promise.all(
      signals.map(async (signal) => {
        // Find users with Discord settings that match this signal
        const eligibleUsers = await UserDiscordSettings.findAll({
          where: {
            notificationsEnabled: true,
            minConfidence: {
              [Op.lte]: signal.confidence, // User's min confidence <= signal confidence
            },
            // Check if signal's pair is in user's preferred pairs
            preferredPairs: {
              [Op.contains]: [signal.pair],
            },
            // Check if signal's timeframe is in user's enabled timeframes
            enabledTimeframes: {
              [Op.contains]: [signal.timeframe],
            },
          },
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'username', 'isActive'],
              where: {
                isActive: true,
              },
            },
          ],
        });

        return {
          ...signal.toJSON(),
          eligibleUsers: eligibleUsers.map(settings => ({
            userId: settings.user.id,
            discordId: settings.discordUserId,
            discordUsername: settings.discordUsername,
            notified: false,
          })),
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        signals: signalsWithUsers,
        pagination: {
          total: count,
          limit: parsedLimit,
          offset: parsedOffset,
          hasMore: (parsedOffset + parsedLimit) < count,
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
 * Mark signal as delivered to Discord user
 *
 * @route POST /api/v1/discord/signals/:signalId/delivered
 * @access Private (Discord Bot API Key required)
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
const markSignalDelivered = async (req, res, next) => {
  try {
    const { signalId } = req.params;
    const { userId, discordId, deliveredAt } = req.body;

    if (!userId && !discordId) {
      throw new AppError('Either userId or discordId is required', 400, 'MISSING_USER_ID');
    }

    // Find the signal
    const signal = await TradingSignal.findByPk(signalId);

    if (!signal) {
      throw new AppError(`Signal ${signalId} not found`, 404, 'SIGNAL_NOT_FOUND');
    }

    // Verify user exists
    let user;
    if (discordId) {
      const discordSettings = await UserDiscordSettings.findOne({
        where: { discordUserId: discordId },
        include: [{ model: User, as: 'user' }],
      });
      if (!discordSettings) {
        throw new AppError(`User with Discord ID ${discordId} not found`, 404, 'USER_NOT_FOUND');
      }
      user = discordSettings.user;
    } else {
      user = await User.findByPk(userId);
      if (!user) {
        throw new AppError(`User ${userId} not found`, 404, 'USER_NOT_FOUND');
      }
    }

    // Update signal notification status
    const currentChannels = signal.notificationChannels || [];
    const discordChannel = {
      channel: 'discord',
      userId: user.id,
      deliveredAt: deliveredAt || new Date().toISOString(),
    };

    // Add to notification channels if not already there
    const alreadyNotified = currentChannels.some(
      ch => ch.channel === 'discord' && ch.userId === user.id
    );

    if (!alreadyNotified) {
      currentChannels.push(discordChannel);
      signal.notificationChannels = currentChannels;
    }

    // Mark as notified
    signal.isNotified = true;
    signal.notifiedAt = new Date();

    await signal.save();

    res.status(200).json({
      success: true,
      data: {
        signalId: signal.id,
        userId: user.id,
        deliveredAt: discordChannel.deliveredAt,
        message: 'Signal marked as delivered',
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
 * Get signal details by ID
 *
 * @route GET /api/v1/discord/signals/:signalId
 * @access Private (Discord Bot API Key required)
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
const getSignalById = async (req, res, next) => {
  try {
    const { signalId } = req.params;

    const signal = await TradingSignal.findByPk(signalId);

    if (!signal) {
      throw new AppError(`Signal ${signalId} not found`, 404, 'SIGNAL_NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: signal,
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
  getPendingSignals,
  markSignalDelivered,
  getSignalById,
};
