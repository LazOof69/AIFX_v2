/**
 * Message Handler
 * Handles incoming text messages from LINE users
 */

const backendClient = require('../services/backendClient');
const messageBuilder = require('../services/messageBuilder');
const logger = require('../utils/logger');

class MessageHandler {
  /**
   * Auto-register LINE user to backend database (non-blocking)
   * @param {Object} event - LINE webhook event
   * @param {Object} client - LINE client
   */
  async ensureUserRegistered(event, client) {
    const userId = event.source.userId;

    try {
      // Get user profile from LINE
      const profile = await client.getProfile(userId);
      const displayName = profile.displayName;

      // Register user in backend
      await backendClient.getOrCreateUser(userId, displayName);
      logger.info(`User ${displayName} (${userId}) auto-registered`);
    } catch (error) {
      // Don't block the message handler if registration fails
      logger.warn(`Failed to auto-register user ${userId}: ${error.message}`);
    }
  }

  /**
   * Handle text message
   * @param {Object} event - LINE webhook event
   * @param {Object} client - LINE client
   */
  async handleText(event, client) {
    const userId = event.source.userId;
    const text = event.message.text.trim();

    logger.info(`Received message from ${userId}: ${text}`);

    // Auto-register user (non-blocking)
    this.ensureUserRegistered(event, client);

    try {
      // Handle help command
      if (text === '幫助' || text === 'help' || text === '說明') {
        return client.replyMessage(event.replyToken, messageBuilder.buildHelpMessage());
      }

      // Handle subscribe command (空格可選，但必須後接貨幣對)
      if (/^(訂閱|subscribe)\s*[A-Z]/i.test(text)) {
        return this.handleSubscribe(event, client, text);
      }

      // Handle unsubscribe command (空格可選，但必須後接貨幣對)
      if (/^(取消訂閱|unsubscribe)\s*[A-Z]/i.test(text)) {
        return this.handleUnsubscribe(event, client, text);
      }

      // Handle list subscriptions command
      if (text === '我的訂閱' || text === 'subscriptions' || text === '訂閱列表') {
        return this.handleListSubscriptions(event, client);
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

    // Find currency pair (normalize text for matching)
    const upperText = text.toUpperCase();

    for (const pair of pairs) {
      // Check both with and without slash
      const withSlash = pair.includes('/') ? pair : this.formatPair(pair);
      const withoutSlash = pair.replace('/', '');

      if (upperText.includes(withSlash) || upperText.includes(withoutSlash)) {
        // Return in XXX/XXX format
        foundPair = withSlash;
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
   * Handle subscribe command
   * @param {Object} event - LINE webhook event
   * @param {Object} client - LINE client
   * @param {string} text - User message text
   */
  async handleSubscribe(event, client, text) {
    const userId = event.source.userId;

    try {
      // Remove command prefix
      const params = text.replace(/^(訂閱|subscribe)\s*/i, '');

      // Parse pair and timeframe
      const result = this.parseMessage(params);

      if (!result || !result.pair) {
        return client.replyMessage(event.replyToken,
          messageBuilder.buildTextMessage(
            '❌ 訂閱格式錯誤\n\n' +
            '正確格式：\n' +
            '• 訂閱 EUR/USD\n' +
            '• 訂閱 EUR/USD 1h\n' +
            '• 訂閱EUR/USD 15min\n' +
            '• subscribe GBP/USD 4h\n\n' +
            '支援時間框架：15min, 1h, 4h, 1d'
          )
        );
      }

      const { pair } = result;

      // Extract timeframe from text (support both period and direct timeframe)
      let timeframe = this.mapPeriodToTimeframe(result.period);

      // If no period found, try to extract timeframe directly
      if (!timeframe) {
        const timeframeMatch = params.match(/(15min|1h|4h|1d|1w)/i);
        if (timeframeMatch) {
          timeframe = timeframeMatch[1].toLowerCase();
        } else {
          timeframe = '1h'; // Default
        }
      }

      logger.info(`User ${userId} subscribing to ${pair} (${timeframe})`);

      // Call backend API
      await backendClient.subscribe(userId, pair, timeframe);

      await client.replyMessage(event.replyToken,
        messageBuilder.buildTextMessage(
          `✅ 訂閱成功！\n\n` +
          `📊 貨幣對：${pair}\n` +
          `⏰ 時間框架：${timeframe}\n\n` +
          `當信號變化時，我會主動通知您！\n` +
          `輸入「我的訂閱」查看所有訂閱`
        )
      );

      logger.info(`User ${userId} successfully subscribed to ${pair} (${timeframe})`);

    } catch (error) {
      logger.error('Error handling subscribe:', error);

      let errorMessage = '❌ 訂閱失敗，請稍後再試';

      if (error.response?.status === 409) {
        errorMessage = '⚠️ 您已經訂閱過此貨幣對和時間框架';
      } else if (error.message) {
        errorMessage = `❌ 訂閱失敗：${error.message}`;
      }

      await client.replyMessage(event.replyToken,
        messageBuilder.buildTextMessage(errorMessage)
      );
    }
  }

  /**
   * Handle unsubscribe command
   * @param {Object} event - LINE webhook event
   * @param {Object} client - LINE client
   * @param {string} text - User message text
   */
  async handleUnsubscribe(event, client, text) {
    const userId = event.source.userId;

    try {
      // Remove command prefix
      const params = text.replace(/^(取消訂閱|unsubscribe)\s*/i, '');

      // Parse pair and timeframe
      const result = this.parseMessage(params);

      if (!result || !result.pair) {
        return client.replyMessage(event.replyToken,
          messageBuilder.buildTextMessage(
            '❌ 取消訂閱格式錯誤\n\n' +
            '正確格式：\n' +
            '• 取消訂閱 EUR/USD\n' +
            '• 取消訂閱 EUR/USD 1h\n' +
            '• 取消訂閱EUR/USD 15min\n' +
            '• unsubscribe GBP/USD 4h'
          )
        );
      }

      const { pair } = result;

      // Extract timeframe from text (support both period and direct timeframe)
      let timeframe = this.mapPeriodToTimeframe(result.period);

      // If no period found, try to extract timeframe directly
      if (!timeframe) {
        const timeframeMatch = params.match(/(15min|1h|4h|1d|1w)/i);
        if (timeframeMatch) {
          timeframe = timeframeMatch[1].toLowerCase();
        } else {
          timeframe = '1h'; // Default
        }
      }

      logger.info(`User ${userId} unsubscribing from ${pair} (${timeframe})`);

      // Call backend API
      await backendClient.unsubscribe(userId, pair, timeframe);

      await client.replyMessage(event.replyToken,
        messageBuilder.buildTextMessage(
          `✅ 已取消訂閱\n\n` +
          `📊 貨幣對：${pair}\n` +
          `⏰ 時間框架：${timeframe}\n\n` +
          `您將不再收到此貨幣對的信號變化通知`
        )
      );

      logger.info(`User ${userId} successfully unsubscribed from ${pair} (${timeframe})`);

    } catch (error) {
      logger.error('Error handling unsubscribe:', error);

      let errorMessage = '❌ 取消訂閱失敗，請稍後再試';

      if (error.response?.status === 404) {
        errorMessage = '⚠️ 您尚未訂閱此貨幣對和時間框架';
      } else if (error.message) {
        errorMessage = `❌ 取消訂閱失敗：${error.message}`;
      }

      await client.replyMessage(event.replyToken,
        messageBuilder.buildTextMessage(errorMessage)
      );
    }
  }

  /**
   * Handle list subscriptions command
   * @param {Object} event - LINE webhook event
   * @param {Object} client - LINE client
   */
  async handleListSubscriptions(event, client) {
    const userId = event.source.userId;

    try {
      logger.info(`User ${userId} requesting subscription list`);

      // Call backend API to get subscriptions
      const subscriptions = await backendClient.getSubscriptions(userId);

      if (!subscriptions || subscriptions.length === 0) {
        return client.replyMessage(event.replyToken,
          messageBuilder.buildTextMessage(
            '📋 您目前沒有任何訂閱\n\n' +
            '使用「訂閱 EUR/USD」來訂閱貨幣對\n' +
            '輸入「幫助」查看完整指南'
          )
        );
      }

      // Build subscription list message
      let message = '📋 您的訂閱列表\n\n';

      subscriptions.forEach((sub, index) => {
        message += `${index + 1}. ${sub.pair} (${sub.timeframe})\n`;
      });

      message += `\n共 ${subscriptions.length} 個訂閱\n`;
      message += `\n使用「取消訂閱 EUR/USD」來取消訂閱`;

      await client.replyMessage(event.replyToken,
        messageBuilder.buildTextMessage(message)
      );

      logger.info(`Sent subscription list to user ${userId} (${subscriptions.length} items)`);

    } catch (error) {
      logger.error('Error handling list subscriptions:', error);

      await client.replyMessage(event.replyToken,
        messageBuilder.buildTextMessage('❌ 無法獲取訂閱列表，請稍後再試')
      );
    }
  }

  /**
   * Map Chinese period to timeframe
   * @param {string} period - Chinese period (日內, 周內, 月內, 季內)
   * @returns {string} Timeframe (15min, 1h, 1d, 1w)
   */
  mapPeriodToTimeframe(period) {
    const periodMap = {
      '日內': '15min',
      '周內': '1h',
      '月內': '1d',
      '季內': '1w'
    };

    return periodMap[period] || null;
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
