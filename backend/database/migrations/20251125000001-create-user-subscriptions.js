'use strict';

/**
 * Migration: Create user_subscriptions table
 * Purpose: Store user subscriptions for signal change notifications
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_subscriptions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      discord_user_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Discord user ID (snowflake)'
      },
      discord_username: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Discord username for display'
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
        comment: 'Timeframe: 1h, 4h, 1d'
      },
      channel_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Discord channel ID where subscription was created'
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

    // Add unique constraint to prevent duplicate subscriptions
    await queryInterface.addConstraint('user_subscriptions', {
      fields: ['discord_user_id', 'pair', 'timeframe'],
      type: 'unique',
      name: 'unique_user_pair_timeframe'
    });

    // Add index for faster queries
    await queryInterface.addIndex('user_subscriptions', ['discord_user_id']);
    await queryInterface.addIndex('user_subscriptions', ['pair', 'timeframe']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('user_subscriptions');
  }
};
