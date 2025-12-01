/**
 * Admin Authentication Middleware
 * 獨立的管理員認證中間件，不影響現有 authenticate 中間件
 */

const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

// Admin JWT secret (獨立的密鑰)
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'admin-secret-key';

/**
 * Admin authentication middleware
 * 驗證管理員 JWT token
 */
const adminAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('未提供認證令牌', 401, 'ADMIN_AUTH_REQUIRED');
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, ADMIN_JWT_SECRET);

      // 確認是管理員 token
      if (!decoded.isAdmin) {
        throw new AppError('無效的管理員令牌', 401, 'INVALID_ADMIN_TOKEN');
      }

      req.admin = decoded;
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        throw new AppError('令牌已過期', 401, 'TOKEN_EXPIRED');
      }
      throw new AppError('無效的令牌', 401, 'INVALID_TOKEN');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Admin login function
 * 驗證管理員帳號密碼並生成 token
 */
const adminLogin = (username, password) => {
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return null;
  }

  const token = jwt.sign(
    {
      username: ADMIN_USERNAME,
      isAdmin: true,
    },
    ADMIN_JWT_SECRET,
    { expiresIn: '4h' }
  );

  return token;
};

module.exports = { adminAuth, adminLogin };
