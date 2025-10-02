'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF', 'EUR/GBP'];
    const actions = ['buy', 'sell', 'hold'];
    const statuses = ['active', 'closed', 'expired'];
    const results = ['win', 'loss', 'breakeven', null];

    const signals = [];

    // Generate 20 demo signals
    for (let i = 0; i < 20; i++) {
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      const action = actions[Math.floor(Math.random() * actions.length)];
      const status = i < 10 ? 'active' : statuses[Math.floor(Math.random() * statuses.length)];
      const confidence = (0.6 + Math.random() * 0.35).toFixed(2); // 0.60 - 0.95
      const entryPrice = (1.0 + Math.random() * 0.2).toFixed(5);

      const stopLossPips = 20 + Math.random() * 30;
      const takeProfitPips = 40 + Math.random() * 80;
      const stopLoss = action === 'buy'
        ? (parseFloat(entryPrice) - stopLossPips * 0.0001).toFixed(5)
        : (parseFloat(entryPrice) + stopLossPips * 0.0001).toFixed(5);
      const takeProfit = action === 'buy'
        ? (parseFloat(entryPrice) + takeProfitPips * 0.0001).toFixed(5)
        : (parseFloat(entryPrice) - takeProfitPips * 0.0001).toFixed(5);

      const riskReward = (takeProfitPips / stopLossPips).toFixed(2);

      const createdAt = new Date(Date.now() - (i * 3600000)); // Spread over last 20 hours

      signals.push({
        id: uuidv4(),
        pair,
        action,
        confidence,
        entry_price: entryPrice,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        risk_reward: riskReward,
        timeframe: '1hour',
        technical_factors: JSON.stringify({
          sma: Math.random() > 0.5,
          rsi: (30 + Math.random() * 40).toFixed(2),
          macd: Math.random() > 0.5 ? 'bullish' : 'bearish',
        }),
        sentiment_factors: JSON.stringify({
          market_sentiment: Math.random() > 0.5 ? 'bullish' : 'bearish',
          news_impact: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        }),
        ml_prediction: JSON.stringify({
          model_confidence: (0.7 + Math.random() * 0.25).toFixed(2),
          prediction: action,
        }),
        status,
        result: status === 'closed' ? results[Math.floor(Math.random() * 3)] : null,
        closed_at: status === 'closed' ? new Date(createdAt.getTime() + 7200000) : null,
        created_at: createdAt,
        updated_at: createdAt,
      });
    }

    await queryInterface.bulkInsert('trading_signals', signals, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('trading_signals', null, {});
  }
};