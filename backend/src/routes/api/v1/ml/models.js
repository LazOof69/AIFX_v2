/**
 * ML Models API Routes
 * Routes for ML Engine model management
 *
 * All routes require ML Engine API Key authentication
 */

const express = require('express');
const router = express.Router();
const { apiKeyAuth, requireService } = require('../../../../middleware/api/apiKeyAuth');
const { asyncHandler } = require('../../../../middleware/errorHandler');
const {
  registerModelVersion,
  updateModelStatus,
  getModelVersions,
  getModelVersionById,
  logTrainingSession,
  createABTest,
  getABTests,
} = require('../../../../controllers/api/ml/modelsController');

// Apply API Key authentication to all routes
router.use(apiKeyAuth);

// Require ML Engine service
router.use(requireService('ml-engine'));

/**
 * @route   POST /api/v1/ml/models/version
 * @desc    Register a new model version
 * @body    modelName, version, algorithm, hyperparameters, trainingMetrics, etc.
 * @access  ML Engine
 */
router.post('/version', asyncHandler(registerModelVersion));

/**
 * @route   GET /api/v1/ml/models
 * @desc    Get model versions
 * @query   modelName, status, isActive, limit, offset
 * @access  ML Engine
 */
router.get('/', asyncHandler(getModelVersions));

/**
 * @route   GET /api/v1/ml/models/:modelId
 * @desc    Get model version by ID
 * @access  ML Engine
 */
router.get('/:modelId', asyncHandler(getModelVersionById));

/**
 * @route   PUT /api/v1/ml/models/:modelId/status
 * @desc    Update model status
 * @body    status, isActive
 * @access  ML Engine
 */
router.put('/:modelId/status', asyncHandler(updateModelStatus));

/**
 * @route   POST /api/v1/ml/models/:modelId/training-logs
 * @desc    Log a training session
 * @body    trainingMetrics, validationMetrics, hyperparameters, duration
 * @access  ML Engine
 */
router.post('/:modelId/training-logs', asyncHandler(logTrainingSession));

/**
 * @route   POST /api/v1/ml/models/ab-test
 * @desc    Create A/B test
 * @body    name, modelAId, modelBId, trafficSplit, targetMetric
 * @access  ML Engine
 */
router.post('/ab-test', asyncHandler(createABTest));

/**
 * @route   GET /api/v1/ml/models/ab-tests
 * @desc    Get A/B tests
 * @query   status, limit, offset
 * @access  ML Engine
 */
router.get('/ab-tests', asyncHandler(getABTests));

module.exports = router;
