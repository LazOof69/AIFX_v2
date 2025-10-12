/**
 * UserTradingHistory Model
 * Stores user's actual trading positions (both open and closed)
 * Part of Phase 3: Trading Lifecycle Management v3.0
 */

const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * UserTradingHistory model for tracking user positions
 */
const UserTradingHistory = sequelize.define('UserTradingHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  signalId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'trading_signals',
      key: 'id',
    },
  },
  pair: {
    type: DataTypes.STRING(10),
    allowNull: false,
    validate: {
      is: /^[A-Z]{3}\/[A-Z]{3}$/,
    },
  },
  action: {
    type: DataTypes.ENUM('buy', 'sell', 'hold'),
    allowNull: false,
  },
  // Entry details
  entryPrice: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  // Exit details (null if position is open)
  exitPrice: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: true,
    validate: {
      min: 0,
    },
  },
  // Risk management
  stopLoss: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: true,
    validate: {
      min: 0,
    },
  },
  takeProfit: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: true,
    validate: {
      min: 0,
    },
  },
  // Position sizing
  positionSize: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Position size in percentage or units',
  },
  // P&L tracking (calculated on close)
  profitLoss: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Profit/Loss in pips',
  },
  profitLossPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: 'Profit/Loss in percentage',
  },
  // Position status
  status: {
    type: DataTypes.ENUM('open', 'closed'),
    defaultValue: 'open',
  },
  result: {
    type: DataTypes.ENUM('win', 'loss', 'breakeven'),
    allowNull: true,
  },
  // User notes
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Timestamps
  openedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'user_trading_history',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['user_id'],
      name: 'user_trading_history_user_id',
    },
    {
      fields: ['signal_id'],
      name: 'user_trading_history_signal_id',
    },
    {
      fields: ['status'],
      name: 'user_trading_history_status',
    },
    {
      fields: ['pair'],
      name: 'user_trading_history_pair',
    },
    {
      fields: ['opened_at'],
      name: 'user_trading_history_opened_at',
    },
  ],
  validate: {
    /**
     * Validate exit price is set for closed positions
     */
    validateExitPrice() {
      if (this.status === 'closed' && !this.exitPrice) {
        throw new Error('Exit price is required for closed positions');
      }
    },
    /**
     * Validate closed_at is set for closed positions
     */
    validateClosedAt() {
      if (this.status === 'closed' && !this.closedAt) {
        throw new Error('Closed at timestamp is required for closed positions');
      }
    },
  },
});

/**
 * Class method to find all open positions
 *
 * @param {string} userId - Optional user ID filter
 * @returns {Promise<UserTradingHistory[]>} Array of open positions
 */
UserTradingHistory.findOpenPositions = async function(userId = null) {
  const where = { status: 'open' };
  if (userId) where.userId = userId;

  return await this.findAll({
    where,
    order: [['opened_at', 'DESC']],
  });
};

/**
 * Class method to find positions by user with filters
 *
 * @param {string} userId - User ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} { positions, total }
 */
UserTradingHistory.findByUser = async function(userId, filters = {}) {
  const {
    status = null,
    pair = null,
    startDate = null,
    endDate = null,
    limit = 50,
    offset = 0,
  } = filters;

  const where = { userId };

  if (status && status !== 'all') {
    where.status = status;
  }
  if (pair) {
    where.pair = pair;
  }
  if (startDate || endDate) {
    where.openedAt = {};
    if (startDate) where.openedAt[Op.gte] = startDate;
    if (endDate) where.openedAt[Op.lte] = endDate;
  }

  const [positions, total] = await Promise.all([
    this.findAll({
      where,
      order: [['opened_at', 'DESC']],
      limit,
      offset,
    }),
    this.count({ where }),
  ]);

  return { positions, total };
};

/**
 * Class method to calculate user statistics
 *
 * @param {string} userId - User ID
 * @param {Object} options - Options
 * @returns {Promise<Object>} Statistics
 */
UserTradingHistory.getUserStatistics = async function(userId, options = {}) {
  const { startDate = null, endDate = null } = options;

  const where = { userId, status: 'closed' };
  if (startDate || endDate) {
    where.closedAt = {};
    if (startDate) where.closedAt[Op.gte] = startDate;
    if (endDate) where.closedAt[Op.lte] = endDate;
  }

  const [totalTrades, winningTrades, losingTrades, breakEvenTrades] = await Promise.all([
    this.count({ where }),
    this.count({ where: { ...where, result: 'win' } }),
    this.count({ where: { ...where, result: 'loss' } }),
    this.count({ where: { ...where, result: 'breakeven' } }),
  ]);

  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  const pnlStats = await this.findOne({
    where: { ...where, profitLoss: { [Op.ne]: null } },
    attributes: [
      [sequelize.fn('AVG', sequelize.col('profit_loss')), 'avgPnL'],
      [sequelize.fn('SUM', sequelize.col('profit_loss')), 'totalPnL'],
      [sequelize.fn('MAX', sequelize.col('profit_loss')), 'bestTrade'],
      [sequelize.fn('MIN', sequelize.col('profit_loss')), 'worstTrade'],
    ],
    raw: true,
  });

  // Calculate average holding duration
  const durationStats = await sequelize.query(
    `SELECT AVG(EXTRACT(EPOCH FROM (closed_at - opened_at)) / 60) as avg_duration_minutes
     FROM user_trading_history
     WHERE user_id = :userId AND status = 'closed' AND closed_at IS NOT NULL`,
    {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    breakEvenTrades,
    winRate: parseFloat(winRate.toFixed(2)),
    averagePnL: pnlStats?.avgPnL ? parseFloat(pnlStats.avgPnL) : 0,
    totalPnL: pnlStats?.totalPnL ? parseFloat(pnlStats.totalPnL) : 0,
    bestTrade: pnlStats?.bestTrade ? parseFloat(pnlStats.bestTrade) : 0,
    worstTrade: pnlStats?.worstTrade ? parseFloat(pnlStats.worstTrade) : 0,
    averageHoldingDuration: durationStats[0]?.avg_duration_minutes
      ? parseFloat(durationStats[0].avg_duration_minutes.toFixed(2))
      : 0,
  };
};

/**
 * Instance method to close position
 *
 * @param {number} exitPrice - Exit price
 * @param {number} profitLoss - Profit/Loss in pips
 * @param {number} profitLossPercentage - Profit/Loss in percentage
 * @param {string} result - Result ('win', 'loss', 'breakeven')
 * @returns {Promise<void>}
 */
UserTradingHistory.prototype.closePosition = async function(
  exitPrice,
  profitLoss,
  profitLossPercentage,
  result
) {
  this.status = 'closed';
  this.exitPrice = exitPrice;
  this.profitLoss = profitLoss;
  this.profitLossPercentage = profitLossPercentage;
  this.result = result;
  this.closedAt = new Date();
  await this.save();
};

/**
 * Instance method to adjust stop loss and take profit
 *
 * @param {number} stopLoss - New stop loss (optional)
 * @param {number} takeProfit - New take profit (optional)
 * @returns {Promise<void>}
 */
UserTradingHistory.prototype.adjustLevels = async function(stopLoss = null, takeProfit = null) {
  if (stopLoss !== null) this.stopLoss = stopLoss;
  if (takeProfit !== null) this.takeProfit = takeProfit;
  await this.save();
};

/**
 * Instance method to calculate unrealized P&L
 *
 * @param {number} currentPrice - Current market price
 * @returns {Object} { pnlPips, pnlPercentage }
 */
UserTradingHistory.prototype.calculateUnrealizedPnL = function(currentPrice) {
  if (this.status === 'closed') {
    return { pnlPips: this.profitLoss, pnlPercentage: this.profitLossPercentage };
  }

  let pnlPips = 0;
  const pipMultiplier = this.pair.includes('JPY') ? 100 : 10000;

  if (this.action === 'buy') {
    pnlPips = (currentPrice - this.entryPrice) * pipMultiplier;
  } else if (this.action === 'sell') {
    pnlPips = (this.entryPrice - currentPrice) * pipMultiplier;
  }

  const pnlPercentage = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;

  return {
    pnlPips: parseFloat(pnlPips.toFixed(2)),
    pnlPercentage: parseFloat(pnlPercentage.toFixed(4)),
  };
};

/**
 * Instance method to calculate holding duration in minutes
 *
 * @returns {number} Holding duration in minutes
 */
UserTradingHistory.prototype.getHoldingDuration = function() {
  const endTime = this.closedAt || new Date();
  const startTime = this.openedAt;
  const diffMs = endTime - startTime;
  return Math.floor(diffMs / (1000 * 60));
};

module.exports = UserTradingHistory;
