/**
 * Migration: Create Users Table
 * Creates the users table with all authentication and trading preference fields
 */

'use strict';

module.exports = {
  /**
   * Apply the migration
   *
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize')} Sequelize
   * @returns {Promise<void>}
   */
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        validate: {
          len: [3, 50],
          isAlphanumeric: true,
        },
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          len: [8, 255],
        },
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: true,
        validate: {
          len: [1, 50],
        },
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: true,
        validate: {
          len: [1, 50],
        },
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      isVerified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      lastLoginAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      refreshToken: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      // Trading Preferences
      tradingFrequency: {
        type: Sequelize.ENUM('scalping', 'daytrading', 'swing', 'position'),
        defaultValue: 'daytrading',
        allowNull: false,
      },
      riskLevel: {
        type: Sequelize.INTEGER,
        defaultValue: 5,
        allowNull: false,
        validate: {
          min: 1,
          max: 10,
        },
      },
      preferredPairs: {
        type: Sequelize.JSON,
        defaultValue: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
        allowNull: false,
      },
      tradingStyle: {
        type: Sequelize.ENUM('trend', 'counter-trend', 'mixed'),
        defaultValue: 'mixed',
        allowNull: false,
      },
      indicators: {
        type: Sequelize.JSON,
        defaultValue: {
          sma: { enabled: true, period: 20 },
          rsi: { enabled: true, period: 14 },
          macd: { enabled: true, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
          bollinger: { enabled: false, period: 20, standardDeviations: 2 },
          stochastic: { enabled: false, kPeriod: 14, dPeriod: 3 },
        },
        allowNull: false,
      },
      // Notification Preferences
      discordUserId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      notificationSettings: {
        type: Sequelize.JSON,
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
        type: Sequelize.STRING,
        defaultValue: 'UTC',
        allowNull: false,
      },
      language: {
        type: Sequelize.STRING,
        defaultValue: 'en',
        allowNull: false,
        validate: {
          isIn: [['en', 'zh', 'es', 'fr', 'de', 'ja']],
        },
      },
      // Timestamps
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Create indexes
    await queryInterface.addIndex('users', ['email'], {
      unique: true,
      name: 'users_email_unique_idx',
    });

    await queryInterface.addIndex('users', ['username'], {
      unique: true,
      name: 'users_username_unique_idx',
    });

    await queryInterface.addIndex('users', ['isActive', 'isVerified'], {
      name: 'users_active_verified_idx',
    });

    await queryInterface.addIndex('users', ['createdAt'], {
      name: 'users_created_at_idx',
    });

    await queryInterface.addIndex('users', ['lastLoginAt'], {
      name: 'users_last_login_idx',
    });
  },

  /**
   * Revert the migration
   *
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize')} Sequelize
   * @returns {Promise<void>}
   */
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
  },
};