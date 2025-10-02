/**
 * Trading Signal Generation Unit Tests
 */

describe('Trading Signal Generation', () => {
  describe('Signal Structure Validation', () => {
    test('should create valid signal structure', () => {
      const signal = {
        pair: 'EUR/USD',
        action: 'buy',
        confidence: 0.75,
        entryPrice: 1.0850,
        stopLoss: 1.0800,
        takeProfit: 1.0950,
        timestamp: new Date().toISOString(),
      };

      expect(signal.pair).toBeDefined();
      expect(['buy', 'sell', 'hold']).toContain(signal.action);
      expect(signal.confidence).toBeGreaterThanOrEqual(0);
      expect(signal.confidence).toBeLessThanOrEqual(1);
      expect(signal.entryPrice).toBeGreaterThan(0);
    });

    test('should validate stop loss placement for buy signal', () => {
      const signal = {
        action: 'buy',
        entryPrice: 1.0850,
        stopLoss: 1.0800,
      };

      expect(signal.stopLoss).toBeLessThan(signal.entryPrice);
    });

    test('should validate stop loss placement for sell signal', () => {
      const signal = {
        action: 'sell',
        entryPrice: 1.0850,
        stopLoss: 1.0900,
      };

      expect(signal.stopLoss).toBeGreaterThan(signal.entryPrice);
    });

    test('should validate take profit placement for buy signal', () => {
      const signal = {
        action: 'buy',
        entryPrice: 1.0850,
        takeProfit: 1.0950,
      };

      expect(signal.takeProfit).toBeGreaterThan(signal.entryPrice);
    });

    test('should validate take profit placement for sell signal', () => {
      const signal = {
        action: 'sell',
        entryPrice: 1.0850,
        takeProfit: 1.0750,
      };

      expect(signal.takeProfit).toBeLessThan(signal.entryPrice);
    });
  });

  describe('Risk/Reward Ratio Calculation', () => {
    test('should calculate risk/reward for buy signal', () => {
      const entryPrice = 1.0850;
      const stopLoss = 1.0800;
      const takeProfit = 1.0950;

      const risk = entryPrice - stopLoss;
      const reward = takeProfit - entryPrice;
      const riskRewardRatio = reward / risk;

      expect(risk).toBe(0.0050);
      expect(reward).toBe(0.0100);
      expect(riskRewardRatio).toBe(2.0);
    });

    test('should calculate risk/reward for sell signal', () => {
      const entryPrice = 1.0850;
      const stopLoss = 1.0900;
      const takeProfit = 1.0750;

      const risk = stopLoss - entryPrice;
      const reward = entryPrice - takeProfit;
      const riskRewardRatio = reward / risk;

      expect(risk).toBe(0.0050);
      expect(reward).toBe(0.0100);
      expect(riskRewardRatio).toBe(2.0);
    });

    test('should accept good risk/reward ratio', () => {
      const riskRewardRatio = 2.5;
      const minRatio = 1.5;

      expect(riskRewardRatio).toBeGreaterThanOrEqual(minRatio);
    });

    test('should reject poor risk/reward ratio', () => {
      const riskRewardRatio = 1.0;
      const minRatio = 1.5;

      expect(riskRewardRatio).toBeLessThan(minRatio);
    });
  });

  describe('Confidence Score Validation', () => {
    test('should normalize confidence score', () => {
      const scores = [0.7, 0.8, 0.9];
      const avgScore = scores.reduce((a, b) => a + b) / scores.length;

      expect(avgScore).toBeGreaterThanOrEqual(0);
      expect(avgScore).toBeLessThanOrEqual(1);
      expect(avgScore).toBeCloseTo(0.8, 1);
    });

    test('should filter low confidence signals', () => {
      const signals = [
        { confidence: 0.45 },
        { confidence: 0.75 },
        { confidence: 0.85 },
      ];

      const minConfidence = 0.6;
      const filtered = signals.filter(s => s.confidence >= minConfidence);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].confidence).toBeGreaterThanOrEqual(minConfidence);
    });

    test('should weight multiple factors', () => {
      const factors = {
        technical: 0.8,
        sentiment: 0.7,
        ml: 0.9,
      };

      const weights = {
        technical: 0.4,
        sentiment: 0.3,
        ml: 0.3,
      };

      const weightedScore =
        factors.technical * weights.technical +
        factors.sentiment * weights.sentiment +
        factors.ml * weights.ml;

      expect(weightedScore).toBeCloseTo(0.8, 1);
    });
  });

  describe('Technical Indicator Analysis', () => {
    test('should calculate SMA crossover', () => {
      const shortSMA = 1.0860;
      const longSMA = 1.0850;

      const isBullishCrossover = shortSMA > longSMA;
      const isBearishCrossover = shortSMA < longSMA;

      expect(isBullishCrossover).toBe(true);
      expect(isBearishCrossover).toBe(false);
    });

    test('should identify RSI overbought condition', () => {
      const rsi = 75;
      const overboughtThreshold = 70;

      expect(rsi).toBeGreaterThan(overboughtThreshold);
    });

    test('should identify RSI oversold condition', () => {
      const rsi = 25;
      const oversoldThreshold = 30;

      expect(rsi).toBeLessThan(oversoldThreshold);
    });

    test('should validate MACD signal', () => {
      const macdLine = 0.0015;
      const signalLine = 0.0010;

      const isBullish = macdLine > signalLine;
      expect(isBullish).toBe(true);
    });
  });

  describe('Signal Action Determination', () => {
    test('should generate buy signal on bullish indicators', () => {
      const indicators = {
        sma: true,  // Bullish crossover
        rsi: 35,    // Not overbought
        macd: 'bullish',
      };

      const bullishCount = [
        indicators.sma,
        indicators.rsi < 70,
        indicators.macd === 'bullish',
      ].filter(Boolean).length;

      const action = bullishCount >= 2 ? 'buy' : 'hold';
      expect(action).toBe('buy');
    });

    test('should generate sell signal on bearish indicators', () => {
      const indicators = {
        sma: false, // Bearish crossover
        rsi: 75,    // Overbought
        macd: 'bearish',
      };

      const bearishCount = [
        !indicators.sma,
        indicators.rsi > 70,
        indicators.macd === 'bearish',
      ].filter(Boolean).length;

      const action = bearishCount >= 2 ? 'sell' : 'hold';
      expect(action).toBe('sell');
    });

    test('should generate hold signal on mixed indicators', () => {
      const indicators = {
        sma: true,  // Bullish
        rsi: 75,    // Bearish (overbought)
        macd: 'bearish',
      };

      const bullishCount = [indicators.sma].filter(Boolean).length;
      const bearishCount = [indicators.rsi > 70, indicators.macd === 'bearish'].filter(Boolean).length;

      const action = bullishCount > bearishCount ? 'buy' :
                     bearishCount > bullishCount ? 'sell' : 'hold';

      expect(action).toBe('hold');
    });
  });

  describe('Signal Filtering', () => {
    test('should filter by user risk level', () => {
      const signals = [
        { riskRewardRatio: 1.5 },
        { riskRewardRatio: 2.0 },
        { riskRewardRatio: 2.5 },
      ];

      const userRiskLevel = 5; // Medium risk
      const minRatio = userRiskLevel <= 5 ? 2.0 : 1.5;

      const filtered = signals.filter(s => s.riskRewardRatio >= minRatio);

      expect(filtered).toHaveLength(2);
    });

    test('should filter by preferred pairs', () => {
      const signals = [
        { pair: 'EUR/USD' },
        { pair: 'GBP/USD' },
        { pair: 'USD/JPY' },
      ];

      const preferredPairs = ['EUR/USD', 'GBP/USD'];
      const filtered = signals.filter(s => preferredPairs.includes(s.pair));

      expect(filtered).toHaveLength(2);
      expect(filtered.map(s => s.pair)).toEqual(['EUR/USD', 'GBP/USD']);
    });

    test('should filter by trading style', () => {
      const signal = {
        action: 'buy',
        indicators: { trend: 'bullish' },
      };

      const userTradingStyle = 'trend';
      const matchesStyle = signal.indicators.trend === 'bullish' &&
                          userTradingStyle === 'trend';

      expect(matchesStyle).toBe(true);
    });
  });

  describe('Signal Expiration', () => {
    test('should mark signal as expired after timeframe', () => {
      const signal = {
        timestamp: new Date(Date.now() - 7200000), // 2 hours ago
        timeframe: '1hour',
      };

      const timeframeMs = 3600000; // 1 hour in ms
      const age = Date.now() - new Date(signal.timestamp).getTime();
      const isExpired = age > timeframeMs * 2;

      expect(isExpired).toBe(true);
    });

    test('should keep signal active within timeframe', () => {
      const signal = {
        timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
        timeframe: '1hour',
      };

      const timeframeMs = 3600000;
      const age = Date.now() - new Date(signal.timestamp).getTime();
      const isExpired = age > timeframeMs * 2;

      expect(isExpired).toBe(false);
    });
  });

  describe('Stop Loss Calculation', () => {
    test('should calculate stop loss using ATR', () => {
      const entryPrice = 1.0850;
      const atr = 0.0020;
      const multiplier = 2;

      const stopLoss = entryPrice - (atr * multiplier);

      expect(stopLoss).toBeCloseTo(1.0810, 4);
    });

    test('should respect maximum stop loss distance', () => {
      const entryPrice = 1.0850;
      const calculatedStopLoss = 1.0700; // 150 pips
      const maxPips = 100;
      const maxStopLoss = entryPrice - (maxPips * 0.0001);

      const finalStopLoss = Math.max(calculatedStopLoss, maxStopLoss);

      expect(finalStopLoss).toBe(maxStopLoss);
      expect(finalStopLoss).toBeGreaterThan(calculatedStopLoss);
    });
  });
});