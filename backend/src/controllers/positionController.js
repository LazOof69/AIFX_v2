const positionService = require('../services/positionService');
const logger = require('../utils/logger');

/**
 * Position Controller
 * Handles user position management endpoints
 * Part of Phase 3: Trading Lifecycle Management v3.0
 */

/**
 * Open a new position
 * @route POST /api/v1/positions/open
 * @access Private
 */
exports.openPosition = async (req, res) => {
  try {
    const { signalId, pair, action, entryPrice, positionSize, stopLoss, takeProfit, notes } = req.body;
    const userId = req.user.id; // From auth middleware

    // Validate required fields
    if (!pair || !action || !entryPrice) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Missing required fields: pair, action, entryPrice',
        timestamp: new Date().toISOString(),
      });
    }

    const position = await positionService.openPosition({
      userId,
      signalId,
      pair,
      action,
      entryPrice,
      positionSize,
      stopLoss,
      takeProfit,
      notes,
    });

    res.status(201).json({
      success: true,
      data: position,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Open position error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: error.message || 'Failed to open position',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Close a position
 * @route POST /api/v1/positions/close
 * @access Private
 */
exports.closePosition = async (req, res) => {
  try {
    const { positionId, exitPrice, exitPercentage, notes } = req.body;

    // Validate required fields
    if (!positionId || !exitPrice) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Missing required fields: positionId, exitPrice',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await positionService.closePosition(positionId, {
      exitPrice,
      exitPercentage: exitPercentage || 100,
      notes,
    });

    // Handle partial close response (returns {closedPosition, remainingPosition})
    // vs full close response (returns position object)
    const responseData = result.closedPosition ? {
      closedPosition: result.closedPosition,
      remainingPosition: result.remainingPosition,
      isPartialClose: true
    } : result;

    res.status(200).json({
      success: true,
      data: responseData,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Close position error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      data: null,
      error: error.message || 'Failed to close position',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Adjust position stop loss and take profit
 * @route PUT /api/v1/positions/:id/adjust
 * @access Private
 */
exports.adjustPosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { stopLoss, takeProfit } = req.body;

    // Validate at least one field is provided
    if (stopLoss === undefined && takeProfit === undefined) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'At least one of stopLoss or takeProfit must be provided',
        timestamp: new Date().toISOString(),
      });
    }

    const position = await positionService.adjustPosition(id, {
      stopLoss,
      takeProfit,
    });

    res.status(200).json({
      success: true,
      data: position,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Adjust position error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      data: null,
      error: error.message || 'Failed to adjust position',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get single position by ID
 * @route GET /api/v1/positions/:id
 * @access Private
 */
exports.getPosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeMonitoring = 'true', monitoringLimit = '10' } = req.query;

    const position = await positionService.getPosition(id, {
      includeMonitoring: includeMonitoring === 'true',
      monitoringLimit: parseInt(monitoringLimit, 10),
    });

    res.status(200).json({
      success: true,
      data: position,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Get position error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      data: null,
      error: error.message || 'Failed to fetch position',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get monitoring history for a position
 * @route GET /api/v1/positions/:id/monitor
 * @access Private
 */
exports.getMonitoringHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = '100' } = req.query;

    const position = await positionService.getPosition(id, {
      includeMonitoring: true,
      monitoringLimit: parseInt(limit, 10),
    });

    res.status(200).json({
      success: true,
      data: {
        positionId: id,
        monitoringRecords: position.monitoringRecords || [],
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Get monitoring history error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      data: null,
      error: error.message || 'Failed to fetch monitoring history',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get all positions for authenticated user
 * @route GET /api/v1/positions/user/:userId
 * @access Private
 */
exports.getUserPositions = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      status = 'all',
      pair,
      startDate,
      endDate,
      limit = '50',
      offset = '0',
    } = req.query;

    // Validate user can only access their own positions (unless admin)
    if (userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'You can only access your own positions',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await positionService.getUserPositions(userId, {
      status,
      pair,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    res.status(200).json({
      success: true,
      data: result,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Get user positions error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: error.message || 'Failed to fetch positions',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get position statistics for authenticated user
 * @route GET /api/v1/positions/user/:userId/statistics
 * @access Private
 */
exports.getPositionStatistics = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate user can only access their own statistics (unless admin)
    if (userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'You can only access your own statistics',
        timestamp: new Date().toISOString(),
      });
    }

    const statistics = await positionService.getPositionStatistics(userId, {
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    });

    res.status(200).json({
      success: true,
      data: statistics,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Get position statistics error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: error.message || 'Failed to fetch statistics',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get all open positions (admin only, for monitoring)
 * @route GET /api/v1/positions/open
 * @access Private (Admin)
 */
exports.getAllOpenPositions = async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'Admin access required',
        timestamp: new Date().toISOString(),
      });
    }

    const { limit = '1000' } = req.query;

    const positions = await positionService.getAllOpenPositions({
      limit: parseInt(limit, 10),
    });

    res.status(200).json({
      success: true,
      data: {
        positions,
        total: positions.length,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Get all open positions error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: error.message || 'Failed to fetch open positions',
      timestamp: new Date().toISOString(),
    });
  }
};

module.exports = exports;
