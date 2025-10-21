/**
 * Migration: Create model_versions table
 *
 * Purpose: Manage all ML model versions
 * - Tracks deployment status
 * - Stores production performance metrics
 * - Links to training logs
 * - Supports version lifecycle management
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('model_versions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      version: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // Model type
      modelType: {
        type: Sequelize.ENUM('full', 'incremental'),
        allowNull: false,
        field: 'model_type',
      },
      parentVersion: {
        type: Sequelize.STRING(50),
        allowNull: true,
        field: 'parent_version',
        comment: 'Parent version for incremental models',
      },

      // Training information
      trainedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'trained_at',
      },
      trainingLogId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'training_log_id',
        references: {
          model: 'model_training_log',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      // Deployment status
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_active',
      },
      deployedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'deployed_at',
      },

      // Production performance metrics (continuously updated)
      productionPredictions: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'production_predictions',
      },
      productionWinRate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        field: 'production_win_rate',
      },
      productionAvgPnl: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        field: 'production_avg_pnl',
      },
      productionSharpeRatio: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        field: 'production_sharpe_ratio',
      },

      // File paths
      stage1ModelPath: {
        type: Sequelize.STRING(255),
        allowNull: true,
        field: 'stage1_model_path',
      },
      stage2ModelPath: {
        type: Sequelize.STRING(255),
        allowNull: true,
        field: 'stage2_model_path',
      },
      scalerPath: {
        type: Sequelize.STRING(255),
        allowNull: true,
        field: 'scaler_path',
      },
      featuresPath: {
        type: Sequelize.STRING(255),
        allowNull: true,
        field: 'features_path',
      },
      metadataPath: {
        type: Sequelize.STRING(255),
        allowNull: true,
        field: 'metadata_path',
      },

      // Version management
      deprecatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'deprecated_at',
      },
      deprecatedReason: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'deprecated_reason',
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
    await queryInterface.addIndex('model_versions', ['version'], {
      name: 'idx_model_versions_version',
      unique: true,
    });

    await queryInterface.addIndex('model_versions', ['is_active'], {
      name: 'idx_model_versions_active',
    });

    await queryInterface.addIndex('model_versions', ['created_at'], {
      name: 'idx_model_versions_created',
      order: [['created_at', 'DESC']],
    });

    await queryInterface.addIndex('model_versions', ['model_type'], {
      name: 'idx_model_versions_type',
    });

    await queryInterface.addIndex('model_versions', ['parent_version'], {
      name: 'idx_model_versions_parent',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('model_versions');
  },
};
