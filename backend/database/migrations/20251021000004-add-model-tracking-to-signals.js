/**
 * Migration: Add model tracking columns to trading_signals
 *
 * Purpose: Track which model version generated each signal
 * - Links signals to model versions
 * - Supports A/B testing attribution
 * - Enables performance tracking per model
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add model_version column
    await queryInterface.addColumn('trading_signals', 'model_version', {
      type: Sequelize.STRING(50),
      allowNull: true,
      field: 'model_version',
      comment: 'ML model version that generated this signal',
    });

    // Add ab_test_id column
    await queryInterface.addColumn('trading_signals', 'ab_test_id', {
      type: Sequelize.UUID,
      allowNull: true,
      field: 'ab_test_id',
      references: {
        model: 'model_ab_test',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'A/B test this signal belongs to',
    });

    // Create index for model_version
    await queryInterface.addIndex('trading_signals', ['model_version'], {
      name: 'idx_signals_model_version',
    });

    // Create index for ab_test_id
    await queryInterface.addIndex('trading_signals', ['ab_test_id'], {
      name: 'idx_signals_ab_test',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex('trading_signals', 'idx_signals_model_version');
    await queryInterface.removeIndex('trading_signals', 'idx_signals_ab_test');

    // Remove columns
    await queryInterface.removeColumn('trading_signals', 'ab_test_id');
    await queryInterface.removeColumn('trading_signals', 'model_version');
  },
};
