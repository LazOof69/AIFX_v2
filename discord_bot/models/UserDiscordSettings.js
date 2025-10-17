const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserDiscordSettings = sequelize.define('UserDiscordSettings', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    discordUserId: {
      type: DataTypes.STRING(255),
      unique: true,
      field: 'discord_user_id'
    },
    discordUsername: {
      type: DataTypes.STRING(255),
      field: 'discord_username'
    },

    // Notification settings
    notificationsEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'notifications_enabled'
    },
    enabledTimeframes: {
      type: DataTypes.JSONB,
      defaultValue: ['1h', '4h'],
      field: 'enabled_timeframes',
      get() {
        const value = this.getDataValue('enabledTimeframes');
        return Array.isArray(value) ? value : ['1h', '4h'];
      }
    },
    preferredPairs: {
      type: DataTypes.JSONB,
      defaultValue: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
      field: 'preferred_pairs',
      get() {
        const value = this.getDataValue('preferredPairs');
        return Array.isArray(value) ? value : ['EUR/USD', 'GBP/USD', 'USD/JPY'];
      }
    },

    // Signal filtering
    minConfidence: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.60,
      field: 'min_confidence',
      validate: {
        min: 0.0,
        max: 1.0
      }
    },
    onlyMlEnhanced: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'only_ml_enhanced'
    },

    // Rate limiting
    maxNotificationsPerDay: {
      type: DataTypes.INTEGER,
      defaultValue: 20,
      field: 'max_notifications_per_day'
    },
    notificationCooldownMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 240, // 4 hours
      field: 'notification_cooldown_minutes'
    },

    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at'
    }
  }, {
    tableName: 'user_discord_settings',
    timestamps: true,
    underscored: true
  });

  UserDiscordSettings.associate = (models) => {
    UserDiscordSettings.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  /**
   * Check if a pair+timeframe combination is enabled for this user
   * @param {string} pair - Currency pair
   * @param {string} timeframe - Timeframe
   * @returns {boolean}
   */
  UserDiscordSettings.prototype.isPairTimeframeEnabled = function(pair, timeframe) {
    if (!this.notificationsEnabled) return false;

    const timeframesEnabled = this.enabledTimeframes || [];
    const pairsEnabled = this.preferredPairs || [];

    return timeframesEnabled.includes(timeframe) && pairsEnabled.includes(pair);
  };

  /**
   * Check if confidence meets threshold
   * @param {number} confidence - Signal confidence (0.0-1.0)
   * @returns {boolean}
   */
  UserDiscordSettings.prototype.meetsConfidenceThreshold = function(confidence) {
    return confidence >= parseFloat(this.minConfidence);
  };

  return UserDiscordSettings;
};
