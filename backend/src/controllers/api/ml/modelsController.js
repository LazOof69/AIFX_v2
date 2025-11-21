/**
 * ML Models API Controller
 * Manages ML model versions and A/B tests
 *
 * Following microservices architecture principles (CLAUDE.md):
 * - ML Engine registers new model versions via API
 * - Backend stores model metadata and performance metrics
 */

const { ModelVersion, ModelTrainingLog, ModelABTest, TradingSignal } = require('../../../models');
const { Op } = require('sequelize');
const AppError = require('../../../utils/AppError');

/**
 * Register a new model version
 *
 * @route   POST /api/v1/ml/models/version
 * @body    { modelName, version, algorithm, hyperparameters, trainingMetrics, trainingDataInfo }
 * @access  ML Engine (API Key required)
 */
const registerModelVersion = async (req, res, next) => {
  try {
    const {
      modelName,
      version,
      algorithm,
      hyperparameters = {},
      trainingMetrics = {},
      trainingDataInfo = {},
      description,
    } = req.body;

    // Validate required fields
    if (!modelName || !version || !algorithm) {
      throw new AppError('Missing required fields: modelName, version, algorithm', 400, 'MISSING_FIELDS');
    }

    // Check if version already exists
    const existingVersion = await ModelVersion.findOne({
      where: { modelName, version },
    });

    if (existingVersion) {
      throw new AppError(`Model version ${modelName}:${version} already exists`, 409, 'VERSION_EXISTS');
    }

    // Create model version
    const modelVersion = await ModelVersion.create({
      modelName,
      version,
      algorithm,
      hyperparameters,
      trainingMetrics,
      trainingDataInfo,
      description,
      status: 'trained', // 'trained', 'testing', 'deployed', 'retired'
      isActive: false, // Not active by default
    });

    res.status(201).json({
      success: true,
      data: {
        modelId: modelVersion.id,
        modelName: modelVersion.modelName,
        version: modelVersion.version,
        algorithm: modelVersion.algorithm,
        status: modelVersion.status,
        message: 'Model version registered successfully',
      },
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        service: req.service?.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update model version status
 *
 * @route   PUT /api/v1/ml/models/:modelId/status
 * @body    { status, isActive }
 * @access  ML Engine (API Key required)
 */
const updateModelStatus = async (req, res, next) => {
  try {
    const { modelId } = req.params;
    const { status, isActive } = req.body;

    // Validate status
    const validStatuses = ['trained', 'testing', 'deployed', 'retired'];
    if (status && !validStatuses.includes(status)) {
      throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400, 'INVALID_STATUS');
    }

    // Find model
    const modelVersion = await ModelVersion.findByPk(modelId);
    if (!modelVersion) {
      throw new AppError(`Model with ID ${modelId} not found`, 404, 'MODEL_NOT_FOUND');
    }

    // Update status
    if (status) modelVersion.status = status;
    if (typeof isActive === 'boolean') modelVersion.isActive = isActive;

    await modelVersion.save();

    res.status(200).json({
      success: true,
      data: {
        modelId: modelVersion.id,
        modelName: modelVersion.modelName,
        version: modelVersion.version,
        status: modelVersion.status,
        isActive: modelVersion.isActive,
        message: 'Model status updated successfully',
      },
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        service: req.service?.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get model versions
 *
 * @route   GET /api/v1/ml/models
 * @query   ?modelName=signal_predictor&status=deployed&limit=20&offset=0
 * @access  ML Engine (API Key required)
 */
const getModelVersions = async (req, res, next) => {
  try {
    const {
      modelName,
      status,
      isActive,
      limit = 20,
      offset = 0,
    } = req.query;

    // Build query
    const where = {};
    if (modelName) where.modelName = modelName;
    if (status) where.status = status;
    if (typeof isActive !== 'undefined') where.isActive = isActive === 'true';

    // Fetch models
    const { rows: models, count: total } = await ModelVersion.findAndCountAll({
      where,
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: {
        models,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + models.length < total,
        },
      },
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        service: req.service?.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get model version by ID
 *
 * @route   GET /api/v1/ml/models/:modelId
 * @access  ML Engine (API Key required)
 */
const getModelVersionById = async (req, res, next) => {
  try {
    const { modelId } = req.params;

    const modelVersion = await ModelVersion.findByPk(modelId);
    if (!modelVersion) {
      throw new AppError(`Model with ID ${modelId} not found`, 404, 'MODEL_NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: modelVersion,
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        service: req.service?.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log model training session
 *
 * @route   POST /api/v1/ml/models/:modelId/training-logs
 * @body    { trainingMetrics, validationMetrics, hyperparameters, duration }
 * @access  ML Engine (API Key required)
 */
const logTrainingSession = async (req, res, next) => {
  try {
    const { modelId } = req.params;
    const {
      trainingMetrics = {},
      validationMetrics = {},
      hyperparameters = {},
      duration,
      notes,
    } = req.body;

    // Verify model exists
    const modelVersion = await ModelVersion.findByPk(modelId);
    if (!modelVersion) {
      throw new AppError(`Model with ID ${modelId} not found`, 404, 'MODEL_NOT_FOUND');
    }

    // Create training log
    const trainingLog = await ModelTrainingLog.create({
      modelVersionId: modelId,
      trainingMetrics,
      validationMetrics,
      hyperparameters,
      trainingDuration: duration,
      notes,
    });

    res.status(201).json({
      success: true,
      data: {
        logId: trainingLog.id,
        modelId,
        message: 'Training session logged successfully',
      },
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        service: req.service?.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create A/B test
 *
 * @route   POST /api/v1/ml/models/ab-test
 * @body    { name, modelAId, modelBId, trafficSplit, targetMetric }
 * @access  ML Engine (API Key required)
 */
const createABTest = async (req, res, next) => {
  try {
    const {
      name,
      modelAId,
      modelBId,
      trafficSplit = 50,
      targetMetric = 'accuracy',
      description,
    } = req.body;

    // Validate required fields
    if (!name || !modelAId || !modelBId) {
      throw new AppError('Missing required fields: name, modelAId, modelBId', 400, 'MISSING_FIELDS');
    }

    // Verify both models exist
    const [modelA, modelB] = await Promise.all([
      ModelVersion.findByPk(modelAId),
      ModelVersion.findByPk(modelBId),
    ]);

    if (!modelA || !modelB) {
      throw new AppError('One or both model IDs are invalid', 404, 'MODEL_NOT_FOUND');
    }

    // Create A/B test
    const abTest = await ModelABTest.create({
      name,
      modelAId,
      modelBId,
      trafficSplit,
      targetMetric,
      description,
      status: 'running', // 'running', 'paused', 'completed'
      startDate: new Date(),
    });

    res.status(201).json({
      success: true,
      data: {
        testId: abTest.id,
        name: abTest.name,
        modelA: modelA.version,
        modelB: modelB.version,
        status: abTest.status,
        message: 'A/B test created successfully',
      },
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        service: req.service?.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get active A/B tests
 *
 * @route   GET /api/v1/ml/models/ab-tests
 * @query   ?status=running&limit=10
 * @access  ML Engine (API Key required)
 */
const getABTests = async (req, res, next) => {
  try {
    const { status, limit = 10, offset = 0 } = req.query;

    const where = {};
    if (status) where.status = status;

    const { rows: tests, count: total } = await ModelABTest.findAndCountAll({
      where,
      limit: Math.min(parseInt(limit), 50),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      include: [
        { model: ModelVersion, as: 'modelA', attributes: ['id', 'modelName', 'version'] },
        { model: ModelVersion, as: 'modelB', attributes: ['id', 'modelName', 'version'] },
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        tests,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + tests.length < total,
        },
      },
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        service: req.service?.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerModelVersion,
  updateModelStatus,
  getModelVersions,
  getModelVersionById,
  logTrainingSession,
  createABTest,
  getABTests,
};
