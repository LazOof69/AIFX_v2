/**
 * Backend API Client
 * Handles all communication with AIFX_v2 Backend API
 * Follows microservices principle: LINE Bot does NOT access database directly
 */

const axios = require('axios');
const logger = require('../utils/logger');

class BackendClient {
  constructor() {
    this.baseURL = process.env.BACKEND_API_URL || 'http://localhost:3000';
    this.apiKey = process.env.LINE_BOT_API_KEY;
    this.timeout = 30000; // 30 seconds
  }

  /**
   * Get headers for API requests
   */
  _getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['X-Service-Name'] = 'line-bot';
    }

    return headers;
  }

  /**
   * Get trading signal for a currency pair
   * @param {string} pair - Currency pair (e.g., "EUR/USD")
   * @param {string} period - Trading period (日內/周內/月內/季內)
   * @param {string} timeframe - Legacy timeframe parameter (15min/1h/4h/1d)
   * @returns {Promise<Object>} Signal data
   */
  async getTradingSignal(pair, period = null, timeframe = null) {
    try {
      const params = { pair };

      if (period) {
        params.period = period;
      } else if (timeframe) {
        params.timeframe = timeframe;
      } else {
        params.period = '周內'; // Default to swing trading
      }

      logger.info(`Fetching trading signal: ${pair} (${period || timeframe || '周內'})`);

      const response = await axios.get(
        `${this.baseURL}/api/v1/trading/signal`,
        {
          params,
          headers: this._getHeaders(),
          timeout: this.timeout
        }
      );

      if (response.data.success && response.data.data?.signal) {
        logger.info(`Successfully fetched signal for ${pair}`);
        return response.data.data.signal;
      } else {
        throw new Error(response.data.error || 'Failed to retrieve signal');
      }
    } catch (error) {
      logger.error(`Error fetching trading signal for ${pair}:`, error.message);
      throw error;
    }
  }

  /**
   * Get or create LINE user in backend
   * @param {string} lineUserId - LINE user ID
   * @param {string} displayName - LINE user display name
   * @returns {Promise<Object>} User data
   */
  async getOrCreateUser(lineUserId, displayName) {
    try {
      logger.info(`Getting or creating user: ${lineUserId} (${displayName})`);

      const response = await axios.post(
        `${this.baseURL}/api/v1/line/users`,
        {
          lineUserId,
          lineDisplayName: displayName
        },
        {
          headers: this._getHeaders(),
          timeout: this.timeout
        }
      );

      if (response.data.success) {
        logger.info(`User ${lineUserId} retrieved/created successfully`);
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to get/create user');
      }
    } catch (error) {
      logger.error(`Error getting/creating user ${lineUserId}:`, error.message);
      throw error;
    }
  }

  /**
   * Update user preferences
   * @param {string} lineUserId - LINE user ID
   * @param {Object} preferences - User preferences
   * @returns {Promise<Object>} Updated preferences
   */
  async updatePreferences(lineUserId, preferences) {
    try {
      logger.info(`Updating preferences for user: ${lineUserId}`);

      const response = await axios.post(
        `${this.baseURL}/api/v1/notifications/preferences`,
        {
          lineUserId,
          preferences
        },
        {
          headers: this._getHeaders(),
          timeout: this.timeout
        }
      );

      if (response.data.success) {
        logger.info(`Preferences updated for user ${lineUserId}`);
        return response.data.data.preferences;
      } else {
        throw new Error(response.data.error || 'Failed to update preferences');
      }
    } catch (error) {
      logger.error(`Error updating preferences for ${lineUserId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get user preferences
   * @param {string} lineUserId - LINE user ID
   * @returns {Promise<Object>} User preferences
   */
  async getPreferences(lineUserId) {
    try {
      logger.info(`Fetching preferences for user: ${lineUserId}`);

      const response = await axios.get(
        `${this.baseURL}/api/v1/notifications/preferences/${lineUserId}`,
        {
          headers: this._getHeaders(),
          timeout: this.timeout
        }
      );

      if (response.data.success) {
        logger.info(`Preferences fetched for user ${lineUserId}`);
        return response.data.data?.preferences || {};
      } else {
        throw new Error(response.data.error || 'Failed to get preferences');
      }
    } catch (error) {
      logger.error(`Error fetching preferences for ${lineUserId}:`, error.message);
      throw error;
    }
  }

  /**
   * Subscribe to signal changes for a pair
   * @param {string} lineUserId - LINE user ID
   * @param {string} pair - Currency pair
   * @param {string} timeframe - Timeframe
   * @param {string} lineDisplayName - LINE display name (optional)
   * @returns {Promise<Object>} Subscription result
   */
  async subscribe(lineUserId, pair, timeframe = '1h', lineDisplayName = null) {
    try {
      logger.info(`Subscribing user ${lineUserId} to ${pair} (${timeframe})`);

      const response = await axios.post(
        `${this.baseURL}/api/v1/line/subscriptions`,
        {
          lineUserId,
          pair,
          timeframe,
          lineDisplayName
        },
        {
          headers: this._getHeaders(),
          timeout: this.timeout
        }
      );

      if (response.data.success) {
        logger.info(`User ${lineUserId} subscribed to ${pair}`);
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to subscribe');
      }
    } catch (error) {
      logger.error(`Error subscribing user ${lineUserId} to ${pair}:`, error.message);
      throw error;
    }
  }

  /**
   * Unsubscribe from signal changes
   * @param {string} lineUserId - LINE user ID
   * @param {string} pair - Currency pair
   * @param {string} timeframe - Timeframe
   * @returns {Promise<Object>} Unsubscribe result
   */
  async unsubscribe(lineUserId, pair, timeframe = '1h') {
    try {
      logger.info(`Unsubscribing user ${lineUserId} from ${pair} (${timeframe})`);

      const response = await axios.post(
        `${this.baseURL}/api/v1/line/subscriptions/unsubscribe`,
        {
          lineUserId,
          pair,
          timeframe
        },
        {
          headers: this._getHeaders(),
          timeout: this.timeout
        }
      );

      if (response.data.success) {
        logger.info(`User ${lineUserId} unsubscribed from ${pair}`);
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to unsubscribe');
      }
    } catch (error) {
      logger.error(`Error unsubscribing user ${lineUserId} from ${pair}:`, error.message);
      throw error;
    }
  }

  /**
   * Get user's subscriptions
   * @param {string} lineUserId - LINE user ID
   * @returns {Promise<Array>} List of subscriptions
   */
  async getSubscriptions(lineUserId) {
    try {
      logger.info(`Fetching subscriptions for user: ${lineUserId}`);

      const response = await axios.get(
        `${this.baseURL}/api/v1/line/subscriptions/${lineUserId}`,
        {
          headers: this._getHeaders(),
          timeout: this.timeout
        }
      );

      if (response.data.success) {
        logger.info(`Subscriptions fetched for user ${lineUserId}`);
        return response.data.data?.subscriptions || [];
      } else {
        throw new Error(response.data.error || 'Failed to get subscriptions');
      }
    } catch (error) {
      logger.error(`Error fetching subscriptions for ${lineUserId}:`, error.message);
      throw error;
    }
  }
}

module.exports = new BackendClient();
