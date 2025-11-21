/**
 * Backend API Client for Discord Bot
 *
 * Following microservices architecture principles (CLAUDE.md):
 * - Discord Bot MUST use Backend APIs instead of direct database access
 * - All communication happens via REST APIs
 * - Service-to-service authentication with API Key
 *
 * This client provides a clean interface to all Backend APIs needed by Discord Bot.
 */

const axios = require('axios');
const logger = require('../utils/logger');

class BackendApiClient {
  constructor() {
    this.baseURL = process.env.BACKEND_API_URL || 'http://localhost:3000/api/v1';
    this.apiKey = process.env.DISCORD_BOT_API_KEY || 'dev_discord_bot_key_replace_in_production';
    this.timeout = parseInt(process.env.API_TIMEOUT || '10000', 10);

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-Service-Name': 'discord-bot',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        this._handleError(error);
        return Promise.reject(error);
      }
    );

    logger.info(`Backend API Client initialized: ${this.baseURL}`);
  }

  /**
   * Handle API errors consistently
   */
  _handleError(error) {
    if (error.response) {
      // Server responded with error status
      logger.error(`Backend API Error: ${error.response.status}`, {
        url: error.config?.url,
        data: error.response.data,
      });
    } else if (error.request) {
      // Request made but no response
      logger.error('Backend API No Response:', {
        url: error.config?.url,
        message: error.message,
      });
    } else {
      // Request setup error
      logger.error('Backend API Request Error:', error.message);
    }
  }

  // ========================================
  // USER MANAGEMENT APIS
  // ========================================

  /**
   * Get user by Discord ID
   * @param {string} discordId - Discord user ID
   * @returns {Promise<Object>} User data with discord settings and preferences
   */
  async getUserByDiscordId(discordId) {
    try {
      const response = await this.client.get(`/discord/users/${discordId}`);
      return response.data.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // User not found
      }
      throw error;
    }
  }

  /**
   * Create or update user
   * @param {Object} userData - User data
   * @param {string} userData.discordId - Discord user ID
   * @param {string} userData.discordUsername - Discord username
   * @param {string} [userData.username] - Backend username (optional)
   * @param {string} [userData.email] - Email (optional)
   * @returns {Promise<Object>} Created/updated user data
   */
  async createOrUpdateUser(userData) {
    const response = await this.client.post('/discord/users', userData);
    return response.data.data;
  }

  /**
   * Update Discord settings for a user
   * @param {string} discordId - Discord user ID
   * @param {Object} settings - Discord settings to update
   * @returns {Promise<Object>} Updated settings
   */
  async updateDiscordSettings(discordId, settings) {
    const response = await this.client.put(`/discord/users/${discordId}/settings`, settings);
    return response.data.data;
  }

  // ========================================
  // TRADING SIGNALS APIS
  // ========================================

  /**
   * Get pending signals (for notification)
   * @param {Object} [filters] - Filter options
   * @param {string} [filters.pair] - Currency pair
   * @param {string} [filters.status] - Signal status
   * @param {number} [filters.limit] - Max results
   * @returns {Promise<Object>} Signals with eligible users
   */
  async getPendingSignals(filters = {}) {
    const response = await this.client.get('/discord/signals', { params: filters });
    return response.data.data;
  }

  /**
   * Get signal by ID
   * @param {string} signalId - Signal ID
   * @returns {Promise<Object>} Signal data
   */
  async getSignalById(signalId) {
    const response = await this.client.get(`/discord/signals/${signalId}`);
    return response.data.data;
  }

  /**
   * Mark signal as delivered
   * @param {string} signalId - Signal ID
   * @param {Array<string>} userIds - User IDs who received the signal
   * @returns {Promise<Object>} Update result
   */
  async markSignalDelivered(signalId, userIds) {
    const response = await this.client.post(`/discord/signals/${signalId}/delivered`, {
      userIds,
      deliveredAt: new Date().toISOString(),
    });
    return response.data.data;
  }

  // ========================================
  // TRADING HISTORY APIS
  // ========================================

  /**
   * Get trading history for a user
   * @param {string} discordId - Discord user ID
   * @param {Object} [filters] - Filter options
   * @param {string} [filters.pair] - Currency pair
   * @param {string} [filters.status] - Trade status
   * @param {number} [filters.limit] - Max results
   * @returns {Promise<Object>} Trading history
   */
  async getTradingHistory(discordId, filters = {}) {
    const params = { discordId, ...filters };
    const response = await this.client.get('/discord/trades', { params });
    return response.data.data;
  }

  /**
   * Record a new trade
   * @param {Object} tradeData - Trade data
   * @param {string} tradeData.discordId - Discord user ID
   * @param {string} tradeData.pair - Currency pair
   * @param {string} tradeData.action - 'buy' or 'sell'
   * @param {number} tradeData.entryPrice - Entry price
   * @param {number} [tradeData.stopLoss] - Stop loss price
   * @param {number} [tradeData.takeProfit] - Take profit price
   * @param {number} [tradeData.positionSize] - Position size
   * @param {string} [tradeData.notes] - Optional notes
   * @returns {Promise<Object>} Created trade
   */
  async recordTrade(tradeData) {
    const response = await this.client.post('/discord/trades', tradeData);
    return response.data.data;
  }

  /**
   * Update an existing trade
   * @param {string} tradeId - Trade ID
   * @param {Object} updateData - Data to update
   * @param {number} [updateData.exitPrice] - Exit price
   * @param {string} [updateData.status] - Trade status
   * @param {string} [updateData.result] - Trade result
   * @param {number} [updateData.profitLoss] - Profit/loss amount
   * @param {string} [updateData.notes] - Updated notes
   * @returns {Promise<Object>} Updated trade
   */
  async updateTrade(tradeId, updateData) {
    const response = await this.client.put(`/discord/trades/${tradeId}`, updateData);
    return response.data.data;
  }

  /**
   * Close a trade (partial or full)
   * @param {string} tradeId - Trade ID
   * @param {number} exitPrice - Exit price
   * @param {number} [percentage] - Percentage to close (1-100, default 100)
   * @param {string} [notes] - Closing notes
   * @returns {Promise<Object>} Updated trade with calculated P&L
   */
  async closeTrade(tradeId, exitPrice, percentage = 100, notes = null) {
    const updateData = {
      exitPrice,
      status: percentage < 100 ? 'partial_closed' : 'closed',
      closedAt: new Date().toISOString(),
    };

    if (notes) {
      updateData.notes = notes;
    }

    // Let backend calculate profit/loss
    return await this.updateTrade(tradeId, updateData);
  }

  // ========================================
  // HEALTH CHECK
  // ========================================

  /**
   * Check Backend API health
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    const response = await this.client.get('/discord/health');
    return response.data.data;
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  /**
   * Get or create user (convenience method)
   * Used by commands that need user mapping
   *
   * @param {string} discordId - Discord user ID
   * @param {string} discordUsername - Discord username
   * @returns {Promise<Object>} User data
   */
  async getOrCreateUser(discordId, discordUsername) {
    // Try to get existing user
    let user = await this.getUserByDiscordId(discordId);

    if (!user) {
      // Create new user
      logger.info(`Creating new user for Discord: ${discordUsername} (${discordId})`);
      user = await this.createOrUpdateUser({
        discordId,
        discordUsername,
      });
    }

    return user;
  }

  /**
   * Subscribe user to signal notifications
   * @param {string} discordId - Discord user ID
   * @param {string} pair - Currency pair
   * @param {Object} [preferences] - Notification preferences
   * @returns {Promise<Object>} Updated settings
   */
  async subscribeToSignals(discordId, pair, preferences = {}) {
    const settings = {
      notificationsEnabled: true,
      preferredPairs: [pair],
      ...preferences,
    };

    return await this.updateDiscordSettings(discordId, settings);
  }

  /**
   * Unsubscribe user from notifications
   * @param {string} discordId - Discord user ID
   * @returns {Promise<Object>} Updated settings
   */
  async unsubscribeFromSignals(discordId) {
    const settings = {
      notificationsEnabled: false,
    };

    return await this.updateDiscordSettings(discordId, settings);
  }
}

// Export singleton instance
module.exports = new BackendApiClient();
