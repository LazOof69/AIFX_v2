/**
 * Demo Users Seeder
 * Creates demo users for development and testing
 */

'use strict';

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  /**
   * Apply the seeder
   *
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize')} Sequelize
   * @returns {Promise<void>}
   */
  up: async (queryInterface, Sequelize) => {
    const saltRounds = 12;

    // Demo users data
    const demoUsers = [
      {
        id: uuidv4(),
        email: 'admin@aifx.com',
        username: 'admin',
        password: await bcrypt.hash('Admin123!@#', saltRounds),
        firstName: 'System',
        lastName: 'Administrator',
        isActive: true,
        isVerified: true,
        tradingFrequency: 'daytrading',
        riskLevel: 7,
        preferredPairs: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD'],
        tradingStyle: 'mixed',
        indicators: {
          sma: { enabled: true, period: 20 },
          rsi: { enabled: true, period: 14 },
          macd: { enabled: true, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
          bollinger: { enabled: true, period: 20, standardDeviations: 2 },
          stochastic: { enabled: false, kPeriod: 14, dPeriod: 3 },
        },
        notificationSettings: {
          enableSignals: true,
          enableMarketUpdates: true,
          enableNewsAlerts: true,
          maxSignalsPerDay: 20,
          signalStrengthThreshold: 0.6,
        },
        timezone: 'UTC',
        language: 'en',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        email: 'demo@aifx.com',
        username: 'demo',
        password: await bcrypt.hash('Demo123!@#', saltRounds),
        firstName: 'Demo',
        lastName: 'User',
        isActive: true,
        isVerified: true,
        tradingFrequency: 'swing',
        riskLevel: 5,
        preferredPairs: ['EUR/USD', 'GBP/USD'],
        tradingStyle: 'trend',
        indicators: {
          sma: { enabled: true, period: 50 },
          rsi: { enabled: true, period: 14 },
          macd: { enabled: false, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
          bollinger: { enabled: false, period: 20, standardDeviations: 2 },
          stochastic: { enabled: true, kPeriod: 14, dPeriod: 3 },
        },
        notificationSettings: {
          enableSignals: true,
          enableMarketUpdates: false,
          enableNewsAlerts: false,
          maxSignalsPerDay: 5,
          signalStrengthThreshold: 0.8,
        },
        timezone: 'America/New_York',
        language: 'en',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        email: 'trader@aifx.com',
        username: 'trader',
        password: await bcrypt.hash('Trader123!@#', saltRounds),
        firstName: 'Professional',
        lastName: 'Trader',
        isActive: true,
        isVerified: true,
        tradingFrequency: 'scalping',
        riskLevel: 8,
        preferredPairs: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'NZD/USD'],
        tradingStyle: 'mixed',
        indicators: {
          sma: { enabled: true, period: 10 },
          rsi: { enabled: true, period: 7 },
          macd: { enabled: true, fastPeriod: 5, slowPeriod: 13, signalPeriod: 8 },
          bollinger: { enabled: true, period: 20, standardDeviations: 1.5 },
          stochastic: { enabled: true, kPeriod: 5, dPeriod: 3 },
        },
        notificationSettings: {
          enableSignals: true,
          enableMarketUpdates: true,
          enableNewsAlerts: true,
          maxSignalsPerDay: 50,
          signalStrengthThreshold: 0.5,
        },
        timezone: 'Europe/London',
        language: 'en',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await queryInterface.bulkInsert('users', demoUsers);

    console.log('✅ Demo users seeded successfully!');
    console.log('📋 Created users:');
    demoUsers.forEach(user => {
      console.log(`   - ${user.email} (${user.username}) - Password: [Same as username]123!@#`);
    });
  },

  /**
   * Revert the seeder
   *
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize')} Sequelize
   * @returns {Promise<void>}
   */
  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('users', {
      email: {
        [Sequelize.Op.in]: ['admin@aifx.com', 'demo@aifx.com', 'trader@aifx.com'],
      },
    });
  },
};