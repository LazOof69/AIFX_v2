/**
 * Signal Change Notification Service
 * Detects signal changes and publishes notifications
 */

const { UserSubscription, SignalChangeHistory } = require('../models');
const tradingSignalService = require('./tradingSignalService');
const { redisClient } = require('../utils/cache');
const logger = require('../utils/logger');

class SignalChangeNotificationService {
  /**
   * Check for signal changes in all subscribed pairs
   */
  async checkAllSignalChanges() {
    try {
      logger.info('🔍 Checking signal changes for subscribed pairs...');

      // Get all unique subscribed pair+timeframe combinations
      const subscriptions = await UserSubscription.findAll({
        attributes: ['pair', 'timeframe'],
        group: ['pair', 'timeframe'],
        raw: true
      });

      if (subscriptions.length === 0) {
        logger.info('No active subscriptions, skipping signal check');
        return;
      }

      logger.info(`Found ${subscriptions.length} unique pair+timeframe combinations to check`);

      // Check each pair+timeframe
      for (const { pair, timeframe } of subscriptions) {
        await this.checkSignalChange(pair, timeframe);
      }

      logger.info('✅ Signal change check completed');

    } catch (error) {
      logger.error('Error checking signal changes:', error);
    }
  }

  /**
   * Check signal change for a specific pair+timeframe
   */
  async checkSignalChange(pair, timeframe) {
    try {
      // Generate new signal
      const newSignalData = await tradingSignalService.generateSignal(
        pair,
        timeframe,
        'signal-monitoring-service'  // Special user ID
      );

      const newSignal = newSignalData.signal;  // buy/hold/sell
      const newConfidence = newSignalData.confidence;

      // Get last recorded signal from history
      const lastHistory = await SignalChangeHistory.findOne({
        where: { pair, timeframe },
        order: [['createdAt', 'DESC']]
      });

      const oldSignal = lastHistory ? lastHistory.newSignal : null;
      const oldConfidence = lastHistory ? parseFloat(lastHistory.newConfidence) : null;

      // Check if signal changed
      if (oldSignal !== newSignal) {
        logger.info(`🚨 Signal change detected: ${pair} (${timeframe}): ${oldSignal || 'null'} → ${newSignal}`);

        // Check notification cooldown (30 minutes)
        const COOLDOWN_MINUTES = 30;
        const now = new Date();
        if (lastHistory && lastHistory.lastNotifiedAt) {
          const minutesSinceLastNotification = (now - new Date(lastHistory.lastNotifiedAt)) / 1000 / 60;
          if (minutesSinceLastNotification < COOLDOWN_MINUTES) {
            logger.info(`⏳ Cooldown active for ${pair} (${timeframe}): ${minutesSinceLastNotification.toFixed(1)}/${COOLDOWN_MINUTES} minutes elapsed`);
            logger.info(`📝 Signal change recorded but notification skipped (cooldown)`);

            // Still save to history but don't send notification
            await SignalChangeHistory.create({
              pair,
              timeframe,
              oldSignal,
              newSignal,
              oldConfidence,
              newConfidence,
              signalStrength: newSignalData.signalStrength,
              marketCondition: newSignalData.marketCondition,
              notificationSent: false,
              createdAt: new Date()
            });

            return; // Skip notification
          }
        }

        // Save to history
        const history = await SignalChangeHistory.create({
          pair,
          timeframe,
          oldSignal,
          newSignal,
          oldConfidence,
          newConfidence,
          signalStrength: newSignalData.signalStrength,
          marketCondition: newSignalData.marketCondition,
          notificationSent: false,
          createdAt: new Date()
        });

        // Get all subscribers
        const subscribers = await UserSubscription.findAll({
          where: { pair, timeframe },
          attributes: ['discordUserId', 'discordUsername']
        });

        if (subscribers.length > 0) {
          // Publish event to Redis
          await this.publishSignalChange({
            pair,
            timeframe,
            oldSignal,
            newSignal,
            oldConfidence,
            newConfidence,
            signalStrength: newSignalData.signalStrength,
            marketCondition: newSignalData.marketCondition,
            entryPrice: newSignalData.entryPrice,
            indicators: newSignalData.technicalData?.indicators,
            subscribers: subscribers.map(s => ({
              id: s.discordUserId,
              username: s.discordUsername
            }))
          });

          // Update history with notified users
          await history.update({
            notifiedUsers: subscribers.map(s => s.discordUserId),
            notificationSent: true,
            lastNotifiedAt: new Date()
          });

          logger.info(`📢 Notification sent to ${subscribers.length} subscribers`);
        }
      } else {
        logger.debug(`No signal change for ${pair} (${timeframe}): ${newSignal}`);
      }

    } catch (error) {
      logger.error(`Error checking signal for ${pair} (${timeframe}):`, error);
    }
  }

  /**
   * Publish signal change event to Redis
   */
  async publishSignalChange(event) {
    try {
      if (!redisClient || !redisClient.isReady) {
        logger.warn('Redis not connected, cannot publish signal change event');
        return;
      }

      await redisClient.publish('signal-change', JSON.stringify(event));
      logger.info(`📡 Published signal-change event: ${event.pair} (${event.timeframe})`);

    } catch (error) {
      logger.error('Error publishing signal change:', error);
    }
  }
}

module.exports = new SignalChangeNotificationService();
