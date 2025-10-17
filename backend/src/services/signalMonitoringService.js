/**
 * Signal Monitoring Service
 *
 * Purpose: Automated monitoring service that checks for reversal signals
 * Runs every 15 minutes to check 4 combinations:
 * - EUR/USD 1h, EUR/USD 15min
 * - USD/JPY 1h, USD/JPY 15min
 *
 * Created: 2025-10-17
 */

const cron = require('node-cron');
const mlEngineService = require('./mlEngineService');
const discordNotificationService = require('./discordNotificationService');
const logger = require('../utils/logger');

// Define currency pairs and timeframes to monitor
const MONITORING_CONFIG = {
  pairs: ['EUR/USD', 'USD/JPY'],
  timeframes: ['1h', '15min']
};

/**
 * Signal Monitoring Service Class
 */
class SignalMonitoringService {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
    this.lastCheckTime = null;
    this.stats = {
      totalChecks: 0,
      signalsDetected: 0,
      errors: 0
    };
  }

  /**
   * Check a single pair/timeframe combination for reversal signal
   * @param {string} pair - Currency pair (e.g., "EUR/USD")
   * @param {string} timeframe - Timeframe ("1h" or "15min")
   * @returns {Promise<Object|null>} Signal data or null if no signal/error
   */
  async checkSignal(pair, timeframe) {
    try {
      logger.info(`Checking ${pair} ${timeframe} for reversal signals...`);

      // Call ML Engine to get prediction
      const result = await mlEngineService.predictReversal(pair, timeframe);

      if (!result.success) {
        logger.error(`Prediction failed for ${pair} ${timeframe}: ${result.error}`);
        this.stats.errors++;
        return null;
      }

      const prediction = result.prediction;

      // Check if a reversal signal is detected (not 'hold')
      if (prediction.signal !== 'hold') {
        logger.info(`🚨 REVERSAL SIGNAL DETECTED: ${pair} ${timeframe} - ${prediction.signal.toUpperCase()} (${(prediction.confidence * 100).toFixed(1)}%)`);

        this.stats.signalsDetected++;

        return {
          pair: prediction.pair,
          timeframe: prediction.timeframe,
          signal: prediction.signal, // 'long' or 'short'
          confidence: prediction.confidence,
          stage1_prob: prediction.stage1_prob,
          stage2_prob: prediction.stage2_prob,
          model_version: prediction.model_version,
          factors: prediction.factors,
          detected_at: new Date(),
          metadata: {
            warning: prediction.warning,
            timestamp: prediction.timestamp
          }
        };
      } else {
        logger.debug(`No reversal signal for ${pair} ${timeframe} (hold)`);
        return null;
      }

    } catch (error) {
      logger.error(`Error checking signal for ${pair} ${timeframe}:`, {
        error: error.message,
        stack: error.stack
      });
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Check all configured pair/timeframe combinations
   * @returns {Promise<Array>} Array of detected signals
   */
  async checkAllSignals() {
    const startTime = Date.now();
    logger.info('='.repeat(60));
    logger.info('🔍 Starting automated signal monitoring check');
    logger.info('='.repeat(60));

    this.stats.totalChecks++;
    this.lastCheckTime = new Date();

    const signals = [];

    // Check all combinations
    for (const pair of MONITORING_CONFIG.pairs) {
      for (const timeframe of MONITORING_CONFIG.timeframes) {
        try {
          const signal = await this.checkSignal(pair, timeframe);
          if (signal) {
            signals.push(signal);
          }
        } catch (error) {
          logger.error(`Unexpected error checking ${pair} ${timeframe}:`, error);
        }
      }
    }

    const duration = Date.now() - startTime;

    logger.info('='.repeat(60));
    logger.info(`✅ Signal monitoring check completed in ${duration}ms`);
    logger.info(`   Signals detected: ${signals.length}`);
    logger.info(`   Total checks: ${this.stats.totalChecks}`);
    logger.info(`   Total signals: ${this.stats.signalsDetected}`);
    logger.info(`   Errors: ${this.stats.errors}`);
    logger.info('='.repeat(60));

    return signals;
  }

  /**
   * Save detected signal to database
   * @param {Object} signal - Signal data
   * @returns {Promise<Object>} Saved signal record
   */
  async saveSignal(signal) {
    try {
      // TODO: Implement database storage
      // For now, just log the signal
      logger.info('💾 Signal would be saved to database:', {
        pair: signal.pair,
        timeframe: signal.timeframe,
        signal: signal.signal,
        confidence: signal.confidence
      });

      // When database model is ready:
      // const SignalNotification = require('../models/SignalNotification');
      // const saved = await SignalNotification.create(signal);
      // return saved;

      return signal;
    } catch (error) {
      logger.error('Error saving signal to database:', error);
      throw error;
    }
  }

  /**
   * Process detected signals (save and notify)
   * @param {Array} signals - Array of detected signals
   */
  async processSignals(signals) {
    if (signals.length === 0) {
      return;
    }

    logger.info(`📊 Processing ${signals.length} detected signal(s)...`);

    for (const signal of signals) {
      try {
        // Save to database
        await this.saveSignal(signal);

        // Send Discord notification
        const notificationResult = await discordNotificationService.sendSignalNotification(signal);

        if (notificationResult.success) {
          if (notificationResult.skipped) {
            logger.info(`⏭️  Signal notification skipped (${notificationResult.reason}): ${signal.pair} ${signal.timeframe}`);
          } else {
            logger.info(`📤 Discord notification sent: ${signal.pair} ${signal.timeframe} ${signal.signal}`);
          }
        } else {
          logger.error(`❌ Discord notification failed: ${notificationResult.error}`);
        }

        logger.info(`✅ Signal processed: ${signal.pair} ${signal.timeframe} ${signal.signal}`);
      } catch (error) {
        logger.error(`Failed to process signal ${signal.pair} ${signal.timeframe}:`, error);
      }
    }
  }

  /**
   * Run monitoring check (called by cron job)
   */
  async runCheck() {
    if (this.isRunning) {
      logger.warn('⚠️  Previous check still running, skipping this iteration');
      return;
    }

    this.isRunning = true;

    try {
      // Check all signals
      const signals = await this.checkAllSignals();

      // Process detected signals
      await this.processSignals(signals);

    } catch (error) {
      logger.error('Error in monitoring check:', error);
      this.stats.errors++;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the monitoring service (cron job every 15 minutes)
   */
  async start() {
    if (this.cronJob) {
      logger.warn('Monitoring service is already running');
      return;
    }

    logger.info('🚀 Starting Signal Monitoring Service');
    logger.info(`   Monitoring pairs: ${MONITORING_CONFIG.pairs.join(', ')}`);
    logger.info(`   Monitoring timeframes: ${MONITORING_CONFIG.timeframes.join(', ')}`);
    logger.info(`   Schedule: Every 15 minutes`);

    // Initialize Discord notification service
    try {
      logger.info('📡 Initializing Discord notification service...');
      await discordNotificationService.initialize();
      logger.info('✅ Discord notification service ready');
    } catch (error) {
      logger.error('⚠️  Failed to initialize Discord service, notifications will be disabled:', error.message);
      logger.warn('   Monitoring will continue without Discord notifications');
    }

    // Cron pattern: Run every 15 minutes
    // Format: '*/15 * * * *' = Every 15 minutes
    this.cronJob = cron.schedule('*/15 * * * *', async () => {
      await this.runCheck();
    });

    // Run initial check immediately
    setTimeout(() => {
      logger.info('🔍 Running initial signal check...');
      this.runCheck();
    }, 5000); // Wait 5 seconds after start

    logger.info('✅ Signal Monitoring Service started');
  }

  /**
   * Stop the monitoring service
   */
  async stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('🛑 Signal Monitoring Service stopped');
    }

    // Disconnect Discord service
    try {
      await discordNotificationService.disconnect();
    } catch (error) {
      logger.error('Error disconnecting Discord service:', error);
    }
  }

  /**
   * Get service status and statistics
   * @returns {Object} Status and stats
   */
  getStatus() {
    return {
      isRunning: !!this.cronJob,
      lastCheckTime: this.lastCheckTime,
      stats: this.stats,
      config: MONITORING_CONFIG
    };
  }

  /**
   * Manually trigger a check (for testing)
   */
  async triggerManualCheck() {
    logger.info('🔧 Manual check triggered');
    await this.runCheck();
  }
}

// Singleton instance
const signalMonitoringService = new SignalMonitoringService();

module.exports = signalMonitoringService;
