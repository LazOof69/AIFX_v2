/**
 * Signal Monitoring Service
 * Monitors trading signals and sends Discord notifications
 * NOW INCLUDES: Signal change detection for subscribed pairs
 */

const forexService = require('./forexService');
const tradingSignalService = require('./tradingSignalService');
const signalChangeNotificationService = require('./signalChangeNotificationService');
const { TradingSignal } = require('../models');
const logger = require('../utils/logger');

class SignalMonitoringService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    // Run every 15 minutes
    this.CHECK_INTERVAL = 15 * 60 * 1000;
  }

  /**
   * Start the monitoring service
   */
  start() {
    if (this.isRunning) {
      logger.warn('Signal monitoring service already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Signal monitoring service started');

    // Run immediately on start
    this.runMonitoringCycle();

    // Then run every 15 minutes
    this.intervalId = setInterval(() => {
      this.runMonitoringCycle();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop the monitoring service
   */
  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('🛑 Signal monitoring service stopped');
  }

  /**
   * Run monitoring cycle
   */
  async runMonitoringCycle() {
    try {
      logger.info('============================================================');
      logger.info('🔄 Signal monitoring cycle started');
      const startTime = Date.now();

      // Check signal changes for subscribed pairs
      await signalChangeNotificationService.checkAllSignalChanges();

      const duration = Date.now() - startTime;
      logger.info(`✅ Signal monitoring cycle completed in ${duration}ms`);
      logger.info('============================================================');

    } catch (error) {
      logger.error('❌ Error in signal monitoring cycle:', error);
    }
  }
}

module.exports = new SignalMonitoringService();
