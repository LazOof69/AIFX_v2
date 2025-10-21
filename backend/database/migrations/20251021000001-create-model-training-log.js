/**
 * Migration: Create model_training_log table
 *
 * Purpose: Track all ML model training sessions
 * - Records training parameters, metrics, and results
 * - Supports both full and incremental training
 * - Links to model version artifacts
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('model_training_log', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      modelVersion: {
        type: Sequelize.STRING(50),
        allowNull: false,
        field: 'model_version',
      },
      trainingType: {
        type: Sequelize.ENUM('full', 'incremental'),
        allowNull: false,
        field: 'training_type',
      },
      dataStartDate: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'data_start_date',
      },
      dataEndDate: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'data_end_date',
      },
      numSamples: {
        type: Sequelize.INTEGER,
        allowNull: false,
        field: 'num_samples',
      },
      trainingDurationSeconds: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: 'training_duration_seconds',
      },

      // Training data statistics
      trainSamples: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: 'train_samples',
      },
      valSamples: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: 'val_samples',
      },
      testSamples: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: 'test_samples',
      },

      // Training parameters
      hyperparameters: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },

      // Performance metrics
      trainLoss: {
        type: Sequelize.DECIMAL(10, 6),
        allowNull: true,
        field: 'train_loss',
      },
      valLoss: {
        type: Sequelize.DECIMAL(10, 6),
        allowNull: true,
        field: 'val_loss',
      },
      testLoss: {
        type: Sequelize.DECIMAL(10, 6),
        allowNull: true,
        field: 'test_loss',
      },
      trainAccuracy: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        field: 'train_accuracy',
      },
      valAccuracy: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        field: 'val_accuracy',
      },
      testAccuracy: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        field: 'test_accuracy',
      },

      // Classification metrics
      precision: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
      },
      recall: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
      },
      f1Score: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        field: 'f1_score',
      },

      // Trading backtest metrics
      backtestWinRate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        field: 'backtest_win_rate',
      },
      backtestSharpeRatio: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        field: 'backtest_sharpe_ratio',
      },
      backtestMaxDrawdown: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        field: 'backtest_max_drawdown',
      },
      backtestTotalPnl: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        field: 'backtest_total_pnl',
      },

      // Status
      status: {
        type: Sequelize.ENUM('training', 'completed', 'failed', 'deployed'),
        allowNull: false,
        defaultValue: 'training',
      },
      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'error_message',
      },

      // Model file paths
      modelPath: {
        type: Sequelize.STRING(255),
        allowNull: true,
        field: 'model_path',
      },
      scalerPath: {
        type: Sequelize.STRING(255),
        allowNull: true,
        field: 'scaler_path',
      },
      metadataPath: {
        type: Sequelize.STRING(255),
        allowNull: true,
        field: 'metadata_path',
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
    await queryInterface.addIndex('model_training_log', ['model_version'], {
      name: 'idx_training_log_version',
    });

    await queryInterface.addIndex('model_training_log', ['created_at'], {
      name: 'idx_training_log_created',
      order: [['created_at', 'DESC']],
    });

    await queryInterface.addIndex('model_training_log', ['status'], {
      name: 'idx_training_log_status',
    });

    await queryInterface.addIndex('model_training_log', ['training_type'], {
      name: 'idx_training_log_type',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('model_training_log');
  },
};
