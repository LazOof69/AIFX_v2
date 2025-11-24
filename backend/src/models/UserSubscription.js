/**
 * UserSubscription Model
 * Represents user subscriptions for signal change notifications
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database').sequelize;

const UserSubscription = sequelize.define('UserSubscription', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  discordUserId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'discord_user_id',
    comment: 'Discord user ID (snowflake)'
  },
  discordUsername: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'discord_username',
    comment: 'Discord username for display'
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
    comment: 'Timeframe: 1h, 4h, 1d'
  },
  channelId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'channel_id',
    comment: 'Discord channel ID where subscription was created'
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
  tableName: 'user_subscriptions',
  timestamps: true,
  underscored: false,
  indexes: [
    {
      unique: true,
      fields: ['discord_user_id', 'pair', 'timeframe'],
      name: 'unique_user_pair_timeframe'
    },
    {
      fields: ['discord_user_id']
    },
    {
      fields: ['pair', 'timeframe']
    }
  ]
});

module.exports = UserSubscription;
