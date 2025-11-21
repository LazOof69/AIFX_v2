/**
 * ML Training Data API Routes
 * Routes for ML Engine to access training data
 *
 * All routes require ML Engine API Key authentication
 */

const express = require('express');
const router = express.Router();
const { apiKeyAuth, requireService } = require('../../../../middleware/api/apiKeyAuth');
const { asyncHandler } = require('../../../../middleware/errorHandler');
const {
  getMarketData,
  getHistoricalSignals,
  getUserTrades,
  getTrainingDataStats,
} = require('../../../../controllers/api/ml/trainingDataController');

// Apply API Key authentication to all routes
router.use(apiKeyAuth);

// Require ML Engine service
router.use(requireService('ml-engine'));

/**
 * @route   GET /api/v1/ml/training-data/market/:pair
 * @desc    Get market data for training
 * @query   startDate, endDate, timeframe, limit, offset
 * @access  ML Engine
 */
router.get('/market/:pair', asyncHandler(getMarketData));

/**
 * @route   GET /api/v1/ml/training-data/signals
 * @desc    Get historical trading signals
 * @query   pair, outcome, startDate, endDate, minConfidence, limit, offset
 * @access  ML Engine
 */
router.get('/signals', asyncHandler(getHistoricalSignals));

/**
 * @route   GET /api/v1/ml/training-data/trades
 * @desc    Get user trading history
 * @query   pair, status, startDate, endDate, limit, offset
 * @access  ML Engine
 */
router.get('/trades', asyncHandler(getUserTrades));

/**
 * @route   GET /api/v1/ml/training-data/stats
 * @desc    Get training data statistics
 * @query   pair
 * @access  ML Engine
 */
router.get('/stats', asyncHandler(getTrainingDataStats));

module.exports = router;
