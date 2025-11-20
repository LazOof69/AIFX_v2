/**
 * Discord Users API Controller
 * Handles Discord Bot requests for user data
 *
 * This controller provides APIs for Discord Bot to access user information
 * following the microservices architecture principles (CLAUDE.md)
 */

const { User, UserDiscordSettings, UserPreferences } = require('../../../models');
const AppError = require('../../../utils/AppError');

/**
 * Get user by Discord ID
 *
 * @route GET /api/v1/discord/users/:discordId
 * @access Private (Discord Bot API Key required)
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
const getUserByDiscordId = async (req, res, next) => {
  try {
    const { discordId } = req.params;

    // Find user by Discord ID
    const discordSettings = await UserDiscordSettings.findOne({
      where: { discordUserId: discordId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email', 'isActive', 'createdAt'],
        },
        {
          model: UserPreferences,
          as: 'preferences',
          required: false,
        },
      ],
    });

    if (!discordSettings) {
      throw new AppError(
        `User with Discord ID ${discordId} not found`,
        404,
        'USER_NOT_FOUND'
      );
    }

    // Format response
    const userData = {
      id: discordSettings.user.id,
      username: discordSettings.user.username,
      email: discordSettings.user.email,
      isActive: discordSettings.user.isActive,
      discordId: discordSettings.discordUserId,
      discordUsername: discordSettings.discordUsername,
      discordSettings: {
        notificationsEnabled: discordSettings.notificationsEnabled,
        enabledTimeframes: discordSettings.enabledTimeframes,
        preferredPairs: discordSettings.preferredPairs,
        minConfidence: parseFloat(discordSettings.minConfidence),
        onlyMlEnhanced: discordSettings.onlyMlEnhanced,
        maxNotificationsPerDay: discordSettings.maxNotificationsPerDay,
        notificationCooldownMinutes: discordSettings.notificationCooldownMinutes,
      },
      preferences: discordSettings.preferences || null,
      createdAt: discordSettings.user.createdAt,
    };

    res.status(200).json({
      success: true,
      data: userData,
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        requestId: req.id,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or update user
 *
 * @route POST /api/v1/discord/users
 * @access Private (Discord Bot API Key required)
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
const createOrUpdateUser = async (req, res, next) => {
  try {
    const {
      discordId,
      discordUsername,
      username,
      email,
      notificationsEnabled,
    } = req.body;

    if (!discordId) {
      throw new AppError('Discord ID is required', 400, 'MISSING_DISCORD_ID');
    }

    if (!username && !discordUsername) {
      throw new AppError('Username or discordUsername is required', 400, 'MISSING_USERNAME');
    }

    // Check if user already exists
    let discordSettings = await UserDiscordSettings.findOne({
      where: { discordUserId: discordId },
      include: [{ model: User, as: 'user' }],
    });

    let user;
    let isNew = false;

    if (discordSettings) {
      // Update existing user
      user = discordSettings.user;

      // Update user info if provided
      if (username && username !== user.username) {
        user.username = username;
        await user.save();
      }

      // Update Discord settings
      if (discordUsername) {
        discordSettings.discordUsername = discordUsername;
      }
      if (typeof notificationsEnabled === 'boolean') {
        discordSettings.notificationsEnabled = notificationsEnabled;
      }
      await discordSettings.save();
    } else {
      // Create new user
      isNew = true;

      // Generate a default email if not provided
      const userEmail = email || `discord_${discordId}@aifx.placeholder`;
      const defaultPassword = `discord_${discordId}_${Date.now()}`;

      user = await User.create({
        email: userEmail,
        username: username || discordUsername || `discord_user_${discordId.substring(0, 8)}`,
        password: defaultPassword,
        isActive: true,
        isVerified: true,
      });

      // Create Discord settings
      discordSettings = await UserDiscordSettings.create({
        userId: user.id,
        discordUserId: discordId,
        discordUsername: discordUsername || username,
        notificationsEnabled: notificationsEnabled !== false, // Default true
      });

      // Create default preferences
      await UserPreferences.create({
        userId: user.id,
        tradingFrequency: 'daytrading',
        riskLevel: 5,
        preferredPairs: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
      });
    }

    res.status(isNew ? 201 : 200).json({
      success: true,
      data: {
        userId: user.id,
        discordId: discordSettings.discordUserId,
        username: user.username,
        created: isNew,
        message: isNew ? 'User created successfully' : 'User updated successfully',
      },
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        requestId: req.id,
      },
    });
  } catch (error) {
    // Handle unique constraint violations
    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0].path;
      return next(new AppError(
        `${field} already exists`,
        409,
        'DUPLICATE_ENTRY'
      ));
    }

    next(error);
  }
};

/**
 * Update Discord settings
 *
 * @route PUT /api/v1/discord/users/:discordId/settings
 * @access Private (Discord Bot API Key required)
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
const updateDiscordSettings = async (req, res, next) => {
  try {
    const { discordId } = req.params;
    const {
      notificationsEnabled,
      enabledTimeframes,
      preferredPairs,
      minConfidence,
      onlyMlEnhanced,
      maxNotificationsPerDay,
      notificationCooldownMinutes,
    } = req.body;

    // Find user's Discord settings
    const discordSettings = await UserDiscordSettings.findOne({
      where: { discordUserId: discordId },
    });

    if (!discordSettings) {
      throw new AppError(
        `User with Discord ID ${discordId} not found`,
        404,
        'USER_NOT_FOUND'
      );
    }

    // Update settings
    if (typeof notificationsEnabled === 'boolean') {
      discordSettings.notificationsEnabled = notificationsEnabled;
    }
    if (enabledTimeframes) {
      discordSettings.enabledTimeframes = enabledTimeframes;
    }
    if (preferredPairs) {
      discordSettings.preferredPairs = preferredPairs;
    }
    if (minConfidence !== undefined) {
      discordSettings.minConfidence = minConfidence;
    }
    if (typeof onlyMlEnhanced === 'boolean') {
      discordSettings.onlyMlEnhanced = onlyMlEnhanced;
    }
    if (maxNotificationsPerDay) {
      discordSettings.maxNotificationsPerDay = maxNotificationsPerDay;
    }
    if (notificationCooldownMinutes) {
      discordSettings.notificationCooldownMinutes = notificationCooldownMinutes;
    }

    await discordSettings.save();

    res.status(200).json({
      success: true,
      data: {
        discordId: discordSettings.discordUserId,
        settings: {
          notificationsEnabled: discordSettings.notificationsEnabled,
          enabledTimeframes: discordSettings.enabledTimeframes,
          preferredPairs: discordSettings.preferredPairs,
          minConfidence: parseFloat(discordSettings.minConfidence),
          onlyMlEnhanced: discordSettings.onlyMlEnhanced,
          maxNotificationsPerDay: discordSettings.maxNotificationsPerDay,
          notificationCooldownMinutes: discordSettings.notificationCooldownMinutes,
        },
        updatedAt: discordSettings.updatedAt,
        message: 'Settings updated successfully',
      },
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        requestId: req.id,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserByDiscordId,
  createOrUpdateUser,
  updateDiscordSettings,
};
