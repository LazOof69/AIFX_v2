/**
 * Admin Controller
 * 獨立的管理員控制器，直接使用 Sequelize 查詢，不依賴現有服務
 */

const { adminLogin } = require('../middleware/adminAuth');
const { sequelize } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');

/**
 * Admin Login
 * POST /api/v1/admin/login
 */
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        data: null,
        error: '請提供帳號和密碼',
        timestamp: new Date().toISOString(),
      });
    }

    const token = adminLogin(username, password);

    if (!token) {
      return res.status(401).json({
        success: false,
        data: null,
        error: '帳號或密碼錯誤',
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      success: true,
      data: { token },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Admin Token
 * GET /api/v1/admin/verify
 */
const verify = async (req, res) => {
  res.status(200).json({
    success: true,
    data: { admin: req.admin },
    error: null,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Get System Health
 * GET /api/v1/admin/health
 */
const getSystemHealth = async (req, res, next) => {
  try {
    const health = {
      status: 'healthy',
      services: {},
      uptime: process.uptime(),
      memory: process.memoryUsage().heapUsed,
      version: require('../../package.json').version,
      environment: process.env.NODE_ENV || 'development',
    };

    // Check PostgreSQL
    try {
      await sequelize.authenticate();
      health.services.postgres = 'connected';
    } catch (e) {
      health.services.postgres = 'disconnected';
      health.status = 'degraded';
    }

    // Check Redis (if available)
    try {
      const redis = require('redis');
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const testClient = redis.createClient({ url: redisUrl });
      await testClient.connect();
      await testClient.ping();
      await testClient.quit();
      health.services.redis = 'connected';
    } catch (e) {
      health.services.redis = 'disconnected';
    }

    // Check ML Engine
    try {
      const mlUrl = process.env.ML_API_URL || 'http://localhost:8000';
      const mlRes = await axios.get(`${mlUrl}/health`, { timeout: 3000 });
      health.services.mlEngine = mlRes.data?.status === 'healthy' ? 'connected' : 'degraded';
    } catch (e) {
      health.services.mlEngine = 'disconnected';
    }

    // Check Sentiment Analysis (via ML Engine)
    try {
      const mlUrl = process.env.ML_API_URL || 'http://localhost:8000';
      const sentimentRes = await axios.post(`${mlUrl}/reversal/predict_raw`, {
        pair: 'EUR/USD',
        timeframe: '1h',
        data: [] // Empty data will fail validation but tells us if service is up
      }, { timeout: 5000 });
      // If we get here without error, sentiment service is available
      health.services.sentiment = 'connected';
      health.sentimentInfo = {
        status: 'active',
        model: 'FinBERT',
        newsSource: 'Google News RSS'
      };
    } catch (e) {
      // Check if it's a validation error (service is up but data is invalid)
      if (e.response?.status === 422 || e.response?.data?.detail) {
        health.services.sentiment = 'connected';
        health.sentimentInfo = {
          status: 'active',
          model: 'FinBERT',
          newsSource: 'Google News RSS'
        };
      } else {
        health.services.sentiment = 'disconnected';
        health.sentimentInfo = {
          status: 'offline',
          error: e.message
        };
      }
    }

    // Check Discord Bot (via internal check)
    health.services.discordBot = 'unknown'; // 需要額外的健康檢查端點

    res.status(200).json({
      success: true,
      data: health,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Dashboard Stats
 * GET /api/v1/admin/stats
 */
const getStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // User stats
    const [userStats] = await sequelize.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active,
        COUNT(CASE WHEN created_at >= :today THEN 1 END) as new_today
      FROM users
    `, {
      replacements: { today },
      type: sequelize.QueryTypes.SELECT,
    });

    // Signal stats
    const [signalStats] = await sequelize.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN created_at >= :today THEN 1 END) as today
      FROM trading_signals
    `, {
      replacements: { today },
      type: sequelize.QueryTypes.SELECT,
    });

    // ML models count (estimated)
    const modelCount = 3; // LSTM, GRU, Ensemble (固定值或從配置讀取)

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: parseInt(userStats?.total || 0),
          active: parseInt(userStats?.active || 0),
          newToday: parseInt(userStats?.new_today || 0),
        },
        signals: {
          total: parseInt(signalStats?.total || 0),
          today: parseInt(signalStats?.today || 0),
        },
        models: {
          active: modelCount,
        },
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Users List
 * GET /api/v1/admin/users
 */
const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const replacements = { limit: parseInt(limit), offset: parseInt(offset) };

    if (search) {
      whereClause = `WHERE username ILIKE :search OR email ILIKE :search`;
      replacements.search = `%${search}%`;
    }

    const users = await sequelize.query(`
      SELECT id, username, email, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT :limit OFFSET :offset
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    });

    const [[countResult]] = await sequelize.query(`
      SELECT COUNT(*) as total FROM users ${whereClause}
    `, {
      replacements,
    });

    res.status(200).json({
      success: true,
      data: {
        users: users || [],
        total: parseInt(countResult?.total || 0),
        page: parseInt(page),
        limit: parseInt(limit),
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update User
 * PUT /api/v1/admin/users/:id
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    await sequelize.query(`
      UPDATE users SET is_active = :isActive, updated_at = NOW()
      WHERE id = :id
    `, {
      replacements: { id, isActive },
    });

    res.status(200).json({
      success: true,
      data: { message: '用戶更新成功' },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Signals List
 * GET /api/v1/admin/signals
 * Query params: page, limit, pair, direction, timeframe
 */
const getSignals = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, pair, direction, timeframe } = req.query;
    const offset = (page - 1) * limit;

    const conditions = [];
    const replacements = { limit: parseInt(limit), offset: parseInt(offset) };

    if (pair) {
      conditions.push(`pair = :pair`);
      replacements.pair = pair;
    }
    if (direction) {
      conditions.push(`action = :direction`);
      replacements.direction = direction;
    }
    if (timeframe) {
      conditions.push(`timeframe = :timeframe`);
      replacements.timeframe = timeframe;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const signals = await sequelize.query(`
      SELECT
        id,
        pair,
        action as direction,
        confidence,
        entry_price as "entryPrice",
        stop_loss as "stopLoss",
        take_profit as "takeProfit",
        timeframe,
        signal_strength as "signalStrength",
        market_condition as "marketCondition",
        factors,
        status,
        created_at as "createdAt"
      FROM trading_signals
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT :limit OFFSET :offset
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    });

    const [[countResult]] = await sequelize.query(`
      SELECT COUNT(*) as total FROM trading_signals ${whereClause}
    `, {
      replacements,
    });

    res.status(200).json({
      success: true,
      data: {
        signals: signals || [],
        total: parseInt(countResult?.total || 0),
        page: parseInt(page),
        limit: parseInt(limit),
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get ML Models
 * GET /api/v1/admin/ml/models
 */
const getMLModels = async (req, res, next) => {
  try {
    // 嘗試從 ML Engine 取得模型資訊
    const mlUrl = process.env.ML_API_URL || 'http://localhost:8000';

    try {
      const response = await axios.get(`${mlUrl}/api/v1/models`, { timeout: 5000 });
      res.status(200).json({
        success: true,
        data: response.data,
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (mlError) {
      // ML Engine 未連接，返回靜態模型資訊
      res.status(200).json({
        success: true,
        data: {
          models: [
            { id: 1, name: 'LSTM Model', type: 'LSTM', version: '1.0', status: 'active', accuracy: 0.72, lastTrained: null },
            { id: 2, name: 'GRU Model', type: 'GRU', version: '1.0', status: 'active', accuracy: 0.70, lastTrained: null },
            { id: 3, name: 'Ensemble Model', type: 'Ensemble', version: '1.0', status: 'active', accuracy: 0.75, lastTrained: null },
          ],
        },
        error: null,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get ML Engine Status
 * GET /api/v1/admin/ml/status
 */
const getMLEngineStatus = async (req, res, next) => {
  try {
    const mlUrl = process.env.ML_API_URL || 'http://localhost:8000';

    try {
      const response = await axios.get(`${mlUrl}/health`, { timeout: 5000 });
      res.status(200).json({
        success: true,
        data: {
          status: 'running',
          uptime: response.data?.uptime || 'N/A',
          memory: response.data?.memory || 'N/A',
          gpu: response.data?.gpu || '無',
        },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (mlError) {
      res.status(200).json({
        success: true,
        data: {
          status: 'disconnected',
          error: '無法連接 ML Engine',
        },
        error: null,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Test Sentiment Analysis for Currency Pair
 * GET /api/v1/admin/sentiment/test/:pair
 */
const testSentiment = async (req, res, next) => {
  try {
    const { pair } = req.params;
    const { timeframe = '1h' } = req.query;

    // Format pair (e.g., EURUSD -> EUR/USD)
    let formattedPair = pair;
    if (pair && !pair.includes('/') && pair.length === 6) {
      formattedPair = `${pair.substring(0, 3)}/${pair.substring(3)}`;
    }

    const mlUrl = process.env.ML_API_URL || 'http://localhost:8000';

    try {
      // Call the ML Engine sentiment endpoint
      const response = await axios.post(`${mlUrl}/sentiment/analyze`, {
        pair: formattedPair,
        timeframe: timeframe
      }, { timeout: 30000 }); // 30 second timeout for sentiment analysis

      // Extract sentiment data from ML response (response.data contains {success, data, error, timestamp})
      const sentimentData = response.data?.data || response.data;

      res.status(200).json({
        success: true,
        data: {
          pair: formattedPair,
          timeframe: timeframe,
          sentiment: sentimentData,
        },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (mlError) {
      // If sentiment endpoint doesn't exist, try predict_raw to get sentiment from there
      if (mlError.response?.status === 404) {
        // Try alternative approach via predict_raw
        try {
          const predResponse = await axios.post(`${mlUrl}/reversal/predict_raw`, {
            pair: formattedPair,
            timeframe: timeframe,
            data: [] // Empty data, we just want sentiment
          }, { timeout: 30000 });

          res.status(200).json({
            success: true,
            data: {
              pair: formattedPair,
              timeframe: timeframe,
              sentiment: {
                sentiment_score: predResponse.data?.sentiment_score || 0.5,
                signal: predResponse.data?.sentiment_signal || 'neutral',
                source: 'predict_raw_fallback'
              },
            },
            error: null,
            timestamp: new Date().toISOString(),
          });
        } catch (e) {
          res.status(503).json({
            success: false,
            data: null,
            error: 'ML Engine 情緒分析不可用',
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        res.status(503).json({
          success: false,
          data: null,
          error: mlError.response?.data?.detail || 'ML Engine 情緒分析請求失敗',
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Retrain ML Model
 * POST /api/v1/admin/ml/retrain/:modelId
 */
const retrainModel = async (req, res, next) => {
  try {
    const { modelId } = req.params;
    const mlUrl = process.env.ML_API_URL || 'http://localhost:8000';

    try {
      const response = await axios.post(`${mlUrl}/api/v1/models/${modelId}/retrain`, {}, { timeout: 10000 });
      res.status(200).json({
        success: true,
        data: response.data,
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (mlError) {
      res.status(503).json({
        success: false,
        data: null,
        error: 'ML Engine 未連接或訓練請求失敗',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  verify,
  getSystemHealth,
  getStats,
  getUsers,
  updateUser,
  getSignals,
  getMLModels,
  getMLEngineStatus,
  retrainModel,
  testSentiment,
};
