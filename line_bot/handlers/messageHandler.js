/**
 * Message Handler
 * Handles incoming text messages from LINE users
 */

const backendClient = require('../services/backendClient');
const messageBuilder = require('../services/messageBuilder');
const logger = require('../utils/logger');

class MessageHandler {
  /**
   * Handle text message
   * @param {Object} event - LINE webhook event
   * @param {Object} client - LINE client
   */
  async handleText(event, client) {
    const userId = event.source.userId;
    const text = event.message.text.trim();

    logger.info(`Received message from ${userId}: ${text}`);

    try {
      // Handle help command
      if (text === '幫助' || text === 'help' || text === '說明') {
        return client.replyMessage(event.replyToken, messageBuilder.buildHelpMessage());
      }

      // Parse currency pair and period
      const result = this.parseMessage(text);

      if (!result) {
        return client.replyMessage(event.replyToken,
          messageBuilder.buildTextMessage(
            '❌ 無法識別貨幣對格式\n\n請輸入格式如：EUR/USD 或 EUR/USD 周內\n輸入「幫助」查看完整指南'
          )
        );
      }

      const { pair, period } = result;

      // Fetch trading signal from backend
      logger.info(`Fetching signal for ${pair} (${period || 'default'})`);

      const signal = await backendClient.getTradingSignal(pair, period);

      // Build and send Flex Message
      const flexMessage = messageBuilder.buildSignalMessage(signal, pair);

      await client.replyMessage(event.replyToken, flexMessage);

      logger.info(`Successfully sent signal for ${pair} to ${userId}`);

    } catch (error) {
      logger.error('Error handling message:', error);

      let errorMessage = '❌ 查詢失敗，請稍後再試';

      if (error.response?.status === 429) {
        errorMessage = '❌ 請求過於頻繁，請稍候再試';
      } else if (error.response?.status === 503) {
        errorMessage = '❌ ML 模型暫時不可用，請聯繫管理員';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = '❌ 後端服務暫時不可用，請聯繫管理員';
      } else if (error.message) {
        errorMessage = `❌ 錯誤：${error.message}`;
      }

      await client.replyMessage(
        event.replyToken,
        messageBuilder.buildErrorMessage(errorMessage)
      );
    }
  }

  /**
   * Parse user message to extract currency pair and period
   * @param {string} text - User input text
   * @returns {Object|null} { pair, period } or null if invalid
   */
  parseMessage(text) {
    // Common currency pairs
    const pairs = [
      'EUR/USD', 'EURUSD',
      'GBP/USD', 'GBPUSD',
      'USD/JPY', 'USDJPY',
      'USD/CHF', 'USDCHF',
      'AUD/USD', 'AUDUSD',
      'EUR/GBP', 'EURGBP',
      'EUR/JPY', 'EURJPY'
    ];

    // Trading periods
    const periods = ['日內', '周內', '月內', '季內'];

    let foundPair = null;
    let foundPeriod = null;

    // Find currency pair
    const upperText = text.toUpperCase().replace(/\s+/g, '');

    for (const pair of pairs) {
      const normalizedPair = pair.replace('/', '');
      if (upperText.includes(normalizedPair)) {
        // Return in XXX/XXX format
        foundPair = pair.includes('/') ? pair : this.formatPair(pair);
        break;
      }
    }

    if (!foundPair) {
      return null;
    }

    // Find trading period
    for (const period of periods) {
      if (text.includes(period)) {
        foundPeriod = period;
        break;
      }
    }

    return {
      pair: foundPair,
      period: foundPeriod
    };
  }

  /**
   * Format pair to XXX/XXX format
   * @param {string} pair - Pair without slash (e.g., "EURUSD")
   * @returns {string} Formatted pair (e.g., "EUR/USD")
   */
  formatPair(pair) {
    if (pair.includes('/')) {
      return pair;
    }
    // Insert slash after 3rd character
    return pair.slice(0, 3) + '/' + pair.slice(3);
  }

  /**
   * Handle follow event (user adds bot as friend)
   * @param {Object} event - LINE webhook event
   * @param {Object} client - LINE client
   */
  async handleFollow(event, client) {
    const userId = event.source.userId;

    try {
      logger.info(`User ${userId} followed the bot`);

      // Get user profile
      const profile = await client.getProfile(userId);
      const displayName = profile.displayName;

      // Register user in backend
      await backendClient.getOrCreateUser(userId, displayName);

      // Send welcome message
      await client.replyMessage(
        event.replyToken,
        messageBuilder.buildWelcomeMessage(displayName)
      );

      logger.info(`Sent welcome message to ${userId} (${displayName})`);

    } catch (error) {
      logger.error('Error handling follow event:', error);
    }
  }

  /**
   * Handle unfollow event (user blocks/removes bot)
   * @param {Object} event - LINE webhook event
   */
  async handleUnfollow(event) {
    const userId = event.source.userId;

    try {
      logger.info(`User ${userId} unfollowed the bot`);
      // Could call backend API to mark user as inactive if needed

    } catch (error) {
      logger.error('Error handling unfollow event:', error);
    }
  }

  /**
   * Handle postback event (button clicks, etc.)
   * @param {Object} event - LINE webhook event
   * @param {Object} client - LINE client
   */
  async handlePostback(event, client) {
    const userId = event.source.userId;
    const data = event.postback.data;

    logger.info(`Received postback from ${userId}: ${data}`);

    try {
      // Parse postback data (format: "action=value&param=value")
      const params = new URLSearchParams(data);
      const action = params.get('action');

      switch (action) {
        case 'signal':
          const pair = params.get('pair');
          const period = params.get('period');

          if (pair) {
            const signal = await backendClient.getTradingSignal(pair, period);
            const flexMessage = messageBuilder.buildSignalMessage(signal, pair);
            await client.replyMessage(event.replyToken, flexMessage);
          }
          break;

        case 'help':
          await client.replyMessage(event.replyToken, messageBuilder.buildHelpMessage());
          break;

        default:
          logger.warn(`Unknown postback action: ${action}`);
      }

    } catch (error) {
      logger.error('Error handling postback:', error);
      await client.replyMessage(
        event.replyToken,
        messageBuilder.buildErrorMessage('處理請求時發生錯誤')
      );
    }
  }
}

module.exports = new MessageHandler();
