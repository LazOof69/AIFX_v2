/**
 * Discord API Routes Index
 * Combines all Discord Bot API routes
 *
 * This is the main entry point for /api/v1/discord/* endpoints
 * Following microservices architecture principles (CLAUDE.md)
 */

const express = require('express');
const router = express.Router();

// Import Discord API subroutes
const usersRoutes = require('./users');
const signalsRoutes = require('./signals');
const tradesRoutes = require('./trades');

// Mount subroutes
router.use('/users', usersRoutes);
router.use('/signals', signalsRoutes);
router.use('/trades', tradesRoutes);

// Health check for Discord API
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      service: 'discord-api',
      timestamp: new Date().toISOString(),
    },
    error: null,
    metadata: {
      timestamp: new Date().toISOString(),
      version: 'v1',
    },
  });
});

module.exports = router;
