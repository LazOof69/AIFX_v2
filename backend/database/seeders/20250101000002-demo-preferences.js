'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get user IDs from users table
    const users = await queryInterface.sequelize.query(
      'SELECT id FROM users;',
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (users.length === 0) {
      console.log('No users found. Please run user seeder first.');
      return;
    }

    const preferences = users.map((user, index) => {
      const preferencesData = [
        {
          trading_frequency: 'daytrading',
          risk_level: 5,
          preferred_pairs: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
          trading_style: 'trend',
          indicators: {
            sma: { enabled: true, period: 20 },
            rsi: { enabled: true, period: 14 },
            macd: { enabled: true },
            bb: { enabled: true, period: 20 },
          },
          notification_settings: {
            email: true,
            discord: true,
            browser: true,
            signalTypes: { buy: true, sell: true, hold: false },
            minConfidence: 70,
          },
        },
        {
          trading_frequency: 'swing',
          risk_level: 7,
          preferred_pairs: ['EUR/USD', 'AUD/USD', 'EUR/GBP', 'GBP/JPY'],
          trading_style: 'mixed',
          indicators: {
            sma: { enabled: true, period: 50 },
            rsi: { enabled: true, period: 14 },
            macd: { enabled: false },
            bb: { enabled: true, period: 20 },
          },
          notification_settings: {
            email: true,
            discord: false,
            browser: true,
            signalTypes: { buy: true, sell: true, hold: true },
            minConfidence: 80,
          },
        },
        {
          trading_frequency: 'scalping',
          risk_level: 3,
          preferred_pairs: ['EUR/USD', 'USD/JPY'],
          trading_style: 'counter-trend',
          indicators: {
            sma: { enabled: true, period: 10 },
            rsi: { enabled: true, period: 7 },
            macd: { enabled: true },
            bb: { enabled: false, period: 20 },
          },
          notification_settings: {
            email: false,
            discord: false,
            browser: true,
            signalTypes: { buy: true, sell: true, hold: false },
            minConfidence: 60,
          },
        },
      ];

      const data = preferencesData[index % preferencesData.length];
      return {
        id: uuidv4(),
        user_id: user.id,
        trading_frequency: data.trading_frequency,
        risk_level: data.risk_level,
        preferred_pairs: data.preferred_pairs,
        trading_style: data.trading_style,
        indicators: JSON.stringify(data.indicators),
        notification_settings: JSON.stringify(data.notification_settings),
        created_at: new Date(),
        updated_at: new Date(),
      };
    });

    await queryInterface.bulkInsert('user_preferences', preferences, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('user_preferences', null, {});
  }
};