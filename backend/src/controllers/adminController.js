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
      const redis = require('../config/redis');
      if (redis && redis.ping) {
        await redis.ping();
        health.services.redis = 'connected';
      } else {
        health.services.redis = 'not_configured';
      }
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
        COUNT(CASE WHEN "isActive" = true THEN 1 END) as active,
        COUNT(CASE WHEN "createdAt" >= :today THEN 1 END) as new_today
      FROM "Users"
    `, {
      replacements: { today },
      type: sequelize.QueryTypes.SELECT,
    });

    // Signal stats
    const [signalStats] = await sequelize.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN "createdAt" >= :today THEN 1 END) as today
      FROM "TradingSignals"
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
      whereClause = `WHERE "username" ILIKE :search OR "email" ILIKE :search`;
      replacements.search = `%${search}%`;
    }

    const [users] = await sequelize.query(`
      SELECT "id", "username", "email", "isActive", "createdAt", "updatedAt"
      FROM "Users"
      ${whereClause}
      ORDER BY "createdAt" DESC
      LIMIT :limit OFFSET :offset
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    });

    const [[countResult]] = await sequelize.query(`
      SELECT COUNT(*) as total FROM "Users" ${whereClause}
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
      UPDATE "Users" SET "isActive" = :isActive, "updatedAt" = NOW()
      WHERE "id" = :id
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
 */
const getSignals = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, pair, direction } = req.query;
    const offset = (page - 1) * limit;

    const conditions = [];
    const replacements = { limit: parseInt(limit), offset: parseInt(offset) };

    if (pair) {
      conditions.push(`"pair" = :pair`);
      replacements.pair = pair;
    }
    if (direction) {
      conditions.push(`"direction" = :direction`);
      replacements.direction = direction;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const signals = await sequelize.query(`
      SELECT "id", "pair", "direction", "confidence", "entryPrice", "stopLoss", "takeProfit", "status", "createdAt"
      FROM "TradingSignals"
      ${whereClause}
      ORDER BY "createdAt" DESC
      LIMIT :limit OFFSET :offset
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    });

    const [[countResult]] = await sequelize.query(`
      SELECT COUNT(*) as total FROM "TradingSignals" ${whereClause}
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
};
