const { TradingSignal, UserPreference } = require('../models');
const { Op } = require('sequelize');

/**
 * Trading Controller
 * Handles trading signals and recommendations
 */

/**
 * Get trading signal for specific currency pair
 * @route GET /api/v1/trading/signal/:pair
 */
exports.getSignal = async (req, res) => {
  try {
    const { pair } = req.params;

    // Validate pair format
    const pairRegex = /^[A-Z]{3}\/[A-Z]{3}$/;
    if (!pairRegex.test(pair)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid currency pair format. Expected format: EUR/USD',
        timestamp: new Date().toISOString(),
      });
    }

    // Get latest active signal for this pair
    const signal = await TradingSignal.findOne({
      where: {
        pair,
        status: 'active',
      },
      order: [['createdAt', 'DESC']],
    });

    if (!signal) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'No active signal found for this pair',
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      success: true,
      data: signal,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get signal error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get all trading signals with pagination
 * @route GET /api/v1/trading/signals
 */
exports.getSignals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      pair,
      action,
      status = 'active',
    } = req.query;

    // Build where clause
    const where = {};

    if (pair) where.pair = pair;
    if (action) where.action = action;
    if (status) where.status = status;

    // Calculate offset
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get signals
    const { count, rows: signals } = await TradingSignal.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
    });

    // Calculate pagination
    const totalPages = Math.ceil(count / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        signals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get signals error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get personalized trading recommendation
 * @route GET /api/v1/trading/recommendation
 */
exports.getRecommendation = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user preferences
    const preferences = await UserPreference.findOne({
      where: { userId },
    });

    if (!preferences) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'User preferences not found',
        timestamp: new Date().toISOString(),
      });
    }

    // Get signals matching user preferences
    const signals = await TradingSignal.findAll({
      where: {
        pair: {
          [Op.in]: preferences.preferredPairs,
        },
        status: 'active',
        confidence: {
          [Op.gte]: (preferences.notificationSettings?.minConfidence || 70) / 100,
        },
      },
      order: [['confidence', 'DESC']],
      limit: 5,
    });

    if (signals.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'No recommendations available at this time',
        timestamp: new Date().toISOString(),
      });
    }

    // Return top signal and alternatives
    res.status(200).json({
      success: true,
      data: {
        signal: signals[0],
        alternativeSignals: signals.slice(1),
        reason: `Matching your ${preferences.tradingStyle} trading style and risk level ${preferences.riskLevel}`,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get recommendation error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get trading history
 * @route GET /api/v1/trading/history
 */
exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      page = 1,
      limit = 10,
      status,
      startDate,
      endDate,
    } = req.query;

    // Build where clause
    const where = { userId };

    if (status) where.status = status;

    if (startDate || endDate) {
      where.openedAt = {};
      if (startDate) where.openedAt[Op.gte] = new Date(startDate);
      if (endDate) where.openedAt[Op.lte] = new Date(endDate);
    }

    // Calculate offset
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // For now, return empty array as UserTradingHistory model needs to be created
    // This is a placeholder implementation
    res.status(200).json({
      success: true,
      data: {
        history: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0,
        },
        statistics: {
          totalTrades: 0,
          winRate: 0,
          totalProfitLoss: 0,
        },
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};