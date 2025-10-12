/**
 * Migration: Allow NULL signal_id in user_trading_history
 * Phase 3 Week 1 Day 3 - Bug fix for manual position opening
 *
 * Issue: Manual positions don't require a signal, but signal_id was NOT NULL
 * Solution: Change signal_id to allow NULL values
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Modify signal_id column to allow NULL
    await queryInterface.changeColumn('user_trading_history', 'signal_id', {
      type: Sequelize.UUID,
      allowNull: true, // Allow NULL for manual positions
      references: {
        model: 'trading_signals',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    console.log('✅ signal_id column updated to allow NULL values');
  },

  down: async (queryInterface, Sequelize) => {
    // Revert: Make signal_id NOT NULL again
    // Note: This will fail if there are NULL values in the column
    await queryInterface.changeColumn('user_trading_history', 'signal_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'trading_signals',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    console.log('✅ signal_id column reverted to NOT NULL');
  },
};
