const { UserPreference } = require('../models');

/**
 * User Preferences Controller
 * Handles user trading preferences and notification settings
 */

/**
 * Get user preferences
 * @route GET /api/v1/preferences
 */
exports.getPreferences = async (req, res) => {
  try {
    const userId = req.user.userId;

    const preferences = await UserPreference.findOne({
      where: { userId },
    });

    if (!preferences) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Preferences not found',
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      success: true,
      data: {
        tradingFrequency: preferences.tradingFrequency,
        riskLevel: preferences.riskLevel,
        preferredPairs: preferences.preferredPairs,
        tradingStyle: preferences.tradingStyle,
        indicators: preferences.indicators,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Update user preferences
 * @route PUT /api/v1/preferences
 */
exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      tradingFrequency,
      riskLevel,
      preferredPairs,
      tradingStyle,
      indicators,
    } = req.body;

    const preferences = await UserPreference.findOne({
      where: { userId },
    });

    if (!preferences) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Preferences not found',
        timestamp: new Date().toISOString(),
      });
    }

    // Validate riskLevel if provided
    if (riskLevel !== undefined && (riskLevel < 1 || riskLevel > 10)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Risk level must be between 1 and 10',
        timestamp: new Date().toISOString(),
      });
    }

    // Validate tradingFrequency if provided
    const validFrequencies = ['scalping', 'daytrading', 'swing', 'position'];
    if (tradingFrequency && !validFrequencies.includes(tradingFrequency)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid trading frequency',
        timestamp: new Date().toISOString(),
      });
    }

    // Validate tradingStyle if provided
    const validStyles = ['trend', 'counter-trend', 'mixed'];
    if (tradingStyle && !validStyles.includes(tradingStyle)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid trading style',
        timestamp: new Date().toISOString(),
      });
    }

    // Update preferences
    await preferences.update({
      tradingFrequency: tradingFrequency || preferences.tradingFrequency,
      riskLevel: riskLevel !== undefined ? riskLevel : preferences.riskLevel,
      preferredPairs: preferredPairs || preferences.preferredPairs,
      tradingStyle: tradingStyle || preferences.tradingStyle,
      indicators: indicators || preferences.indicators,
    });

    res.status(200).json({
      success: true,
      data: {
        tradingFrequency: preferences.tradingFrequency,
        riskLevel: preferences.riskLevel,
        preferredPairs: preferences.preferredPairs,
        tradingStyle: preferences.tradingStyle,
        indicators: preferences.indicators,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get notification settings
 * @route GET /api/v1/preferences/notifications
 */
exports.getNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.userId;

    const preferences = await UserPreference.findOne({
      where: { userId },
    });

    if (!preferences) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Preferences not found',
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      success: true,
      data: preferences.notificationSettings || {
        email: true,
        discord: false,
        browser: true,
        signalTypes: {
          buy: true,
          sell: true,
          hold: false,
        },
        minConfidence: 70,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Update notification settings
 * @route PUT /api/v1/preferences/notifications
 */
exports.updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const notificationSettings = req.body;

    const preferences = await UserPreference.findOne({
      where: { userId },
    });

    if (!preferences) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Preferences not found',
        timestamp: new Date().toISOString(),
      });
    }

    // Validate minConfidence if provided
    if (notificationSettings.minConfidence !== undefined) {
      const minConf = parseInt(notificationSettings.minConfidence);
      if (isNaN(minConf) || minConf < 0 || minConf > 100) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'Minimum confidence must be between 0 and 100',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Merge with existing settings
    const updatedSettings = {
      ...preferences.notificationSettings,
      ...notificationSettings,
    };

    await preferences.update({
      notificationSettings: updatedSettings,
    });

    res.status(200).json({
      success: true,
      data: updatedSettings,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};