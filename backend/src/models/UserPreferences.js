/**
 * UserPreferences Model
 * Stores user trading preferences and notification settings
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * UserPreferences model for storing user configuration
 */
const UserPreferences = sequelize.define('UserPreferences', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  tradingFrequency: {
    type: DataTypes.ENUM('scalping', 'daytrading', 'swing', 'position'),
    defaultValue: 'daytrading',
  },
  riskLevel: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    validate: {
      min: 1,
      max: 10,
    },
  },
  preferredPairs: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
  },
  tradingStyle: {
    type: DataTypes.ENUM('trend', 'counter-trend', 'mixed'),
    defaultValue: 'mixed',
  },
  indicators: {
    type: DataTypes.JSONB,
    defaultValue: {
      sma: { enabled: true, period: 20 },
      rsi: { enabled: true, period: 14 },
      macd: { enabled: true },
      bb: { enabled: false, period: 20 },
    },
  },
  notificationSettings: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {
      // Phase 1 settings
      email: true,
      browser: true,
      discord: false,
      signalTypes: {
        buy: true,
        sell: true,
        hold: false,
      },
      minConfidence: 70,
      // Phase 3 settings
      urgencyThreshold: 2,
      level2Cooldown: 5,
      level3Cooldown: 30,
      dailySummaryTime: '22:00',
      muteHours: ['00:00-07:00'],
      trailingStopEnabled: true,
      autoAdjustSl: false,
      partialExitEnabled: true,
    },
  },
}, {
  tableName: 'user_preferences',
  timestamps: true,
  underscored: true,
});

/**
 * Class method to find or create preferences for user
 *
 * @param {string} userId - User ID
 * @returns {Promise<UserPreferences>} User preferences
 */
UserPreferences.findOrCreateForUser = async function(userId) {
  const [preferences, created] = await this.findOrCreate({
    where: { userId },
    defaults: { userId },
  });
  return preferences;
};

/**
 * Class method to get notification settings for user
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Notification settings
 */
UserPreferences.getNotificationSettings = async function(userId) {
  const preferences = await this.findOne({
    where: { userId },
    attributes: ['notificationSettings'],
  });
  return preferences?.notificationSettings || {};
};

/**
 * Instance method to update notification settings
 *
 * @param {Object} settings - New settings (merged with existing)
 * @returns {Promise<void>}
 */
UserPreferences.prototype.updateNotificationSettings = async function(settings) {
  this.notificationSettings = {
    ...this.notificationSettings,
    ...settings,
  };
  await this.save();
};

/**
 * Instance method to check if a signal type is enabled
 *
 * @param {string} signalType - Signal type ('buy', 'sell', 'hold')
 * @returns {boolean} True if enabled
 */
UserPreferences.prototype.isSignalTypeEnabled = function(signalType) {
  return this.notificationSettings?.signalTypes?.[signalType] || false;
};

/**
 * Instance method to check if confidence meets minimum threshold
 *
 * @param {number} confidence - Signal confidence (0-1)
 * @returns {boolean} True if meets threshold
 */
UserPreferences.prototype.meetsConfidenceThreshold = function(confidence) {
  const minConfidence = this.notificationSettings?.minConfidence || 70;
  return confidence * 100 >= minConfidence;
};

/**
 * Instance method to check if current time is in mute hours
 *
 * @returns {boolean} True if currently muted
 */
UserPreferences.prototype.isInMuteHours = function() {
  const muteHours = this.notificationSettings?.muteHours || [];
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  for (const range of muteHours) {
    const [start, end] = range.split('-');
    if (currentTime >= start && currentTime <= end) {
      return true;
    }
  }

  return false;
};

module.exports = UserPreferences;
