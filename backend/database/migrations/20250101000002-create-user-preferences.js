'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_preferences', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      trading_frequency: {
        type: Sequelize.ENUM('scalping', 'daytrading', 'swing', 'position'),
        defaultValue: 'daytrading',
      },
      risk_level: {
        type: Sequelize.INTEGER,
        defaultValue: 5,
        validate: {
          min: 1,
          max: 10,
        },
      },
      preferred_pairs: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
      },
      trading_style: {
        type: Sequelize.ENUM('trend', 'counter-trend', 'mixed'),
        defaultValue: 'mixed',
      },
      indicators: {
        type: Sequelize.JSONB,
        defaultValue: {
          sma: { enabled: true, period: 20 },
          rsi: { enabled: true, period: 14 },
          macd: { enabled: true },
          bb: { enabled: false, period: 20 },
        },
      },
      notification_settings: {
        type: Sequelize.JSONB,
        defaultValue: {
          email: true,
          discord: false,
          browser: true,
          signalTypes: {
            buy: true,
            sell: true,
            hold: false,
          },
          minConfidence: 70,
        },
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes
    await queryInterface.addIndex('user_preferences', ['user_id'], { unique: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('user_preferences');
  }
};