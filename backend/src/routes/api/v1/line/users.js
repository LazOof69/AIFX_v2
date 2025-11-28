/**
 * LINE Users API Routes
 * Routes for LINE Bot to access user data
 *
 * All routes require LINE Bot API Key authentication
 */

const express = require('express');
const router = express.Router();
const { apiKeyAuth, requireService } = require('../../../../middleware/api/apiKeyAuth');
const { asyncHandler } = require('../../../../middleware/errorHandler');
const {
  getUserByLineId,
  createOrUpdateUser,
  updateLineSettings,
} = require('../../../../controllers/api/line/usersController');

// Apply API Key authentication to all routes
router.use(apiKeyAuth);

// Require LINE Bot service
router.use(requireService('line-bot'));

/**
 * @route   GET /api/v1/line/users/:lineUserId
 * @desc    Get user by LINE ID
 * @access  Private (LINE Bot API Key)
 */
router.get('/:lineUserId', asyncHandler(getUserByLineId));

/**
 * @route   POST /api/v1/line/users
 * @desc    Create or update user
 * @access  Private (LINE Bot API Key)
 */
router.post('/', asyncHandler(createOrUpdateUser));

/**
 * @route   PUT /api/v1/line/users/:lineUserId/settings
 * @desc    Update LINE settings
 * @access  Private (LINE Bot API Key)
 */
router.put('/:lineUserId/settings', asyncHandler(updateLineSettings));

module.exports = router;
