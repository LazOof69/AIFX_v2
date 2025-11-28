/**
 * UserLineSettings Model
 * Maps LINE users to backend users and stores LINE-specific settings
 *
 * Architecture: Part of Backend service (has database access)
 * Purpose: Store LINE user mappings and preferences
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * UserLineSettings model
 */
const UserLineSettings = sequelize.define('UserLineSettings', {
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
  lineUserId: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false,
    field: 'line_user_id',
    comment: 'LINE user ID (U...)'
  },
  lineDisplayName: {
    type: DataTypes.STRING(255),
    field: 'line_display_name',
    comment: 'LINE display name'
  },
  notificationsEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'notifications_enabled'
  },
  enabledTimeframes: {
    type: DataTypes.JSONB,
    defaultValue: ['1h', '4h'],
    field: 'enabled_timeframes',
    comment: 'Enabled timeframes for notifications'
  },
  preferredPairs: {
    type: DataTypes.JSONB,
    defaultValue: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
    field: 'preferred_pairs',
    comment: 'Preferred currency pairs'
  },
  minConfidence: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0.6,
    field: 'min_confidence',
    comment: 'Minimum confidence level for notifications (0.0-1.0)'
  },
  onlyMlEnhanced: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'only_ml_enhanced',
    comment: 'Only receive ML-enhanced signals'
  },
  maxNotificationsPerDay: {
    type: DataTypes.INTEGER,
    defaultValue: 20,
    field: 'max_notifications_per_day',
    comment: 'Maximum notifications per day'
  },
  notificationCooldownMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 240,
    field: 'notification_cooldown_minutes',
    comment: 'Cooldown period between notifications (minutes)'
  }
}, {
  tableName: 'user_line_settings',
  underscored: true,
  timestamps: true,
  paranoid: false,  // Disable soft deletes
  indexes: [
    {
      unique: true,
      fields: ['line_user_id'],
      name: 'idx_line_user_id'
    },
    {
      unique: true,
      fields: ['user_id'],
      name: 'idx_line_settings_user_id'
    },
    {
      fields: ['notifications_enabled'],
      name: 'idx_line_notifications_enabled'
    }
  ]
});

module.exports = UserLineSettings;
