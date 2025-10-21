/**
 * Migration: Create model_ab_test table
 *
 * Purpose: Manage A/B testing of model versions
 * - Compare two model versions in production
 * - Track performance metrics for each variant
 * - Calculate statistical significance
 * - Determine winner automatically
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('model_ab_test', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      testName: {
        type: Sequelize.STRING(100),
        allowNull: false,
        field: 'test_name',
      },
      modelAVersion: {
        type: Sequelize.STRING(50),
        allowNull: false,
        field: 'model_a_version',
      },
      modelBVersion: {
        type: Sequelize.STRING(50),
        allowNull: false,
        field: 'model_b_version',
      },

      // A/B test configuration
      trafficSplit: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 0.5,
        field: 'traffic_split',
        comment: '0.5 = 50/50 split',
      },
      startDate: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'start_date',
      },
      endDate: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'end_date',
      },

      // Performance comparison - Model A
      modelAPredictions: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'model_a_predictions',
      },
      modelAWinRate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        field: 'model_a_win_rate',
      },
      modelAAvgPnl: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        field: 'model_a_avg_pnl',
      },
      modelASharpeRatio: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        field: 'model_a_sharpe_ratio',
      },

      // Performance comparison - Model B
      modelBPredictions: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'model_b_predictions',
      },
      modelBWinRate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        field: 'model_b_win_rate',
      },
      modelBAvgPnl: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        field: 'model_b_avg_pnl',
      },
      modelBSharpeRatio: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        field: 'model_b_sharpe_ratio',
      },

      // Statistical significance
      pValue: {
        type: Sequelize.DECIMAL(6, 5),
        allowNull: true,
        field: 'p_value',
        comment: 'p-value for statistical significance test',
      },
      isSignificant: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_significant',
        comment: 'True if p-value < 0.05',
      },

      // Test result
      winner: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'model_a, model_b, or tie',
      },
      status: {
        type: Sequelize.ENUM('running', 'completed', 'stopped'),
        allowNull: false,
        defaultValue: 'running',
      },

      // Notes
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at',
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'updated_at',
      },
    });

    // Create indexes
    await queryInterface.addIndex('model_ab_test', ['status'], {
      name: 'idx_ab_test_status',
    });

    await queryInterface.addIndex('model_ab_test', ['model_a_version'], {
      name: 'idx_ab_test_model_a',
    });

    await queryInterface.addIndex('model_ab_test', ['model_b_version'], {
      name: 'idx_ab_test_model_b',
    });

    await queryInterface.addIndex('model_ab_test', ['start_date'], {
      name: 'idx_ab_test_start_date',
      order: [['start_date', 'DESC']],
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('model_ab_test');
  },
};
