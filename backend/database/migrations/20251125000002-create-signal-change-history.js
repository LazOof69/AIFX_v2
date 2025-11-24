'use strict';

/**
 * Migration: Create signal_change_history table
 * Purpose: Track signal changes and notification cooldowns
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('signal_change_history', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      pair: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Currency pair (e.g., EUR/USD)'
      },
      timeframe: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: 'Timeframe: 1h, 4h, 1d'
      },
      old_signal: {
        type: Sequelize.STRING(10),
        allowNull: true,
        comment: 'Previous signal: buy/hold/sell'
      },
      new_signal: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: 'New signal: buy/hold/sell'
      },
      old_confidence: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Previous confidence (0.00-1.00)'
      },
      new_confidence: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        comment: 'New confidence (0.00-1.00)'
      },
      signal_strength: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Signal strength: weak/moderate/strong/very_strong'
      },
      market_condition: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Market condition: calm/trending/volatile'
      },
      notified_users: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Array of Discord user IDs who were notified'
      },
      notification_sent: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether notification was successfully sent'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When this signal change was detected'
      },
      last_notified_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When notification was last sent (for cooldown tracking)'
      }
    });

    // Add indexes for faster queries
    await queryInterface.addIndex('signal_change_history', ['pair', 'timeframe']);
    await queryInterface.addIndex('signal_change_history', ['created_at']);
    await queryInterface.addIndex('signal_change_history', ['pair', 'timeframe', 'created_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('signal_change_history');
  }
};
