/**
 * User Model
 * Defines user accounts with authentication and trading preferences
 */

const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const { sequelize } = require('../config/database');

/**
 * User model with authentication and trading preferences
 */
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50],
      isAlphanumeric: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [8, 255],
    },
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: [1, 50],
    },
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: [1, 50],
    },
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  refreshToken: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Trading Preferences (as per CLAUDE.md specification)
  tradingFrequency: {
    type: DataTypes.ENUM('scalping', 'daytrading', 'swing', 'position'),
    defaultValue: 'daytrading',
    allowNull: false,
  },
  riskLevel: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    allowNull: false,
    validate: {
      min: 1,
      max: 10,
    },
  },
  preferredPairs: {
    type: DataTypes.JSON,
    defaultValue: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
    allowNull: false,
    validate: {
      isValidPairs(value) {
        if (!Array.isArray(value)) {
          throw new Error('Preferred pairs must be an array');
        }
        if (value.length === 0) {
          throw new Error('At least one preferred pair is required');
        }
        const pairRegex = /^[A-Z]{3}\/[A-Z]{3}$/;
        for (const pair of value) {
          if (!pairRegex.test(pair)) {
            throw new Error(`Invalid currency pair format: ${pair}`);
          }
        }
      },
    },
  },
  tradingStyle: {
    type: DataTypes.ENUM('trend', 'counter-trend', 'mixed'),
    defaultValue: 'mixed',
    allowNull: false,
  },
  // Technical Indicators Preferences
  indicators: {
    type: DataTypes.JSON,
    defaultValue: {
      sma: { enabled: true, period: 20 },
      rsi: { enabled: true, period: 14 },
      macd: { enabled: true, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      bollinger: { enabled: false, period: 20, standardDeviations: 2 },
      stochastic: { enabled: false, kPeriod: 14, dPeriod: 3 },
    },
    allowNull: false,
    validate: {
      isValidIndicators(value) {
        if (typeof value !== 'object' || value === null) {
          throw new Error('Indicators must be an object');
        }

        const validIndicators = ['sma', 'rsi', 'macd', 'bollinger', 'stochastic'];
        for (const [key, config] of Object.entries(value)) {
          if (!validIndicators.includes(key)) {
            throw new Error(`Invalid indicator: ${key}`);
          }
          if (typeof config !== 'object' || !config.hasOwnProperty('enabled')) {
            throw new Error(`Indicator ${key} must have an 'enabled' property`);
          }
        }
      },
    },
  },
  // Notification Preferences
  discordUserId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  notificationSettings: {
    type: DataTypes.JSON,
    defaultValue: {
      enableSignals: true,
      enableMarketUpdates: false,
      enableNewsAlerts: false,
      maxSignalsPerDay: 10,
      signalStrengthThreshold: 0.7,
    },
    allowNull: false,
  },
  // Account Settings
  timezone: {
    type: DataTypes.STRING,
    defaultValue: 'UTC',
    allowNull: false,
  },
  language: {
    type: DataTypes.STRING,
    defaultValue: 'en',
    allowNull: false,
    validate: {
      isIn: [['en', 'zh', 'es', 'fr', 'de', 'ja']],
    },
  },
}, {
  tableName: 'users',
  indexes: [
    {
      unique: true,
      fields: ['email'],
    },
    {
      unique: true,
      fields: ['username'],
    },
    {
      fields: ['isActive', 'isVerified'],
    },
  ],
  hooks: {
    /**
     * Hash password before creating user
     */
    beforeCreate: async (user) => {
      if (user.password) {
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        user.password = await bcrypt.hash(user.password, saltRounds);
      }
    },

    /**
     * Hash password before updating user if password changed
     */
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        user.password = await bcrypt.hash(user.password, saltRounds);
      }
    },
  },
});

/**
 * Instance method to check password
 *
 * @param {string} candidatePassword - Password to check
 * @returns {Promise<boolean>} Password match result
 */
User.prototype.checkPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Instance method to get user data without sensitive information
 *
 * @returns {object} Safe user data
 */
User.prototype.toSafeObject = function() {
  const { password, refreshToken, ...safeUser } = this.toJSON();
  return safeUser;
};

/**
 * Class method to find user by email or username
 *
 * @param {string} identifier - Email or username
 * @returns {Promise<User|null>} User instance or null
 */
User.findByIdentifier = async function(identifier) {
  return await this.findOne({
    where: {
      [sequelize.Op.or]: [
        { email: identifier },
        { username: identifier },
      ],
    },
  });
};

/**
 * Instance method to update last login timestamp
 *
 * @returns {Promise<void>}
 */
User.prototype.updateLastLogin = async function() {
  this.lastLoginAt = new Date();
  await this.save();
};

/**
 * Instance method to update trading preferences
 *
 * @param {object} preferences - New trading preferences
 * @returns {Promise<void>}
 */
User.prototype.updateTradingPreferences = async function(preferences) {
  const allowedFields = [
    'tradingFrequency',
    'riskLevel',
    'preferredPairs',
    'tradingStyle',
    'indicators',
    'notificationSettings',
  ];

  for (const [key, value] of Object.entries(preferences)) {
    if (allowedFields.includes(key)) {
      this[key] = value;
    }
  }

  await this.save();
};

module.exports = User;