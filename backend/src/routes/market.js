/**
 * Market Data Routes
 * Provides forex market data endpoints with caching and rate limiting
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const forexService = require('../services/forexService');
const { optionalAuthenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateCurrencyPairParam, validateMarketDataQuery } = require('../middleware/validation');
const cache = require('../utils/cache');

const router = express.Router();

/**
 * Rate limiting for market data endpoints
 * More generous limits for market data since it's cached
 */
const marketDataRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    data: null,
    error: 'Too many market data requests, please try again later',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route   GET /api/v1/market/realtime/:pair
 * @desc    Get real-time exchange rate for a currency pair
 * @access  Public (with optional authentication for personalized features)
 * @params  pair - Currency pair (e.g., EUR/USD)
 */
router.get(
  '/realtime/:pair',
  marketDataRateLimit,
  optionalAuthenticate,
  validateCurrencyPairParam,
  asyncHandler(async (req, res) => {
    const { pair } = req.params;

    try {
      const data = await forexService.getRealTimeRate(pair);

      // Add user-specific information if authenticated
      let userContext = {};
      if (req.user) {
        userContext = {
          isPreferred: req.user.preferredPairs?.includes(pair) || false,
          riskLevel: req.user.riskLevel,
        };
      }

      res.status(200).json({
        success: true,
        data: {
          ...data,
          userContext,
          requestTimestamp: new Date().toISOString(),
        },
        error: null,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      // Let error handler middleware handle the error
      throw error;
    }
  })
);

/**
 * @route   GET /api/v1/market/history/:pair
 * @desc    Get historical data for a currency pair
 * @access  Public (with optional authentication)
 * @params  pair - Currency pair (e.g., EUR/USD)
 * @query   timeframe - Data timeframe (1min, 5min, 15min, 30min, 1h, 4h, 1d, 1w, 1M)
 * @query   limit - Number of data points (default: 100, max: 1000)
 * @query   startDate - Start date for historical data (ISO format)
 * @query   endDate - End date for historical data (ISO format)
 */
router.get(
  '/history/:pair',
  marketDataRateLimit,
  optionalAuthenticate,
  validateCurrencyPairParam,
  validateMarketDataQuery,
  asyncHandler(async (req, res) => {
    const { pair } = req.params;
    const { timeframe = '1d', limit = 100, startDate, endDate } = req.query;

    try {
      // Validate timeframe
      const validTimeframes = ['1min', '5min', '15min', '30min', '1h', '4h', '1d', '1w', '1M'];
      if (!validTimeframes.includes(timeframe)) {
        return res.status(400).json({
          success: false,
          data: null,
          error: `Invalid timeframe. Supported values: ${validTimeframes.join(', ')}`,
          timestamp: new Date().toISOString(),
        });
      }

      // Validate limit
      const limitNumber = parseInt(limit);
      if (limitNumber < 1 || limitNumber > 1000) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'Limit must be between 1 and 1000',
          timestamp: new Date().toISOString(),
        });
      }

      const data = await forexService.getHistoricalData(pair, timeframe, limitNumber);

      // Filter by date range if provided
      if (data.data && Array.isArray(data.data) && (startDate || endDate)) {
        const start = startDate ? new Date(startDate) : new Date('1970-01-01');
        const end = endDate ? new Date(endDate) : new Date();

        data.data = data.data.filter(item => {
          const itemDate = new Date(item.timestamp);
          return itemDate >= start && itemDate <= end;
        });
      }

      // Add metadata
      const metadata = {
        pair,
        timeframe,
        requestedLimit: limitNumber,
        actualCount: data.data ? (Array.isArray(data.data) ? data.data.length : 1) : 0,
        dateRange: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      };

      // Add user-specific information if authenticated
      let userContext = {};
      if (req.user) {
        userContext = {
          isPreferred: req.user.preferredPairs?.includes(pair) || false,
          tradingStyle: req.user.tradingStyle,
          indicators: req.user.indicators,
        };
      }

      res.status(200).json({
        success: true,
        data: {
          ...data,
          metadata,
          userContext,
          requestTimestamp: new Date().toISOString(),
        },
        error: null,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      throw error;
    }
  })
);

/**
 * @route   GET /api/v1/market/pairs
 * @desc    Get list of supported currency pairs
 * @access  Public
 * @query   category - Filter by category (major, minor, all)
 * @query   search - Search pairs by name
 */
router.get(
  '/pairs',
  marketDataRateLimit,
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { category = 'all', search } = req.query;

    try {
      const data = await forexService.getSupportedPairs();

      let filteredPairs = data.pairs;

      // Filter by category
      if (category !== 'all') {
        if (category === 'major') {
          filteredPairs = data.categories.major;
        } else if (category === 'minor') {
          filteredPairs = data.categories.minor;
        } else {
          return res.status(400).json({
            success: false,
            data: null,
            error: 'Invalid category. Supported values: major, minor, all',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Filter by search term
      if (search) {
        const searchTerm = search.toLowerCase();
        filteredPairs = filteredPairs.filter(pairInfo =>
          pairInfo.pair.toLowerCase().includes(searchTerm) ||
          pairInfo.base.toLowerCase().includes(searchTerm) ||
          pairInfo.quote.toLowerCase().includes(searchTerm) ||
          pairInfo.description.toLowerCase().includes(searchTerm)
        );
      }

      // Add user-specific information if authenticated
      let userContext = {};
      if (req.user) {
        const preferredPairs = req.user.preferredPairs || [];
        userContext = {
          preferredPairs,
          totalPreferred: preferredPairs.length,
          userTradingFrequency: req.user.tradingFrequency,
          userRiskLevel: req.user.riskLevel,
        };

        // Mark preferred pairs
        filteredPairs = filteredPairs.map(pairInfo => ({
          ...pairInfo,
          isPreferred: preferredPairs.includes(pairInfo.pair),
        }));
      }

      const result = {
        pairs: filteredPairs,
        total: filteredPairs.length,
        filters: {
          category,
          search: search || null,
        },
        categories: {
          major: {
            count: data.categories.major.length,
            description: 'Major currency pairs (most liquid)',
          },
          minor: {
            count: data.categories.minor.length,
            description: 'Minor currency pairs (cross pairs)',
          },
          all: {
            count: data.total,
            description: 'All supported currency pairs',
          },
        },
        userContext,
        cached: true,
        timestamp: data.timestamp,
        requestTimestamp: new Date().toISOString(),
      };

      res.status(200).json({
        success: true,
        data: result,
        error: null,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      throw error;
    }
  })
);

/**
 * @route   GET /api/v1/market/status
 * @desc    Get market status and API health
 * @access  Public
 */
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    try {
      const [apiStats, cacheStats] = await Promise.all([
        forexService.getApiUsageStats(),
        cache.getStats(),
      ]);

      const status = {
        market: {
          status: 'operational',
          supportedPairs: forexService.SUPPORTED_PAIRS.length,
          lastUpdated: new Date().toISOString(),
        },
        apis: apiStats,
        cache: cacheStats,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json({
        success: true,
        data: status,
        error: null,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      throw error;
    }
  })
);

/**
 * @route   POST /api/v1/market/cache/clear
 * @desc    Clear market data cache (admin only)
 * @access  Private (requires authentication)
 */
router.post(
  '/cache/clear',
  require('../middleware/auth').authenticate,
  asyncHandler(async (req, res) => {
    try {
      // In a real application, you'd check for admin privileges here
      const { pattern = 'forex:*' } = req.body;

      const clearedCount = await forexService.clearCache(pattern);

      res.status(200).json({
        success: true,
        data: {
          message: 'Cache cleared successfully',
          clearedKeys: clearedCount,
          pattern,
          clearedBy: req.user.username,
          timestamp: new Date().toISOString(),
        },
        error: null,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      throw error;
    }
  })
);

/**
 * @route   GET /api/v1/market/analytics/:pair
 * @desc    Get basic analytics for a currency pair
 * @access  Public (with optional authentication)
 * @params  pair - Currency pair
 */
router.get(
  '/analytics/:pair',
  marketDataRateLimit,
  optionalAuthenticate,
  validateCurrencyPairParam,
  asyncHandler(async (req, res) => {
    const { pair } = req.params;

    try {
      // Get recent historical data for analytics
      const historicalData = await forexService.getHistoricalData(pair, '1d', 30);

      let analytics = {
        pair,
        period: '30 days',
        dataPoints: 0,
        analytics: null,
      };

      if (historicalData.data && Array.isArray(historicalData.data) && historicalData.data.length > 0) {
        const prices = historicalData.data.map(item => item.close);
        const volumes = historicalData.data.map(item => item.volume || 0);

        // Calculate basic statistics
        const current = prices[0];
        const previous = prices[prices.length - 1];
        const high = Math.max(...prices);
        const low = Math.min(...prices);
        const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;

        // Calculate volatility (standard deviation)
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - average, 2), 0) / prices.length;
        const volatility = Math.sqrt(variance);

        analytics = {
          pair,
          period: '30 days',
          dataPoints: historicalData.data.length,
          analytics: {
            current: parseFloat(current.toFixed(5)),
            previous: parseFloat(previous.toFixed(5)),
            change: parseFloat((current - previous).toFixed(5)),
            changePercent: parseFloat(((current - previous) / previous * 100).toFixed(2)),
            high: parseFloat(high.toFixed(5)),
            low: parseFloat(low.toFixed(5)),
            average: parseFloat(average.toFixed(5)),
            volatility: parseFloat((volatility / average * 100).toFixed(2)), // Coefficient of variation
            range: parseFloat((high - low).toFixed(5)),
            rangePercent: parseFloat(((high - low) / average * 100).toFixed(2)),
            totalVolume: volumes.reduce((sum, vol) => sum + vol, 0),
            averageVolume: Math.round(volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length),
          },
          lastUpdated: historicalData.timestamp,
        };
      }

      res.status(200).json({
        success: true,
        data: analytics,
        error: null,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      throw error;
    }
  })
);

module.exports = router;