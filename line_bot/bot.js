/**
 * AIFX_v2 LINE Bot
 * Main bot file for handling LINE webhook and notifications
 *
 * Architecture: Follows microservices principles
 * - Does NOT access database directly
 * - Uses Backend API for all data operations
 * - Communicates via REST APIs only
 */

require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const redis = require('redis');
const messageHandler = require('./handlers/messageHandler');
const logger = require('./utils/logger');

// Validate environment variables
const requiredEnvVars = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`❌ ${envVar} is not set in environment variables`);
    process.exit(1);
  }
}

// LINE Bot configuration
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

// Create LINE client
const client = new line.Client(config);

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Webhook endpoint
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    // Process all events in parallel
    const results = await Promise.all(
      req.body.events.map(event => handleEvent(event))
    );

    logger.info(`Processed ${results.length} events`);
    res.json({ success: true });

  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'line-bot',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Handle incoming LINE event
 * @param {Object} event - LINE webhook event
 */
async function handleEvent(event) {
  logger.info(`Received event type: ${event.type}`);

  try {
    switch (event.type) {
      case 'message':
        if (event.message.type === 'text') {
          await messageHandler.handleText(event, client);
        }
        break;

      case 'follow':
        await messageHandler.handleFollow(event, client);
        break;

      case 'unfollow':
        await messageHandler.handleUnfollow(event);
        break;

      case 'postback':
        await messageHandler.handlePostback(event, client);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    logger.error('Error handling event:', error);
    throw error;
  }
}

/**
 * Initialize Redis for pub/sub notifications
 */
let redisClient = null;
let redisSubscriber = null;

async function initializeRedis() {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisDb = parseInt(process.env.REDIS_DB) || 2;

    redisClient = redis.createClient({
      url: redisUrl,
      database: redisDb
    });

    redisSubscriber = redisClient.duplicate();

    redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
    redisSubscriber.on('error', (err) => logger.error('Redis Subscriber Error:', err));

    await redisClient.connect();
    await redisSubscriber.connect();

    logger.info('✅ Redis connected successfully');

    // Subscribe to trading-signals channel
    await redisSubscriber.subscribe('trading-signals', async (message) => {
      try {
        const notification = JSON.parse(message);
        await handleNotification(notification);
      } catch (error) {
        logger.error('Error handling notification:', error);
      }
    });

    logger.info('✅ Subscribed to trading-signals channel');

    // Subscribe to signal-change channel
    await redisSubscriber.subscribe('signal-change', async (message) => {
      try {
        const event = JSON.parse(message);
        await handleSignalChangeNotification(event);
      } catch (error) {
        logger.error('Error handling signal-change event:', error);
      }
    });

    logger.info('✅ Subscribed to signal-change channel');

  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    logger.warn('Bot will continue without Redis pub/sub functionality');
  }
}

/**
 * Handle trading signal notification from Redis
 * @param {Object} notification - Notification data
 */
async function handleNotification(notification) {
  try {
    const { lineUserId, signal, pair, timeframe } = notification;

    if (!lineUserId || !signal) {
      logger.warn('Invalid notification format:', notification);
      return;
    }

    logger.info(`Sending notification to ${lineUserId} for ${pair}`);

    // Build Flex Message
    const messageBuilder = require('./services/messageBuilder');
    const flexMessage = messageBuilder.buildSignalMessage(signal, pair);

    // Send push message to user
    await client.pushMessage(lineUserId, flexMessage);

    logger.info(`✅ Notification sent to ${lineUserId} for ${pair}`);

  } catch (error) {
    logger.error('Error sending notification:', error);
  }
}

/**
 * Handle signal change notification from Redis
 * @param {Object} event - Signal change event data
 */
async function handleSignalChangeNotification(event) {
  try {
    logger.info(`📬 Received signal-change event: ${event.pair} (${event.timeframe})`);

    if (!event.subscribers || event.subscribers.length === 0) {
      logger.info('No subscribers for this signal change');
      return;
    }

    // Build notification message
    const messageBuilder = require('./services/messageBuilder');

    let emoji = '⚪';
    if (event.newSignal === 'buy') emoji = '🟢';
    else if (event.newSignal === 'sell') emoji = '🔴';

    const notificationText = `${emoji} 信號變化通知

📊 貨幣對: ${event.pair}
⏰ 時間框架: ${event.timeframe}

📈 信號變化: ${event.oldSignal?.toUpperCase() || 'INITIAL'} → ${event.newSignal.toUpperCase()}
💪 信心度: ${(event.newConfidence * 100).toFixed(0)}%
📊 強度: ${event.signalStrength?.toUpperCase() || 'N/A'}
📉 市場狀況: ${event.marketCondition?.toUpperCase() || 'N/A'}
${event.entryPrice ? `💰 入場價格: ${event.entryPrice.toFixed(5)}` : ''}

⚠️ 這是自動通知，請謹慎交易！`;

    // Send to all subscribers
    const messagePromises = event.subscribers.map(subscriber => {
      return client.pushMessage(subscriber.id, {
        type: 'text',
        text: notificationText
      });
    });

    await Promise.all(messagePromises);

    logger.info(`✅ Signal change notification sent to ${event.subscribers.length} subscribers`);

  } catch (error) {
    logger.error('Error sending signal change notification:', error);
  }
}

// Start server
const server = app.listen(PORT, () => {
  logger.info(`✅ LINE Bot server listening on port ${PORT}`);
  logger.info(`📊 Webhook URL: http://localhost:${PORT}/webhook`);
  logger.info(`🏥 Health check: http://localhost:${PORT}/health`);

  // Initialize Redis
  initializeRedis();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Shutting down LINE Bot...');

  if (redisClient) {
    await redisClient.quit();
  }
  if (redisSubscriber) {
    await redisSubscriber.quit();
  }

  server.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Shutting down LINE Bot...');

  if (redisClient) {
    await redisClient.quit();
  }
  if (redisSubscriber) {
    await redisSubscriber.quit();
  }

  server.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;
