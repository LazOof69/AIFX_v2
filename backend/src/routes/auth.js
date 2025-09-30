/**
 * Authentication Routes
 * Handles user registration, login, token refresh, and logout
 */

const express = require('express');
const authService = require('../services/authService');
const { authenticate, authRateLimit } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  validateUserRegistration,
  validateUserLogin,
  validateRefreshToken,
  validatePasswordChange,
  validatePasswordReset,
} = require('../middleware/validation');

const router = express.Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  authRateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  validateUserRegistration,
  asyncHandler(async (req, res) => {
    const { email, username, password, firstName, lastName } = req.body;

    const result = await authService.registerUser({
      email,
      username,
      password,
      firstName,
      lastName,
    });

    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        message: 'User registered successfully',
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and get tokens
 * @access  Public
 */
router.post(
  '/login',
  authRateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  validateUserLogin,
  asyncHandler(async (req, res) => {
    const { identifier, password } = req.body;

    const result = await authService.loginUser(identifier, password);

    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        message: 'Login successful',
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post(
  '/refresh',
  authRateLimit(10, 15 * 60 * 1000), // 10 attempts per 15 minutes
  validateRefreshToken,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    const result = await authService.refreshAccessToken(refreshToken);

    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        message: 'Token refreshed successfully',
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user and invalidate refresh token
 * @access  Private
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await authService.logoutUser(req.userId);

    res.status(200).json({
      success: true,
      data: {
        message: 'Logout successful',
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Logout user from all devices
 * @access  Private
 */
router.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req, res) => {
    await authService.logoutAllDevices(req.userId);

    res.status(200).json({
      success: true,
      data: {
        message: 'Logged out from all devices successfully',
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await authService.getUserProfile(req.userId);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticate,
  asyncHandler(async (req, res) => {
    const allowedFields = ['firstName', 'lastName', 'timezone', 'language'];
    const updateData = {};

    // Filter only allowed fields
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const user = await authService.updateUserProfile(req.userId, updateData);

    res.status(200).json({
      success: true,
      data: {
        user,
        message: 'Profile updated successfully',
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
  '/change-password',
  authenticate,
  authRateLimit(3, 15 * 60 * 1000), // 3 attempts per 15 minutes
  validatePasswordChange,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    await authService.changePassword(req.userId, currentPassword, newPassword);

    res.status(200).json({
      success: true,
      data: {
        message: 'Password changed successfully. Please login again.',
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Initiate password reset process
 * @access  Public
 */
router.post(
  '/forgot-password',
  authRateLimit(3, 60 * 60 * 1000), // 3 attempts per hour
  validatePasswordReset,
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    const result = await authService.initiatePasswordReset(email);

    res.status(200).json({
      success: true,
      data: {
        message: result.message,
        // In production, remove these fields:
        resetToken: result.resetToken,
        userId: result.userId,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Complete password reset with token
 * @access  Public
 */
router.post(
  '/reset-password',
  authRateLimit(3, 15 * 60 * 1000), // 3 attempts per 15 minutes
  asyncHandler(async (req, res) => {
    const { resetToken, newPassword, userId } = req.body;

    // Basic validation
    if (!resetToken || !newPassword || !userId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Reset token, new password, and user ID are required',
        timestamp: new Date().toISOString(),
      });
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (newPassword.length < 8 || !passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        timestamp: new Date().toISOString(),
      });
    }

    await authService.completePasswordReset(resetToken, newPassword, userId);

    res.status(200).json({
      success: true,
      data: {
        message: 'Password reset successfully. Please login with your new password.',
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   POST /api/v1/auth/verify
 * @desc    Verify user account (email verification)
 * @access  Private
 */
router.post(
  '/verify',
  authenticate,
  asyncHandler(async (req, res) => {
    await authService.verifyAccount(req.userId);

    res.status(200).json({
      success: true,
      data: {
        message: 'Account verified successfully',
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   DELETE /api/v1/auth/deactivate
 * @desc    Deactivate user account
 * @access  Private
 */
router.delete(
  '/deactivate',
  authenticate,
  asyncHandler(async (req, res) => {
    await authService.deactivateAccount(req.userId);

    res.status(200).json({
      success: true,
      data: {
        message: 'Account deactivated successfully',
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   GET /api/v1/auth/validate
 * @desc    Validate current session
 * @access  Private
 */
router.get(
  '/validate',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await authService.validateSession(req.userId);

    res.status(200).json({
      success: true,
      data: {
        user,
        valid: true,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  })
);

module.exports = router;