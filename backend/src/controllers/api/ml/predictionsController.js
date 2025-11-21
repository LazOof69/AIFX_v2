/**
 * ML Predictions API Controller
 * Manages ML predictions and accuracy metrics
 *
 * Following microservices architecture principles (CLAUDE.md):
 * - ML Engine submits predictions via API
 * - Backend stores and tracks prediction accuracy
 */

const { TradingSignal, ModelVersion } = require('../../../models');
const { Op } = require('sequelize');
const { sequelize } = require('../../../config/database');
const AppError = require('../../../utils/AppError');

/**
 * Submit a new prediction (create trading signal)
 *
 * @route   POST /api/v1/ml/predictions
 * @body    { pair, timeframe, signal, confidence, factors, entryPrice, stopLoss, takeProfit, modelVersionId, ... }
 * @access  ML Engine (API Key required)
 */
const submitPrediction = async (req, res, next) => {
  try {
    const {
      pair,
      timeframe,
      signal,
      confidence,
      factors = {},
      entryPrice,
      stopLoss,
      takeProfit,
      riskRewardRatio,
      positionSize,
      signalStrength = 'moderate',
      marketCondition,
      technicalData = {},
      modelVersionId,
      userId = null, // null for system-wide signals
    } = req.body;

    // Validate required fields
    if (!pair || !timeframe || !signal || !confidence || !entryPrice) {
      throw new AppError(
        'Missing required fields: pair, timeframe, signal, confidence, entryPrice',
        400,
        'MISSING_FIELDS'
      );
    }

    // Validate pair format
    if (!/^[A-Z]{3}\/[A-Z]{3}$/.test(pair)) {
      throw new AppError('Invalid currency pair format. Expected format: EUR/USD', 400, 'INVALID_PAIR');
    }

    // Validate signal type
    const validSignals = ['buy', 'sell', 'hold'];
    if (!validSignals.includes(signal)) {
      throw new AppError(`Invalid signal. Must be one of: ${validSignals.join(', ')}`, 400, 'INVALID_SIGNAL');
    }

    // Validate confidence range
    if (confidence < 0 || confidence > 1) {
      throw new AppError('Confidence must be between 0 and 1', 400, 'INVALID_CONFIDENCE');
    }

    // Verify model version exists if provided
    if (modelVersionId) {
      const modelVersion = await ModelVersion.findByPk(modelVersionId);
      if (!modelVersion) {
        throw new AppError(`Model version with ID ${modelVersionId} not found`, 404, 'MODEL_NOT_FOUND');
      }
    }

    // Create trading signal
    const tradingSignal = await TradingSignal.create({
      userId,
      pair,
      timeframe,
      signal,
      confidence,
      factors,
      entryPrice,
      stopLoss,
      takeProfit,
      riskRewardRatio,
      positionSize,
      source: 'ml_engine',
      signalStrength,
      marketCondition,
      technicalData,
      status: 'active',
      actualOutcome: 'pending',
      isNotified: false,
    });

    res.status(201).json({
      success: true,
      data: {
        predictionId: tradingSignal.id,
        pair: tradingSignal.pair,
        signal: tradingSignal.signal,
        confidence: tradingSignal.confidence,
        entryPrice: tradingSignal.entryPrice,
        message: 'Prediction submitted successfully',
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
 * Update prediction outcome
 *
 * @route   PUT /api/v1/ml/predictions/:predictionId/outcome
 * @body    { outcome, actualPnL, actualPnLPercent }
 * @access  ML Engine (API Key required)
 */
const updatePredictionOutcome = async (req, res, next) => {
  try {
    const { predictionId } = req.params;
    const { outcome, actualPnL, actualPnLPercent } = req.body;

    // Validate outcome
    const validOutcomes = ['win', 'loss', 'breakeven'];
    if (!validOutcomes.includes(outcome)) {
      throw new AppError(`Invalid outcome. Must be one of: ${validOutcomes.join(', ')}`, 400, 'INVALID_OUTCOME');
    }

    // Find signal
    const signal = await TradingSignal.findByPk(predictionId);
    if (!signal) {
      throw new AppError(`Prediction with ID ${predictionId} not found`, 404, 'PREDICTION_NOT_FOUND');
    }

    // Update outcome
    await signal.updateOutcome(outcome, actualPnL, actualPnLPercent);

    res.status(200).json({
      success: true,
      data: {
        predictionId: signal.id,
        outcome: signal.actualOutcome,
        actualPnL: signal.actualPnL,
        actualPnLPercent: signal.actualPnLPercent,
        durationMinutes: signal.durationMinutes,
        message: 'Prediction outcome updated successfully',
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
 * Get prediction accuracy statistics
 *
 * @route   GET /api/v1/ml/predictions/accuracy
 * @query   ?modelVersionId=uuid&pair=EUR/USD&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * @access  ML Engine (API Key required)
 */
const getPredictionAccuracy = async (req, res, next) => {
  try {
    const {
      modelVersionId,
      pair,
      startDate,
      endDate,
      minConfidence,
    } = req.query;

    // Build query
    const where = {
      source: 'ml_engine',
      actualOutcome: { [Op.ne]: 'pending' },
    };

    if (pair) where.pair = pair;
    if (minConfidence) where.confidence = { [Op.gte]: parseFloat(minConfidence) };

    // Add date range
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    // Get statistics
    const stats = await TradingSignal.getStatistics(null, startDate, endDate);

    // Get outcome distribution
    const [winCount, lossCount, breakevenCount] = await Promise.all([
      TradingSignal.count({ where: { ...where, actualOutcome: 'win' } }),
      TradingSignal.count({ where: { ...where, actualOutcome: 'loss' } }),
      TradingSignal.count({ where: { ...where, actualOutcome: 'breakeven' } }),
    ]);

    // Calculate confidence-stratified accuracy
    const confidenceBuckets = [
      { min: 0.0, max: 0.5 },
      { min: 0.5, max: 0.7 },
      { min: 0.7, max: 0.85 },
      { min: 0.85, max: 1.0 },
    ];

    const accuracyByConfidence = await Promise.all(
      confidenceBuckets.map(async (bucket) => {
        const bucketWhere = {
          ...where,
          confidence: {
            [Op.gte]: bucket.min,
            [Op.lt]: bucket.max,
          },
        };

        const [total, wins] = await Promise.all([
          TradingSignal.count({ where: bucketWhere }),
          TradingSignal.count({ where: { ...bucketWhere, actualOutcome: 'win' } }),
        ]);

        return {
          confidenceRange: `${bucket.min}-${bucket.max}`,
          totalPredictions: total,
          accuracy: total > 0 ? ((wins / total) * 100).toFixed(2) : 0,
        };
      })
    );

    // Get average P&L
    const avgPnL = await TradingSignal.findOne({
      where: { ...where, actualPnL: { [Op.ne]: null } },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('actual_pnl')), 'avgPnL'],
        [sequelize.fn('SUM', sequelize.col('actual_pnl')), 'totalPnL'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      raw: true,
    });

    res.status(200).json({
      success: true,
      data: {
        filters: {
          pair: pair || 'all',
          startDate,
          endDate,
          minConfidence,
        },
        overall: {
          totalPredictions: stats.totalSignals,
          winRate: stats.winRate,
          averagePnL: stats.averagePnL,
          totalPnL: stats.totalPnL,
        },
        outcomeDistribution: {
          wins: winCount,
          losses: lossCount,
          breakeven: breakevenCount,
        },
        accuracyByConfidence,
        performance: {
          totalTrades: avgPnL?.count || 0,
          avgPnL: avgPnL?.avgPnL ? parseFloat(avgPnL.avgPnL) : 0,
          totalPnL: avgPnL?.totalPnL ? parseFloat(avgPnL.totalPnL) : 0,
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
 * Get recent predictions
 *
 * @route   GET /api/v1/ml/predictions
 * @query   ?pair=EUR/USD&status=active&limit=20&offset=0
 * @access  ML Engine (API Key required)
 */
const getRecentPredictions = async (req, res, next) => {
  try {
    const {
      pair,
      status,
      outcome,
      minConfidence,
      limit = 20,
      offset = 0,
    } = req.query;

    // Build query
    const where = {
      source: 'ml_engine',
    };

    if (pair) where.pair = pair;
    if (status) where.status = status;
    if (outcome) where.actualOutcome = outcome;
    if (minConfidence) where.confidence = { [Op.gte]: parseFloat(minConfidence) };

    // Fetch predictions
    const { rows: predictions, count: total } = await TradingSignal.findAndCountAll({
      where,
      limit: Math.min(parseInt(limit), 100),
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
        'signalStrength',
        'status',
        'actualOutcome',
        'actualPnL',
        'actualPnLPercent',
        'createdAt',
        'triggeredAt',
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        predictions,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + predictions.length < total,
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
  submitPrediction,
  updatePredictionOutcome,
  getPredictionAccuracy,
  getRecentPredictions,
};
