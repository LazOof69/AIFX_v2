/**
 * UserLineSubscription Model
 * Represents LINE user subscriptions for signal change notifications
 *
 * Architecture: Part of Backend service (has database access)
 * Purpose: Store LINE user subscriptions for trading signal notifications
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database').sequelize;

const UserLineSubscription = sequelize.define('UserLineSubscription', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  lineUserId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'line_user_id',
    comment: 'LINE user ID (U...)'
  },
  lineDisplayName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'line_display_name',
    comment: 'LINE display name for notifications'
  },
  pair: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'Currency pair (e.g., EUR/USD)'
  },
  timeframe: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: '1h',
    comment: 'Timeframe: 15min, 1h, 4h, 1d, 1w'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at'
  }
}, {
  tableName: 'user_line_subscriptions',
  timestamps: true,
  underscored: false,
  indexes: [
    {
      unique: true,
      fields: ['line_user_id', 'pair', 'timeframe'],
      name: 'unique_line_user_pair_timeframe'
    },
    {
      fields: ['line_user_id']
    },
    {
      fields: ['pair', 'timeframe']
    }
  ]
});

module.exports = UserLineSubscription;
