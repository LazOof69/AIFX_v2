/**
 * Migration: Create user_line_subscriptions table
 *
 * This table stores LINE user subscriptions for signal change notifications
 * Similar to user_subscriptions but for LINE platform
 *
 * Created: 2025-11-29
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_line_subscriptions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      line_user_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'LINE user ID (U...)'
      },
      line_display_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'LINE display name for notifications'
      },
      pair: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Currency pair (e.g., EUR/USD)'
      },
      timeframe: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: '1h',
        comment: 'Timeframe: 15min, 1h, 4h, 1d, 1w'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create unique index for (line_user_id, pair, timeframe)
    await queryInterface.addIndex('user_line_subscriptions', {
      fields: ['line_user_id', 'pair', 'timeframe'],
      unique: true,
      name: 'unique_line_user_pair_timeframe'
    });

    // Create index for line_user_id for faster lookups
    await queryInterface.addIndex('user_line_subscriptions', {
      fields: ['line_user_id'],
      name: 'idx_line_user_subscriptions_user_id'
    });

    // Create index for (pair, timeframe) for signal monitoring
    await queryInterface.addIndex('user_line_subscriptions', {
      fields: ['pair', 'timeframe'],
      name: 'idx_line_subscriptions_pair_timeframe'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('user_line_subscriptions');
  }
};
