/**
 * Discord Users API Routes
 * Routes for Discord Bot to access user data
 *
 * All routes require Discord Bot API Key authentication
 */

const express = require('express');
const router = express.Router();
const { apiKeyAuth, requireService } = require('../../../../middleware/api/apiKeyAuth');
const { asyncHandler } = require('../../../../middleware/errorHandler');
const {
  getUserByDiscordId,
  createOrUpdateUser,
  updateDiscordSettings,
} = require('../../../../controllers/api/discord/usersController');

// Apply API Key authentication to all routes
router.use(apiKeyAuth);

// Require Discord Bot service
router.use(requireService('discord-bot'));

/**
 * @route   GET /api/v1/discord/users/:discordId
 * @desc    Get user by Discord ID
 * @access  Private (Discord Bot API Key)
 */
router.get('/:discordId', asyncHandler(getUserByDiscordId));

/**
 * @route   POST /api/v1/discord/users
 * @desc    Create or update user
 * @access  Private (Discord Bot API Key)
 */
router.post('/', asyncHandler(createOrUpdateUser));

/**
 * @route   PUT /api/v1/discord/users/:discordId/settings
 * @desc    Update Discord settings
 * @access  Private (Discord Bot API Key)
 */
router.put('/:discordId/settings', asyncHandler(updateDiscordSettings));

module.exports = router;
