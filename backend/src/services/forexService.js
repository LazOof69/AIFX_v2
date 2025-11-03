/**
 * Forex Data Service
 * Simplified service using ONLY yfinance via ML Engine API
 * REMOVED: Alpha Vantage, Twelve Data (as per user request)
 */

const axios = require('axios');
const cache = require('../utils/cache');
const MarketData = require('../models/MarketData');
const AppError = require('../utils/AppError');

/**
 * ML Engine API Configuration
 */
const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';

/**
 * Supported currency pairs (from yfinance)
 */
const SUPPORTED_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  'EUR/GBP', 'EUR/AUD', 'EUR/JPY', 'GBP/JPY', 'CHF/JPY', 'AUD/JPY', 'AUD/NZD',
];

/**
 * Initialize cache connection
 */
const initializeCache = async () => {
  try {
    await cache.initializeRedis();
  } catch (error) {
    console.warn('⚠️ Cache initialization failed, continuing without cache:', error.message);
  }
};

/**
 * Fetch real-time price for a currency pair
 * Uses yfinance via ML Engine API
 *
 * @param {string} pair - Currency pair (e.g., 'EUR/USD')
 * @returns {Promise<object>} Price data
 */
const getRealtimePrice = async (pair) => {
  try {
    // Check cache first
    const cacheKey = cache.generateForexKey('realtime', pair);
    const cachedData = await cache.get(cacheKey);

    if (cachedData) {
      console.log(`✅ Cache hit for ${pair} realtime price`);
      return {
        success: true,
        data: JSON.parse(cachedData),
        cached: true,
        timestamp: new Date().toISOString(),
      };
    }

    console.log(`🔍 Fetching realtime price for ${pair} from ML Engine (yfinance)...`);

    // Fetch from ML Engine (which uses yfinance)
    const response = await axios.get(`${ML_API_URL}/market-data/${pair.replace('/', '')}`, {
      params: {
        timeframe: '1min',
        limit: 1,
      },
      timeout: 10000,
    });

    if (!response.data.success || !response.data.data.timeSeries.length) {
      throw new AppError(`No price data available for ${pair}`, 404, 'NO_DATA');
    }

    const latestCandle = response.data.data.timeSeries[0];
    const priceData = {
      pair,
      price: latestCandle.close,
      open: latestCandle.open,
      high: latestCandle.high,
      low: latestCandle.low,
      timestamp: latestCandle.timestamp,
      source: 'yfinance',
    };

    // Cache for 30 seconds (realtime data should be fresh)
    await cache.set(cacheKey, JSON.stringify(priceData), 30);

    return {
      success: true,
      data: priceData,
      cached: false,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`❌ Error fetching realtime price for ${pair}:`, error.message);

    if (error.code === 'NO_DATA') {
      throw error;
    }

    throw new AppError(
      `Failed to fetch realtime price: ${error.message}`,
      503,
      'API_ERROR'
    );
  }
};

/**
 * Fetch historical market data
 * Uses yfinance via ML Engine API
 *
 * @param {string} pair - Currency pair
 * @param {string} timeframe - Timeframe (1min, 5min, 15min, 30min, 1h, 4h, 1d, 1w, 1M)
 * @param {number} limit - Number of candles to fetch
 * @returns {Promise<object>} Historical data
 */
const getHistoricalData = async (pair, timeframe = '1hour', limit = 100) => {
  try {
    // Normalize timeframe format
    const normalizedTimeframe = normalizeTimeframe(timeframe);

    // Check cache first
    const cacheKey = cache.generateForexKey('historical', pair, normalizedTimeframe, limit.toString());
    const cachedData = await cache.get(cacheKey);

    if (cachedData) {
      console.log(`✅ Cache hit for ${pair} ${normalizedTimeframe} historical data`);
      return {
        success: true,
        data: JSON.parse(cachedData),
        cached: true,
        timestamp: new Date().toISOString(),
      };
    }

    console.log(`🔍 Fetching ${pair} ${normalizedTimeframe} historical data from ML Engine (yfinance)...`);

    // Fetch from ML Engine (which uses yfinance)
    const response = await axios.get(`${ML_API_URL}/market-data/${pair.replace('/', '')}`, {
      params: {
        timeframe: normalizedTimeframe,
        limit: limit,
      },
      timeout: 15000,
    });

    if (!response.data.success) {
      throw new AppError(
        response.data.error || 'Failed to fetch historical data',
        404,
        'NO_DATA'
      );
    }

    const historicalData = {
      pair,
      timeframe: normalizedTimeframe,
      timeSeries: response.data.data.timeSeries,
      metadata: response.data.data.metadata,
      source: 'yfinance',
    };

    // Cache based on timeframe (longer timeframes = longer cache)
    const cacheTTL = getCacheTTL(normalizedTimeframe);
    await cache.set(cacheKey, JSON.stringify(historicalData), cacheTTL);

    return {
      success: true,
      data: historicalData,
      cached: false,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`❌ Error fetching historical data for ${pair}:`, error.message);

    if (error.code === 'NO_DATA') {
      throw error;
    }

    throw new AppError(
      `Failed to fetch historical data: ${error.message}`,
      503,
      'API_ERROR'
    );
  }
};

/**
 * Normalize timeframe format
 */
const normalizeTimeframe = (timeframe) => {
  const mapping = {
    '1min': '1min',
    '5min': '5min',
    '15min': '15min',
    '30min': '30min',
    '1hour': '1h',
    '1h': '1h',
    '4hour': '4h',
    '4h': '4h',
    'daily': '1d',
    '1day': '1d',
    '1d': '1d',
    'weekly': '1w',
    '1week': '1w',
    '1w': '1w',
    'monthly': '1M',
    '1month': '1M',
    '1M': '1M',
  };

  return mapping[timeframe] || '1h';
};

/**
 * Get cache TTL based on timeframe
 */
const getCacheTTL = (timeframe) => {
  const ttlMap = {
    '1min': 30,      // 30 seconds
    '5min': 120,     // 2 minutes
    '15min': 300,    // 5 minutes
    '30min': 600,    // 10 minutes
    '1h': 1800,      // 30 minutes
    '4h': 3600,      // 1 hour
    '1d': 14400,     // 4 hours
    '1w': 86400,     // 1 day
    '1M': 86400,     // 1 day
  };

  return ttlMap[timeframe] || 1800;
};

/**
 * Get supported currency pairs
 */
const getSupportedPairs = () => {
  return {
    success: true,
    data: {
      pairs: SUPPORTED_PAIRS,
      total: SUPPORTED_PAIRS.length,
      source: 'yfinance',
    },
    timestamp: new Date().toISOString(),
  };
};

/**
 * Save market data to database (for historical tracking)
 */
const saveMarketData = async (pair, data) => {
  try {
    await MarketData.create({
      pair,
      timeframe: data.timeframe,
      open: data.open,
      high: data.high,
      low: data.low,
      close: data.close,
      volume: data.volume || 0,
      timestamp: new Date(data.timestamp),
      source: 'yfinance',
    });

    return { success: true };
  } catch (error) {
    console.error(`❌ Error saving market data for ${pair}:`, error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  initializeCache,
  getRealtimePrice,
  getHistoricalData,
  getSupportedPairs,
  saveMarketData,
};
