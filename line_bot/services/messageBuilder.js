/**
 * LINE Message Builder
 * Builds Flex Messages and other LINE message formats
 */

const logger = require('../utils/logger');

class MessageBuilder {
  /**
   * Build trading signal Flex Message
   * @param {Object} signal - Signal data from backend
   * @param {string} pair - Currency pair
   * @returns {Object} LINE Flex Message
   */
  buildSignalMessage(signal, pair) {
    // Determine color based on signal
    let headerColor = '#808080'; // Gray for hold
    let signalEmoji = '⚪';

    if (signal.signal === 'buy') {
      headerColor = '#00FF00'; // Green
      signalEmoji = '🟢';
    } else if (signal.signal === 'sell') {
      headerColor = '#FF0000'; // Red
      signalEmoji = '🔴';
    }

    // Signal strength emoji
    let strengthEmoji = '⭐';
    if (signal.signalStrength === 'very_strong') strengthEmoji = '⭐⭐⭐⭐';
    else if (signal.signalStrength === 'strong') strengthEmoji = '⭐⭐⭐';
    else if (signal.signalStrength === 'moderate') strengthEmoji = '⭐⭐';

    // Sentiment emoji
    let sentimentEmoji = '⚖️';
    if (signal.sentimentSignal === 'bullish') sentimentEmoji = '🐂';
    else if (signal.sentimentSignal === 'bearish') sentimentEmoji = '🐻';

    // Build contents array
    const contents = [
      {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `${signalEmoji} ${signal.signal.toUpperCase()} ${strengthEmoji}`,
            weight: 'bold',
            size: 'xl',
            color: '#ffffff'
          }
        ],
        backgroundColor: headerColor,
        paddingAll: '13px'
      },
      {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '13px',
        contents: [
          // Confidence
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '💪 Confidence',
                size: 'sm',
                color: '#555555',
                flex: 0
              },
              {
                type: 'text',
                text: `${(signal.confidence * 100).toFixed(0)}%`,
                size: 'sm',
                color: '#111111',
                align: 'end'
              }
            ]
          },
          // Signal Strength
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '📈 Strength',
                size: 'sm',
                color: '#555555',
                flex: 0
              },
              {
                type: 'text',
                text: signal.signalStrength?.replace('_', ' ').toUpperCase() || 'N/A',
                size: 'sm',
                color: '#111111',
                align: 'end'
              }
            ]
          },
          // Timeframe
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '🎯 Timeframe',
                size: 'sm',
                color: '#555555',
                flex: 0
              },
              {
                type: 'text',
                text: signal.timeframe?.toUpperCase() || 'N/A',
                size: 'sm',
                color: '#111111',
                align: 'end'
              }
            ]
          }
        ]
      }
    ];

    // Add period info if available
    if (signal.periodInfo) {
      const pi = signal.periodInfo;
      contents.push({
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '13px',
        backgroundColor: '#f0f0f0',
        contents: [
          {
            type: 'text',
            text: `${pi.emoji} ${pi.nameCn}`,
            weight: 'bold',
            size: 'sm',
            color: '#111111'
          },
          {
            type: 'text',
            text: `⏰ ${pi.holdingPeriod}`,
            size: 'xs',
            color: '#555555',
            wrap: true
          },
          {
            type: 'text',
            text: `⚠️ ${pi.riskLevelCn}`,
            size: 'xs',
            color: '#555555',
            wrap: true
          }
        ]
      });
    }

    // Add price and market info
    contents.push({
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '13px',
      contents: [
        // Current Price
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: '💰 Price',
              size: 'sm',
              color: '#555555',
              flex: 0
            },
            {
              type: 'text',
              text: signal.entryPrice?.toFixed(5) || 'N/A',
              size: 'sm',
              color: '#111111',
              align: 'end'
            }
          ]
        },
        // Market Condition
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: '📊 Market',
              size: 'sm',
              color: '#555555',
              flex: 0
            },
            {
              type: 'text',
              text: signal.marketCondition?.toUpperCase() || 'N/A',
              size: 'sm',
              color: '#111111',
              align: 'end'
            }
          ]
        },
        // Sentiment
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: '📰 Sentiment',
              size: 'sm',
              color: '#555555',
              flex: 0
            },
            {
              type: 'text',
              text: signal.sentimentScore
                ? `${(signal.sentimentScore * 100).toFixed(1)}% ${sentimentEmoji}`
                : 'N/A',
              size: 'sm',
              color: '#111111',
              align: 'end'
            }
          ]
        }
      ]
    });

    // Add technical indicators if available
    if (signal.technicalData?.indicators) {
      const indicators = signal.technicalData.indicators;
      const indicatorContents = [];

      if (indicators.sma) {
        indicatorContents.push({
          type: 'text',
          text: `SMA(${indicators.sma.period}): ${indicators.sma.value.toFixed(5)} (${indicators.sma.signal})`,
          size: 'xs',
          color: '#555555',
          wrap: true
        });
      }

      if (indicators.rsi) {
        indicatorContents.push({
          type: 'text',
          text: `RSI(${indicators.rsi.period}): ${indicators.rsi.value.toFixed(2)} (${indicators.rsi.signal})`,
          size: 'xs',
          color: '#555555',
          wrap: true
        });
      }

      if (indicatorContents.length > 0) {
        contents.push({
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          paddingAll: '13px',
          backgroundColor: '#f8f8f8',
          contents: [
            {
              type: 'text',
              text: '📉 Technical Indicators',
              weight: 'bold',
              size: 'sm',
              color: '#111111'
            },
            ...indicatorContents
          ]
        });
      }
    }

    // Add risk warning footer
    contents.push({
      type: 'box',
      layout: 'vertical',
      paddingAll: '13px',
      contents: [
        {
          type: 'text',
          text: signal.riskWarning || '⚠️ Trading carries significant risk.',
          size: 'xs',
          color: '#999999',
          wrap: true
        }
      ]
    });

    return {
      type: 'flex',
      altText: `Trading Signal: ${pair} - ${signal.signal.toUpperCase()}`,
      contents: {
        type: 'bubble',
        hero: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `📊 ${pair}`,
              weight: 'bold',
              size: 'xxl',
              color: '#ffffff'
            }
          ],
          backgroundColor: '#1DB446',
          paddingAll: '20px'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: contents,
          paddingAll: '0px'
        }
      }
    };
  }

  /**
   * Build simple text message
   * @param {string} text - Message text
   * @returns {Object} LINE text message
   */
  buildTextMessage(text) {
    return {
      type: 'text',
      text: text
    };
  }

  /**
   * Build error message
   * @param {string} error - Error message
   * @returns {Object} LINE text message
   */
  buildErrorMessage(error) {
    return this.buildTextMessage(`❌ ${error}`);
  }

  /**
   * Build help message
   * @returns {Object} LINE text message
   */
  buildHelpMessage() {
    const helpText = `📖 AIFX v2 交易機器人使用指南

🔍 查詢信號：
輸入貨幣對，例如：
• EUR/USD
• EUR/USD 周內
• GBP/USD 日內

🔔 訂閱功能（新）：
• 訂閱 EUR/USD - 訂閱信號變化通知
• 訂閱 EUR/USD 1h - 指定時間框架
• 取消訂閱 EUR/USD - 取消訂閱
• 我的訂閱 - 查看所有訂閱

當訂閱的貨幣對信號改變時，我會主動通知您！

📊 支援的貨幣對：
• EUR/USD (歐元/美元)
• USD/JPY (美元/日元)
• GBP/USD (英鎊/美元)

⏰ 交易週期：
• 日內 - 當天平倉 (15min)
• 周內 - 波段操作 (1h) ⭐推薦新手
• 月內 - 趨勢跟隨 (1d)
• 季內 - 長期持有 (1w)

⏱️ 時間框架：
• 15min, 1h, 4h, 1d

需要幫助？輸入「幫助」查看此訊息`;

    return this.buildTextMessage(helpText);
  }

  /**
   * Build welcome message
   * @param {string} displayName - User's display name
   * @returns {Object} LINE text message
   */
  buildWelcomeMessage(displayName) {
    const welcomeText = `👋 歡迎 ${displayName}！

我是 AIFX v2 智能交易機器人，可以幫您：
✅ 獲取即時交易信號
✅ 分析市場情緒
✅ 提供技術指標分析

輸入貨幣對（例如 EUR/USD）開始使用
輸入「幫助」查看完整指南`;

    return this.buildTextMessage(welcomeText);
  }
}

module.exports = new MessageBuilder();
