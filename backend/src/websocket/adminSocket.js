/**
 * WebSocket Admin Handler
 * 處理管理員桌面 App 的 WebSocket 連接
 */

const jwt = require('jsonwebtoken');
const { sequelize } = require('../models');
const axios = require('axios');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'admin-secret-key';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// 已認證的 admin sockets
const authenticatedAdmins = new Map();

/**
 * 初始化 Admin WebSocket 處理
 */
function initAdminSocket(io) {
  // Admin namespace
  const adminNsp = io.of('/admin-ws');

  adminNsp.on('connection', (socket) => {
    console.log(`[Admin WS] New connection: ${socket.id}`);

    // 設定超時，未認證則斷開
    const authTimeout = setTimeout(() => {
      if (!authenticatedAdmins.has(socket.id)) {
        console.log(`[Admin WS] Auth timeout, disconnecting: ${socket.id}`);
        socket.emit('error', { code: 'AUTH_TIMEOUT', message: '認證逾時' });
        socket.disconnect();
      }
    }, 30000);

    // 登入認證
    socket.on('admin:login', async (data) => {
      try {
        const { username, password } = data;

        if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
          socket.emit('admin:login:response', {
            success: false,
            error: '帳號或密碼錯誤'
          });
          return;
        }

        // 生成 token
        const token = jwt.sign(
          { username: ADMIN_USERNAME, isAdmin: true },
          ADMIN_JWT_SECRET,
          { expiresIn: '4h' }
        );

        clearTimeout(authTimeout);
        authenticatedAdmins.set(socket.id, { username, token });

        socket.emit('admin:login:response', {
          success: true,
          data: { token, username }
        });

        console.log(`[Admin WS] Admin authenticated: ${socket.id}`);
      } catch (error) {
        socket.emit('admin:login:response', {
          success: false,
          error: error.message
        });
      }
    });

    // Token 認證 (用於重連)
    socket.on('admin:auth', (data) => {
      try {
        const { token } = data;
        const decoded = jwt.verify(token, ADMIN_JWT_SECRET);

        if (!decoded.isAdmin) {
          socket.emit('admin:auth:response', {
            success: false,
            error: '無效的管理員令牌'
          });
          return;
        }

        clearTimeout(authTimeout);
        authenticatedAdmins.set(socket.id, { username: decoded.username, token });

        socket.emit('admin:auth:response', {
          success: true,
          data: { username: decoded.username }
        });

        console.log(`[Admin WS] Admin re-authenticated: ${socket.id}`);
      } catch (error) {
        socket.emit('admin:auth:response', {
          success: false,
          error: '令牌無效或已過期'
        });
      }
    });

    // 中間件：檢查認證
    const requireAuth = (handler) => async (data, callback) => {
      if (!authenticatedAdmins.has(socket.id)) {
        const response = { success: false, error: '未認證' };
        if (callback) callback(response);
        else socket.emit('error', response);
        return;
      }
      try {
        await handler(data, callback);
      } catch (error) {
        const response = { success: false, error: error.message };
        if (callback) callback(response);
        else socket.emit('error', response);
      }
    };

    // 取得系統健康狀態
    socket.on('admin:health', requireAuth(async (data, callback) => {
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

      // Check Redis
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

      socket.emit('admin:health:response', { success: true, data: health });
    }));

    // 取得統計數據
    socket.on('admin:stats', requireAuth(async (data, callback) => {
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

      socket.emit('admin:stats:response', {
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
          models: { active: 3 },
        }
      });
    }));

    // 取得用戶列表
    socket.on('admin:users', requireAuth(async (data, callback) => {
      const { page = 1, limit = 20, search } = data || {};
      const offset = (page - 1) * limit;

      let whereClause = '';
      const replacements = { limit: parseInt(limit), offset: parseInt(offset) };

      if (search) {
        whereClause = `WHERE "username" ILIKE :search OR "email" ILIKE :search`;
        replacements.search = `%${search}%`;
      }

      const users = await sequelize.query(`
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
      `, { replacements });

      socket.emit('admin:users:response', {
        success: true,
        data: {
          users: users || [],
          total: parseInt(countResult?.total || 0),
          page: parseInt(page),
          limit: parseInt(limit),
        }
      });
    }));

    // 更新用戶狀態
    socket.on('admin:user:update', requireAuth(async (data, callback) => {
      const { id, isActive } = data;

      await sequelize.query(`
        UPDATE "Users" SET "isActive" = :isActive, "updatedAt" = NOW()
        WHERE "id" = :id
      `, {
        replacements: { id, isActive },
      });

      socket.emit('admin:user:update:response', {
        success: true,
        data: { message: '用戶更新成功' }
      });
    }));

    // 取得訊號列表
    socket.on('admin:signals', requireAuth(async (data, callback) => {
      const { page = 1, limit = 20, pair, direction } = data || {};
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
      `, { replacements });

      socket.emit('admin:signals:response', {
        success: true,
        data: {
          signals: signals || [],
          total: parseInt(countResult?.total || 0),
          page: parseInt(page),
          limit: parseInt(limit),
        }
      });
    }));

    // 取得 ML 模型
    socket.on('admin:ml:models', requireAuth(async (data, callback) => {
      socket.emit('admin:ml:models:response', {
        success: true,
        data: {
          models: [
            { id: 1, name: 'LSTM Model', type: 'LSTM', version: '1.0', status: 'active', accuracy: 0.72, lastTrained: null },
            { id: 2, name: 'GRU Model', type: 'GRU', version: '1.0', status: 'active', accuracy: 0.70, lastTrained: null },
            { id: 3, name: 'Ensemble Model', type: 'Ensemble', version: '1.0', status: 'active', accuracy: 0.75, lastTrained: null },
          ],
        }
      });
    }));

    // 取得 ML Engine 狀態
    socket.on('admin:ml:status', requireAuth(async (data, callback) => {
      try {
        const mlUrl = process.env.ML_API_URL || 'http://localhost:8000';
        const response = await axios.get(`${mlUrl}/health`, { timeout: 5000 });
        socket.emit('admin:ml:status:response', {
          success: true,
          data: {
            status: 'running',
            uptime: response.data?.uptime || 'N/A',
            memory: response.data?.memory || 'N/A',
            gpu: response.data?.gpu || '無',
          }
        });
      } catch (e) {
        socket.emit('admin:ml:status:response', {
          success: true,
          data: { status: 'disconnected', error: '無法連接 ML Engine' }
        });
      }
    }));

    // 斷開連接
    socket.on('disconnect', () => {
      clearTimeout(authTimeout);
      authenticatedAdmins.delete(socket.id);
      console.log(`[Admin WS] Disconnected: ${socket.id}`);
    });
  });

  console.log('[Admin WS] Admin WebSocket initialized on /admin-ws');
}

module.exports = { initAdminSocket };
