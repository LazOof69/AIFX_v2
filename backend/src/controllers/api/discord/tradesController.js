/**
 * Discord Trades API Controller
 * Handles Discord Bot requests for trading history
 *
 * This controller provides APIs for Discord Bot to access and record trade data
 * following the microservices architecture principles (CLAUDE.md)
 */

const { UserTradingHistory, User, UserDiscordSettings } = require('../../../models');
const { Op } = require('sequelize');
const AppError = require('../../../utils/AppError');

/**
 * Get user trading history
 *
 * @route GET /api/v1/discord/trades
 * @query userId - User ID (required if discordId not provided)
 * @query discordId - Discord ID (required if userId not provided)
 * @query limit - Maximum number of trades to return (default: 20, max: 100)
 * @query offset - Offset for pagination (default: 0)
 * @query pair - Filter by currency pair (optional)
 * @access Private (Discord Bot API Key required)
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
const getTradingHistory = async (req, res, next) => {
  try {
    const {
      userId,
      discordId,
      limit = 20,
      offset = 0,
      pair,
    } = req.query;

    if (!userId && !discordId) {
      throw new AppError('Either userId or discordId is required', 400, 'MISSING_USER_ID');
    }

    // Find user
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

    // Validate limit
    const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const parsedOffset = parseInt(offset, 10) || 0;

    // Build query
    const where = {
      userId: user.id,
    };

    if (pair) {
      where.pair = pair;
    }

    // Get trading history
    const { count, rows: trades } = await UserTradingHistory.findAndCountAll({
      where,
      limit: parsedLimit,
      offset: parsedOffset,
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: {
        userId: user.id,
        trades,
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
 * Record a new trade
 *
 * @route POST /api/v1/discord/trades
 * @access Private (Discord Bot API Key required)
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
const recordTrade = async (req, res, next) => {
  try {
    const {
      userId,
      discordId,
      pair,
      action,
      amount,
      entryPrice,
      exitPrice,
      stopLoss,
      takeProfit,
      signalId,
    } = req.body;

    if (!userId && !discordId) {
      throw new AppError('Either userId or discordId is required', 400, 'MISSING_USER_ID');
    }

    if (!pair) {
      throw new AppError('Pair is required', 400, 'MISSING_PAIR');
    }

    if (!action || !['buy', 'sell'].includes(action)) {
      throw new AppError('Valid action (buy/sell) is required', 400, 'INVALID_ACTION');
    }

    if (!amount || amount <= 0) {
      throw new AppError('Valid amount is required', 400, 'INVALID_AMOUNT');
    }

    if (!entryPrice || entryPrice <= 0) {
      throw new AppError('Valid entry price is required', 400, 'INVALID_ENTRY_PRICE');
    }

    // Find user
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

    // Calculate P&L if exitPrice provided
    let profitLoss = null;
    let profitLossPercent = null;
    let status = 'open';

    if (exitPrice && exitPrice > 0) {
      if (action === 'buy') {
        profitLoss = (exitPrice - entryPrice) * amount;
        profitLossPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
      } else {
        profitLoss = (entryPrice - exitPrice) * amount;
        profitLossPercent = ((entryPrice - exitPrice) / entryPrice) * 100;
      }
      status = profitLoss >= 0 ? 'closed_profit' : 'closed_loss';
    }

    // Create trade record
    const trade = await UserTradingHistory.create({
      userId: user.id,
      pair,
      action,
      amount,
      entryPrice,
      exitPrice: exitPrice || null,
      stopLoss: stopLoss || null,
      takeProfit: takeProfit || null,
      profitLoss,
      profitLossPercent,
      status,
      signalId: signalId || null,
      source: 'discord',
    });

    res.status(201).json({
      success: true,
      data: {
        tradeId: trade.id,
        userId: user.id,
        pair: trade.pair,
        action: trade.action,
        amount: trade.amount,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        profitLoss: trade.profitLoss,
        profitLossPercent: trade.profitLossPercent,
        status: trade.status,
        createdAt: trade.createdAt,
        message: 'Trade recorded successfully',
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
 * Update trade (e.g., close position)
 *
 * @route PUT /api/v1/discord/trades/:tradeId
 * @access Private (Discord Bot API Key required)
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
const updateTrade = async (req, res, next) => {
  try {
    const { tradeId } = req.params;
    const { exitPrice, status } = req.body;

    const trade = await UserTradingHistory.findByPk(tradeId);

    if (!trade) {
      throw new AppError(`Trade ${tradeId} not found`, 404, 'TRADE_NOT_FOUND');
    }

    // Update exit price if provided
    if (exitPrice && exitPrice > 0) {
      trade.exitPrice = exitPrice;

      // Recalculate P&L
      if (trade.action === 'buy') {
        trade.profitLoss = (exitPrice - trade.entryPrice) * trade.amount;
        trade.profitLossPercent = ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
      } else {
        trade.profitLoss = (trade.entryPrice - exitPrice) * trade.amount;
        trade.profitLossPercent = ((trade.entryPrice - exitPrice) / trade.entryPrice) * 100;
      }

      // Auto-update status based on P&L
      if (!status) {
        trade.status = trade.profitLoss >= 0 ? 'closed_profit' : 'closed_loss';
      }
    }

    // Update status if provided
    if (status) {
      trade.status = status;
    }

    await trade.save();

    res.status(200).json({
      success: true,
      data: {
        tradeId: trade.id,
        exitPrice: trade.exitPrice,
        profitLoss: trade.profitLoss,
        profitLossPercent: trade.profitLossPercent,
        status: trade.status,
        updatedAt: trade.updatedAt,
        message: 'Trade updated successfully',
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
  getTradingHistory,
  recordTrade,
  updateTrade,
};
