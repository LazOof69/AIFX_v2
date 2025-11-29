/**
 * LINE Subscriptions API Routes
 * Routes for LINE Bot to manage user subscriptions
 *
 * All routes require LINE Bot API Key authentication
 */

const express = require('express');
const router = express.Router();
const { apiKeyAuth, requireService } = require('../../../../middleware/api/apiKeyAuth');
const { asyncHandler } = require('../../../../middleware/errorHandler');
const {
  subscribe,
  unsubscribe,
  getSubscriptions,
  getSubscribers,
} = require('../../../../controllers/api/line/subscriptionsController');

// Apply API Key authentication to all routes
router.use(apiKeyAuth);

// Require LINE Bot service
router.use(requireService('line-bot'));

/**
 * @route   POST /api/v1/line/subscriptions
 * @desc    Subscribe to signal changes for a pair
 * @access  Private (LINE Bot API Key)
 * @body    { lineUserId, pair, timeframe, lineDisplayName? }
 */
router.post('/', asyncHandler(subscribe));

/**
 * @route   POST /api/v1/line/subscriptions/unsubscribe
 * @desc    Unsubscribe from signal changes
 * @access  Private (LINE Bot API Key)
 * @body    { lineUserId, pair, timeframe }
 */
router.post('/unsubscribe', asyncHandler(unsubscribe));

/**
 * @route   GET /api/v1/line/subscriptions/:lineUserId
 * @desc    Get all subscriptions for a LINE user
 * @access  Private (LINE Bot API Key)
 */
router.get('/:lineUserId', asyncHandler(getSubscriptions));

/**
 * @route   GET /api/v1/line/subscriptions/subscribers/:pair/:timeframe
 * @desc    Get all LINE subscribers for a pair/timeframe (for signal monitoring)
 * @access  Private (Backend API Key)
 */
router.get('/subscribers/:pair/:timeframe', asyncHandler(getSubscribers));

module.exports = router;
