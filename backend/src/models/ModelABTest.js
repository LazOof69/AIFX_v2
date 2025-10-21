/**
 * ModelABTest Model
 * Manages A/B testing of model versions
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * ModelABTest model for A/B testing
 */
const ModelABTest = sequelize.define('ModelABTest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  testName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'test_name',
  },
  modelAVersion: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'model_a_version',
  },
  modelBVersion: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'model_b_version',
  },

  // A/B test configuration
  trafficSplit: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: false,
    defaultValue: 0.5,
    field: 'traffic_split',
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'start_date',
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'end_date',
  },

  // Performance comparison - Model A
  modelAPredictions: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'model_a_predictions',
  },
  modelAWinRate: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
    field: 'model_a_win_rate',
  },
  modelAAvgPnl: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'model_a_avg_pnl',
  },
  modelASharpeRatio: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: true,
    field: 'model_a_sharpe_ratio',
  },

  // Performance comparison - Model B
  modelBPredictions: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'model_b_predictions',
  },
  modelBWinRate: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
    field: 'model_b_win_rate',
  },
  modelBAvgPnl: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'model_b_avg_pnl',
  },
  modelBSharpeRatio: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: true,
    field: 'model_b_sharpe_ratio',
  },

  // Statistical significance
  pValue: {
    type: DataTypes.DECIMAL(6, 5),
    allowNull: true,
    field: 'p_value',
  },
  isSignificant: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_significant',
  },

  // Test result
  winner: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('running', 'completed', 'stopped'),
    allowNull: false,
    defaultValue: 'running',
  },

  // Notes
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'model_ab_test',
  underscored: true,
  paranoid: false,
  indexes: [
    {
      fields: ['status'],
      name: 'idx_ab_test_status',
    },
    {
      fields: ['model_a_version'],
      name: 'idx_ab_test_model_a',
    },
    {
      fields: ['model_b_version'],
      name: 'idx_ab_test_model_b',
    },
    {
      fields: ['start_date'],
      name: 'idx_ab_test_start_date',
    },
  ],
});

/**
 * Get currently running A/B test
 *
 * @returns {Promise<ModelABTest|null>}
 */
ModelABTest.getCurrentTest = async function() {
  return await this.findOne({
    where: { status: 'running' },
    order: [['startDate', 'DESC']],
  });
};

/**
 * Start a new A/B test
 *
 * @param {object} config - Test configuration
 * @returns {Promise<ModelABTest>}
 */
ModelABTest.startTest = async function(config) {
  const {
    testName,
    modelAVersion,
    modelBVersion,
    trafficSplit = 0.5,
    durationDays = 7,
  } = config;

  // Check if there's already a running test
  const currentTest = await this.getCurrentTest();
  if (currentTest) {
    throw new Error(`A/B test "${currentTest.testName}" is already running. Stop it first.`);
  }

  // Create new test
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

  return await this.create({
    testName,
    modelAVersion,
    modelBVersion,
    trafficSplit,
    startDate,
    endDate,
    status: 'running',
  });
};

/**
 * Record a prediction for the A/B test
 *
 * @param {string} testId - Test ID
 * @param {string} modelVersion - Which model was used
 * @returns {Promise<void>}
 */
ModelABTest.recordPrediction = async function(testId, modelVersion) {
  const test = await this.findByPk(testId);

  if (!test) {
    throw new Error(`A/B test ${testId} not found`);
  }

  if (modelVersion === test.modelAVersion) {
    test.modelAPredictions += 1;
  } else if (modelVersion === test.modelBVersion) {
    test.modelBPredictions += 1;
  } else {
    throw new Error(`Model version ${modelVersion} not part of this A/B test`);
  }

  await test.save();
};

/**
 * Update metrics for a model in the test
 *
 * @param {string} testId - Test ID
 * @param {string} modelVersion - Which model
 * @param {object} metrics - Metrics to update
 * @returns {Promise<void>}
 */
ModelABTest.updateMetrics = async function(testId, modelVersion, metrics) {
  const test = await this.findByPk(testId);

  if (!test) {
    throw new Error(`A/B test ${testId} not found`);
  }

  if (modelVersion === test.modelAVersion) {
    if (metrics.winRate !== undefined) test.modelAWinRate = metrics.winRate;
    if (metrics.avgPnl !== undefined) test.modelAAvgPnl = metrics.avgPnl;
    if (metrics.sharpeRatio !== undefined) test.modelASharpeRatio = metrics.sharpeRatio;
  } else if (modelVersion === test.modelBVersion) {
    if (metrics.winRate !== undefined) test.modelBWinRate = metrics.winRate;
    if (metrics.avgPnl !== undefined) test.modelBAvgPnl = metrics.avgPnl;
    if (metrics.sharpeRatio !== undefined) test.modelBSharpeRatio = metrics.sharpeRatio;
  } else {
    throw new Error(`Model version ${modelVersion} not part of this A/B test`);
  }

  await test.save();
};

/**
 * Calculate statistical significance (simple t-test approximation)
 *
 * @param {string} testId - Test ID
 * @returns {Promise<object>}
 */
ModelABTest.calculateSignificance = async function(testId) {
  const test = await this.findByPk(testId);

  if (!test) {
    throw new Error(`A/B test ${testId} not found`);
  }

  // Simplified p-value calculation (would need actual trade data for proper calculation)
  // For now, use a heuristic based on difference and sample size
  const winRateDiff = Math.abs((test.modelAWinRate || 0) - (test.modelBWinRate || 0));
  const totalPredictions = test.modelAPredictions + test.modelBPredictions;

  // Simple heuristic: larger difference and more samples = more significant
  let pValue = 1.0;
  if (totalPredictions > 100) {
    pValue = Math.max(0.001, 1.0 - (winRateDiff * Math.sqrt(totalPredictions / 100)));
  }

  test.pValue = pValue;
  test.isSignificant = pValue < 0.05;

  await test.save();

  return {
    pValue,
    isSignificant: pValue < 0.05,
    winRateDiff,
    totalPredictions,
  };
};

/**
 * Determine winner and complete the test
 *
 * @param {string} testId - Test ID
 * @returns {Promise<object>}
 */
ModelABTest.completeTest = async function(testId) {
  const test = await this.findByPk(testId);

  if (!test) {
    throw new Error(`A/B test ${testId} not found`);
  }

  // Calculate significance
  await this.calculateSignificance(testId);

  // Determine winner based on win rate (primary metric)
  let winner = 'tie';

  if (test.isSignificant) {
    const winRateA = test.modelAWinRate || 0;
    const winRateB = test.modelBWinRate || 0;

    if (winRateA > winRateB) {
      winner = test.modelAVersion;
    } else if (winRateB > winRateA) {
      winner = test.modelBVersion;
    }
  }

  test.winner = winner;
  test.status = 'completed';
  test.endDate = new Date();

  await test.save();

  return {
    winner,
    isSignificant: test.isSignificant,
    modelA: {
      version: test.modelAVersion,
      predictions: test.modelAPredictions,
      winRate: test.modelAWinRate,
      avgPnl: test.modelAAvgPnl,
    },
    modelB: {
      version: test.modelBVersion,
      predictions: test.modelBPredictions,
      winRate: test.modelBWinRate,
      avgPnl: test.modelBAvgPnl,
    },
  };
};

/**
 * Stop a running test
 *
 * @param {string} testId - Test ID
 * @returns {Promise<void>}
 */
ModelABTest.stopTest = async function(testId) {
  await this.update(
    {
      status: 'stopped',
      endDate: new Date(),
    },
    {
      where: { id: testId },
    }
  );
};

module.exports = ModelABTest;
