/**
 * Authentication Service
 * Handles user authentication, registration, and token management
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../middleware/auth');

/**
 * Register a new user
 *
 * @param {object} userData - User registration data
 * @returns {Promise<object>} User data and tokens
 */
const registerUser = async (userData) => {
  const { email, username, password, firstName, lastName } = userData;

  // Check if user already exists
  const existingUser = await User.findOne({
    where: {
      [User.sequelize.Op.or]: [
        { email: email.toLowerCase() },
        { username: username.toLowerCase() },
      ],
    },
  });

  if (existingUser) {
    if (existingUser.email === email.toLowerCase()) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }
    if (existingUser.username === username.toLowerCase()) {
      throw new AppError('Username already taken', 409, 'USERNAME_EXISTS');
    }
  }

  // Create new user (password will be hashed by the model hook)
  const user = await User.create({
    email: email.toLowerCase(),
    username: username.toLowerCase(),
    password,
    firstName,
    lastName,
    isActive: true,
    isVerified: false, // Email verification can be implemented later
  });

  // Generate tokens
  const accessToken = generateAccessToken({ userId: user.id });
  const refreshToken = generateRefreshToken({ userId: user.id });

  // Store refresh token in database
  await user.update({ refreshToken });

  return {
    user: user.toSafeObject(),
    accessToken,
    refreshToken,
  };
};

/**
 * Authenticate user login
 *
 * @param {string} identifier - Email or username
 * @param {string} password - User password
 * @returns {Promise<object>} User data and tokens
 */
const loginUser = async (identifier, password) => {
  // Find user by email or username
  const user = await User.findByIdentifier(identifier.toLowerCase());

  if (!user) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  // Check if user is active
  if (!user.isActive) {
    throw new AppError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
  }

  // Verify password
  const isPasswordValid = await user.checkPassword(password);

  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  // Generate new tokens
  const accessToken = generateAccessToken({ userId: user.id });
  const refreshToken = generateRefreshToken({ userId: user.id });

  // Store refresh token and update last login
  await user.update({
    refreshToken,
    lastLoginAt: new Date(),
  });

  return {
    user: user.toSafeObject(),
    accessToken,
    refreshToken,
  };
};

/**
 * Refresh access token using refresh token
 *
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<object>} New tokens
 */
const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError('Refresh token required', 401, 'REFRESH_TOKEN_REQUIRED');
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  // Find user and verify stored refresh token
  const user = await User.findByPk(decoded.userId);

  if (!user) {
    throw new AppError('User not found', 401, 'USER_NOT_FOUND');
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
  }

  if (user.refreshToken !== refreshToken) {
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  // Generate new tokens
  const newAccessToken = generateAccessToken({ userId: user.id });
  const newRefreshToken = generateRefreshToken({ userId: user.id });

  // Update stored refresh token
  await user.update({ refreshToken: newRefreshToken });

  return {
    user: user.toSafeObject(),
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

/**
 * Logout user by invalidating refresh token
 *
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
const logoutUser = async (userId) => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Clear refresh token
  await user.update({ refreshToken: null });
};

/**
 * Logout user from all devices by clearing refresh token
 *
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
const logoutAllDevices = async (userId) => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Clear refresh token (this invalidates all sessions)
  await user.update({ refreshToken: null });
};

/**
 * Change user password
 *
 * @param {string} userId - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<void>}
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Verify current password
  const isCurrentPasswordValid = await user.checkPassword(currentPassword);

  if (!isCurrentPasswordValid) {
    throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
  }

  // Update password (will be hashed by model hook)
  await user.update({ password: newPassword });

  // Invalidate all sessions for security
  await user.update({ refreshToken: null });
};

/**
 * Reset password (for forgot password functionality)
 * This is a basic implementation - in production, you'd want email verification
 *
 * @param {string} email - User email
 * @returns {Promise<string>} Reset token (in production, send via email)
 */
const initiatePasswordReset = async (email) => {
  const user = await User.findOne({ where: { email: email.toLowerCase() } });

  if (!user) {
    // Don't reveal if email exists for security
    throw new AppError('If this email is registered, you will receive reset instructions', 200, 'RESET_EMAIL_SENT');
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
  }

  // Generate reset token (in production, store this in database with expiry)
  const resetToken = crypto.randomBytes(32).toString('hex');

  // In production, you would:
  // 1. Store resetToken and expiry in database
  // 2. Send email with reset link
  // 3. Return success message without the token

  // For development, returning the token directly
  return {
    message: 'Password reset instructions sent to email',
    resetToken, // Remove this in production
    userId: user.id, // Remove this in production
  };
};

/**
 * Complete password reset with token
 *
 * @param {string} resetToken - Reset token
 * @param {string} newPassword - New password
 * @param {string} userId - User ID (in production, get from token)
 * @returns {Promise<void>}
 */
const completePasswordReset = async (resetToken, newPassword, userId) => {
  // In production, you would verify the reset token from database
  // For now, we'll just verify the user exists

  const user = await User.findByPk(userId);

  if (!user) {
    throw new AppError('Invalid reset token', 400, 'INVALID_RESET_TOKEN');
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
  }

  // Update password (will be hashed by model hook)
  await user.update({ password: newPassword });

  // Invalidate all sessions for security
  await user.update({ refreshToken: null });
};

/**
 * Verify user account (for email verification)
 *
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
const verifyAccount = async (userId) => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  if (user.isVerified) {
    throw new AppError('Account already verified', 400, 'ALREADY_VERIFIED');
  }

  await user.update({ isVerified: true });
};

/**
 * Deactivate user account
 *
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
const deactivateAccount = async (userId) => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  await user.update({
    isActive: false,
    refreshToken: null, // Logout from all devices
  });
};

/**
 * Get user profile
 *
 * @param {string} userId - User ID
 * @returns {Promise<object>} User profile data
 */
const getUserProfile = async (userId) => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  return user.toSafeObject();
};

/**
 * Update user profile
 *
 * @param {string} userId - User ID
 * @param {object} updateData - Profile update data
 * @returns {Promise<object>} Updated user data
 */
const updateUserProfile = async (userId, updateData) => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Only allow certain fields to be updated
  const allowedFields = ['firstName', 'lastName', 'timezone', 'language'];
  const filteredData = {};

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      filteredData[field] = updateData[field];
    }
  }

  if (Object.keys(filteredData).length === 0) {
    throw new AppError('No valid fields to update', 400, 'NO_VALID_FIELDS');
  }

  await user.update(filteredData);

  return user.toSafeObject();
};

/**
 * Validate user session
 *
 * @param {string} userId - User ID
 * @returns {Promise<object>} User data if session is valid
 */
const validateSession = async (userId) => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new AppError('Session invalid', 401, 'INVALID_SESSION');
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
  }

  return user.toSafeObject();
};

module.exports = {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  logoutAllDevices,
  changePassword,
  initiatePasswordReset,
  completePasswordReset,
  verifyAccount,
  deactivateAccount,
  getUserProfile,
  updateUserProfile,
  validateSession,
};