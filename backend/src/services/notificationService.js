/**
 * Notification Service
 * Handles sending notifications to users via Discord and other channels
 */

const redis = require('redis');
const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.redisClient = null;
    this.rateLimiter = new Map();
    this.subscriptions = new Map(); // In-memory storage (use database in production)
    this.userPreferences = new Map(); // In-memory storage (use database in production)
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection for pub/sub
   */
  async initializeRedis() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.redisClient = redis.createClient({
        url: redisUrl,
        database: 2 // Use separate database for notifications
      });

      this.redisClient.on('error', (err) => {
        logger.error('Notification Service Redis Error:', err);
      });

      await this.redisClient.connect();
      logger.info('Notification Service Redis connected');
    } catch (error) {
      logger.error('Failed to initialize Redis for notifications:', error);
      logger.warn('Notifications will not be sent without Redis');
    }
  }

  /**
   * Subscribe user to notifications
   */
  async subscribe(options) {
    try {
      const {
        discordUserId,
        discordUsername,
        pair,
        signalType = 'all',
        channel = 'discord'
      } = options;

      if (!discordUserId || !pair) {
        throw new Error('Missing required fields: discordUserId and pair');
      }

      // Create subscription key
      const subscriptionKey = `${discordUserId}:${pair}`;

      // Store subscription
      this.subscriptions.set(subscriptionKey, {
        discordUserId,
        discordUsername,
        pair,
        signalType,
        channel,
        subscribedAt: new Date().toISOString()
      });

      logger.info(`User ${discordUsername} (${discordUserId}) subscribed to ${pair} (${signalType})`);

      return {
        success: true,
        subscription: {
          pair,
          signalType,
          channel
        }
      };
    } catch (error) {
      logger.error('Subscribe error:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe user from notifications
   */
  async unsubscribe(options) {
    try {
      const { discordUserId, pair } = options;

      if (!discordUserId) {
        throw new Error('Missing required field: discordUserId');
      }

      let unsubscribedCount = 0;

      if (pair === 'all' || !pair) {
        // Unsubscribe from all pairs
        for (const [key, subscription] of this.subscriptions.entries()) {
          if (subscription.discordUserId === discordUserId) {
            this.subscriptions.delete(key);
            unsubscribedCount++;
          }
        }
      } else {
        // Unsubscribe from specific pair
        const subscriptionKey = `${discordUserId}:${pair}`;
        if (this.subscriptions.has(subscriptionKey)) {
          this.subscriptions.delete(subscriptionKey);
          unsubscribedCount++;
        }
      }

      if (unsubscribedCount === 0) {
        throw new Error('No active subscriptions found');
      }

      logger.info(`User ${discordUserId} unsubscribed from ${unsubscribedCount} subscriptions`);

      return {
        success: true,
        unsubscribedCount
      };
    } catch (error) {
      logger.error('Unsubscribe error:', error);
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(options) {
    try {
      const { discordUserId, preferences } = options;

      if (!discordUserId) {
        throw new Error('Missing required field: discordUserId');
      }

      // Get existing preferences or create new
      const existingPrefs = this.userPreferences.get(discordUserId) || {};

      // Merge with new preferences
      const updatedPrefs = {
        ...existingPrefs,
        ...preferences,
        updatedAt: new Date().toISOString()
      };

      this.userPreferences.set(discordUserId, updatedPrefs);

      logger.info(`Preferences updated for user ${discordUserId}`);

      return {
        success: true,
        preferences: updatedPrefs
      };
    } catch (error) {
      logger.error('Update preferences error:', error);
      throw error;
    }
  }

  /**
   * Get user preferences
   */
  async getPreferences(discordUserId) {
    try {
      const preferences = this.userPreferences.get(discordUserId);

      return {
        success: true,
        preferences: preferences || {}
      };
    } catch (error) {
      logger.error('Get preferences error:', error);
      throw error;
    }
  }

  /**
   * Send notification to subscribed users
   */
  async sendNotification(signal, pair, timeframe = '1h') {
    try {
      if (!this.redisClient || !this.redisClient.isOpen) {
        logger.warn('Redis not available, cannot send notifications');
        return { success: false, sent: 0 };
      }

      let sentCount = 0;

      // Find all subscriptions for this pair
      for (const [key, subscription] of this.subscriptions.entries()) {
        if (subscription.pair === pair) {
          // Check if user should receive this notification
          if (this.shouldNotify(subscription, signal)) {
            // Check rate limiting
            if (!this.checkRateLimit(subscription.discordUserId)) {
              logger.warn(`Rate limit exceeded for user ${subscription.discordUserId}`);
              continue;
            }

            // Publish notification to Redis
            const notification = {
              discordUserId: subscription.discordUserId,
              signal,
              pair,
              timeframe,
              timestamp: new Date().toISOString()
            };

            await this.redisClient.publish(
              'trading-signals',
              JSON.stringify(notification)
            );

            sentCount++;
            logger.info(`Notification sent to user ${subscription.discordUserId} for ${pair}`);
          }
        }
      }

      return { success: true, sent: sentCount };
    } catch (error) {
      logger.error('Send notification error:', error);
      throw error;
    }
  }

  /**
   * Check if user should receive notification based on preferences
   */
  shouldNotify(subscription, signal) {
    const userPrefs = this.userPreferences.get(subscription.discordUserId) || {};

    // Check signal type filter
    if (subscription.signalType !== 'all') {
      if (subscription.signalType === 'strong') {
        // Only send strong and very_strong signals
        if (!['strong', 'very_strong'].includes(signal.signalStrength)) {
          return false;
        }
      } else if (subscription.signalType !== signal.signal) {
        // Check if signal matches (buy/sell)
        return false;
      }
    }

    // Check minimum confidence preference
    if (userPrefs.minConfidence && signal.confidence < userPrefs.minConfidence) {
      return false;
    }

    // Check strong signals only preference
    if (userPrefs.strongSignalsOnly) {
      if (!['strong', 'very_strong'].includes(signal.signalStrength)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check rate limiting for notifications
   * Max 1 notification per user per minute
   */
  checkRateLimit(userId) {
    const now = Date.now();
    const maxNotificationsPerMinute = 1;
    const windowMs = 60000; // 1 minute

    if (!this.rateLimiter.has(userId)) {
      this.rateLimiter.set(userId, []);
    }

    const userTimestamps = this.rateLimiter.get(userId);

    // Remove timestamps older than window
    const validTimestamps = userTimestamps.filter(
      timestamp => now - timestamp < windowMs
    );

    if (validTimestamps.length >= maxNotificationsPerMinute) {
      return false;
    }

    validTimestamps.push(now);
    this.rateLimiter.set(userId, validTimestamps);

    return true;
  }

  /**
   * Get user subscriptions
   */
  getUserSubscriptions(discordUserId) {
    const userSubs = [];

    for (const [key, subscription] of this.subscriptions.entries()) {
      if (subscription.discordUserId === discordUserId) {
        userSubs.push(subscription);
      }
    }

    return userSubs;
  }

  /**
   * Get all subscriptions (admin only)
   */
  getAllSubscriptions() {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Clean up rate limiter periodically
   */
  startCleanupTask() {
    setInterval(() => {
      const now = Date.now();
      const windowMs = 60000;

      for (const [userId, timestamps] of this.rateLimiter.entries()) {
        const validTimestamps = timestamps.filter(
          timestamp => now - timestamp < windowMs
        );

        if (validTimestamps.length === 0) {
          this.rateLimiter.delete(userId);
        } else {
          this.rateLimiter.set(userId, validTimestamps);
        }
      }
    }, 60000); // Clean up every minute

    logger.info('Notification rate limiter cleanup task started');
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.redisClient && this.redisClient.isOpen) {
      await this.redisClient.quit();
      logger.info('Notification Service Redis connection closed');
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService();

// Start cleanup task
notificationService.startCleanupTask();

module.exports = notificationService;