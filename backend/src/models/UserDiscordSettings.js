/**
 * UserDiscordSettings Model
 * Maps Discord users to backend users and stores Discord-specific settings
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * UserDiscordSettings model
 */
const UserDiscordSettings = sequelize.define('UserDiscordSettings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  discordUserId: {
    type: DataTypes.STRING(255),
    unique: true,
    field: 'discord_user_id',
    comment: 'Discord snowflake ID'
  },
  discordUsername: {
    type: DataTypes.STRING(255),
    field: 'discord_username',
    comment: 'Discord username#discriminator'
  },
  notificationsEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'notifications_enabled'
  },
  enabledTimeframes: {
    type: DataTypes.JSONB,
    defaultValue: ['1h', '4h'],
    field: 'enabled_timeframes'
  },
  preferredPairs: {
    type: DataTypes.JSONB,
    defaultValue: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
    field: 'preferred_pairs'
  },
  minConfidence: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0.6,
    field: 'min_confidence'
  },
  onlyMlEnhanced: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'only_ml_enhanced'
  },
  maxNotificationsPerDay: {
    type: DataTypes.INTEGER,
    defaultValue: 20,
    field: 'max_notifications_per_day'
  },
  notificationCooldownMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 240,
    field: 'notification_cooldown_minutes'
  }
}, {
  tableName: 'user_discord_settings',
  underscored: true,
  timestamps: true,
  paranoid: false,  // Disable soft deletes (no deleted_at column)
  indexes: [
    {
      unique: true,
      fields: ['discord_user_id'],
      name: 'idx_discord_user_id'
    },
    {
      fields: ['notifications_enabled'],
      name: 'idx_notifications_enabled'
    }
  ]
});

module.exports = UserDiscordSettings;
