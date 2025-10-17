/**
 * Market Data Collection Service
 *
 * Purpose: Fetch forex market data from external APIs and store in market_data table
 * Supports: EUR/USD, USD/JPY with 1h and 15min timeframes
 *
 * Data Sources:
 * - Primary: Alpha Vantage (5 req/min limit)
 * - Fallback: Twelve Data (800 req/day limit)
 * - For testing: yfinance via Python script
 */

const axios = require('axios');
const { Op } = require('sequelize');
const MarketData = require('../models/MarketData');

class MarketDataCollectionService {
  constructor() {
    this.alphaVantageKey = process.env.ALPHA_VANTAGE_KEY;
    this.twelveDataKey = process.env.TWELVE_DATA_KEY;

    // Rate limiting
    this.lastAlphaVantageCall = 0;
    this.alphaVantageDelay = 12000; // 12 seconds between calls (5 req/min)
  }

  /**
   * Fetch latest market data for all configured pairs and timeframes
   * @returns {Promise<Object>} Collection results
   */
  async fetchLatestData() {
    const pairs = ['EUR/USD', 'USD/JPY'];
    const timeframes = ['1h', '15min'];

    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    for (const pair of pairs) {
      for (const timeframe of timeframes) {
        try {
          console.log(`[MarketDataCollection] Fetching ${pair} ${timeframe}...`);

          // Check if we already have recent data
          const latestData = await this.getLatestStoredData(pair, timeframe);
          const needsUpdate = this.shouldUpdateData(latestData, timeframe);

          if (!needsUpdate) {
            console.log(`[MarketDataCollection] ${pair} ${timeframe} is up-to-date, skipping`);
            results.skipped.push({ pair, timeframe, reason: 'up-to-date' });
            continue;
          }

          // Fetch new data
          const candles = await this.fetchCandlestickData(pair, timeframe, 100);

          if (!candles || candles.length === 0) {
            throw new Error('No candles received from API');
          }

          // Store in database
          const stored = await this.storeMarketData(candles, pair, timeframe);

          results.success.push({
            pair,
            timeframe,
            candlesStored: stored,
            latestTimestamp: candles[candles.length - 1].timestamp
          });

          console.log(`[MarketDataCollection] ✅ Stored ${stored} candles for ${pair} ${timeframe}`);

        } catch (error) {
          console.error(`[MarketDataCollection] ❌ Failed to fetch ${pair} ${timeframe}:`, error.message);
          results.failed.push({
            pair,
            timeframe,
            error: error.message
          });
        }
      }
    }

    return results;
  }

  /**
   * Get latest stored data for pair/timeframe
   * @param {string} pair - Currency pair
   * @param {string} timeframe - Timeframe
   * @returns {Promise<Object|null>}
   */
  async getLatestStoredData(pair, timeframe) {
    return await MarketData.findOne({
      where: { pair, timeframe },
      order: [['timestamp', 'DESC']]
    });
  }

  /**
   * Check if data needs updating based on timeframe
   * @param {Object} latestData - Latest stored data
   * @param {string} timeframe - Timeframe
   * @returns {boolean}
   */
  shouldUpdateData(latestData, timeframe) {
    if (!latestData) return true;

    const now = new Date();
    const lastTimestamp = new Date(latestData.timestamp);
    const ageMinutes = (now - lastTimestamp) / 1000 / 60;

    // Update thresholds by timeframe
    const thresholds = {
      '15min': 15,
      '1h': 60,
      '4h': 240,
      '1d': 1440
    };

    return ageMinutes >= (thresholds[timeframe] || 60);
  }

  /**
   * Fetch candlestick data from API
   * @param {string} pair - Currency pair
   * @param {string} timeframe - Timeframe
   * @param {number} limit - Number of candles to fetch
   * @returns {Promise<Array>}
   */
  async fetchCandlestickData(pair, timeframe, limit = 100) {
    // Try Alpha Vantage first
    try {
      return await this.fetchFromAlphaVantage(pair, timeframe, limit);
    } catch (error) {
      console.warn(`[MarketDataCollection] Alpha Vantage failed, trying Twelve Data:`, error.message);

      // Fallback to Twelve Data
      try {
        return await this.fetchFromTwelveData(pair, timeframe, limit);
      } catch (error2) {
        console.error(`[MarketDataCollection] All data sources failed`);
        throw new Error(`Failed to fetch data: ${error2.message}`);
      }
    }
  }

  /**
   * Fetch from Alpha Vantage API
   * @param {string} pair - Currency pair
   * @param {string} timeframe - Timeframe
   * @param {number} limit - Number of candles
   * @returns {Promise<Array>}
   */
  async fetchFromAlphaVantage(pair, timeframe, limit) {
    if (!this.alphaVantageKey) {
      throw new Error('ALPHA_VANTAGE_KEY not configured');
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastCall = now - this.lastAlphaVantageCall;
    if (timeSinceLastCall < this.alphaVantageDelay) {
      const waitTime = this.alphaVantageDelay - timeSinceLastCall;
      console.log(`[AlphaVantage] Rate limit: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Map timeframe to Alpha Vantage function
    const functionMap = {
      '1min': 'FX_INTRADAY',
      '5min': 'FX_INTRADAY',
      '15min': 'FX_INTRADAY',
      '30min': 'FX_INTRADAY',
      '1h': 'FX_INTRADAY',
      '4h': 'FX_INTRADAY',
      '1d': 'FX_DAILY'
    };

    const intervalMap = {
      '1min': '1min',
      '5min': '5min',
      '15min': '15min',
      '30min': '30min',
      '1h': '60min',
      '4h': '60min' // Will need custom aggregation
    };

    const fromSymbol = pair.substring(0, 3);
    const toSymbol = pair.substring(4, 7);
    const functionName = functionMap[timeframe];
    const interval = intervalMap[timeframe];

    const url = `https://www.alphavantage.co/query?function=${functionName}&from_symbol=${fromSymbol}&to_symbol=${toSymbol}&interval=${interval}&outputsize=full&apikey=${this.alphaVantageKey}`;

    const response = await axios.get(url, { timeout: 30000 });
    this.lastAlphaVantageCall = Date.now();

    if (response.data.Note) {
      throw new Error('Alpha Vantage API rate limit exceeded');
    }

    if (response.data.Error) {
      throw new Error(`Alpha Vantage error: ${response.data.Error}`);
    }

    // Parse response
    const timeSeriesKey = Object.keys(response.data).find(key => key.includes('Time Series'));
    if (!timeSeriesKey) {
      throw new Error('Invalid Alpha Vantage response format');
    }

    const timeSeries = response.data[timeSeriesKey];
    const candles = [];

    // Convert to our format
    for (const [timestamp, values] of Object.entries(timeSeries)) {
      candles.push({
        timestamp: new Date(timestamp),
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: 0 // FX doesn't have reliable volume
      });

      if (candles.length >= limit) break;
    }

    // Sort by timestamp (oldest first)
    candles.sort((a, b) => a.timestamp - b.timestamp);

    return candles;
  }

  /**
   * Fetch from Twelve Data API
   * @param {string} pair - Currency pair
   * @param {string} timeframe - Timeframe
   * @param {number} limit - Number of candles
   * @returns {Promise<Array>}
   */
  async fetchFromTwelveData(pair, timeframe, limit) {
    if (!this.twelveDataKey) {
      throw new Error('TWELVE_DATA_KEY not configured');
    }

    // Twelve Data interval format
    const intervalMap = {
      '1min': '1min',
      '5min': '5min',
      '15min': '15min',
      '30min': '30min',
      '1h': '1h',
      '4h': '4h',
      '1d': '1day'
    };

    const symbol = pair.replace('/', '');
    const interval = intervalMap[timeframe];

    const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&outputsize=${limit}&apikey=${this.twelveDataKey}`;

    const response = await axios.get(url, { timeout: 30000 });

    if (response.data.status === 'error') {
      throw new Error(`Twelve Data error: ${response.data.message}`);
    }

    const candles = response.data.values.map(v => ({
      timestamp: new Date(v.datetime),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: parseInt(v.volume) || 0
    }));

    // Sort by timestamp (oldest first)
    candles.sort((a, b) => a.timestamp - b.timestamp);

    return candles;
  }

  /**
   * Store market data in database
   * @param {Array} candles - Candlestick data
   * @param {string} pair - Currency pair
   * @param {string} timeframe - Timeframe
   * @returns {Promise<number>} Number of records stored
   */
  async storeMarketData(candles, pair, timeframe) {
    let storedCount = 0;

    for (const candle of candles) {
      try {
        // Use upsert to handle duplicates
        await MarketData.upsert({
          pair,
          timeframe,
          timestamp: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          source: 'alpha_vantage',
          isRealTime: true,
          cacheExpiresAt: this.calculateCacheExpiry(timeframe)
        });

        storedCount++;
      } catch (error) {
        // Skip duplicates
        if (error.name !== 'SequelizeUniqueConstraintError') {
          console.error(`[MarketDataCollection] Failed to store candle:`, error.message);
        }
      }
    }

    return storedCount;
  }

  /**
   * Calculate cache expiry based on timeframe
   * @param {string} timeframe - Timeframe
   * @returns {Date}
   */
  calculateCacheExpiry(timeframe) {
    const now = new Date();
    const expiryMinutes = {
      '1min': 1,
      '5min': 5,
      '15min': 15,
      '30min': 30,
      '1h': 60,
      '4h': 240,
      '1d': 1440
    };

    const minutes = expiryMinutes[timeframe] || 60;
    return new Date(now.getTime() + minutes * 60 * 1000);
  }

  /**
   * Get statistics about stored data
   * @returns {Promise<Object>}
   */
  async getStorageStats() {
    const stats = await MarketData.findAll({
      attributes: [
        'pair',
        'timeframe',
        [MarketData.sequelize.fn('COUNT', MarketData.sequelize.col('id')), 'count'],
        [MarketData.sequelize.fn('MIN', MarketData.sequelize.col('timestamp')), 'oldest'],
        [MarketData.sequelize.fn('MAX', MarketData.sequelize.col('timestamp')), 'newest']
      ],
      group: ['pair', 'timeframe'],
      raw: true
    });

    return stats;
  }
}

module.exports = new MarketDataCollectionService();
