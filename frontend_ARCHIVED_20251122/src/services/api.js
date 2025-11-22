import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * API client instance with interceptors
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken } = response.data.data;
        localStorage.setItem('accessToken', accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Authentication API
 */
export const authAPI = {
  /**
   * Login user
   * @param {string} identifier - User email or username
   * @param {string} password - User password
   * @returns {Promise} Login response
   */
  login: async (identifier, password) => {
    const response = await apiClient.post('/auth/login', { identifier, password });
    if (response.success) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    return response;
  },

  /**
   * Register new user
   * @param {Object} userData - User registration data
   * @returns {Promise} Registration response
   */
  register: async (userData) => {
    return apiClient.post('/auth/register', userData);
  },

  /**
   * Logout user
   * @returns {Promise} Logout response
   */
  logout: async () => {
    const response = await apiClient.post('/auth/logout');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    return response;
  },

  /**
   * Get current user profile
   * @returns {Promise} User profile
   */
  getProfile: async () => {
    return apiClient.get('/auth/me');
  },
};

/**
 * Trading Signals API
 */
export const tradingAPI = {
  /**
   * Get trading signal for currency pair
   * @param {string} pair - Currency pair (e.g., 'EUR/USD')
   * @returns {Promise} Trading signal
   */
  getSignal: async (pair) => {
    return apiClient.get(`/trading/signal/${pair}`);
  },

  /**
   * Get all trading signals (using history endpoint)
   * @param {Object} params - Query parameters
   * @returns {Promise} List of trading signals
   */
  getSignals: async (params = {}) => {
    return apiClient.get('/trading/history', { params });
  },

  /**
   * Get user's trading history
   * @param {Object} params - Query parameters
   * @returns {Promise} Trading history
   */
  getHistory: async (params = {}) => {
    return apiClient.get('/trading/history', { params });
  },

  /**
   * Get personalized recommendation
   * @returns {Promise} Trading recommendation
   */
  getRecommendation: async () => {
    return apiClient.get('/trading/recommendation');
  },
};

/**
 * Market Data API
 */
export const marketAPI = {
  /**
   * Get real-time price for currency pair
   * @param {string} pair - Currency pair
   * @returns {Promise} Price data
   */
  getPrice: async (pair) => {
    // Use correct backend endpoint: /market/realtime/:pair
    return apiClient.get(`/market/realtime/${pair}`);
  },

  /**
   * Get historical data
   * @param {string} pair - Currency pair
   * @param {string} timeframe - Timeframe (1min, 5min, 15min, 1hour, 4hour, daily)
   * @param {number} limit - Number of data points
   * @returns {Promise} Historical data
   */
  getHistory: async (pair, timeframe = '1hour', limit = 100) => {
    return apiClient.get(`/market/history/${pair}`, {
      params: { timeframe, limit },
    });
  },

  /**
   * Get market overview (simplified - use trading signals)
   * @returns {Promise} Market overview data
   */
  getOverview: async () => {
    // Use trading history as market overview data
    return tradingAPI.getSignals({ limit: 20 });
  },

  /**
   * Get technical indicators (simplified - return basic mock data)
   * @param {string} pair - Currency pair
   * @param {Array} indicators - List of indicators
   * @returns {Promise} Technical indicators data
   */
  getIndicators: async (pair, indicators = ['sma', 'rsi', 'macd']) => {
    // Return simplified indicator data based on pair
    return {
      success: true,
      data: {
        sma: {
          period: 50,
          value: Math.random() * 2 + 0.5, // Random value for display
        },
        rsi: {
          period: 14,
          value: Math.random() * 40 + 30, // Random RSI between 30-70
        },
        macd: {
          value: Math.random() * 0.01 - 0.005,
          signal: Math.random() * 0.01 - 0.005,
        },
      },
    };
  },
};

/**
 * User Preferences API
 */
export const preferencesAPI = {
  /**
   * Get user preferences
   * @returns {Promise} User preferences
   */
  get: async () => {
    return apiClient.get('/preferences');
  },

  /**
   * Update user preferences
   * @param {Object} preferences - Preferences to update
   * @returns {Promise} Updated preferences
   */
  update: async (preferences) => {
    return apiClient.put('/preferences', preferences);
  },

  /**
   * Get notification settings
   * @returns {Promise} Notification settings
   */
  getNotifications: async () => {
    return apiClient.get('/preferences/notifications');
  },

  /**
   * Update notification settings
   * @param {Object} settings - Notification settings
   * @returns {Promise} Updated settings
   */
  updateNotifications: async (settings) => {
    return apiClient.put('/preferences/notifications', settings);
  },
};

/**
 * Notifications API
 */
export const notificationsAPI = {
  /**
   * Get user notifications
   * @param {Object} params - Query parameters
   * @returns {Promise} List of notifications
   */
  getAll: async (params = {}) => {
    return apiClient.get('/notifications', { params });
  },

  /**
   * Mark notification as read
   * @param {string} id - Notification ID
   * @returns {Promise} Updated notification
   */
  markAsRead: async (id) => {
    return apiClient.patch(`/notifications/${id}/read`);
  },

  /**
   * Mark all notifications as read
   * @returns {Promise} Response
   */
  markAllAsRead: async () => {
    return apiClient.patch('/notifications/read-all');
  },

  /**
   * Delete notification
   * @param {string} id - Notification ID
   * @returns {Promise} Response
   */
  delete: async (id) => {
    return apiClient.delete(`/notifications/${id}`);
  },
};

/**
 * Analytics API
 */
export const analyticsAPI = {
  /**
   * Get trading performance
   * @param {string} period - Time period (7d, 30d, 90d, 1y)
   * @returns {Promise} Performance data
   */
  getPerformance: async (period = '30d') => {
    return apiClient.get('/analytics/performance', { params: { period } });
  },

  /**
   * Get win rate statistics
   * @returns {Promise} Win rate data
   */
  getWinRate: async () => {
    return apiClient.get('/analytics/win-rate');
  },
};

export default apiClient;