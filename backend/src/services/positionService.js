const logger = require('../utils/logger');
const { UserTradingHistory, PositionMonitoring, TradingSignal, UserPreferences } = require('../models');
const { Op } = require('sequelize');
const forexService = require('./forexService');

/**
 * Position Service
 * Manages user trading positions lifecycle
 * Part of Phase 3: Trading Lifecycle Management v3.0
 */
class PositionService {
  /**
   * Open a new position for user
   * @param {Object} positionData - Position data
   * @param {string} positionData.userId - User ID
   * @param {string} positionData.signalId - Signal ID (optional, if from trading signal)
   * @param {string} positionData.pair - Currency pair (e.g., 'EUR/USD')
   * @param {string} positionData.action - Position direction: 'buy' or 'sell'
   * @param {number} positionData.entryPrice - Entry price
   * @param {number} positionData.positionSize - Position size in percentage (0-100)
   * @param {number} positionData.stopLoss - Stop loss price (optional)
   * @param {number} positionData.takeProfit - Take profit price (optional)
   * @param {string} positionData.notes - User notes (optional)
   * @returns {Promise<Object>} - Created position record
   */
  async openPosition(positionData) {
    try {
      const { userId, signalId, pair, action, entryPrice, positionSize, stopLoss, takeProfit, notes } = positionData;

      logger.info(`Opening position for user ${userId}: ${pair} ${action}`);

      // Validate required fields
      if (!userId || !pair || !action || !entryPrice) {
        throw new Error('Missing required fields: userId, pair, action, entryPrice');
      }

      // Validate action
      if (!['buy', 'sell'].includes(action)) {
        throw new Error('Invalid action. Must be "buy" or "sell"');
      }

      // Validate pair format
      if (!/^[A-Z]{3}\/[A-Z]{3}$/.test(pair)) {
        throw new Error('Invalid pair format. Expected format: EUR/USD');
      }

      // Validate signal exists if provided
      if (signalId) {
        const signal = await TradingSignal.findByPk(signalId);
        if (!signal) {
          throw new Error(`Signal with ID ${signalId} not found`);
        }
      }

      // Create position record
      // Build data object, only include signalId if it exists
      const positionDataToCreate = {
        userId,
        pair,
        action,
        entryPrice,
        positionSize: positionSize || null,
        stopLoss: stopLoss || null,
        takeProfit: takeProfit || null,
        notes: notes || null,
        status: 'open',
        openedAt: new Date(),
      };

      // Only add signalId if provided (for signal-based positions)
      if (signalId) {
        positionDataToCreate.signalId = signalId;
      }

      const position = await UserTradingHistory.create(positionDataToCreate);

      logger.info(`Position ${position.id} opened successfully for user ${userId}`);

      return position.toJSON();
    } catch (error) {
      logger.error(`Error opening position: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close an existing position
   * @param {string} positionId - Position ID
   * @param {Object} closeData - Close data
   * @param {number} closeData.exitPrice - Exit price
   * @param {number} closeData.exitPercentage - Percentage to close (1-100, default 100)
   * @param {string} closeData.notes - User notes (optional)
   * @returns {Promise<Object>} - Updated position with P&L data
   */
  async closePosition(positionId, closeData) {
    try {
      const { exitPrice, exitPercentage = 100, notes } = closeData;

      logger.info(`Closing position ${positionId}`);

      // Validate required fields
      if (!exitPrice) {
        throw new Error('Exit price is required');
      }

      // Fetch position
      const position = await UserTradingHistory.findByPk(positionId);
      if (!position) {
        throw new Error(`Position ${positionId} not found`);
      }

      // Validate position is open
      if (position.status === 'closed') {
        throw new Error(`Position ${positionId} is already closed`);
      }

      // Validate exit percentage
      if (exitPercentage < 1 || exitPercentage > 100) {
        throw new Error('Exit percentage must be between 1 and 100');
      }

      // If partial close, use partialClosePosition instead
      if (exitPercentage < 100) {
        return await this.partialClosePosition(positionId, exitPercentage, exitPrice);
      }

      // Calculate P&L
      const pnl = this._calculatePnL(position, exitPrice);

      // Determine result
      let result = 'breakeven';
      if (pnl.pnlPips > 1) result = 'win';
      else if (pnl.pnlPips < -1) result = 'loss';

      // Update position
      await position.closePosition(exitPrice, pnl.pnlPips, pnl.pnlPercentage, result);

      if (notes) {
        position.notes = position.notes ? `${position.notes}\n${notes}` : notes;
        await position.save();
      }

      logger.info(`Position ${positionId} closed: ${result}, P&L: ${pnl.pnlPips} pips`);

      return position.toJSON();
    } catch (error) {
      logger.error(`Error closing position: ${error.message}`);
      throw error;
    }
  }

  /**
   * Partially close a position (take partial profit)
   * @param {string} positionId - Position ID
   * @param {number} percentage - Percentage to close (1-99)
   * @param {number} exitPrice - Exit price
   * @returns {Promise<Object>} - { closedPosition, remainingPosition }
   */
  async partialClosePosition(positionId, percentage, exitPrice) {
    try {
      logger.info(`Partially closing position ${positionId}: ${percentage}%`);

      // Validate percentage
      if (percentage < 1 || percentage >= 100) {
        throw new Error('Percentage must be between 1 and 99 for partial close');
      }

      // Fetch position
      const position = await UserTradingHistory.findByPk(positionId);
      if (!position) {
        throw new Error(`Position ${positionId} not found`);
      }

      // Validate position is open
      if (position.status === 'closed') {
        throw new Error(`Position ${positionId} is already closed`);
      }

      // Calculate P&L for closed portion
      const pnl = this._calculatePnL(position, exitPrice);
      const closedPnlPips = (pnl.pnlPips * percentage) / 100;
      const closedPnlPercentage = pnl.pnlPercentage;

      // Determine result
      let result = 'breakeven';
      if (closedPnlPips > 1) result = 'win';
      else if (closedPnlPips < -1) result = 'loss';

      // Create closed position record
      const closedPosition = await UserTradingHistory.create({
        userId: position.userId,
        signalId: position.signalId,
        pair: position.pair,
        action: position.action,
        entryPrice: position.entryPrice,
        exitPrice: exitPrice,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
        positionSize: position.positionSize ? (position.positionSize * percentage) / 100 : null,
        profitLoss: closedPnlPips,
        profitLossPercentage: closedPnlPercentage,
        status: 'closed',
        result: result,
        notes: `Partial close (${percentage}%) from position ${positionId}`,
        openedAt: position.openedAt,
        closedAt: new Date(),
      });

      // Update original position size
      if (position.positionSize) {
        position.positionSize = (position.positionSize * (100 - percentage)) / 100;
      }
      position.notes = position.notes
        ? `${position.notes}\nPartial close: ${percentage}% at ${exitPrice}`
        : `Partial close: ${percentage}% at ${exitPrice}`;
      await position.save();

      logger.info(`Position ${positionId} partially closed: ${percentage}%, P&L: ${closedPnlPips} pips`);

      return {
        closedPosition: closedPosition.toJSON(),
        remainingPosition: position.toJSON(),
      };
    } catch (error) {
      logger.error(`Error partially closing position: ${error.message}`);
      throw error;
    }
  }

  /**
   * Adjust stop loss and/or take profit for a position
   * @param {string} positionId - Position ID
   * @param {Object} adjustData - Adjustment data
   * @param {number} adjustData.stopLoss - New stop loss price (optional)
   * @param {number} adjustData.takeProfit - New take profit price (optional)
   * @returns {Promise<Object>} - Updated position
   */
  async adjustPosition(positionId, adjustData) {
    try {
      const { stopLoss, takeProfit } = adjustData;

      logger.info(`Adjusting position ${positionId}`);

      // Validate at least one field is provided
      if (stopLoss === undefined && takeProfit === undefined) {
        throw new Error('At least one of stopLoss or takeProfit must be provided');
      }

      // Fetch position
      const position = await UserTradingHistory.findByPk(positionId);
      if (!position) {
        throw new Error(`Position ${positionId} not found`);
      }

      // Validate position is open
      if (position.status === 'closed') {
        throw new Error(`Cannot adjust closed position ${positionId}`);
      }

      // Validate stop loss and take profit levels
      if (stopLoss !== undefined) {
        if (position.action === 'buy' && stopLoss >= position.entryPrice) {
          throw new Error('Stop loss for buy position must be below entry price');
        }
        if (position.action === 'sell' && stopLoss <= position.entryPrice) {
          throw new Error('Stop loss for sell position must be above entry price');
        }
      }

      if (takeProfit !== undefined) {
        if (position.action === 'buy' && takeProfit <= position.entryPrice) {
          throw new Error('Take profit for buy position must be above entry price');
        }
        if (position.action === 'sell' && takeProfit >= position.entryPrice) {
          throw new Error('Take profit for sell position must be below entry price');
        }
      }

      // Update position
      await position.adjustLevels(stopLoss, takeProfit);

      logger.info(`Position ${positionId} adjusted: SL=${stopLoss || position.stopLoss}, TP=${takeProfit || position.takeProfit}`);

      return position.toJSON();
    } catch (error) {
      logger.error(`Error adjusting position: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get single position by ID with latest monitoring data
   * @param {string} positionId - Position ID
   * @param {Object} options - Query options
   * @param {boolean} options.includeMonitoring - Include monitoring history (default: true)
   * @param {number} options.monitoringLimit - Limit monitoring records (default: 10)
   * @returns {Promise<Object>} - Position with monitoring data
   */
  async getPosition(positionId, options = {}) {
    try {
      const { includeMonitoring = true, monitoringLimit = 10 } = options;

      logger.debug(`Fetching position ${positionId}`);

      // Fetch position with related data
      const position = await UserTradingHistory.findByPk(positionId, {
        include: [
          {
            model: TradingSignal,
            as: 'signal',
            attributes: ['id', 'pair', 'action', 'confidence', 'entryPrice', 'stopLoss', 'takeProfit'],
          },
        ],
      });

      if (!position) {
        throw new Error(`Position ${positionId} not found`);
      }

      const positionData = position.toJSON();

      // Calculate current unrealized P&L if position is open
      if (position.status === 'open') {
        try {
          const currentPrice = await this._getCurrentPrice(position.pair);
          const unrealizedPnl = position.calculateUnrealizedPnL(currentPrice);
          positionData.currentPrice = currentPrice;
          positionData.unrealizedPnl = unrealizedPnl;
        } catch (error) {
          logger.warn(`Could not fetch current price for ${position.pair}: ${error.message}`);
          positionData.currentPrice = null;
          positionData.unrealizedPnl = null;
        }
      }

      // Include monitoring history if requested
      if (includeMonitoring) {
        const monitoringRecords = await PositionMonitoring.getHistory(positionId, {
          limit: monitoringLimit,
        });
        positionData.monitoringRecords = monitoringRecords.map(r => r.toJSON());
      }

      return positionData;
    } catch (error) {
      logger.error(`Error fetching position: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all positions for a user
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @param {string} filters.status - Filter by status: 'open', 'closed', or 'all' (default: 'all')
   * @param {string} filters.pair - Filter by currency pair (optional)
   * @param {Date} filters.startDate - Filter by opened_at >= startDate (optional)
   * @param {Date} filters.endDate - Filter by opened_at <= endDate (optional)
   * @param {number} filters.limit - Limit results (default: 50)
   * @param {number} filters.offset - Offset for pagination (default: 0)
   * @returns {Promise<Object>} - { positions: [...], total: number }
   */
  async getUserPositions(userId, filters = {}) {
    try {
      logger.debug(`Fetching positions for user ${userId}`);

      const result = await UserTradingHistory.findByUser(userId, filters);

      // Calculate current unrealized P&L for open positions
      const positionsWithPnl = await Promise.all(
        result.positions.map(async position => {
          const positionData = position.toJSON();

          if (position.status === 'open') {
            try {
              const currentPrice = await this._getCurrentPrice(position.pair);
              const unrealizedPnl = position.calculateUnrealizedPnL(currentPrice);
              positionData.currentPrice = currentPrice;
              positionData.unrealizedPnl = unrealizedPnl;
            } catch (error) {
              logger.warn(`Could not fetch current price for ${position.pair}: ${error.message}`);
              positionData.currentPrice = null;
              positionData.unrealizedPnl = null;
            }
          }

          return positionData;
        })
      );

      return {
        positions: positionsWithPnl,
        total: result.total,
      };
    } catch (error) {
      logger.error(`Error fetching user positions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all open positions across all users (for monitoring service)
   * @param {Object} options - Query options
   * @param {number} options.limit - Limit results (default: 1000)
   * @returns {Promise<Array>} - Array of open positions with user preferences
   */
  async getAllOpenPositions(options = {}) {
    try {
      const { limit = 1000 } = options;

      logger.debug('Fetching all open positions for monitoring');

      const positions = await UserTradingHistory.findAll({
        where: { status: 'open' },
        include: [
          {
            model: UserPreferences,
            as: 'user.preferences',
            attributes: ['notificationSettings'],
            required: false,
          },
        ],
        order: [['openedAt', 'DESC']],
        limit,
      });

      return positions.map(p => p.toJSON());
    } catch (error) {
      logger.error(`Error fetching open positions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate current unrealized P&L for an open position
   * @param {Object} position - Position data
   * @param {number} currentPrice - Current market price
   * @returns {Object} - { pnlPips, pnlPercentage }
   */
  calculateUnrealizedPnL(position, currentPrice) {
    try {
      return this._calculatePnL(position, currentPrice);
    } catch (error) {
      logger.error(`Error calculating P&L: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get position performance statistics for a user
   * @param {string} userId - User ID
   * @param {Object} options - Options
   * @param {Date} options.startDate - Filter by date range (optional)
   * @param {Date} options.endDate - Filter by date range (optional)
   * @returns {Promise<Object>} - Performance statistics
   */
  async getPositionStatistics(userId, options = {}) {
    try {
      logger.debug(`Calculating position statistics for user ${userId}`);

      const stats = await UserTradingHistory.getUserStatistics(userId, options);

      return stats;
    } catch (error) {
      logger.error(`Error calculating statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Internal method to calculate P&L
   * @private
   * @param {Object} position - Position data
   * @param {number} exitPrice - Exit or current price
   * @returns {Object} - { pnlPips, pnlPercentage }
   */
  _calculatePnL(position, exitPrice) {
    const pipMultiplier = position.pair.includes('JPY') ? 100 : 10000;
    let pnlPips = 0;

    if (position.action === 'buy') {
      pnlPips = (exitPrice - position.entryPrice) * pipMultiplier;
    } else if (position.action === 'sell') {
      pnlPips = (position.entryPrice - exitPrice) * pipMultiplier;
    }

    let pnlPercentage = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
    if (position.action === 'sell') {
      // Invert percentage for sell positions
      pnlPercentage = -pnlPercentage;
    }

    return {
      pnlPips: parseFloat(pnlPips.toFixed(2)),
      pnlPercentage: parseFloat(pnlPercentage.toFixed(4)),
    };
  }

  /**
   * Internal method to get current market price
   * @private
   * @param {string} pair - Currency pair
   * @returns {Promise<number>} - Current price
   */
  async _getCurrentPrice(pair) {
    try {
      // Use forexService to get current price
      const quote = await forexService.getQuote(pair);
      return parseFloat(quote.price);
    } catch (error) {
      logger.warn(`Could not fetch current price for ${pair}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new PositionService();
