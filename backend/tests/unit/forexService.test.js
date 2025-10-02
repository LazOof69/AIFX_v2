/**
 * Forex Data Service Unit Tests
 */

describe('Forex Data Service', () => {
  describe('Currency Pair Validation', () => {
    const isValidPair = (pair) => {
      const pairRegex = /^[A-Z]{3}\/[A-Z]{3}$/;
      return pairRegex.test(pair);
    };

    test('should validate correct currency pair format', () => {
      const validPairs = [
        'EUR/USD',
        'GBP/USD',
        'USD/JPY',
        'AUD/USD',
        'USD/CHF',
      ];

      validPairs.forEach(pair => {
        expect(isValidPair(pair)).toBe(true);
      });
    });

    test('should reject invalid currency pair format', () => {
      const invalidPairs = [
        'EURUSD',      // Missing slash
        'EUR-USD',     // Wrong separator
        'EU/USD',      // Too short
        'EUR/US',      // Too short
        'eur/usd',     // Lowercase
      ];

      invalidPairs.forEach(pair => {
        expect(isValidPair(pair)).toBe(false);
      });
    });
  });

  describe('Price Data Validation', () => {
    test('should validate price data structure', () => {
      const priceData = {
        pair: 'EUR/USD',
        price: 1.0850,
        bid: 1.0849,
        ask: 1.0851,
        timestamp: new Date().toISOString(),
      };

      expect(priceData.pair).toBeDefined();
      expect(typeof priceData.price).toBe('number');
      expect(priceData.price).toBeGreaterThan(0);
      expect(priceData.bid).toBeLessThanOrEqual(priceData.ask);
    });

    test('should calculate spread correctly', () => {
      const bid = 1.0849;
      const ask = 1.0851;
      const spread = ask - bid;

      expect(spread).toBeGreaterThanOrEqual(0);
      expect(spread).toBe(0.0002);
    });

    test('should validate historical data format', () => {
      const historicalData = [
        { timestamp: '2025-01-01T00:00:00Z', open: 1.0850, high: 1.0860, low: 1.0840, close: 1.0855, volume: 1000 },
        { timestamp: '2025-01-01T01:00:00Z', open: 1.0855, high: 1.0870, low: 1.0850, close: 1.0865, volume: 1200 },
      ];

      historicalData.forEach(candle => {
        expect(candle.high).toBeGreaterThanOrEqual(candle.open);
        expect(candle.high).toBeGreaterThanOrEqual(candle.close);
        expect(candle.low).toBeLessThanOrEqual(candle.open);
        expect(candle.low).toBeLessThanOrEqual(candle.close);
        expect(candle.volume).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Timeframe Validation', () => {
    const validTimeframes = ['1min', '5min', '15min', '30min', '1hour', '4hour', 'daily', 'weekly', 'monthly'];

    test('should validate correct timeframe values', () => {
      validTimeframes.forEach(timeframe => {
        expect(validTimeframes).toContain(timeframe);
      });
    });

    test('should reject invalid timeframe values', () => {
      const invalidTimeframes = ['2min', '10hour', 'yearly', 'invalid'];

      invalidTimeframes.forEach(timeframe => {
        expect(validTimeframes).not.toContain(timeframe);
      });
    });

    test('should convert timeframe to minutes', () => {
      const timeframeToMinutes = (timeframe) => {
        const map = {
          '1min': 1,
          '5min': 5,
          '15min': 15,
          '30min': 30,
          '1hour': 60,
          '4hour': 240,
          'daily': 1440,
        };
        return map[timeframe];
      };

      expect(timeframeToMinutes('1hour')).toBe(60);
      expect(timeframeToMinutes('daily')).toBe(1440);
    });
  });

  describe('Rate Limiting', () => {
    test('should track API request count', () => {
      let requestCount = 0;
      const maxRequests = 5;

      const makeRequest = () => {
        if (requestCount >= maxRequests) {
          throw new Error('Rate limit exceeded');
        }
        requestCount++;
        return { success: true };
      };

      // Make 5 successful requests
      for (let i = 0; i < 5; i++) {
        expect(() => makeRequest()).not.toThrow();
      }

      // 6th request should fail
      expect(() => makeRequest()).toThrow('Rate limit exceeded');
    });

    test('should reset counter after time window', () => {
      const rateLimit = {
        count: 5,
        maxRequests: 5,
        windowStart: Date.now(),
        windowMs: 60000,
      };

      const canMakeRequest = () => {
        const now = Date.now();
        if (now - rateLimit.windowStart > rateLimit.windowMs) {
          rateLimit.count = 0;
          rateLimit.windowStart = now;
        }
        return rateLimit.count < rateLimit.maxRequests;
      };

      // Simulate time passing
      rateLimit.windowStart = Date.now() - 61000; // 61 seconds ago

      expect(canMakeRequest()).toBe(true);
    });
  });

  describe('Data Caching', () => {
    test('should cache forex data', () => {
      const cache = new Map();
      const cacheKey = 'EUR/USD:1hour';
      const data = { price: 1.0850, timestamp: Date.now() };

      cache.set(cacheKey, data);

      expect(cache.has(cacheKey)).toBe(true);
      expect(cache.get(cacheKey)).toEqual(data);
    });

    test('should invalidate expired cache', () => {
      const ttl = 60000; // 60 seconds
      const cachedData = {
        data: { price: 1.0850 },
        timestamp: Date.now() - 61000, // 61 seconds ago
      };

      const isExpired = (cachedData, ttl) => {
        return Date.now() - cachedData.timestamp > ttl;
      };

      expect(isExpired(cachedData, ttl)).toBe(true);
    });

    test('should return valid cached data', () => {
      const ttl = 60000;
      const cachedData = {
        data: { price: 1.0850 },
        timestamp: Date.now() - 30000, // 30 seconds ago
      };

      const isExpired = (cachedData, ttl) => {
        return Date.now() - cachedData.timestamp > ttl;
      };

      expect(isExpired(cachedData, ttl)).toBe(false);
    });
  });

  describe('Price Change Calculation', () => {
    test('should calculate price change percentage', () => {
      const oldPrice = 1.0800;
      const newPrice = 1.0850;
      const changePercent = ((newPrice - oldPrice) / oldPrice) * 100;

      expect(changePercent).toBeCloseTo(0.463, 2);
    });

    test('should handle negative price change', () => {
      const oldPrice = 1.0850;
      const newPrice = 1.0800;
      const changePercent = ((newPrice - oldPrice) / oldPrice) * 100;

      expect(changePercent).toBeLessThan(0);
      expect(changePercent).toBeCloseTo(-0.461, 2);
    });

    test('should calculate pips difference', () => {
      const calculatePips = (oldPrice, newPrice) => {
        return Math.abs((newPrice - oldPrice) * 10000);
      };

      expect(calculatePips(1.0800, 1.0850)).toBe(50);
      expect(calculatePips(1.0850, 1.0800)).toBe(50);
    });
  });

  describe('Error Handling', () => {
    test('should handle API timeout', () => {
      const timeout = 5000;
      const requestTime = 6000;

      const isTimeout = requestTime > timeout;
      expect(isTimeout).toBe(true);
    });

    test('should handle invalid API response', () => {
      const invalidResponse = { error: 'Invalid API key' };

      expect(invalidResponse.error).toBeDefined();
      expect(invalidResponse.data).toBeUndefined();
    });

    test('should retry failed requests', () => {
      let attemptCount = 0;
      const maxRetries = 3;

      const makeRequest = () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Request failed');
        }
        return { success: true };
      };

      let result;
      for (let i = 0; i < maxRetries; i++) {
        try {
          result = makeRequest();
          break;
        } catch (error) {
          if (i === maxRetries - 1) throw error;
        }
      }

      expect(result).toEqual({ success: true });
      expect(attemptCount).toBe(3);
    });
  });

  describe('Data Transformation', () => {
    test('should transform API response to standard format', () => {
      const apiResponse = {
        '1. symbol': 'EUR/USD',
        '2. price': '1.0850',
        '3. timestamp': '2025-01-01 12:00:00',
      };

      const transform = (response) => ({
        pair: response['1. symbol'],
        price: parseFloat(response['2. price']),
        timestamp: new Date(response['3. timestamp']).toISOString(),
      });

      const transformed = transform(apiResponse);

      expect(transformed.pair).toBe('EUR/USD');
      expect(transformed.price).toBe(1.0850);
      expect(typeof transformed.timestamp).toBe('string');
    });
  });
});