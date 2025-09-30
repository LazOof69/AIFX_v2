/**
 * Redis Cache Utility
 * Provides centralized caching functionality with Redis
 */

const redis = require('redis');
const AppError = require('./AppError');

/**
 * Redis client instance
 */
let redisClient = null;
let isConnected = false;

/**
 * Cache TTL constants (in seconds)
 */
const CACHE_TTL = {
  REALTIME_DATA: 60,          // 1 minute for real-time data
  HISTORICAL_DATA: 86400,     // 1 day for historical data
  API_RATE_LIMIT: 300,        // 5 minutes for rate limit tracking
  USER_SESSION: 3600,         // 1 hour for user sessions
  MARKET_STATUS: 300,         // 5 minutes for market status
  TECHNICAL_INDICATORS: 300,  // 5 minutes for technical indicators
};

/**
 * Cache key prefixes
 */
const CACHE_PREFIX = {
  FOREX_REALTIME: 'forex:realtime',
  FOREX_HISTORICAL: 'forex:historical',
  FOREX_INTRADAY: 'forex:intraday',
  API_CALLS: 'api:calls',
  API_LIMIT: 'api:limit',
  MARKET_STATUS: 'market:status',
  TECHNICAL_DATA: 'technical',
  USER_PREFERENCES: 'user:prefs',
};

/**
 * Initialize Redis connection
 *
 * @returns {Promise<void>}
 */
const initializeRedis = async () => {
  try {
    if (redisClient && isConnected) {
      return;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisOptions = {
      url: redisUrl,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          console.error('❌ Redis connection refused');
          return new Error('Redis connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          console.error('❌ Redis retry time exhausted');
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          console.error('❌ Redis max retry attempts reached');
          return undefined;
        }
        // Exponential backoff
        return Math.min(options.attempt * 100, 3000);
      },
    };

    redisClient = redis.createClient(redisOptions);

    redisClient.on('connect', () => {
      console.log('🔗 Redis connecting...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis connected and ready');
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
      isConnected = false;
    });

    redisClient.on('end', () => {
      console.log('🔌 Redis connection ended');
      isConnected = false;
    });

    await redisClient.connect();

  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error.message);
    isConnected = false;
    throw error;
  }
};

/**
 * Check if Redis is connected
 *
 * @returns {boolean}
 */
const isRedisConnected = () => {
  return isConnected && redisClient && redisClient.isReady;
};

/**
 * Get data from cache
 *
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached data or null
 */
const get = async (key) => {
  try {
    if (!isRedisConnected()) {
      console.warn('⚠️ Redis not connected, cache miss for key:', key);
      return null;
    }

    const data = await redisClient.get(key);

    if (data === null) {
      return null;
    }

    // Try to parse JSON, return raw string if parsing fails
    try {
      return JSON.parse(data);
    } catch (parseError) {
      return data;
    }

  } catch (error) {
    console.error('❌ Redis GET error for key', key, ':', error.message);
    return null;
  }
};

/**
 * Set data in cache
 *
 * @param {string} key - Cache key
 * @param {any} value - Data to cache
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>} Success status
 */
const set = async (key, value, ttl = CACHE_TTL.REALTIME_DATA) => {
  try {
    if (!isRedisConnected()) {
      console.warn('⚠️ Redis not connected, cache set failed for key:', key);
      return false;
    }

    // Serialize data
    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

    // Set with TTL
    const result = await redisClient.setEx(key, ttl, serializedValue);
    return result === 'OK';

  } catch (error) {
    console.error('❌ Redis SET error for key', key, ':', error.message);
    return false;
  }
};

/**
 * Delete data from cache
 *
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} Success status
 */
const del = async (key) => {
  try {
    if (!isRedisConnected()) {
      console.warn('⚠️ Redis not connected, cache delete failed for key:', key);
      return false;
    }

    const result = await redisClient.del(key);
    return result > 0;

  } catch (error) {
    console.error('❌ Redis DELETE error for key', key, ':', error.message);
    return false;
  }
};

/**
 * Check if key exists in cache
 *
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} Existence status
 */
const exists = async (key) => {
  try {
    if (!isRedisConnected()) {
      return false;
    }

    const result = await redisClient.exists(key);
    return result === 1;

  } catch (error) {
    console.error('❌ Redis EXISTS error for key', key, ':', error.message);
    return false;
  }
};

/**
 * Get multiple keys from cache
 *
 * @param {string[]} keys - Array of cache keys
 * @returns {Promise<object>} Object with key-value pairs
 */
const mget = async (keys) => {
  try {
    if (!isRedisConnected() || keys.length === 0) {
      return {};
    }

    const values = await redisClient.mGet(keys);
    const result = {};

    keys.forEach((key, index) => {
      const value = values[index];
      if (value !== null) {
        try {
          result[key] = JSON.parse(value);
        } catch (parseError) {
          result[key] = value;
        }
      }
    });

    return result;

  } catch (error) {
    console.error('❌ Redis MGET error:', error.message);
    return {};
  }
};

/**
 * Set multiple key-value pairs in cache
 *
 * @param {object} keyValuePairs - Object with key-value pairs
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>} Success status
 */
const mset = async (keyValuePairs, ttl = CACHE_TTL.REALTIME_DATA) => {
  try {
    if (!isRedisConnected() || Object.keys(keyValuePairs).length === 0) {
      return false;
    }

    // Use pipeline for better performance
    const pipeline = redisClient.multi();

    Object.entries(keyValuePairs).forEach(([key, value]) => {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      pipeline.setEx(key, ttl, serializedValue);
    });

    const results = await pipeline.exec();
    return results.every(result => result[1] === 'OK');

  } catch (error) {
    console.error('❌ Redis MSET error:', error.message);
    return false;
  }
};

/**
 * Increment a counter in cache
 *
 * @param {string} key - Cache key
 * @param {number} increment - Increment value (default: 1)
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<number>} New counter value
 */
const incr = async (key, increment = 1, ttl = null) => {
  try {
    if (!isRedisConnected()) {
      return 0;
    }

    let result;
    if (increment === 1) {
      result = await redisClient.incr(key);
    } else {
      result = await redisClient.incrBy(key, increment);
    }

    // Set TTL if provided and this is the first increment
    if (ttl && result === increment) {
      await redisClient.expire(key, ttl);
    }

    return result;

  } catch (error) {
    console.error('❌ Redis INCR error for key', key, ':', error.message);
    return 0;
  }
};

/**
 * Get remaining TTL for a key
 *
 * @param {string} key - Cache key
 * @returns {Promise<number>} TTL in seconds (-1 if no expiry, -2 if key doesn't exist)
 */
const ttl = async (key) => {
  try {
    if (!isRedisConnected()) {
      return -2;
    }

    return await redisClient.ttl(key);

  } catch (error) {
    console.error('❌ Redis TTL error for key', key, ':', error.message);
    return -2;
  }
};

/**
 * Clear all keys matching a pattern
 *
 * @param {string} pattern - Key pattern (e.g., 'forex:*')
 * @returns {Promise<number>} Number of deleted keys
 */
const clearPattern = async (pattern) => {
  try {
    if (!isRedisConnected()) {
      return 0;
    }

    const keys = await redisClient.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }

    const result = await redisClient.del(keys);
    return result;

  } catch (error) {
    console.error('❌ Redis CLEAR PATTERN error for pattern', pattern, ':', error.message);
    return 0;
  }
};

/**
 * Generate cache key for forex data
 *
 * @param {string} type - Data type (realtime, historical, intraday)
 * @param {string} pair - Currency pair
 * @param {string} timeframe - Timeframe (optional)
 * @param {string} date - Date string (optional)
 * @returns {string} Cache key
 */
const generateForexKey = (type, pair, timeframe = null, date = null) => {
  let prefix;

  switch (type) {
    case 'realtime':
      prefix = CACHE_PREFIX.FOREX_REALTIME;
      break;
    case 'historical':
      prefix = CACHE_PREFIX.FOREX_HISTORICAL;
      break;
    case 'intraday':
      prefix = CACHE_PREFIX.FOREX_INTRADAY;
      break;
    default:
      throw new AppError('Invalid forex data type', 400, 'INVALID_DATA_TYPE');
  }

  let key = `${prefix}:${pair}`;

  if (timeframe) {
    key += `:${timeframe}`;
  }

  if (date) {
    key += `:${date}`;
  }

  return key;
};

/**
 * Generate cache key for API rate limiting
 *
 * @param {string} provider - API provider (alpha_vantage, twelve_data)
 * @param {string} type - Limit type (daily, per_minute)
 * @returns {string} Cache key
 */
const generateApiLimitKey = (provider, type = 'daily') => {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const minute = type === 'per_minute' ? new Date().toISOString().slice(0, 16) : ''; // YYYY-MM-DDTHH:MM

  return `${CACHE_PREFIX.API_LIMIT}:${provider}:${type}:${date}${minute}`;
};

/**
 * Close Redis connection
 *
 * @returns {Promise<void>}
 */
const closeConnection = async () => {
  try {
    if (redisClient) {
      await redisClient.quit();
      console.log('✅ Redis connection closed');
    }
  } catch (error) {
    console.error('❌ Error closing Redis connection:', error.message);
  } finally {
    redisClient = null;
    isConnected = false;
  }
};

/**
 * Get cache statistics
 *
 * @returns {Promise<object>} Cache statistics
 */
const getStats = async () => {
  try {
    if (!isRedisConnected()) {
      return {
        connected: false,
        keys: 0,
        memory: 0,
      };
    }

    const info = await redisClient.info('memory');
    const dbSize = await redisClient.dbSize();

    const memoryMatch = info.match(/used_memory:(\d+)/);
    const memory = memoryMatch ? parseInt(memoryMatch[1]) : 0;

    return {
      connected: true,
      keys: dbSize,
      memory: memory,
      memoryHuman: `${(memory / 1024 / 1024).toFixed(2)} MB`,
    };

  } catch (error) {
    console.error('❌ Redis STATS error:', error.message);
    return {
      connected: false,
      keys: 0,
      memory: 0,
      error: error.message,
    };
  }
};

module.exports = {
  // Core operations
  initializeRedis,
  isRedisConnected,
  get,
  set,
  del,
  exists,
  mget,
  mset,
  incr,
  ttl,
  clearPattern,
  closeConnection,
  getStats,

  // Key generators
  generateForexKey,
  generateApiLimitKey,

  // Constants
  CACHE_TTL,
  CACHE_PREFIX,
};