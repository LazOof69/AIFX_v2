/**
 * SignalChangeHistory Model
 * Tracks signal changes and notification cooldowns
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database').sequelize;

const SignalChangeHistory = sequelize.define('SignalChangeHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  pair: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'Currency pair (e.g., EUR/USD)'
  },
  timeframe: {
    type: DataTypes.STRING(10),
    allowNull: false,
    comment: 'Timeframe: 1h, 4h, 1d'
  },
  oldSignal: {
    type: DataTypes.STRING(10),
    allowNull: true,
    field: 'old_signal',
    comment: 'Previous signal: buy/hold/sell'
  },
  newSignal: {
    type: DataTypes.STRING(10),
    allowNull: false,
    field: 'new_signal',
    comment: 'New signal: buy/hold/sell'
  },
  oldConfidence: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field: 'old_confidence',
    comment: 'Previous confidence (0.00-1.00)'
  },
  newConfidence: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    field: 'new_confidence',
    comment: 'New confidence (0.00-1.00)'
  },
  signalStrength: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'signal_strength',
    comment: 'Signal strength: weak/moderate/strong/very_strong'
  },
  marketCondition: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'market_condition',
    comment: 'Market condition: calm/trending/volatile'
  },
  notifiedUsers: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: true,
    defaultValue: [],
    field: 'notified_users',
    comment: 'Array of Discord user IDs who were notified'
  },
  notificationSent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'notification_sent',
    comment: 'Whether notification was successfully sent'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
    comment: 'When this signal change was detected'
  },
  lastNotifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_notified_at',
    comment: 'When notification was last sent (for cooldown tracking)'
  }
}, {
  tableName: 'signal_change_history',
  timestamps: false,
  underscored: false,
  indexes: [
    {
      fields: ['pair', 'timeframe']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['pair', 'timeframe', 'created_at']
    }
  ]
});

module.exports = SignalChangeHistory;
