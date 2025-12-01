/**
 * Scheduled Signal Service
 * Periodically generates signals for predefined currency pairs and timeframes
 * Only saves to database when signal state changes
 */

const tradingSignalService = require('./tradingSignalService');
const TradingSignal = require('../models/TradingSignal');
const logger = require('../utils/logger');
const redis = require('redis');

/**
 * Configuration for scheduled signal tracking
 */
const CONFIG = {
  // 3 currency pairs to track
  PAIRS: ['EUR/USD', 'GBP/USD', 'USD/JPY'],

  // 4 timeframes to track
  TIMEFRAMES: ['15min', '1h', '4h', '1d'],

  // Check interval (5 minutes)
  CHECK_INTERVAL_MS: 5 * 60 * 1000,

  // Redis key prefix for last signal state
  REDIS_KEY_PREFIX: 'signal_state:'
};

class ScheduledSignalService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.redisClient = null;
    this.lastSignals = new Map(); // In-memory fallback if Redis unavailable
  }

  /**
   * Initialize Redis client for state tracking
   */
  async initRedis() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redisClient = redis.createClient({ url: redisUrl });
      this.redisClient.on('error', (err) => logger.error('ScheduledSignal Redis error:', err));
      await this.redisClient.connect();
      logger.info('ScheduledSignalService: Redis connected');
    } catch (error) {
      logger.warn('ScheduledSignalService: Redis not available, using in-memory storage');
      this.redisClient = null;
    }
  }

  /**
   * Get the Redis key for a pair+timeframe combination
   */
  getRedisKey(pair, timeframe) {
    return `${CONFIG.REDIS_KEY_PREFIX}${pair.replace('/', '_')}_${timeframe}`;
  }

  /**
   * Get last saved signal state for pair+timeframe
   */
  async getLastSignalState(pair, timeframe) {
    const key = this.getRedisKey(pair, timeframe);

    if (this.redisClient && this.redisClient.isReady) {
      try {
        const data = await this.redisClient.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        logger.warn(`Redis get error for ${key}:`, error.message);
      }
    }

    // Fallback to in-memory
    return this.lastSignals.get(key) || null;
  }

  /**
   * Save signal state for pair+timeframe
   */
  async saveSignalState(pair, timeframe, signalData) {
    const key = this.getRedisKey(pair, timeframe);
    const state = {
      signal: signalData.signal,
      confidence: signalData.confidence,
      timestamp: new Date().toISOString()
    };

    if (this.redisClient && this.redisClient.isReady) {
      try {
        await this.redisClient.set(key, JSON.stringify(state), { EX: 86400 }); // 24h TTL
      } catch (error) {
        logger.warn(`Redis set error for ${key}:`, error.message);
      }
    }

    // Always save to in-memory as backup
    this.lastSignals.set(key, state);
  }

  /**
   * Start the scheduled signal service
   */
  async start() {
    if (this.isRunning) {
      logger.warn('ScheduledSignalService already running');
      return;
    }

    await this.initRedis();
    this.isRunning = true;
    logger.info('🚀 ScheduledSignalService started');
    logger.info(`📊 Tracking ${CONFIG.PAIRS.length} pairs x ${CONFIG.TIMEFRAMES.length} timeframes = ${CONFIG.PAIRS.length * CONFIG.TIMEFRAMES.length} combinations`);
    logger.info(`⏰ Check interval: ${CONFIG.CHECK_INTERVAL_MS / 1000 / 60} minutes`);

    // Run immediately on start
    await this.runSignalCheck();

    // Then run every CHECK_INTERVAL_MS
    this.intervalId = setInterval(() => {
      this.runSignalCheck();
    }, CONFIG.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the scheduled signal service
   */
  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
    }

    this.isRunning = false;
    logger.info('🛑 ScheduledSignalService stopped');
  }

  /**
   * Run signal check for all pairs and timeframes
   */
  async runSignalCheck() {
    const startTime = Date.now();
    logger.info('============================================================');
    logger.info('📡 Scheduled signal check started');

    let totalChecked = 0;
    let signalChanges = 0;
    let errors = 0;

    for (const pair of CONFIG.PAIRS) {
      for (const timeframe of CONFIG.TIMEFRAMES) {
        try {
          const changed = await this.checkAndSaveSignal(pair, timeframe);
          totalChecked++;
          if (changed) signalChanges++;
        } catch (error) {
          errors++;
          logger.error(`Error checking ${pair} (${timeframe}):`, error.message);
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`✅ Scheduled signal check completed in ${duration}ms`);
    logger.info(`   Total checked: ${totalChecked}`);
    logger.info(`   Signal changes: ${signalChanges}`);
    logger.info(`   Errors: ${errors}`);
    logger.info('============================================================');
  }

  /**
   * Normalize signal value to match database enum ('buy', 'sell', 'hold')
   * ML Engine may return 'standby' which maps to 'hold'
   */
  normalizeSignal(signal) {
    const normalized = signal?.toLowerCase();
    if (normalized === 'standby') return 'hold';
    if (['buy', 'sell', 'hold'].includes(normalized)) return normalized;
    return 'hold'; // Default to hold for unknown signals
  }

  /**
   * Check signal for a pair+timeframe and save if changed
   * @returns {boolean} True if signal changed and was saved
   */
  async checkAndSaveSignal(pair, timeframe) {
    try {
      // Generate new signal
      const newSignalData = await tradingSignalService.generateSignal(pair, { timeframe });
      const rawSignal = newSignalData.signal;
      const newSignal = this.normalizeSignal(rawSignal); // Normalize: standby -> hold

      // Get last recorded signal state
      const lastState = await this.getLastSignalState(pair, timeframe);
      const oldSignal = lastState?.signal || null;

      // Check if signal changed
      if (oldSignal !== newSignal) {
        logger.info(`🚨 Signal CHANGED: ${pair} (${timeframe}): ${oldSignal || 'INITIAL'} → ${newSignal.toUpperCase()}`);

        // Save to TradingSignal database table
        await TradingSignal.create({
          userId: null, // System-generated signal
          pair: pair,
          timeframe: timeframe,
          signal: newSignal,
          confidence: newSignalData.confidence,
          factors: newSignalData.factors,
          entryPrice: newSignalData.entryPrice,
          stopLoss: newSignalData.stopLoss,
          takeProfit: newSignalData.takeProfit,
          riskRewardRatio: newSignalData.riskRewardRatio,
          source: newSignalData.source || 'scheduled_check',
          signalStrength: newSignalData.signalStrength,
          marketCondition: newSignalData.marketCondition,
          technicalData: newSignalData.technicalData,
          status: 'active',
          expiresAt: newSignalData.expiresAt
        });

        logger.info(`💾 Signal saved to database: ${pair} (${timeframe}) = ${newSignal.toUpperCase()}`);

        // Update signal state with normalized signal
        await this.saveSignalState(pair, timeframe, { ...newSignalData, signal: newSignal });

        return true;
      }

      // Signal unchanged
      logger.debug(`No change for ${pair} (${timeframe}): ${newSignal}`);
      return false;

    } catch (error) {
      logger.error(`Error in checkAndSaveSignal for ${pair} (${timeframe}):`, error);
      throw error;
    }
  }

  /**
   * Get configuration
   */
  getConfig() {
    return CONFIG;
  }

  /**
   * Check if service is running
   */
  isServiceRunning() {
    return this.isRunning;
  }
}

module.exports = new ScheduledSignalService();
