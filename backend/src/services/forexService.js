/**
 * Forex Data Service
 * Integrates with Alpha Vantage and Twelve Data APIs with automatic fallback
 */

const axios = require('axios');
const cache = require('../utils/cache');
const MarketData = require('../models/MarketData');
const AppError = require('../utils/AppError');

/**
 * API Configuration
 */
const API_CONFIG = {
  ALPHA_VANTAGE: {
    BASE_URL: 'https://www.alphavantage.co/query',
    RATE_LIMIT_PER_MINUTE: 5,
    RATE_LIMIT_PER_DAY: 500,
  },
  TWELVE_DATA: {
    BASE_URL: 'https://api.twelvedata.com',
    RATE_LIMIT_PER_MINUTE: 8,
    RATE_LIMIT_PER_DAY: 800,
  },
};

/**
 * Supported currency pairs
 */
const SUPPORTED_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  'EUR/GBP', 'EUR/JPY', 'EUR/CHF', 'EUR/AUD', 'EUR/CAD', 'EUR/NZD',
  'GBP/JPY', 'GBP/CHF', 'GBP/AUD', 'GBP/CAD', 'GBP/NZD',
  'AUD/JPY', 'AUD/CHF', 'AUD/CAD', 'AUD/NZD',
  'CAD/JPY', 'CAD/CHF', 'CHF/JPY', 'NZD/JPY', 'NZD/CHF', 'NZD/CAD',
];

/**
 * Timeframe mappings for different APIs
 */
const TIMEFRAME_MAPPING = {
  ALPHA_VANTAGE: {
    '1min': '1min',
    '5min': '5min',
    '15min': '15min',
    '30min': '30min',
    '1h': '60min',
    '1d': 'daily',
    '1w': 'weekly',
    '1M': 'monthly',
  },
  TWELVE_DATA: {
    '1min': '1min',
    '5min': '5min',
    '15min': '15min',
    '30min': '30min',
    '1h': '1h',
    '4h': '4h',
    '1d': '1day',
    '1w': '1week',
    '1M': '1month',
  },
};

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
 * Check API rate limits
 *
 * @param {string} provider - API provider (alpha_vantage, twelve_data)
 * @returns {Promise<object>} Rate limit status
 */
const checkRateLimit = async (provider) => {
  try {
    const dailyKey = cache.generateApiLimitKey(provider, 'daily');
    const minuteKey = cache.generateApiLimitKey(provider, 'per_minute');

    const [dailyCalls, minuteCalls] = await Promise.all([
      cache.get(dailyKey) || 0,
      cache.get(minuteKey) || 0,
    ]);

    const config = API_CONFIG[provider.toUpperCase()];

    return {
      provider,
      dailyCalls: parseInt(dailyCalls),
      minuteCalls: parseInt(minuteCalls),
      dailyLimit: config.RATE_LIMIT_PER_DAY,
      minuteLimit: config.RATE_LIMIT_PER_MINUTE,
      canMakeRequest: dailyCalls < config.RATE_LIMIT_PER_DAY && minuteCalls < config.RATE_LIMIT_PER_MINUTE,
    };
  } catch (error) {
    console.error(`❌ Error checking rate limit for ${provider}:`, error.message);
    return {
      provider,
      dailyCalls: 0,
      minuteCalls: 0,
      canMakeRequest: true,
    };
  }
};

/**
 * Increment API usage counter
 *
 * @param {string} provider - API provider
 * @returns {Promise<void>}
 */
const incrementApiUsage = async (provider) => {
  try {
    const dailyKey = cache.generateApiLimitKey(provider, 'daily');
    const minuteKey = cache.generateApiLimitKey(provider, 'per_minute');

    await Promise.all([
      cache.incr(dailyKey, 1, cache.CACHE_TTL.HISTORICAL_DATA),
      cache.incr(minuteKey, 1, 60),
    ]);
  } catch (error) {
    console.error(`❌ Error incrementing API usage for ${provider}:`, error.message);
  }
};

/**
 * Get the best available API provider
 *
 * @returns {Promise<string>} Available API provider
 */
const getBestProvider = async () => {
  const providers = ['alpha_vantage', 'twelve_data'];

  for (const provider of providers) {
    const rateLimit = await checkRateLimit(provider);
    if (rateLimit.canMakeRequest) {
      return provider;
    }
  }

  throw new AppError('All API providers have reached rate limits', 429, 'API_RATE_LIMIT_EXCEEDED');
};

/**
 * Make API request with retry logic
 *
 * @param {string} url - Request URL
 * @param {object} options - Request options
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<object>} API response
 */
const makeApiRequest = async (url, options = {}, maxRetries = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios({
        url,
        timeout: 10000,
        ...options,
      });

      return response.data;
    } catch (error) {
      lastError = error;

      if (error.response?.status === 429) {
        // Rate limit exceeded, don't retry
        throw new AppError('API rate limit exceeded', 429, 'API_RATE_LIMIT');
      }

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new AppError(
    `API request failed after ${maxRetries} attempts: ${lastError.message}`,
    500,
    'API_REQUEST_FAILED'
  );
};

/**
 * Fetch data from Alpha Vantage API
 *
 * @param {string} pair - Currency pair
 * @param {string} function_name - API function name
 * @param {object} params - Additional parameters
 * @returns {Promise<object>} API response
 */
const fetchFromAlphaVantage = async (pair, function_name, params = {}) => {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) {
    throw new AppError('Alpha Vantage API key not configured', 500, 'API_KEY_MISSING');
  }

  // Convert pair format (EUR/USD -> EURUSD)
  const symbol = pair.replace('/', '');

  const queryParams = new URLSearchParams({
    function: function_name,
    from_symbol: symbol.slice(0, 3),
    to_symbol: symbol.slice(3, 6),
    apikey: apiKey,
    ...params,
  });

  const url = `${API_CONFIG.ALPHA_VANTAGE.BASE_URL}?${queryParams}`;

  await incrementApiUsage('alpha_vantage');
  return await makeApiRequest(url);
};

/**
 * Fetch data from Twelve Data API
 *
 * @param {string} pair - Currency pair
 * @param {string} endpoint - API endpoint
 * @param {object} params - Additional parameters
 * @returns {Promise<object>} API response
 */
const fetchFromTwelveData = async (pair, endpoint, params = {}) => {
  const apiKey = process.env.TWELVE_DATA_KEY;
  if (!apiKey) {
    throw new AppError('Twelve Data API key not configured', 500, 'API_KEY_MISSING');
  }

  // Convert pair format (EUR/USD -> EUR/USD)
  const symbol = pair;

  const queryParams = new URLSearchParams({
    symbol,
    apikey: apiKey,
    ...params,
  });

  const url = `${API_CONFIG.TWELVE_DATA.BASE_URL}/${endpoint}?${queryParams}`;

  await incrementApiUsage('twelve_data');
  return await makeApiRequest(url);
};

/**
 * Standardize forex data format
 *
 * @param {object} data - Raw API data
 * @param {string} provider - Data provider
 * @param {string} pair - Currency pair
 * @returns {object} Standardized data
 */
const standardizeForexData = (data, provider, pair) => {
  let standardized = {
    pair,
    provider,
    timestamp: new Date().toISOString(),
    data: null,
  };

  try {
    if (provider === 'alpha_vantage') {
      // Handle different Alpha Vantage response formats
      if (data['Realtime Currency Exchange Rate']) {
        const rate = data['Realtime Currency Exchange Rate'];
        standardized.data = {
          price: parseFloat(rate['5. Exchange Rate']),
          bid: parseFloat(rate['8. Bid Price']),
          ask: parseFloat(rate['9. Ask Price']),
          timestamp: rate['6. Last Refreshed'],
        };
      } else if (data['Time Series FX (1min)'] || data['Time Series FX (5min)'] ||
                 data['Time Series FX (15min)'] || data['Time Series FX (30min)'] ||
                 data['Time Series FX (60min)'] || data['Time Series FX (Daily)']) {

        // Find the time series data
        const timeSeriesKey = Object.keys(data).find(key => key.startsWith('Time Series'));
        const timeSeries = data[timeSeriesKey];

        standardized.data = Object.entries(timeSeries).map(([timestamp, values]) => ({
          timestamp,
          open: parseFloat(values['1. open']),
          high: parseFloat(values['2. high']),
          low: parseFloat(values['3. low']),
          close: parseFloat(values['4. close']),
        }));
      }
    } else if (provider === 'twelve_data') {
      // Handle Twelve Data response formats
      if (data.price) {
        standardized.data = {
          price: parseFloat(data.price),
          timestamp: data.datetime,
        };
      } else if (data.values) {
        standardized.data = data.values.map(item => ({
          timestamp: item.datetime,
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          volume: item.volume ? parseInt(item.volume) : 0,
        }));
      }
    }
  } catch (error) {
    console.error('❌ Error standardizing forex data:', error.message);
    throw new AppError('Failed to standardize forex data', 500, 'DATA_STANDARDIZATION_ERROR');
  }

  return standardized;
};

/**
 * Get real-time exchange rate
 *
 * @param {string} pair - Currency pair (e.g., 'EUR/USD')
 * @returns {Promise<object>} Real-time exchange rate
 */
const getRealTimeRate = async (pair) => {
  if (!SUPPORTED_PAIRS.includes(pair)) {
    throw new AppError(`Currency pair ${pair} is not supported`, 400, 'UNSUPPORTED_PAIR');
  }

  // Check cache first
  const cacheKey = cache.generateForexKey('realtime', pair);
  const cachedData = await cache.get(cacheKey);

  if (cachedData) {
    return {
      ...cachedData,
      cached: true,
      cacheTimestamp: new Date().toISOString(),
    };
  }

  try {
    // Get best available provider
    const provider = await getBestProvider();
    let data;

    if (provider === 'alpha_vantage') {
      data = await fetchFromAlphaVantage(pair, 'CURRENCY_EXCHANGE_RATE');
    } else if (provider === 'twelve_data') {
      data = await fetchFromTwelveData(pair, 'price');
    }

    const standardizedData = standardizeForexData(data, provider, pair);

    // Cache the result
    await cache.set(cacheKey, standardizedData, cache.CACHE_TTL.REALTIME_DATA);

    // Store in database for historical tracking
    try {
      await MarketData.create({
        pair,
        timeframe: '1min',
        timestamp: new Date(),
        open: standardizedData.data.price || standardizedData.data.bid,
        high: standardizedData.data.price || standardizedData.data.ask,
        low: standardizedData.data.price || standardizedData.data.bid,
        close: standardizedData.data.price || standardizedData.data.ask,
        source: provider,
        isRealTime: true,
        cacheExpiresAt: new Date(Date.now() + cache.CACHE_TTL.REALTIME_DATA * 1000),
      });
    } catch (dbError) {
      console.warn('⚠️ Failed to store market data in database:', dbError.message);
    }

    return {
      ...standardizedData,
      cached: false,
    };

  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      `Failed to fetch real-time rate for ${pair}: ${error.message}`,
      500,
      'REALTIME_DATA_ERROR'
    );
  }
};

/**
 * Get historical data
 *
 * @param {string} pair - Currency pair
 * @param {string} timeframe - Timeframe (1min, 5min, 15min, 30min, 1h, 4h, 1d, 1w, 1M)
 * @param {number} limit - Number of data points to return
 * @returns {Promise<object>} Historical data
 */
const getHistoricalData = async (pair, timeframe = '1d', limit = 100) => {
  if (!SUPPORTED_PAIRS.includes(pair)) {
    throw new AppError(`Currency pair ${pair} is not supported`, 400, 'UNSUPPORTED_PAIR');
  }

  // Check cache first
  const cacheKey = cache.generateForexKey('historical', pair, timeframe, limit.toString());
  const cachedData = await cache.get(cacheKey);

  if (cachedData) {
    return {
      ...cachedData,
      cached: true,
      cacheTimestamp: new Date().toISOString(),
    };
  }

  try {
    // Get best available provider
    const provider = await getBestProvider();
    let data;

    if (provider === 'alpha_vantage') {
      const avTimeframe = TIMEFRAME_MAPPING.ALPHA_VANTAGE[timeframe];
      if (!avTimeframe) {
        throw new AppError(`Timeframe ${timeframe} not supported by Alpha Vantage`, 400, 'UNSUPPORTED_TIMEFRAME');
      }

      if (avTimeframe.includes('min')) {
        data = await fetchFromAlphaVantage(pair, 'FX_INTRADAY', {
          interval: avTimeframe,
          outputsize: limit > 100 ? 'full' : 'compact',
        });
      } else {
        data = await fetchFromAlphaVantage(pair, `FX_${avTimeframe.toUpperCase()}`, {
          outputsize: limit > 100 ? 'full' : 'compact',
        });
      }
    } else if (provider === 'twelve_data') {
      const tdTimeframe = TIMEFRAME_MAPPING.TWELVE_DATA[timeframe];
      if (!tdTimeframe) {
        throw new AppError(`Timeframe ${timeframe} not supported by Twelve Data`, 400, 'UNSUPPORTED_TIMEFRAME');
      }

      data = await fetchFromTwelveData(pair, 'time_series', {
        interval: tdTimeframe,
        outputsize: limit,
      });
    }

    const standardizedData = standardizeForexData(data, provider, pair);

    // Limit the number of data points
    if (standardizedData.data && Array.isArray(standardizedData.data)) {
      standardizedData.data = standardizedData.data.slice(0, limit);
    }

    // Cache the result
    await cache.set(cacheKey, standardizedData, cache.CACHE_TTL.HISTORICAL_DATA);

    return {
      ...standardizedData,
      cached: false,
    };

  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      `Failed to fetch historical data for ${pair}: ${error.message}`,
      500,
      'HISTORICAL_DATA_ERROR'
    );
  }
};

/**
 * Get supported currency pairs
 *
 * @returns {Promise<object>} Supported pairs information
 */
const getSupportedPairs = async () => {
  const cacheKey = 'forex:supported_pairs';
  const cachedData = await cache.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  const pairInfo = SUPPORTED_PAIRS.map(pair => {
    const [base, quote] = pair.split('/');
    return {
      pair,
      base,
      quote,
      displayName: `${base}/${quote}`,
      description: `${base} to ${quote}`,
    };
  });

  const result = {
    pairs: pairInfo,
    total: SUPPORTED_PAIRS.length,
    categories: {
      major: pairInfo.filter(p => ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'].includes(p.pair)),
      minor: pairInfo.filter(p => !['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'].includes(p.pair)),
    },
    timestamp: new Date().toISOString(),
  };

  // Cache for 1 hour
  await cache.set(cacheKey, result, 3600);

  return result;
};

/**
 * Get API usage statistics
 *
 * @returns {Promise<object>} API usage statistics
 */
const getApiUsageStats = async () => {
  try {
    const providers = ['alpha_vantage', 'twelve_data'];
    const stats = {};

    for (const provider of providers) {
      const rateLimit = await checkRateLimit(provider);
      stats[provider] = rateLimit;
    }

    return {
      providers: stats,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Error getting API usage stats:', error.message);
    return {
      providers: {},
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Clear forex data cache
 *
 * @param {string} pattern - Cache pattern to clear (optional)
 * @returns {Promise<number>} Number of cleared keys
 */
const clearCache = async (pattern = 'forex:*') => {
  try {
    return await cache.clearPattern(pattern);
  } catch (error) {
    console.error('❌ Error clearing cache:', error.message);
    return 0;
  }
};

// Initialize cache on service load
initializeCache();

module.exports = {
  getRealTimeRate,
  getQuote: getRealTimeRate, // Alias for consistency with positionService
  getHistoricalData,
  getSupportedPairs,
  getApiUsageStats,
  clearCache,
  checkRateLimit,
  SUPPORTED_PAIRS,
};