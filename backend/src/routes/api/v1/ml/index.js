/**
 * ML API Routes Index
 * Combines all ML Engine API routes
 *
 * This is the main entry point for /api/v1/ml/* endpoints
 * Following microservices architecture principles (CLAUDE.md)
 */

const express = require('express');
const router = express.Router();
const { apiKeyAuth } = require('../../../../middleware/api/apiKeyAuth');

// Import ML API subroutes
const trainingDataRoutes = require('./training-data');
const modelsRoutes = require('./models');
const predictionsRoutes = require('./predictions');

// Mount subroutes
router.use('/training-data', trainingDataRoutes);
router.use('/models', modelsRoutes);
router.use('/predictions', predictionsRoutes);

// Health check for ML API (with API Key auth)
router.get('/health', apiKeyAuth, (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      service: 'ml-api',
      timestamp: new Date().toISOString(),
    },
    error: null,
    metadata: {
      timestamp: new Date().toISOString(),
      version: 'v1',
      service: req.service?.name,
    },
  });
});

module.exports = router;
