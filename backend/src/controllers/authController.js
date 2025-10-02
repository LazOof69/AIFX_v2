const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, UserPreference } = require('../models');

/**
 * Authentication Controller
 * Handles user registration, login, logout, and profile
 */

/**
 * Register a new user
 * @route POST /api/v1/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Username, email, and password are required',
        timestamp: new Date().toISOString(),
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        data: null,
        error: 'User with this email already exists',
        timestamp: new Date().toISOString(),
      });
    }

    // Check if username is taken
    const existingUsername = await User.findOne({
      where: { username },
    });

    if (existingUsername) {
      return res.status(409).json({
        success: false,
        data: null,
        error: 'Username is already taken',
        timestamp: new Date().toISOString(),
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      username,
      email,
      passwordHash,
    });

    // Create default preferences for user
    await UserPreference.create({
      userId: user.id,
      tradingFrequency: 'daytrading',
      riskLevel: 5,
      preferredPairs: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
      tradingStyle: 'mixed',
      indicators: {
        sma: { enabled: true, period: 20 },
        rsi: { enabled: true, period: 14 },
        macd: { enabled: true },
        bb: { enabled: false, period: 20 },
      },
      notificationSettings: {
        email: true,
        discord: false,
        browser: true,
        signalTypes: { buy: true, sell: true, hold: false },
        minConfidence: 70,
      },
    });

    // Return user data (without password)
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt,
        },
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Login user
 * @route POST /api/v1/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Email and password are required',
        timestamp: new Date().toISOString(),
      });
    }

    // Find user
    const user = await User.findOne({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Invalid email or password',
        timestamp: new Date().toISOString(),
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'Account is inactive',
        timestamp: new Date().toISOString(),
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Invalid email or password',
        timestamp: new Date().toISOString(),
      });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    const refreshToken = jwt.sign(
      {
        userId: user.id,
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    // Update last login
    await user.update({ lastLogin: new Date() });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
        accessToken,
        refreshToken,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Refresh access token
 * @route POST /api/v1/auth/refresh
 */
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Refresh token is required',
        timestamp: new Date().toISOString(),
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Find user
    const user = await User.findByPk(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Invalid refresh token',
        timestamp: new Date().toISOString(),
      });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    res.status(200).json({
      success: true,
      data: {
        accessToken,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      data: null,
      error: 'Invalid or expired refresh token',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Logout user
 * @route POST /api/v1/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    // In a real application, you might want to:
    // 1. Add the token to a blacklist
    // 2. Remove refresh token from database
    // 3. Clear any sessions

    res.status(200).json({
      success: true,
      data: null,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get current user profile
 * @route GET /api/v1/auth/profile
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'email', 'isActive', 'lastLogin', 'createdAt', 'updatedAt'],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'User not found',
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      success: true,
      data: user,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Update user profile
 * @route PUT /api/v1/auth/profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { username, email } = req.body;

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'User not found',
        timestamp: new Date().toISOString(),
      });
    }

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({
        where: { email },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          data: null,
          error: 'Email is already taken',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Check if username is already taken by another user
    if (username && username !== user.username) {
      const existingUsername = await User.findOne({
        where: { username },
      });

      if (existingUsername) {
        return res.status(409).json({
          success: false,
          data: null,
          error: 'Username is already taken',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Update user
    await user.update({
      username: username || user.username,
      email: email || user.email,
    });

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        updatedAt: user.updatedAt,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};