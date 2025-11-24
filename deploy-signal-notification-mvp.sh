#!/bin/bash

# =============================================================================
# Signal Change Notification MVP - One-Click Deployment Script
# =============================================================================
#
# This script creates all necessary files for the MVP implementation of
# signal change notifications feature.
#
# Usage: bash deploy-signal-notification-mvp.sh
#
# =============================================================================

set -e  # Exit on error

echo "🚀 Deploying Signal Change Notification MVP..."
echo ""

# -----------------------------------------------------------------------------
# 1. Create Backend Subscriptions Controller
# -----------------------------------------------------------------------------
echo "📝 Creating Backend Subscriptions Controller..."
cat > /root/AIFX_v2/backend/src/controllers/subscriptionsController.js << 'CONTROLLER_EOF'
/**
 * Subscriptions Controller
 * Manages user subscriptions for signal change notifications
 */

const { UserSubscription } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Create a new subscription
 * POST /api/v1/subscriptions
 */
exports.createSubscription = async (req, res) => {
  try {
    const { discordUserId, discordUsername, pair, timeframe = '1h', channelId } = req.body;

    // Validate required fields
    if (!discordUserId || !pair) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: discordUserId, pair'
      });
    }

    // Validate pair format (XXX/XXX)
    if (!pair.match(/^[A-Z]{3}\/[A-Z]{3}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pair format. Use XXX/XXX (e.g., EUR/USD)'
      });
    }

    // Validate timeframe
    const validTimeframes = ['1h', '4h', '1d'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        success: false,
        error: `Invalid timeframe. Must be one of: ${validTimeframes.join(', ')}`
      });
    }

    // Check if subscription already exists
    const existing = await UserSubscription.findOne({
      where: {
        discordUserId,
        pair,
        timeframe
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Already subscribed to this pair and timeframe'
      });
    }

    // Create subscription
    const subscription = await UserSubscription.create({
      discordUserId,
      discordUsername,
      pair,
      timeframe,
      channelId
    });

    logger.info(`Subscription created: ${discordUsername} → ${pair} (${timeframe})`);

    res.status(201).json({
      success: true,
      data: subscription
    });

  } catch (error) {
    logger.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subscription'
    });
  }
};

/**
 * Delete a subscription
 * DELETE /api/v1/subscriptions/:id
 */
exports.deleteSubscription = async (req, res) => {
  try {
    const { id } = req.params;

    const subscription = await UserSubscription.findByPk(id);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    await subscription.destroy();

    logger.info(`Subscription deleted: ${subscription.discordUsername} → ${subscription.pair}`);

    res.json({
      success: true,
      message: 'Subscription deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete subscription'
    });
  }
};

/**
 * Delete subscription by user and pair
 * DELETE /api/v1/subscriptions/user/:discordUserId/pair/:pair
 */
exports.deleteSubscriptionByUserAndPair = async (req, res) => {
  try {
    const { discordUserId, pair } = req.params;
    const { timeframe = '1h' } = req.query;

    const subscription = await UserSubscription.findOne({
      where: {
        discordUserId,
        pair,
        timeframe
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    await subscription.destroy();

    logger.info(`Subscription deleted: ${subscription.discordUsername} → ${pair} (${timeframe})`);

    res.json({
      success: true,
      message: 'Subscription deleted successfully',
      data: subscription
    });

  } catch (error) {
    logger.error('Error deleting subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete subscription'
    });
  }
};

/**
 * Get user's subscriptions
 * GET /api/v1/subscriptions/user/:discordUserId
 */
exports.getUserSubscriptions = async (req, res) => {
  try {
    const { discordUserId } = req.params;

    const subscriptions = await UserSubscription.findAll({
      where: { discordUserId },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: subscriptions
    });

  } catch (error) {
    logger.error('Error getting user subscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscriptions'
    });
  }
};

/**
 * Get subscribers for a pair
 * GET /api/v1/subscriptions/pair/:pair
 */
exports.getPairSubscribers = async (req, res) => {
  try {
    const { pair } = req.params;
    const { timeframe = '1h' } = req.query;

    const subscriptions = await UserSubscription.findAll({
      where: {
        pair,
        timeframe
      },
      attributes: ['discordUserId', 'discordUsername'],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: subscriptions
    });

  } catch (error) {
    logger.error('Error getting pair subscribers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscribers'
    });
  }
};

/**
 * Get all subscribed pairs (for monitoring)
 * GET /api/v1/subscriptions/pairs
 */
exports.getSubscribedPairs = async (req, res) => {
  try {
    const subscriptions = await UserSubscription.findAll({
      attributes: ['pair', 'timeframe'],
      group: ['pair', 'timeframe'],
      raw: true
    });

    // Extract unique pair+timeframe combinations
    const pairs = subscriptions.map(s => ({
      pair: s.pair,
      timeframe: s.timeframe
    }));

    res.json({
      success: true,
      data: pairs
    });

  } catch (error) {
    logger.error('Error getting subscribed pairs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscribed pairs'
    });
  }
};
CONTROLLER_EOF

echo "✅ Controller created"

# -----------------------------------------------------------------------------
# 2. Create Backend Subscriptions Routes
# -----------------------------------------------------------------------------
echo "📝 Creating Backend Subscriptions Routes..."
cat > /root/AIFX_v2/backend/src/routes/api/v1/subscriptions.js << 'ROUTES_EOF'
/**
 * Subscriptions Routes
 * API routes for managing signal change subscriptions
 */

const express = require('express');
const router = express.Router();
const subscriptionsController = require('../../../controllers/subscriptionsController');
const { apiKeyAuth } = require('../../../middleware/auth');

// Apply API key authentication to all routes
router.use(apiKeyAuth);

// Create subscription
router.post('/', subscriptionsController.createSubscription);

// Delete subscription by ID
router.delete('/:id', subscriptionsController.deleteSubscription);

// Delete subscription by user and pair
router.delete('/user/:discordUserId/pair/:pair', subscriptionsController.deleteSubscriptionByUserAndPair);

// Get user's subscriptions
router.get('/user/:discordUserId', subscriptionsController.getUserSubscriptions);

// Get subscribers for a pair
router.get('/pair/:pair', subscriptionsController.getPairSubscribers);

// Get all subscribed pairs (for monitoring service)
router.get('/pairs', subscriptionsController.getSubscribedPairs);

module.exports = router;
ROUTES_EOF

echo "✅ Routes created"

# -----------------------------------------------------------------------------
# 3. Register routes in app.js
# -----------------------------------------------------------------------------
echo "📝 Registering routes in app.js..."
# Check if routes already registered
if ! grep -q "subscriptions.js" /root/AIFX_v2/backend/src/app.js; then
  # Find the line with other v1 routes and add subscriptions route after it
  sed -i "/const tradingRoutes = require('.\/routes\/api\/v1\/trading');/a const subscriptionsRoutes = require('./routes/api/v1/subscriptions');" /root/AIFX_v2/backend/src/app.js
  sed -i "/app.use('\/api\/v1\/trading', tradingRoutes);/a app.use('/api/v1/subscriptions', subscriptionsRoutes);" /root/AIFX_v2/backend/src/app.js
  echo "✅ Routes registered in app.js"
else
  echo "⚠️  Routes already registered, skipping"
fi

# -----------------------------------------------------------------------------
# 4. Extend signalMonitoringService
# -----------------------------------------------------------------------------
echo "📝 Creating Signal Change Notification Service..."
cat > /root/AIFX_v2/backend/src/services/signalChangeNotificationService.js << 'SERVICE_EOF'
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

      const newSignal = newSignalData.signal.signal;  // buy/hold/sell
      const newConfidence = newSignalData.signal.confidence;

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

        // Save to history
        const history = await SignalChangeHistory.create({
          pair,
          timeframe,
          oldSignal,
          newSignal,
          oldConfidence,
          newConfidence,
          signalStrength: newSignalData.signal.signalStrength,
          marketCondition: newSignalData.signal.marketCondition,
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
            signalStrength: newSignalData.signal.signalStrength,
            marketCondition: newSignalData.signal.marketCondition,
            entryPrice: newSignalData.signal.entryPrice,
            indicators: newSignalData.signal.technicalData?.indicators,
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
SERVICE_EOF

echo "✅ Signal Change Notification Service created"

# -----------------------------------------------------------------------------
# 5. Update signalMonitoringService to use new service
# -----------------------------------------------------------------------------
echo "📝 Updating signalMonitoringService..."
cat > /root/AIFX_v2/backend/src/services/signalMonitoringService.js << 'MONITORING_EOF'
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
MONITORING_EOF

echo "✅ signalMonitoringService updated"

# -----------------------------------------------------------------------------
# 6. Create Discord subscribe command
# -----------------------------------------------------------------------------
echo "📝 Creating Discord /subscribe command..."
cat > /root/AIFX_v2/discord_bot/commands/subscribe.js << 'SUBSCRIBE_EOF'
/**
 * Subscribe Command
 * Allows users to subscribe to signal change notifications
 */

const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('subscribe')
    .setDescription('Subscribe to signal change notifications for a currency pair')
    .addStringOption(option =>
      option
        .setName('pair')
        .setDescription('Currency pair (e.g., EUR/USD)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('timeframe')
        .setDescription('Timeframe for analysis')
        .setRequired(false)
        .addChoices(
          { name: '1 Hour', value: '1h' },
          { name: '4 Hours', value: '4h' },
          { name: '1 Day', value: '1d' }
        )
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const pair = interaction.options.getString('pair').toUpperCase();
      const timeframe = interaction.options.getString('timeframe') || '1h';

      // Validate pair format
      if (!pair.match(/^[A-Z]{3}\/[A-Z]{3}$/)) {
        return await interaction.editReply({
          content: '❌ Invalid currency pair format. Please use format: XXX/XXX (e.g., EUR/USD)'
        });
      }

      // Call backend API
      const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
      const apiKey = process.env.DISCORD_BOT_API_KEY;

      const response = await axios.post(
        `${backendUrl}/api/v1/subscriptions`,
        {
          discordUserId: interaction.user.id,
          discordUsername: interaction.user.username,
          pair: pair,
          timeframe: timeframe,
          channelId: interaction.channelId
        },
        {
          headers: {
            'x-api-key': apiKey
          }
        }
      );

      if (response.data.success) {
        await interaction.editReply({
          content: `✅ Successfully subscribed to **${pair}** (${timeframe})!\n\n` +
                   `You will be notified in <#${process.env.DISCORD_SIGNAL_CHANNEL_ID}> when the signal changes.`
        });

        logger.info(`User ${interaction.user.username} subscribed to ${pair} (${timeframe})`);
      } else {
        await interaction.editReply({
          content: `❌ Failed to subscribe: ${response.data.error}`
        });
      }

    } catch (error) {
      logger.error('Subscribe command error:', error);

      let errorMessage = '❌ Failed to subscribe. Please try again later.';

      if (error.response?.status === 409) {
        errorMessage = '⚠️ You are already subscribed to this pair and timeframe.';
      } else if (error.response?.data?.error) {
        errorMessage = `❌ ${error.response.data.error}`;
      }

      try {
        await interaction.editReply({ content: errorMessage });
      } catch (replyError) {
        logger.error('Failed to send error message:', replyError);
      }
    }
  }
};
SUBSCRIBE_EOF

echo "✅ /subscribe command created"

# -----------------------------------------------------------------------------
# 7. Create Discord unsubscribe command
# -----------------------------------------------------------------------------
echo "📝 Creating Discord /unsubscribe command..."
cat > /root/AIFX_v2/discord_bot/commands/unsubscribe.js << 'UNSUBSCRIBE_EOF'
/**
 * Unsubscribe Command
 * Allows users to unsubscribe from signal change notifications
 */

const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unsubscribe')
    .setDescription('Unsubscribe from signal change notifications')
    .addStringOption(option =>
      option
        .setName('pair')
        .setDescription('Currency pair (e.g., EUR/USD)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('timeframe')
        .setDescription('Timeframe')
        .setRequired(false)
        .addChoices(
          { name: '1 Hour', value: '1h' },
          { name: '4 Hours', value: '4h' },
          { name: '1 Day', value: '1d' }
        )
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const pair = interaction.options.getString('pair').toUpperCase();
      const timeframe = interaction.options.getString('timeframe') || '1h';

      // Call backend API
      const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
      const apiKey = process.env.DISCORD_BOT_API_KEY;

      const response = await axios.delete(
        `${backendUrl}/api/v1/subscriptions/user/${interaction.user.id}/pair/${encodeURIComponent(pair)}?timeframe=${timeframe}`,
        {
          headers: {
            'x-api-key': apiKey
          }
        }
      );

      if (response.data.success) {
        await interaction.editReply({
          content: `✅ Successfully unsubscribed from **${pair}** (${timeframe}).`
        });

        logger.info(`User ${interaction.user.username} unsubscribed from ${pair} (${timeframe})`);
      } else {
        await interaction.editReply({
          content: `❌ Failed to unsubscribe: ${response.data.error}`
        });
      }

    } catch (error) {
      logger.error('Unsubscribe command error:', error);

      let errorMessage = '❌ Failed to unsubscribe. Please try again later.';

      if (error.response?.status === 404) {
        errorMessage = '⚠️ You are not subscribed to this pair.';
      } else if (error.response?.data?.error) {
        errorMessage = `❌ ${error.response.data.error}`;
      }

      try {
        await interaction.editReply({ content: errorMessage });
      } catch (replyError) {
        logger.error('Failed to send error message:', replyError);
      }
    }
  }
};
UNSUBSCRIBE_EOF

echo "✅ /unsubscribe command created"

# -----------------------------------------------------------------------------
# 8. Create Discord subscriptions command
# -----------------------------------------------------------------------------
echo "📝 Creating Discord /subscriptions command..."
cat > /root/AIFX_v2/discord_bot/commands/subscriptions.js << 'SUBSCRIPTIONS_EOF'
/**
 * Subscriptions Command
 * Shows user's current subscriptions
 */

const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('subscriptions')
    .setDescription('View your signal change subscriptions'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Call backend API
      const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
      const apiKey = process.env.DISCORD_BOT_API_KEY;

      const response = await axios.get(
        `${backendUrl}/api/v1/subscriptions/user/${interaction.user.id}`,
        {
          headers: {
            'x-api-key': apiKey
          }
        }
      );

      if (response.data.success) {
        const subscriptions = response.data.data;

        if (subscriptions.length === 0) {
          return await interaction.editReply({
            content: '📭 You have no active subscriptions.\n\nUse `/subscribe pair:EUR/USD` to subscribe to a currency pair.'
          });
        }

        // Format subscriptions list
        let message = `📊 **Your Subscriptions** (${subscriptions.length})\n\n`;

        subscriptions.forEach((sub, index) => {
          message += `${index + 1}. **${sub.pair}** (${sub.timeframe})\n`;
          message += `   Subscribed: ${new Date(sub.createdAt).toLocaleDateString()}\n\n`;
        });

        message += `\nUse \`/unsubscribe pair:XXX/XXX\` to unsubscribe.`;

        await interaction.editReply({ content: message });

        logger.info(`User ${interaction.user.username} viewed subscriptions (${subscriptions.length} total)`);
      } else {
        await interaction.editReply({
          content: `❌ Failed to fetch subscriptions: ${response.data.error}`
        });
      }

    } catch (error) {
      logger.error('Subscriptions command error:', error);

      try {
        await interaction.editReply({
          content: '❌ Failed to fetch subscriptions. Please try again later.'
        });
      } catch (replyError) {
        logger.error('Failed to send error message:', replyError);
      }
    }
  }
};
SUBSCRIPTIONS_EOF

echo "✅ /subscriptions command created"

# -----------------------------------------------------------------------------
# 9. Add signal-change event listener to Discord bot
# -----------------------------------------------------------------------------
echo "📝 Adding signal-change event listener to Discord bot..."

# Create a snippet file for the Redis subscription
cat > /tmp/discord_bot_redis_snippet.js << 'REDIS_EOF'

// =============================================================================
// Signal Change Notification Listener
// =============================================================================
const redis = require('redis');

// Subscribe to signal-change events from Backend
async function setupSignalChangeListener() {
  try {
    // Create Redis subscriber client
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisDb = process.env.REDIS_DB || 2;

    const subscriber = redis.createClient({
      url: redisUrl,
      database: parseInt(redisDb)
    });

    await subscriber.connect();
    logger.info('✅ Redis subscriber connected for signal-change events');

    // Subscribe to signal-change channel
    await subscriber.subscribe('signal-change', async (message) => {
      try {
        const event = JSON.parse(message);
        logger.info(`📬 Received signal-change event: ${event.pair} (${event.timeframe})`);

        // Send notification to Discord channel
        await sendSignalChangeNotification(event);

      } catch (error) {
        logger.error('Error handling signal-change event:', error);
      }
    });

    logger.info('✅ Subscribed to signal-change channel');

  } catch (error) {
    logger.error('❌ Failed to setup signal-change listener:', error);
  }
}

/**
 * Send signal change notification to Discord
 */
async function sendSignalChangeNotification(event) {
  try {
    const channelId = process.env.DISCORD_SIGNAL_CHANNEL_ID;
    if (!channelId) {
      logger.warn('DISCORD_SIGNAL_CHANNEL_ID not set, cannot send notification');
      return;
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      logger.error(`Channel ${channelId} not found`);
      return;
    }

    // Format user mentions
    const mentions = event.subscribers.map(s => `<@${s.id}>`).join(' ');

    // Determine emoji based on signal
    let emoji = '⚪';
    if (event.newSignal === 'buy') emoji = '🟢';
    if (event.newSignal === 'sell') emoji = '🔴';

    // Format message
    let message = `${emoji} **Signal Change Alert**\n\n`;
    message += `**${event.pair}** (${event.timeframe})\n`;
    message += `${event.oldSignal ? event.oldSignal.toUpperCase() : 'N/A'} → **${event.newSignal.toUpperCase()}**\n\n`;
    message += `📊 Confidence: ${(event.newConfidence * 100).toFixed(0)}%\n`;
    message += `💪 Strength: ${event.signalStrength?.toUpperCase() || 'N/A'}\n`;
    message += `📈 Market: ${event.marketCondition?.toUpperCase() || 'N/A'}\n`;

    if (event.entryPrice) {
      message += `💰 Entry Price: ${event.entryPrice.toFixed(5)}\n`;
    }

    if (event.indicators) {
      message += `\n📉 Indicators:\n`;
      if (event.indicators.sma) {
        message += `SMA(${event.indicators.sma.period}): ${event.indicators.sma.value.toFixed(5)} (${event.indicators.sma.signal})\n`;
      }
      if (event.indicators.rsi) {
        message += `RSI(${event.indicators.rsi.period}): ${event.indicators.rsi.value.toFixed(2)} (${event.indicators.rsi.signal})\n`;
      }
    }

    message += `\n👥 ${mentions}`;
    message += `\n⏰ ${new Date().toLocaleString()}`;

    await channel.send(message);
    logger.info(`✅ Notification sent to ${event.subscribers.length} subscribers`);

  } catch (error) {
    logger.error('Error sending signal change notification:', error);
  }
}

// Call setup function when bot is ready
client.once('ready', async () => {
  // ... existing ready code ...

  // Setup signal-change listener
  await setupSignalChangeListener();
});
REDIS_EOF

echo "⚠️  Note: You need to manually add the Redis subscription code to bot.js"
echo "    The code snippet has been created at: /tmp/discord_bot_redis_snippet.js"
echo "    Please review and integrate it into /root/AIFX_v2/discord_bot/bot.js"

# -----------------------------------------------------------------------------
# 10. Deploy commands to Discord
# -----------------------------------------------------------------------------
echo ""
echo "📝 Redeploying Discord commands..."
cd /root/AIFX_v2/discord_bot
node deploy-commands.js

echo ""
echo "============================================================================="
echo "✅ MVP Deployment Complete!"
echo "============================================================================="
echo ""
echo "📋 Created Files:"
echo "  ✅ Backend Controller: src/controllers/subscriptionsController.js"
echo "  ✅ Backend Routes: src/routes/api/v1/subscriptions.js"
echo "  ✅ Signal Change Service: src/services/signalChangeNotificationService.js"
echo "  ✅ Updated Service: src/services/signalMonitoringService.js"
echo "  ✅ Discord /subscribe: commands/subscribe.js"
echo "  ✅ Discord /unsubscribe: commands/unsubscribe.js"
echo "  ✅ Discord /subscriptions: commands/subscriptions.js"
echo ""
echo "⚠️  Manual Steps Required:"
echo "  1. Add Redis subscription code to bot.js (see /tmp/discord_bot_redis_snippet.js)"
echo "  2. Restart Backend: screen -S backend -X quit && cd /root/AIFX_v2/backend && screen -dmS backend bash -c 'npm start'"
echo "  3. Restart Discord Bot: screen -S discord-bot -X quit && cd /root/AIFX_v2/discord_bot && screen -dmS discord-bot bash -c 'node bot.js'"
echo ""
echo "🧪 Testing:"
echo "  1. In Discord: /subscribe pair:EUR/USD"
echo "  2. Wait 15 minutes for signal check"
echo "  3. Check notifications in signal channel"
echo ""
echo "============================================================================="
