/**
 * Discord Signals API Routes
 * Routes for Discord Bot to access trading signals
 *
 * All routes require Discord Bot API Key authentication
 */

const express = require('express');
const router = express.Router();
const { apiKeyAuth, requireService } = require('../../../../middleware/api/apiKeyAuth');
const { asyncHandler } = require('../../../../middleware/errorHandler');
const {
  getPendingSignals,
  markSignalDelivered,
  getSignalById,
} = require('../../../../controllers/api/discord/signalsController');

// Apply API Key authentication to all routes
router.use(apiKeyAuth);

// Require Discord Bot service
router.use(requireService('discord-bot'));

/**
 * @route   GET /api/v1/discord/signals
 * @desc    Get pending trading signals for Discord notifications
 * @query   status - Signal status (default: 'active')
 * @query   limit - Maximum number of signals (default: 50, max: 100)
 * @query   offset - Pagination offset (default: 0)
 * @access  Private (Discord Bot API Key)
 */
router.get('/', asyncHandler(getPendingSignals));

/**
 * @route   GET /api/v1/discord/signals/:signalId
 * @desc    Get signal details by ID
 * @access  Private (Discord Bot API Key)
 */
router.get('/:signalId', asyncHandler(getSignalById));

/**
 * @route   POST /api/v1/discord/signals/:signalId/delivered
 * @desc    Mark signal as delivered to Discord user
 * @access  Private (Discord Bot API Key)
 */
router.post('/:signalId/delivered', asyncHandler(markSignalDelivered));

module.exports = router;
