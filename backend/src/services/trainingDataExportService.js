/**
 * Training Data Export Service
 * Exports market data and trading signals for ML model training
 *
 * Features:
 * - Export OHLC data with technical indicators
 * - Export trading signals with actual outcomes
 * - Auto-label using market movement
 * - Generate CSV for ML engine
 * - Support time range filtering
 */

const fs = require('fs').promises;
const path = require('path');
const { Op } = require('sequelize');
const MarketData = require('../models/MarketData');
const TradingSignal = require('../models/TradingSignal');
const logger = require('../utils/logger');

/**
 * Export market data for training
 *
 * @param {object} options - Export options
 * @param {Date} options.startDate - Start date
 * @param {Date} options.endDate - End date
 * @param {string[]} options.pairs - Currency pairs to export
 * @param {string[]} options.timeframes - Timeframes to export
 * @param {string} options.outputPath - Output directory path
 * @returns {Promise<object>} Export result
 */
async function exportMarketData({
  startDate,
  endDate,
  pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY'],
  timeframes = ['1h', '4h', '1d'],
  outputPath = '/tmp/training_data'
}) {
  try {
    logger.info('🚀 Starting market data export', {
      startDate,
      endDate,
      pairs,
      timeframes
    });

    // Ensure output directory exists
    await fs.mkdir(outputPath, { recursive: true });

    const results = {
      totalRecords: 0,
      filesGenerated: [],
      errors: []
    };

    // Export data for each pair and timeframe combination
    for (const pair of pairs) {
      for (const timeframe of timeframes) {
        try {
          const data = await MarketData.findAll({
            where: {
              pair,
              timeframe,
              timestamp: {
                [Op.between]: [startDate, endDate]
              }
            },
            order: [['timestamp', 'ASC']],
            raw: true
          });

          if (data.length === 0) {
            logger.warn(`⚠️ No data found for ${pair} ${timeframe}`);
            continue;
          }

          // Generate CSV content
          const csvContent = await generateMarketDataCSV(data);

          // Write to file
          const filename = `market_data_${pair.replace('/', '_')}_${timeframe}.csv`;
          const filepath = path.join(outputPath, filename);
          await fs.writeFile(filepath, csvContent);

          results.totalRecords += data.length;
          results.filesGenerated.push({
            filename,
            records: data.length,
            pair,
            timeframe
          });

          logger.info(`✅ Exported ${data.length} records for ${pair} ${timeframe}`);

        } catch (error) {
          const errorMsg = `Failed to export ${pair} ${timeframe}: ${error.message}`;
          logger.error(errorMsg, error);
          results.errors.push(errorMsg);
        }
      }
    }

    logger.info(`✅ Market data export completed. Total records: ${results.totalRecords}`);
    return results;

  } catch (error) {
    logger.error('❌ Market data export failed', error);
    throw error;
  }
}

/**
 * Export trading signals with outcomes for training
 *
 * @param {object} options - Export options
 * @param {Date} options.startDate - Start date
 * @param {Date} options.endDate - End date
 * @param {boolean} options.autoLabel - Auto-label signals using market movement
 * @param {string} options.outputPath - Output directory path
 * @returns {Promise<object>} Export result
 */
async function exportTradingSignals({
  startDate,
  endDate,
  autoLabel = true,
  outputPath = '/tmp/training_data'
}) {
  try {
    logger.info('🚀 Starting trading signals export', {
      startDate,
      endDate,
      autoLabel
    });

    // Ensure output directory exists
    await fs.mkdir(outputPath, { recursive: true });

    // Fetch signals within date range
    const signals = await TradingSignal.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate]
        }
      },
      order: [['createdAt', 'ASC']],
      raw: true
    });

    logger.info(`📊 Found ${signals.length} signals to export`);

    // Auto-label signals if requested
    let labeledSignals = signals;
    let autoLabeledCount = 0;

    if (autoLabel) {
      const labelResult = await autoLabelSignals(signals);
      labeledSignals = labelResult.signals;
      autoLabeledCount = labelResult.labeled;
      logger.info(`🏷️ Auto-labeled ${autoLabeledCount} signals`);
    }

    // Generate CSV content
    const csvContent = await generateSignalsCSV(labeledSignals);

    // Write to file
    const filename = 'trading_signals_labeled.csv';
    const filepath = path.join(outputPath, filename);
    await fs.writeFile(filepath, csvContent);

    const results = {
      totalSignals: signals.length,
      autoLabeledCount,
      filename,
      filepath
    };

    logger.info(`✅ Trading signals export completed. Total: ${signals.length}, Auto-labeled: ${autoLabeledCount}`);
    return results;

  } catch (error) {
    logger.error('❌ Trading signals export failed', error);
    throw error;
  }
}

/**
 * Auto-label trading signals using market movement
 *
 * Strategy:
 * - For BUY signals: Check if price went up (close > entry) within timeframe
 * - For SELL signals: Check if price went down (close < entry) within timeframe
 * - For HOLD signals: Check if price stayed within ±0.5% range
 *
 * @param {object[]} signals - Array of signals
 * @returns {Promise<object>} Labeled signals and count
 */
async function autoLabelSignals(signals) {
  const labeledSignals = [];
  let labeledCount = 0;

  for (const signal of signals) {
    // Skip if already labeled
    if (signal.actual_outcome && signal.actual_outcome !== 'pending') {
      labeledSignals.push(signal);
      continue;
    }

    try {
      // Calculate time window based on timeframe
      const timeWindow = calculateTimeWindow(signal.timeframe);
      const endTime = new Date(signal.created_at.getTime() + timeWindow);

      // Fetch market data after signal creation
      const futureData = await MarketData.findOne({
        where: {
          pair: signal.pair,
          timeframe: signal.timeframe,
          timestamp: {
            [Op.between]: [signal.created_at, endTime]
          }
        },
        order: [['timestamp', 'DESC']],
        raw: true
      });

      if (!futureData) {
        // Not enough data to label
        labeledSignals.push(signal);
        continue;
      }

      // Calculate actual outcome based on market movement
      const entryPrice = parseFloat(signal.entry_price);
      const closePrice = parseFloat(futureData.close);
      const priceChange = ((closePrice - entryPrice) / entryPrice) * 100;

      let outcome = 'pending';
      let pnlPercent = 0;

      if (signal.signal === 'buy') {
        if (priceChange > 0.5) {
          outcome = 'win';
          pnlPercent = priceChange;
        } else if (priceChange < -0.5) {
          outcome = 'loss';
          pnlPercent = priceChange;
        } else {
          outcome = 'breakeven';
          pnlPercent = priceChange;
        }
      } else if (signal.signal === 'sell') {
        if (priceChange < -0.5) {
          outcome = 'win';
          pnlPercent = -priceChange; // Invert for sell
        } else if (priceChange > 0.5) {
          outcome = 'loss';
          pnlPercent = -priceChange;
        } else {
          outcome = 'breakeven';
          pnlPercent = -priceChange;
        }
      } else if (signal.signal === 'hold') {
        if (Math.abs(priceChange) <= 0.5) {
          outcome = 'win'; // Correctly predicted no significant movement
          pnlPercent = 0;
        } else {
          outcome = 'loss'; // Incorrectly predicted hold
          pnlPercent = 0;
        }
      }

      // Update signal with labeled outcome
      labeledSignals.push({
        ...signal,
        actual_outcome: outcome,
        actual_pnl_percent: pnlPercent.toFixed(2),
        auto_labeled: true
      });

      labeledCount++;

    } catch (error) {
      logger.warn(`⚠️ Failed to auto-label signal ${signal.id}: ${error.message}`);
      labeledSignals.push(signal);
    }
  }

  return {
    signals: labeledSignals,
    labeled: labeledCount
  };
}

/**
 * Calculate time window for auto-labeling based on timeframe
 *
 * @param {string} timeframe - Trading timeframe
 * @returns {number} Time window in milliseconds
 */
function calculateTimeWindow(timeframe) {
  const windows = {
    '1min': 5 * 60 * 1000,        // 5 minutes
    '5min': 15 * 60 * 1000,       // 15 minutes
    '15min': 30 * 60 * 1000,      // 30 minutes
    '30min': 60 * 60 * 1000,      // 1 hour
    '1h': 4 * 60 * 60 * 1000,     // 4 hours
    '4h': 24 * 60 * 60 * 1000,    // 24 hours (1 day)
    '1d': 7 * 24 * 60 * 60 * 1000, // 7 days (1 week)
    '1w': 30 * 24 * 60 * 60 * 1000, // 30 days (1 month)
    '1M': 90 * 24 * 60 * 60 * 1000  // 90 days (3 months)
  };

  return windows[timeframe] || 60 * 60 * 1000; // Default: 1 hour
}

/**
 * Generate CSV content from market data
 *
 * @param {object[]} data - Market data array
 * @returns {Promise<string>} CSV content
 */
async function generateMarketDataCSV(data) {
  // CSV headers
  const headers = [
    'timestamp',
    'pair',
    'timeframe',
    'open',
    'high',
    'low',
    'close',
    'volume',
    'technical_indicators',
    'source',
    'market_state'
  ];

  // Generate CSV rows
  const rows = data.map(row => {
    return [
      row.timestamp,
      row.pair,
      row.timeframe,
      row.open,
      row.high,
      row.low,
      row.close,
      row.volume || 0,
      JSON.stringify(row.technical_indicators || {}),
      row.source,
      row.market_state || ''
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generate CSV content from trading signals
 *
 * @param {object[]} signals - Trading signals array
 * @returns {Promise<string>} CSV content
 */
async function generateSignalsCSV(signals) {
  // CSV headers
  const headers = [
    'timestamp',
    'pair',
    'timeframe',
    'signal',
    'confidence',
    'entry_price',
    'stop_loss',
    'take_profit',
    'technical_factor',
    'sentiment_factor',
    'pattern_factor',
    'actual_outcome',
    'actual_pnl_percent',
    'auto_labeled',
    'source',
    'signal_strength',
    'market_condition'
  ];

  // Generate CSV rows
  const rows = signals.map(signal => {
    const factors = typeof signal.factors === 'string'
      ? JSON.parse(signal.factors)
      : signal.factors || {};

    return [
      signal.created_at,
      signal.pair,
      signal.timeframe,
      signal.signal,
      signal.confidence,
      signal.entry_price,
      signal.stop_loss || '',
      signal.take_profit || '',
      factors.technical || 0,
      factors.sentiment || 0,
      factors.pattern || 0,
      signal.actual_outcome || 'pending',
      signal.actual_pnl_percent || '',
      signal.auto_labeled || false,
      signal.source,
      signal.signal_strength || '',
      signal.market_condition || ''
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Export complete training dataset (market data + signals)
 *
 * @param {object} options - Export options
 * @returns {Promise<object>} Export result
 */
async function exportCompleteDataset({
  startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: last 30 days
  endDate = new Date(),
  pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY'],
  timeframes = ['1h', '4h', '1d'],
  autoLabel = true,
  outputPath = '/tmp/training_data'
}) {
  try {
    logger.info('🚀 Starting complete dataset export', {
      startDate,
      endDate,
      pairs,
      timeframes,
      autoLabel,
      outputPath
    });

    // Export market data
    const marketDataResult = await exportMarketData({
      startDate,
      endDate,
      pairs,
      timeframes,
      outputPath
    });

    // Export trading signals
    const signalsResult = await exportTradingSignals({
      startDate,
      endDate,
      autoLabel,
      outputPath
    });

    // Generate metadata file
    const metadata = {
      exportDate: new Date().toISOString(),
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      marketData: {
        pairs,
        timeframes,
        totalRecords: marketDataResult.totalRecords,
        filesGenerated: marketDataResult.filesGenerated
      },
      signals: {
        totalSignals: signalsResult.totalSignals,
        autoLabeledCount: signalsResult.autoLabeledCount,
        filename: signalsResult.filename
      },
      errors: marketDataResult.errors
    };

    const metadataPath = path.join(outputPath, 'export_metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    logger.info('✅ Complete dataset export finished successfully');
    logger.info(`📦 Output directory: ${outputPath}`);
    logger.info(`📊 Market data records: ${marketDataResult.totalRecords}`);
    logger.info(`🎯 Trading signals: ${signalsResult.totalSignals}`);
    logger.info(`🏷️ Auto-labeled: ${signalsResult.autoLabeledCount}`);

    return {
      success: true,
      metadata,
      outputPath
    };

  } catch (error) {
    logger.error('❌ Complete dataset export failed', error);
    throw error;
  }
}

/**
 * Get export statistics
 *
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<object>} Export statistics
 */
async function getExportStatistics(startDate, endDate) {
  try {
    const [marketDataCount, signalsCount, labeledSignalsCount] = await Promise.all([
      MarketData.count({
        where: {
          timestamp: {
            [Op.between]: [startDate, endDate]
          }
        }
      }),
      TradingSignal.count({
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        }
      }),
      TradingSignal.count({
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate]
          },
          actualOutcome: {
            [Op.ne]: 'pending'
          }
        }
      })
    ]);

    return {
      marketDataRecords: marketDataCount,
      totalSignals: signalsCount,
      labeledSignals: labeledSignalsCount,
      unlabeledSignals: signalsCount - labeledSignalsCount,
      labelingPercentage: signalsCount > 0
        ? ((labeledSignalsCount / signalsCount) * 100).toFixed(2)
        : 0
    };

  } catch (error) {
    logger.error('❌ Failed to get export statistics', error);
    throw error;
  }
}

module.exports = {
  exportMarketData,
  exportTradingSignals,
  exportCompleteDataset,
  autoLabelSignals,
  getExportStatistics,
  calculateTimeWindow
};
