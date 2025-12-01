/**
 * Market Data Collector Service
 *
 * Purpose: Periodically collect and store market data from external APIs
 * Runs every 15 minutes to collect 15min and 1h timeframe data
 *
 * Created: 2025-10-20
 */

const cron = require('node-cron');
const forexService = require('./forexService');
const { MarketData } = require('../models');
const logger = require('../utils/logger');

// Configuration for data collection
// Updated to match scheduledSignalService requirements
const COLLECTION_CONFIG = {
  pairs: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
  timeframes: ['15min', '1h', '4h', '1d'],
  batchSize: 100, // Number of historical candles to fetch initially
  updateSize: 10   // Number of recent candles to fetch on updates
};

/**
 * Market Data Collector Class
 */
class MarketDataCollector {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
    this.lastCollectionTime = null;
    this.stats = {
      totalCollections: 0,
      successfulCollections: 0,
      failedCollections: 0,
      candlesStored: 0
    };
    this.initialized = false;
  }

  /**
   * Store market data in database
   * @param {string} pair - Currency pair
   * @param {string} timeframe - Timeframe
   * @param {Array} candles - Array of candle data
   * @returns {Promise<number>} Number of candles stored
   */
  async storeMarketData(pair, timeframe, candles) {
    let storedCount = 0;

    try {
      for (const candle of candles) {
        try {
          // Use upsert to avoid duplicate entries
          await MarketData.upsert({
            pair: pair,
            timeframe: timeframe,
            timestamp: new Date(candle.timestamp),
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
            volume: parseFloat(candle.volume) || 0.0,
            source: 'yfinance',
            isRealTime: false
          });
          storedCount++;
        } catch (error) {
          // Skip duplicates or invalid data
          if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
            logger.warn(`Failed to store candle for ${pair} ${timeframe}:`, {
              timestamp: candle.timestamp,
              error: error.message
            });
          }
        }
      }

      return storedCount;
    } catch (error) {
      logger.error(`Error storing market data for ${pair} ${timeframe}:`, error);
      throw error;
    }
  }

  /**
   * Collect data for a single pair/timeframe combination
   * @param {string} pair - Currency pair
   * @param {string} timeframe - Timeframe
   * @param {number} limit - Number of candles to fetch
   * @returns {Promise<Object>} Collection result
   */
  async collectData(pair, timeframe, limit = 10) {
    try {
      logger.debug(`Collecting ${pair} ${timeframe} data (limit: ${limit})...`);

      // Fetch historical data from forex service
      const result = await forexService.getHistoricalData(pair, timeframe, limit);

      if (!result || !result.data || !result.data.timeSeries || !Array.isArray(result.data.timeSeries)) {
        throw new Error(`Invalid data format received from forex service`);
      }

      const candles = result.data.timeSeries;

      if (candles.length === 0) {
        logger.warn(`No data received for ${pair} ${timeframe}`);
        return {
          success: false,
          pair,
          timeframe,
          candlesCollected: 0,
          candlesStored: 0,
          error: 'No data received'
        };
      }

      // Store in database
      const storedCount = await this.storeMarketData(pair, timeframe, candles);

      logger.info(`✅ Collected ${pair} ${timeframe}: ${candles.length} candles, ${storedCount} stored`);

      return {
        success: true,
        pair,
        timeframe,
        candlesCollected: candles.length,
        candlesStored: storedCount,
        cached: result.cached || false
      };

    } catch (error) {
      logger.error(`Failed to collect ${pair} ${timeframe}:`, {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        pair,
        timeframe,
        candlesCollected: 0,
        candlesStored: 0,
        error: error.message
      };
    }
  }

  /**
   * Initialize database with historical data
   * Run this once to populate the database with historical candles
   * @returns {Promise<void>}
   */
  async initializeHistoricalData() {
    if (this.initialized) {
      logger.info('Historical data already initialized, skipping...');
      return;
    }

    logger.info('='.repeat(60));
    logger.info('📦 Initializing historical market data');
    logger.info('='.repeat(60));

    const results = [];

    for (const pair of COLLECTION_CONFIG.pairs) {
      for (const timeframe of COLLECTION_CONFIG.timeframes) {
        try {
          // Check if we already have data for this pair/timeframe
          const existingCount = await MarketData.count({
            where: { pair, timeframe }
          });

          if (existingCount >= 60) {
            logger.info(`✅ ${pair} ${timeframe}: ${existingCount} candles already exist, skipping initialization`);
            continue;
          }

          logger.info(`Fetching historical data for ${pair} ${timeframe}...`);

          // Fetch large batch for initialization
          const result = await this.collectData(pair, timeframe, COLLECTION_CONFIG.batchSize);
          results.push(result);

          // Delay to respect API rate limits
          await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds delay (4 per minute)

        } catch (error) {
          logger.error(`Failed to initialize ${pair} ${timeframe}:`, error);
        }
      }
    }

    const totalStored = results.reduce((sum, r) => sum + (r.candlesStored || 0), 0);

    logger.info('='.repeat(60));
    logger.info(`✅ Historical data initialization completed`);
    logger.info(`   Total candles stored: ${totalStored}`);
    logger.info('='.repeat(60));

    this.initialized = true;
  }

  /**
   * Run periodic data collection (called by cron)
   */
  async runCollection() {
    if (this.isRunning) {
      logger.warn('⚠️  Previous collection still running, skipping this iteration');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('='.repeat(60));
      logger.info('📊 Starting market data collection');
      logger.info('='.repeat(60));

      this.stats.totalCollections++;
      this.lastCollectionTime = new Date();

      const results = [];

      // Collect data for all configured pairs and timeframes
      for (const pair of COLLECTION_CONFIG.pairs) {
        for (const timeframe of COLLECTION_CONFIG.timeframes) {
          const result = await this.collectData(pair, timeframe, COLLECTION_CONFIG.updateSize);
          results.push(result);

          // Small delay between requests to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds
        }
      }

      // Update statistics
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const totalStored = results.reduce((sum, r) => sum + (r.candlesStored || 0), 0);

      this.stats.successfulCollections += successful;
      this.stats.failedCollections += failed;
      this.stats.candlesStored += totalStored;

      const duration = Date.now() - startTime;

      logger.info('='.repeat(60));
      logger.info(`✅ Market data collection completed in ${duration}ms`);
      logger.info(`   Successful: ${successful}/${results.length}`);
      logger.info(`   Failed: ${failed}/${results.length}`);
      logger.info(`   Candles stored: ${totalStored}`);
      logger.info(`   Total collections: ${this.stats.totalCollections}`);
      logger.info(`   Total candles stored: ${this.stats.candlesStored}`);
      logger.info('='.repeat(60));

    } catch (error) {
      logger.error('Error in market data collection:', error);
      this.stats.failedCollections++;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the market data collector service
   */
  async start() {
    if (this.cronJob) {
      logger.warn('Market Data Collector is already running');
      return;
    }

    logger.info('🚀 Starting Market Data Collector Service');
    logger.info(`   Monitoring pairs: ${COLLECTION_CONFIG.pairs.join(', ')}`);
    logger.info(`   Monitoring timeframes: ${COLLECTION_CONFIG.timeframes.join(', ')}`);
    logger.info(`   Schedule: Every 15 minutes`);

    // Initialize historical data first
    try {
      await this.initializeHistoricalData();
    } catch (error) {
      logger.error('⚠️  Historical data initialization failed:', error.message);
      logger.warn('   Will continue with periodic updates');
    }

    // Cron pattern: Run every 15 minutes
    // Format: '*/15 * * * *' = Every 15 minutes (at :00, :15, :30, :45)
    this.cronJob = cron.schedule('*/15 * * * *', async () => {
      await this.runCollection();
    });

    // Run initial collection after 10 seconds
    setTimeout(() => {
      logger.info('🔍 Running initial data collection...');
      this.runCollection();
    }, 10000);

    logger.info('✅ Market Data Collector Service started');
  }

  /**
   * Stop the market data collector service
   */
  async stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('🛑 Market Data Collector Service stopped');
    }
  }

  /**
   * Get service status and statistics
   * @returns {Object} Status and stats
   */
  getStatus() {
    return {
      isRunning: !!this.cronJob,
      lastCollectionTime: this.lastCollectionTime,
      stats: this.stats,
      config: COLLECTION_CONFIG,
      initialized: this.initialized
    };
  }

  /**
   * Manually trigger a collection (for testing)
   */
  async triggerManualCollection() {
    logger.info('🔧 Manual collection triggered');
    await this.runCollection();
  }

  /**
   * Manually trigger historical data initialization (for testing)
   */
  async triggerInitialization() {
    logger.info('🔧 Manual initialization triggered');
    this.initialized = false;
    await this.initializeHistoricalData();
  }
}

// Singleton instance
const marketDataCollector = new MarketDataCollector();

module.exports = marketDataCollector;
