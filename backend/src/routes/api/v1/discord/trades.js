/**
 * Discord Trades API Routes
 * Routes for Discord Bot to access and record trading history
 *
 * All routes require Discord Bot API Key authentication
 */

const express = require('express');
const router = express.Router();
const { apiKeyAuth, requireService } = require('../../../../middleware/api/apiKeyAuth');
const { asyncHandler } = require('../../../../middleware/errorHandler');
const {
  getTradingHistory,
  recordTrade,
  updateTrade,
} = require('../../../../controllers/api/discord/tradesController');

// Apply API Key authentication to all routes
router.use(apiKeyAuth);

// Require Discord Bot service
router.use(requireService('discord-bot'));

/**
 * @route   GET /api/v1/discord/trades
 * @desc    Get user trading history
 * @query   userId - User ID (required if discordId not provided)
 * @query   discordId - Discord ID (required if userId not provided)
 * @query   limit - Maximum number of trades (default: 20, max: 100)
 * @query   offset - Pagination offset (default: 0)
 * @query   pair - Filter by currency pair (optional)
 * @access  Private (Discord Bot API Key)
 */
router.get('/', asyncHandler(getTradingHistory));

/**
 * @route   POST /api/v1/discord/trades
 * @desc    Record a new trade
 * @access  Private (Discord Bot API Key)
 */
router.post('/', asyncHandler(recordTrade));

/**
 * @route   PUT /api/v1/discord/trades/:tradeId
 * @desc    Update trade (e.g., close position)
 * @access  Private (Discord Bot API Key)
 */
router.put('/:tradeId', asyncHandler(updateTrade));

module.exports = router;
