/**
 * Forex Data Service
 * Uses Twelve Data API via ML Engine
 * All market data fetched through ML Engine's /market-data endpoint
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
 * Uses Twelve Data API via ML Engine
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
        data: cachedData,  // Already parsed by cache.get()
        cached: true,
        timestamp: new Date().toISOString(),
      };
    }

    console.log(`🔍 Fetching realtime price for ${pair} from ML Engine (Twelve Data)...`);

    // Fetch from ML Engine (which uses Twelve Data)
    const response = await axios.get(`${ML_API_URL}/market-data/${pair.replace('/', '')}`, {
      params: {
        timeframe: '1min',
        limit: 1,
      },
      timeout: 30000, // Increased to 30s for Twelve Data API
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
      source: 'twelvedata',
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
 * Fetch historical market data (HYBRID MODE)
 * Strategy: Database (99 candles) + API (1 latest candle)
 * Saves API quota while maintaining real-time data
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

    // Check cache first (short TTL for hybrid mode)
    const cacheKey = cache.generateForexKey('historical', pair, normalizedTimeframe, limit.toString());
    const cachedData = await cache.get(cacheKey);

    if (cachedData) {
      console.log(`✅ Cache hit for ${pair} ${normalizedTimeframe} historical data`);
      return {
        success: true,
        data: cachedData,
        cached: true,
        timestamp: new Date().toISOString(),
      };
    }

    console.log(`🔄 HYBRID MODE: Fetching ${pair} ${normalizedTimeframe} data...`);

    // HYBRID MODE: Database (99) + API (1)
    // Step 1: Get 99 candles from database
    const dbCandles = await MarketData.findLatest(pair, normalizedTimeframe, limit - 1);
    console.log(`📂 Database: Retrieved ${dbCandles.length} candles for ${pair} ${normalizedTimeframe}`);

    // Step 2: Get 1 latest candle from API
    let latestCandle = null;
    let apiCallMade = false;

    try {
      const apiResponse = await axios.get(`${ML_API_URL}/market-data/${pair.replace('/', '')}`, {
        params: {
          timeframe: normalizedTimeframe,
          limit: 1,  // Only fetch the latest candle
        },
        timeout: 30000,
      });

      if (apiResponse.data.success && apiResponse.data.timeSeries && apiResponse.data.timeSeries.length > 0) {
        latestCandle = apiResponse.data.timeSeries[0];
        apiCallMade = true;
        console.log(`🌐 API: Retrieved latest candle for ${pair} ${normalizedTimeframe}`);
      }
    } catch (apiError) {
      console.warn(`⚠️ API call failed, using database only: ${apiError.message}`);
    }

    // Step 3: Combine data
    let timeSeries = [];

    if (latestCandle && apiCallMade) {
      // Add latest candle from API first (most recent)
      timeSeries.push(latestCandle);

      // Add database candles (skip if latest timestamp matches API)
      const latestApiTimestamp = new Date(latestCandle.timestamp).getTime();
      dbCandles.forEach(candle => {
        const candleTimestamp = new Date(candle.timestamp).getTime();
        if (candleTimestamp < latestApiTimestamp) {
          timeSeries.push({
            timestamp: candle.timestamp,
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
            volume: parseFloat(candle.volume || 0)
          });
        }
      });

      console.log(`✅ HYBRID: Combined ${timeSeries.length} candles (1 API + ${dbCandles.length} DB)`);
    } else {
      // Fallback: Use only database candles
      timeSeries = dbCandles.map(candle => ({
        timestamp: candle.timestamp,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume || 0)
      }));
      console.log(`📂 DATABASE ONLY: Using ${timeSeries.length} candles from database`);
    }

    // Ensure we have enough data
    if (timeSeries.length === 0) {
      throw new AppError(
        `No market data available for ${pair} ${normalizedTimeframe}`,
        404,
        'NO_DATA'
      );
    }

    const historicalData = {
      pair,
      timeframe: normalizedTimeframe,
      timeSeries: timeSeries.slice(0, limit), // Limit to requested number
      metadata: {
        total: timeSeries.length,
        source: apiCallMade ? 'hybrid' : 'database',
        databaseCandles: dbCandles.length,
        apiCandles: apiCallMade ? 1 : 0
      },
      source: apiCallMade ? 'hybrid' : 'database',
    };

    // Cache for shorter time (30 seconds for hybrid mode)
    await cache.set(cacheKey, JSON.stringify(historicalData), 30);

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
 * Get supported currency pairs with detailed information
 * Returns structured data compatible with market routes
 */
const getSupportedPairs = () => {
  // Major currency pairs (most liquid, involve USD)
  const majorPairs = [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF',
    'AUD/USD', 'USD/CAD', 'NZD/USD'
  ];

  // Minor currency pairs (cross pairs, no USD)
  const minorPairs = [
    'EUR/GBP', 'EUR/AUD', 'EUR/JPY', 'GBP/JPY',
    'CHF/JPY', 'AUD/JPY', 'AUD/NZD'
  ];

  /**
   * Create detailed pair information
   * @param {string} pair - Currency pair (e.g., 'EUR/USD')
   * @param {string} category - Category (major, minor)
   * @returns {object} Pair information object
   */
  const createPairInfo = (pair, category) => {
    const [base, quote] = pair.split('/');
    return {
      pair,
      base,
      quote,
      category,
      description: `${base} to ${quote}`,
      available: true
    };
  };

  // Generate detailed info for each pair
  const majorPairInfos = majorPairs.map(p => createPairInfo(p, 'major'));
  const minorPairInfos = minorPairs.map(p => createPairInfo(p, 'minor'));
  const allPairs = [...majorPairInfos, ...minorPairInfos];

  return {
    pairs: allPairs,
    categories: {
      major: majorPairInfos,
      minor: minorPairInfos
    },
    total: allPairs.length,
    timestamp: new Date().toISOString()
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

/**
 * Get API usage statistics
 * Returns information about the data sources being used
 *
 * @returns {Promise<object>} API usage statistics
 */
const getApiUsageStats = async () => {
  try {
    // Check ML Engine health
    let mlEngineStatus = 'unknown';
    let mlEngineHealthy = false;

    try {
      const healthCheck = await axios.get(`${ML_API_URL}/health`, { timeout: 5000 });
      mlEngineStatus = healthCheck.data.status || 'unknown';
      mlEngineHealthy = mlEngineStatus === 'healthy';
    } catch (error) {
      mlEngineStatus = 'offline';
      console.warn('⚠️ ML Engine health check failed:', error.message);
    }

    return {
      yfinance: {
        name: 'YFinance via ML Engine',
        status: mlEngineHealthy ? 'active' : 'degraded',
        endpoint: ML_API_URL,
        dailyLimit: 'Unlimited',
        rateLimitPerMinute: 'No strict limit',
        requestsToday: 'N/A',
        lastChecked: new Date().toISOString(),
        healthy: mlEngineHealthy,
        features: [
          'Real-time forex data',
          'Historical data',
          'Intraday data',
          'Multiple timeframes'
        ]
      },
      mlEngine: {
        status: mlEngineStatus,
        endpoint: ML_API_URL,
        healthy: mlEngineHealthy,
        lastChecked: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('❌ Error getting API usage stats:', error.message);
    throw new AppError(
      `Failed to get API usage stats: ${error.message}`,
      503,
      'STATS_ERROR'
    );
  }
};

/**
 * Clear cache by pattern
 * Allows clearing specific cache keys or all forex cache
 *
 * @param {string} pattern - Redis key pattern (default: 'forex:*')
 * @returns {Promise<number>} Number of keys cleared
 */
const clearCache = async (pattern = 'forex:*') => {
  try {
    console.log(`🗑️ Clearing cache with pattern: ${pattern}`);

    const clearedCount = await cache.clearPattern(pattern);

    console.log(`✅ Cleared ${clearedCount} cache keys matching pattern: ${pattern}`);

    return clearedCount;
  } catch (error) {
    console.error(`❌ Error clearing cache: ${error.message}`);
    throw new AppError(
      `Failed to clear cache: ${error.message}`,
      500,
      'CACHE_CLEAR_ERROR'
    );
  }
};

module.exports = {
  initializeCache,
  getRealtimePrice,
  getHistoricalData,
  getSupportedPairs,
  saveMarketData,
  getApiUsageStats,
  clearCache,
  SUPPORTED_PAIRS,
};
