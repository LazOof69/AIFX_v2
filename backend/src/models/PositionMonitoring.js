/**
 * PositionMonitoring Model
 * Stores real-time monitoring data for open positions
 * Part of Phase 3: Trading Lifecycle Management v3.0
 */

const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * PositionMonitoring model for tracking position analysis over time
 */
const PositionMonitoring = sequelize.define('PositionMonitoring', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  positionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'user_trading_history',
      key: 'id',
    },
  },
  // Current market state
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  currentPrice: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  // Unrealized P&L
  unrealizedPnlPips: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  unrealizedPnlPercentage: {
    type: DataTypes.DECIMAL(8, 4),
    allowNull: true,
  },
  // Trend analysis (from ML model)
  trendDirection: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      isIn: [['uptrend', 'downtrend', 'sideways', 'reversal', 'unknown']],
    },
  },
  trendStrength: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
    validate: {
      min: 0.0,
      max: 1.0,
    },
  },
  reversalProbability: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
    validate: {
      min: 0.0,
      max: 1.0,
    },
  },
  // Risk-reward analysis
  currentRisk: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: true,
    comment: 'Current distance to stop loss in price units',
  },
  currentReward: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: true,
    comment: 'Current distance to take profit in price units',
  },
  currentRrRatio: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: 'Current risk-reward ratio',
  },
  // Recommendation
  recommendation: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      isIn: [['hold', 'exit', 'take_partial', 'adjust_sl', 'adjust_tp', 'trailing_stop']],
    },
  },
  recommendationConfidence: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
    validate: {
      min: 0.0,
      max: 1.0,
    },
  },
  reasoning: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'AI-generated explanation for the recommendation',
  },
  // Notification tracking
  notificationSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  notificationLevel: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 4,
    },
    comment: '1=urgent, 2=important (5min cooldown), 3=general (30min cooldown), 4=daily summary',
  },
}, {
  tableName: 'position_monitoring',
  timestamps: false, // Using custom timestamp field
  underscored: false, // Database uses camelCase column names
  indexes: [
    {
      fields: ['positionId'],
      name: 'position_monitoring_position_id_index',
    },
    {
      fields: ['timestamp'],
      name: 'position_monitoring_timestamp_index',
    },
    {
      fields: ['positionId', 'timestamp'],
      name: 'position_monitoring_position_time_index',
    },
    {
      fields: ['recommendation'],
      name: 'position_monitoring_recommendation_index',
    },
    {
      fields: ['notification_sent'],
      name: 'position_monitoring_notification_sent_index',
    },
    {
      fields: ['notification_level'],
      name: 'position_monitoring_notification_level_index',
    },
    {
      fields: ['position_id', 'notification_sent', 'timestamp'],
      name: 'position_monitoring_service_query_index',
    },
  ],
});

/**
 * Class method to get monitoring history for a position
 *
 * @param {string} positionId - Position ID
 * @param {Object} options - Query options
 * @returns {Promise<PositionMonitoring[]>} Array of monitoring records
 */
PositionMonitoring.getHistory = async function(positionId, options = {}) {
  const { limit = 100, startDate = null, endDate = null } = options;

  const where = { positionId };
  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp[Op.gte] = startDate;
    if (endDate) where.timestamp[Op.lte] = endDate;
  }

  return await this.findAll({
    where,
    order: [['timestamp', 'DESC']],
    limit,
  });
};

/**
 * Class method to get latest monitoring record for a position
 *
 * @param {string} positionId - Position ID
 * @returns {Promise<PositionMonitoring|null>} Latest monitoring record
 */
PositionMonitoring.getLatest = async function(positionId) {
  return await this.findOne({
    where: { positionId },
    order: [['timestamp', 'DESC']],
  });
};

/**
 * Class method to find records requiring notification
 *
 * @param {number} minLevel - Minimum notification level (default: 1)
 * @returns {Promise<PositionMonitoring[]>} Records to notify
 */
PositionMonitoring.findPendingNotifications = async function(minLevel = 1) {
  return await this.findAll({
    where: {
      notificationSent: false,
      notificationLevel: {
        [Op.gte]: minLevel,
      },
    },
    order: [['notification_level', 'ASC'], ['timestamp', 'DESC']],
  });
};

/**
 * Class method to get monitoring statistics for a position
 *
 * @param {string} positionId - Position ID
 * @returns {Promise<Object>} Statistics
 */
PositionMonitoring.getStatistics = async function(positionId) {
  const records = await this.findAll({
    where: { positionId },
    order: [['timestamp', 'ASC']],
  });

  if (records.length === 0) {
    return {
      totalRecords: 0,
      firstCheck: null,
      lastCheck: null,
      maxPnl: 0,
      minPnl: 0,
      avgTrendStrength: 0,
      avgReversalProb: 0,
      recommendations: {},
    };
  }

  const pnls = records.map(r => parseFloat(r.unrealizedPnlPercentage) || 0);
  const trendStrengths = records
    .map(r => parseFloat(r.trendStrength))
    .filter(v => v !== null && !isNaN(v));
  const reversalProbs = records
    .map(r => parseFloat(r.reversalProbability))
    .filter(v => v !== null && !isNaN(v));

  const recommendations = records.reduce((acc, r) => {
    if (r.recommendation) {
      acc[r.recommendation] = (acc[r.recommendation] || 0) + 1;
    }
    return acc;
  }, {});

  return {
    totalRecords: records.length,
    firstCheck: records[0].timestamp,
    lastCheck: records[records.length - 1].timestamp,
    maxPnl: Math.max(...pnls),
    minPnl: Math.min(...pnls),
    avgTrendStrength:
      trendStrengths.length > 0
        ? trendStrengths.reduce((a, b) => a + b, 0) / trendStrengths.length
        : 0,
    avgReversalProb:
      reversalProbs.length > 0
        ? reversalProbs.reduce((a, b) => a + b, 0) / reversalProbs.length
        : 0,
    recommendations,
  };
};

/**
 * Instance method to mark notification as sent
 *
 * @returns {Promise<void>}
 */
PositionMonitoring.prototype.markNotified = async function() {
  this.notificationSent = true;
  await this.save();
};

/**
 * Instance method to check if recommendation is critical
 *
 * @returns {boolean} True if critical (exit or take_partial)
 */
PositionMonitoring.prototype.isCritical = function() {
  return ['exit', 'take_partial'].includes(this.recommendation);
};

/**
 * Instance method to check if trend is reversing
 *
 * @param {number} threshold - Reversal probability threshold (default: 0.6)
 * @returns {boolean} True if reversal probability exceeds threshold
 */
PositionMonitoring.prototype.isReversing = function(threshold = 0.6) {
  return this.reversalProbability && parseFloat(this.reversalProbability) >= threshold;
};

module.exports = PositionMonitoring;
