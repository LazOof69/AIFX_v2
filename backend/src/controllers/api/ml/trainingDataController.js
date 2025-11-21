/**
 * ML Training Data API Controller
 * Provides training data access for ML Engine
 *
 * Following microservices architecture principles (CLAUDE.md):
 * - Only Backend has direct database access
 * - ML Engine must use these APIs to fetch training data
 */

const { MarketData, TradingSignal, UserTradingHistory } = require('../../../models');
const { Op } = require('sequelize');
const AppError = require('../../../utils/AppError');

/**
 * Get market data for training
 *
 * @route   GET /api/v1/ml/training-data/market/:pair
 * @query   ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&timeframe=1h&limit=1000&offset=0
 * @access  ML Engine (API Key required)
 */
const getMarketData = async (req, res, next) => {
  try {
    const { pair } = req.params;
    const {
      startDate,
      endDate,
      timeframe = '1h',
      limit = 1000,
      offset = 0,
    } = req.query;

    // Validate pair format
    if (!/^[A-Z]{3}\/[A-Z]{3}$/.test(pair)) {
      throw new AppError('Invalid currency pair format. Expected format: EUR/USD', 400, 'INVALID_PAIR');
    }

    // Build query
    const where = {
      pair,
      timeframe,
    };

    // Add date range if provided
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp[Op.gte] = new Date(startDate);
      if (endDate) where.timestamp[Op.lte] = new Date(endDate);
    }

    // Fetch market data
    const { rows: data, count: total } = await MarketData.findAndCountAll({
      where,
      limit: Math.min(parseInt(limit), 10000), // Max 10k records per request
      offset: parseInt(offset),
      order: [['timestamp', 'ASC']],
      attributes: [
        'id',
        'pair',
        'timeframe',
        'timestamp',
        'open',
        'high',
        'low',
        'close',
        'volume',
        'technicalIndicators',
        'createdAt',
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        pair,
        timeframe,
        marketData: data,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + data.length < total,
        },
      },
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        service: req.service?.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get historical trading signals for training
 *
 * @route   GET /api/v1/ml/training-data/signals
 * @query   ?pair=EUR/USD&outcome=win&startDate=YYYY-MM-DD&limit=1000&offset=0
 * @access  ML Engine (API Key required)
 */
const getHistoricalSignals = async (req, res, next) => {
  try {
    const {
      pair,
      outcome, // 'win', 'loss', 'breakeven', 'pending'
      startDate,
      endDate,
      minConfidence,
      limit = 1000,
      offset = 0,
    } = req.query;

    // Build query
    const where = {};

    if (pair) where.pair = pair;
    if (outcome) where.actualOutcome = outcome;
    if (minConfidence) where.confidence = { [Op.gte]: parseFloat(minConfidence) };

    // Add date range
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    // Fetch signals
    const { rows: signals, count: total } = await TradingSignal.findAndCountAll({
      where,
      limit: Math.min(parseInt(limit), 10000),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      attributes: [
        'id',
        'pair',
        'timeframe',
        'signal',
        'confidence',
        'factors',
        'entryPrice',
        'stopLoss',
        'takeProfit',
        'riskRewardRatio',
        'source',
        'signalStrength',
        'marketCondition',
        'technicalData',
        'status',
        'actualOutcome',
        'actualPnL',
        'actualPnLPercent',
        'durationMinutes',
        'createdAt',
        'triggeredAt',
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        signals,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + signals.length < total,
        },
      },
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        service: req.service?.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user trading history for training
 *
 * @route   GET /api/v1/ml/training-data/trades
 * @query   ?pair=EUR/USD&status=closed_profit&limit=1000&offset=0
 * @access  ML Engine (API Key required)
 */
const getUserTrades = async (req, res, next) => {
  try {
    const {
      pair,
      status,
      startDate,
      endDate,
      limit = 1000,
      offset = 0,
    } = req.query;

    // Build query
    const where = {};

    if (pair) where.pair = pair;
    if (status) where.status = status;

    // Add date range
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    // Fetch trades
    const { rows: trades, count: total } = await UserTradingHistory.findAndCountAll({
      where,
      limit: Math.min(parseInt(limit), 10000),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      attributes: [
        'id',
        'userId',
        'pair',
        'action',
        'positionSize',
        'entryPrice',
        'exitPrice',
        'stopLoss',
        'takeProfit',
        'profitLoss',
        'profitLossPercentage',
        'status',
        'signalId',
        'createdAt',
        'closedAt',
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        trades,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + trades.length < total,
        },
      },
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        service: req.service?.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get training data statistics
 *
 * @route   GET /api/v1/ml/training-data/stats
 * @access  ML Engine (API Key required)
 */
const getTrainingDataStats = async (req, res, next) => {
  try {
    const { pair } = req.query;
    const where = pair ? { pair } : {};

    // Get counts
    const [marketDataCount, signalsCount, tradesCount] = await Promise.all([
      MarketData.count({ where }),
      TradingSignal.count({ where }),
      UserTradingHistory.count({ where }),
    ]);

    // Get date ranges
    const [
      oldestMarketData,
      latestMarketData,
      oldestSignal,
      latestSignal,
    ] = await Promise.all([
      MarketData.findOne({
        where,
        order: [['timestamp', 'ASC']],
        attributes: ['timestamp'],
      }),
      MarketData.findOne({
        where,
        order: [['timestamp', 'DESC']],
        attributes: ['timestamp'],
      }),
      TradingSignal.findOne({
        where,
        order: [['createdAt', 'ASC']],
        attributes: ['createdAt'],
      }),
      TradingSignal.findOne({
        where,
        order: [['createdAt', 'DESC']],
        attributes: ['createdAt'],
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        pair: pair || 'all',
        marketData: {
          count: marketDataCount,
          oldestRecord: oldestMarketData?.timestamp,
          latestRecord: latestMarketData?.timestamp,
        },
        signals: {
          count: signalsCount,
          oldestRecord: oldestSignal?.createdAt,
          latestRecord: latestSignal?.createdAt,
        },
        trades: {
          count: tradesCount,
        },
      },
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        service: req.service?.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMarketData,
  getHistoricalSignals,
  getUserTrades,
  getTrainingDataStats,
};
