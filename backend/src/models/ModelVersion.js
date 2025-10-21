/**
 * ModelVersion Model
 * Manages all ML model versions and their lifecycle
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * ModelVersion model for managing model versions
 */
const ModelVersion = sequelize.define('ModelVersion', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  version: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  // Model type
  modelType: {
    type: DataTypes.ENUM('full', 'incremental'),
    allowNull: false,
    field: 'model_type',
  },
  parentVersion: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'parent_version',
  },

  // Training information
  trainedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'trained_at',
  },
  trainingLogId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'training_log_id',
    references: {
      model: 'model_training_log',
      key: 'id',
    },
  },

  // Deployment status
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_active',
  },
  deployedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'deployed_at',
  },

  // Production performance metrics
  productionPredictions: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'production_predictions',
  },
  productionWinRate: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
    field: 'production_win_rate',
  },
  productionAvgPnl: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'production_avg_pnl',
  },
  productionSharpeRatio: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: true,
    field: 'production_sharpe_ratio',
  },

  // File paths
  stage1ModelPath: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'stage1_model_path',
  },
  stage2ModelPath: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'stage2_model_path',
  },
  scalerPath: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'scaler_path',
  },
  featuresPath: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'features_path',
  },
  metadataPath: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'metadata_path',
  },

  // Version management
  deprecatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'deprecated_at',
  },
  deprecatedReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'deprecated_reason',
  },
}, {
  tableName: 'model_versions',
  underscored: true,
  paranoid: false,
  indexes: [
    {
      fields: ['version'],
      name: 'idx_model_versions_version',
      unique: true,
    },
    {
      fields: ['is_active'],
      name: 'idx_model_versions_active',
    },
    {
      fields: ['created_at'],
      name: 'idx_model_versions_created',
    },
    {
      fields: ['model_type'],
      name: 'idx_model_versions_type',
    },
    {
      fields: ['parent_version'],
      name: 'idx_model_versions_parent',
    },
  ],
});

/**
 * Get active model version
 *
 * @returns {Promise<ModelVersion|null>}
 */
ModelVersion.getActive = async function() {
  return await this.findOne({
    where: { isActive: true },
  });
};

/**
 * Set a model version as active (deactivate all others)
 *
 * @param {string} version - Version to activate
 * @returns {Promise<ModelVersion>}
 */
ModelVersion.setActive = async function(version) {
  const t = await sequelize.transaction();

  try {
    // Deactivate all other versions
    await this.update(
      { isActive: false },
      { where: { isActive: true }, transaction: t }
    );

    // Activate the specified version
    const [affectedCount, affectedRows] = await this.update(
      {
        isActive: true,
        deployedAt: new Date(),
      },
      {
        where: { version },
        returning: true,
        transaction: t,
      }
    );

    await t.commit();

    if (affectedCount === 0) {
      throw new Error(`Model version ${version} not found`);
    }

    return affectedRows[0];
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

/**
 * Find version by name
 *
 * @param {string} version - Version identifier
 * @returns {Promise<ModelVersion|null>}
 */
ModelVersion.findByVersion = async function(version) {
  return await this.findOne({
    where: { version },
  });
};

/**
 * Get all non-deprecated versions
 *
 * @returns {Promise<ModelVersion[]>}
 */
ModelVersion.findAllActive = async function() {
  return await this.findAll({
    where: { deprecatedAt: null },
    order: [['createdAt', 'DESC']],
  });
};

/**
 * Deprecate a model version
 *
 * @param {string} version - Version to deprecate
 * @param {string} reason - Deprecation reason
 * @returns {Promise<void>}
 */
ModelVersion.deprecate = async function(version, reason) {
  await this.update(
    {
      deprecatedAt: new Date(),
      deprecatedReason: reason,
      isActive: false,
    },
    {
      where: { version },
    }
  );
};

/**
 * Update production metrics
 *
 * @param {string} version - Version identifier
 * @param {object} metrics - Metrics to update
 * @returns {Promise<void>}
 */
ModelVersion.updateProductionMetrics = async function(version, metrics) {
  const model = await this.findOne({ where: { version } });

  if (!model) {
    throw new Error(`Model version ${version} not found`);
  }

  if (metrics.predictions !== undefined) {
    model.productionPredictions += metrics.predictions;
  }

  if (metrics.winRate !== undefined) {
    model.productionWinRate = metrics.winRate;
  }

  if (metrics.avgPnl !== undefined) {
    model.productionAvgPnl = metrics.avgPnl;
  }

  if (metrics.sharpeRatio !== undefined) {
    model.productionSharpeRatio = metrics.sharpeRatio;
  }

  await model.save();
};

/**
 * Get version comparison data
 *
 * @param {string[]} versions - Versions to compare
 * @returns {Promise<object[]>}
 */
ModelVersion.compareVersions = async function(versions) {
  return await this.findAll({
    where: {
      version: {
        [sequelize.Op.in]: versions,
      },
    },
    attributes: [
      'version',
      'name',
      'productionPredictions',
      'productionWinRate',
      'productionAvgPnl',
      'productionSharpeRatio',
      'deployedAt',
    ],
    order: [['productionWinRate', 'DESC']],
  });
};

module.exports = ModelVersion;
