/**
 * LINE Users API Controller
 * Handles LINE Bot requests for user data
 *
 * This controller provides APIs for LINE Bot to access user information
 * following the microservices architecture principles (CLAUDE.md)
 */

const { User, UserLineSettings, UserPreferences } = require('../../../models');
const AppError = require('../../../utils/AppError');

/**
 * Get user by LINE ID
 *
 * @route GET /api/v1/line/users/:lineUserId
 * @access Private (LINE Bot API Key required)
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
const getUserByLineId = async (req, res, next) => {
  try {
    const { lineUserId } = req.params;

    // Find user by LINE ID
    const lineSettings = await UserLineSettings.findOne({
      where: { lineUserId: lineUserId },
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

    if (!lineSettings) {
      throw new AppError(
        `User with LINE ID ${lineUserId} not found`,
        404,
        'USER_NOT_FOUND'
      );
    }

    // Format response
    const userData = {
      id: lineSettings.user.id,
      username: lineSettings.user.username,
      email: lineSettings.user.email,
      isActive: lineSettings.user.isActive,
      lineUserId: lineSettings.lineUserId,
      lineDisplayName: lineSettings.lineDisplayName,
      lineSettings: {
        notificationsEnabled: lineSettings.notificationsEnabled,
        enabledTimeframes: lineSettings.enabledTimeframes,
        preferredPairs: lineSettings.preferredPairs,
        minConfidence: parseFloat(lineSettings.minConfidence),
        onlyMlEnhanced: lineSettings.onlyMlEnhanced,
        maxNotificationsPerDay: lineSettings.maxNotificationsPerDay,
        notificationCooldownMinutes: lineSettings.notificationCooldownMinutes,
      },
      preferences: lineSettings.preferences || null,
      createdAt: lineSettings.user.createdAt,
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
 * @route POST /api/v1/line/users
 * @access Private (LINE Bot API Key required)
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
const createOrUpdateUser = async (req, res, next) => {
  try {
    const {
      lineUserId,
      lineDisplayName,
      username,
      email,
      notificationsEnabled,
    } = req.body;

    if (!lineUserId) {
      throw new AppError('LINE user ID is required', 400, 'MISSING_LINE_USER_ID');
    }

    if (!username && !lineDisplayName) {
      throw new AppError('Username or lineDisplayName is required', 400, 'MISSING_USERNAME');
    }

    // Check if user already exists
    let lineSettings = await UserLineSettings.findOne({
      where: { lineUserId: lineUserId },
      include: [{ model: User, as: 'user' }],
    });

    let user;
    let isNew = false;

    if (lineSettings) {
      // Update existing user
      user = lineSettings.user;

      // Update user info if provided
      if (username && username !== user.username) {
        user.username = username;
        await user.save();
      }

      // Update LINE settings
      if (lineDisplayName) {
        lineSettings.lineDisplayName = lineDisplayName;
      }
      if (typeof notificationsEnabled === 'boolean') {
        lineSettings.notificationsEnabled = notificationsEnabled;
      }
      await lineSettings.save();
    } else {
      // Create new user
      isNew = true;

      // Generate a default email if not provided
      const userEmail = email || `line_${lineUserId}@aifx.placeholder`;
      const defaultPassword = `line_${lineUserId}_${Date.now()}`;

      // Generate a safe username (only alphanumeric and underscores)
      let safeUsername = username;
      if (!safeUsername) {
        // Use lineUserId to create a unique, safe username
        const shortId = lineUserId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
        safeUsername = `line_${shortId}`;
      }

      user = await User.create({
        email: userEmail,
        username: safeUsername,
        password: defaultPassword,
        isActive: true,
        isVerified: true,
      });

      // Create LINE settings
      lineSettings = await UserLineSettings.create({
        userId: user.id,
        lineUserId: lineUserId,
        lineDisplayName: lineDisplayName || username,
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
        lineUserId: lineSettings.lineUserId,
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
 * Update LINE settings
 *
 * @route PUT /api/v1/line/users/:lineUserId/settings
 * @access Private (LINE Bot API Key required)
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
const updateLineSettings = async (req, res, next) => {
  try {
    const { lineUserId } = req.params;
    const {
      notificationsEnabled,
      enabledTimeframes,
      preferredPairs,
      minConfidence,
      onlyMlEnhanced,
      maxNotificationsPerDay,
      notificationCooldownMinutes,
    } = req.body;

    // Find user's LINE settings
    const lineSettings = await UserLineSettings.findOne({
      where: { lineUserId: lineUserId },
    });

    if (!lineSettings) {
      throw new AppError(
        `User with LINE ID ${lineUserId} not found`,
        404,
        'USER_NOT_FOUND'
      );
    }

    // Update settings
    if (typeof notificationsEnabled === 'boolean') {
      lineSettings.notificationsEnabled = notificationsEnabled;
    }
    if (enabledTimeframes) {
      lineSettings.enabledTimeframes = enabledTimeframes;
    }
    if (preferredPairs) {
      lineSettings.preferredPairs = preferredPairs;
    }
    if (minConfidence !== undefined) {
      lineSettings.minConfidence = minConfidence;
    }
    if (typeof onlyMlEnhanced === 'boolean') {
      lineSettings.onlyMlEnhanced = onlyMlEnhanced;
    }
    if (maxNotificationsPerDay) {
      lineSettings.maxNotificationsPerDay = maxNotificationsPerDay;
    }
    if (notificationCooldownMinutes) {
      lineSettings.notificationCooldownMinutes = notificationCooldownMinutes;
    }

    await lineSettings.save();

    res.status(200).json({
      success: true,
      data: {
        lineUserId: lineSettings.lineUserId,
        settings: {
          notificationsEnabled: lineSettings.notificationsEnabled,
          enabledTimeframes: lineSettings.enabledTimeframes,
          preferredPairs: lineSettings.preferredPairs,
          minConfidence: parseFloat(lineSettings.minConfidence),
          onlyMlEnhanced: lineSettings.onlyMlEnhanced,
          maxNotificationsPerDay: lineSettings.maxNotificationsPerDay,
          notificationCooldownMinutes: lineSettings.notificationCooldownMinutes,
        },
        updatedAt: lineSettings.updatedAt,
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
  getUserByLineId,
  createOrUpdateUser,
  updateLineSettings,
};
