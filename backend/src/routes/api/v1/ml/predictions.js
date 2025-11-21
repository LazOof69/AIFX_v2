/**
 * ML Predictions API Routes
 * Routes for ML Engine predictions management
 *
 * All routes require ML Engine API Key authentication
 */

const express = require('express');
const router = express.Router();
const { apiKeyAuth, requireService } = require('../../../../middleware/api/apiKeyAuth');
const { asyncHandler } = require('../../../../middleware/errorHandler');
const {
  submitPrediction,
  updatePredictionOutcome,
  getPredictionAccuracy,
  getRecentPredictions,
} = require('../../../../controllers/api/ml/predictionsController');

// Apply API Key authentication to all routes
router.use(apiKeyAuth);

// Require ML Engine service
router.use(requireService('ml-engine'));

/**
 * @route   POST /api/v1/ml/predictions
 * @desc    Submit a new prediction (create trading signal)
 * @body    pair, timeframe, signal, confidence, factors, entryPrice, etc.
 * @access  ML Engine
 */
router.post('/', asyncHandler(submitPrediction));

/**
 * @route   GET /api/v1/ml/predictions
 * @desc    Get recent predictions
 * @query   pair, status, outcome, minConfidence, limit, offset
 * @access  ML Engine
 */
router.get('/', asyncHandler(getRecentPredictions));

/**
 * @route   PUT /api/v1/ml/predictions/:predictionId/outcome
 * @desc    Update prediction outcome
 * @body    outcome, actualPnL, actualPnLPercent
 * @access  ML Engine
 */
router.put('/:predictionId/outcome', asyncHandler(updatePredictionOutcome));

/**
 * @route   GET /api/v1/ml/predictions/accuracy
 * @desc    Get prediction accuracy statistics
 * @query   modelVersionId, pair, startDate, endDate, minConfidence
 * @access  ML Engine
 */
router.get('/accuracy', asyncHandler(getPredictionAccuracy));

module.exports = router;
