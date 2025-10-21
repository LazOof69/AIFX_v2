/**
 * ModelTrainingLog Model
 * Tracks all ML model training sessions and their results
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * ModelTrainingLog model for tracking model training sessions
 */
const ModelTrainingLog = sequelize.define('ModelTrainingLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  modelVersion: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'model_version',
  },
  trainingType: {
    type: DataTypes.ENUM('full', 'incremental'),
    allowNull: false,
    field: 'training_type',
  },
  dataStartDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'data_start_date',
  },
  dataEndDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'data_end_date',
  },
  numSamples: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'num_samples',
  },
  trainingDurationSeconds: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'training_duration_seconds',
  },

  // Training data statistics
  trainSamples: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'train_samples',
  },
  valSamples: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'val_samples',
  },
  testSamples: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'test_samples',
  },

  // Training parameters
  hyperparameters: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
  },

  // Performance metrics
  trainLoss: {
    type: DataTypes.DECIMAL(10, 6),
    allowNull: true,
    field: 'train_loss',
  },
  valLoss: {
    type: DataTypes.DECIMAL(10, 6),
    allowNull: true,
    field: 'val_loss',
  },
  testLoss: {
    type: DataTypes.DECIMAL(10, 6),
    allowNull: true,
    field: 'test_loss',
  },
  trainAccuracy: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
    field: 'train_accuracy',
  },
  valAccuracy: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
    field: 'val_accuracy',
  },
  testAccuracy: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
    field: 'test_accuracy',
  },

  // Classification metrics
  precision: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
  },
  recall: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
  },
  f1Score: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
    field: 'f1_score',
  },

  // Trading backtest metrics
  backtestWinRate: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
    field: 'backtest_win_rate',
  },
  backtestSharpeRatio: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: true,
    field: 'backtest_sharpe_ratio',
  },
  backtestMaxDrawdown: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: true,
    field: 'backtest_max_drawdown',
  },
  backtestTotalPnl: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    field: 'backtest_total_pnl',
  },

  // Status
  status: {
    type: DataTypes.ENUM('training', 'completed', 'failed', 'deployed'),
    allowNull: false,
    defaultValue: 'training',
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message',
  },

  // Model file paths
  modelPath: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'model_path',
  },
  scalerPath: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'scaler_path',
  },
  metadataPath: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'metadata_path',
  },
}, {
  tableName: 'model_training_log',
  underscored: true,
  paranoid: false,
  indexes: [
    {
      fields: ['model_version'],
      name: 'idx_training_log_version',
    },
    {
      fields: ['created_at'],
      name: 'idx_training_log_created',
    },
    {
      fields: ['status'],
      name: 'idx_training_log_status',
    },
    {
      fields: ['training_type'],
      name: 'idx_training_log_type',
    },
  ],
});

/**
 * Find training logs by model version
 *
 * @param {string} modelVersion - Model version
 * @returns {Promise<ModelTrainingLog[]>}
 */
ModelTrainingLog.findByVersion = async function(modelVersion) {
  return await this.findAll({
    where: { modelVersion },
    order: [['createdAt', 'DESC']],
  });
};

/**
 * Find latest successful training
 *
 * @param {string} trainingType - 'full' or 'incremental'
 * @returns {Promise<ModelTrainingLog|null>}
 */
ModelTrainingLog.findLatestSuccess = async function(trainingType = null) {
  const where = { status: 'completed' };
  if (trainingType) {
    where.trainingType = trainingType;
  }

  return await this.findOne({
    where,
    order: [['createdAt', 'DESC']],
  });
};

/**
 * Get training statistics
 *
 * @param {Date} startDate - Start date filter
 * @param {Date} endDate - End date filter
 * @returns {Promise<object>}
 */
ModelTrainingLog.getStatistics = async function(startDate = null, endDate = null) {
  const where = {};

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt[sequelize.Op.gte] = startDate;
    if (endDate) where.createdAt[sequelize.Op.lte] = endDate;
  }

  const [totalTraining, completed, failed] = await Promise.all([
    this.count({ where }),
    this.count({ where: { ...where, status: 'completed' } }),
    this.count({ where: { ...where, status: 'failed' } }),
  ]);

  const avgMetrics = await this.findOne({
    where: { ...where, status: 'completed' },
    attributes: [
      [sequelize.fn('AVG', sequelize.col('val_accuracy')), 'avgValAccuracy'],
      [sequelize.fn('AVG', sequelize.col('backtest_win_rate')), 'avgWinRate'],
      [sequelize.fn('AVG', sequelize.col('training_duration_seconds')), 'avgDuration'],
    ],
    raw: true,
  });

  return {
    totalTraining,
    completed,
    failed,
    successRate: totalTraining > 0 ? (completed / totalTraining) * 100 : 0,
    avgValAccuracy: avgMetrics?.avgValAccuracy ? parseFloat(avgMetrics.avgValAccuracy) : 0,
    avgWinRate: avgMetrics?.avgWinRate ? parseFloat(avgMetrics.avgWinRate) : 0,
    avgDurationSeconds: avgMetrics?.avgDuration ? parseFloat(avgMetrics.avgDuration) : 0,
  };
};

module.exports = ModelTrainingLog;
