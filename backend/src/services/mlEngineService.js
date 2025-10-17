/**
 * ML Engine Service Client
 *
 * Purpose: Interface with the Python ML Engine API for trading signal predictions
 * Handles reversal detection and direction classification
 *
 * Created: 2025-10-17
 */

const axios = require('axios');
const logger = require('../utils/logger');
const { MarketData } = require('../models');
const { Op } = require('sequelize');

class MLEngineService {
  constructor() {
    this.baseURL = process.env.ML_API_URL || 'http://localhost:8000';
    this.timeout = 30000; // 30 second timeout for predictions
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Check if ML Engine is healthy and available
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'healthy' && response.data.model_loaded === true;
    } catch (error) {
      logger.error('ML Engine health check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Fetch market data from database
   * @param {string} pair - Currency pair (e.g., "EUR/USD")
   * @param {string} timeframe - Timeframe ("1h" or "15min")
   * @param {number} limit - Number of candles to fetch (default: 250, minimum 150 for indicators)
   * @returns {Promise<Array>} Array of market data points
   */
  async fetchMarketData(pair, timeframe, limit = 250) {
    try {
      const data = await MarketData.findAll({
        where: {
          pair: pair,
          timeframe: timeframe
        },
        order: [['timestamp', 'DESC']],
        limit: limit,
        attributes: ['timestamp', 'open', 'high', 'low', 'close', 'volume'],
        raw: true
      });

      // Reverse to get chronological order (oldest to newest)
      return data.reverse();
    } catch (error) {
      logger.error('Failed to fetch market data from database', {
        pair,
        timeframe,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Format market data for ML API
   * @param {Array} marketData - Raw market data from database
   * @returns {Array} Formatted data points
   */
  formatMarketDataForAPI(marketData) {
    return marketData.map(candle => ({
      timestamp: candle.timestamp.toISOString(),
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseFloat(candle.volume) || 0.0
    }));
  }

  /**
   * Predict reversal signal using ML Engine
   * @param {string} pair - Currency pair
   * @param {string} timeframe - Timeframe
   * @param {string} version - Model version (optional, defaults to active version)
   * @returns {Promise<Object>} Prediction result
   */
  async predictReversal(pair, timeframe, version = null) {
    try {
      // Fetch market data from database
      const rawData = await this.fetchMarketData(pair, timeframe, 100);

      if (!rawData || rawData.length < 60) {
        throw new Error(`Insufficient market data for ${pair} ${timeframe}. Need at least 60 candles, got ${rawData?.length || 0}`);
      }

      // Format data for API
      const formattedData = this.formatMarketDataForAPI(rawData);

      // Prepare request payload
      const requestPayload = {
        pair: pair,
        timeframe: timeframe,
        data: formattedData,
        version: version
      };

      logger.info('Sending reversal prediction request to ML Engine', {
        pair,
        timeframe,
        dataPoints: formattedData.length,
        version: version || 'active'
      });

      // Call ML API
      const response = await this.client.post('/reversal/predict_raw', requestPayload);

      if (!response.data.success) {
        throw new Error(response.data.error || 'ML Engine prediction failed');
      }

      const prediction = response.data.data;

      logger.info('Received prediction from ML Engine', {
        pair,
        timeframe,
        signal: prediction.signal,
        confidence: prediction.confidence
      });

      return {
        success: true,
        prediction: {
          pair: prediction.pair,
          timeframe: prediction.timeframe,
          signal: prediction.signal, // 'hold', 'long', 'short'
          confidence: prediction.confidence,
          stage1_prob: prediction.stage1_prob,
          stage2_prob: prediction.stage2_prob,
          model_version: prediction.model_version,
          factors: prediction.factors,
          timestamp: prediction.timestamp,
          warning: prediction.warning
        },
        error: null
      };

    } catch (error) {
      logger.error('ML Engine prediction failed', {
        pair,
        timeframe,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        prediction: null,
        error: error.message
      };
    }
  }

  /**
   * Compare predictions from multiple model versions
   * @param {string} pair - Currency pair
   * @param {string} timeframe - Timeframe
   * @param {Array<string>} versions - Model versions to compare (e.g., ['v3.0', 'v3.1'])
   * @returns {Promise<Object>} Comparison result
   */
  async compareVersions(pair, timeframe, versions = ['v3.0', 'v3.1']) {
    try {
      // Fetch market data
      const rawData = await this.fetchMarketData(pair, timeframe, 100);

      if (!rawData || rawData.length < 60) {
        throw new Error(`Insufficient market data for ${pair} ${timeframe}`);
      }

      const formattedData = this.formatMarketDataForAPI(rawData);

      // Prepare request
      const requestPayload = {
        pair: pair,
        timeframe: timeframe,
        data: formattedData,
        versions: versions
      };

      logger.info('Sending version comparison request to ML Engine', {
        pair,
        timeframe,
        versions
      });

      const response = await this.client.post('/reversal/compare_raw', requestPayload);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Version comparison failed');
      }

      return {
        success: true,
        comparison: response.data.data,
        error: null
      };

    } catch (error) {
      logger.error('Version comparison failed', {
        pair,
        timeframe,
        versions,
        error: error.message
      });

      return {
        success: false,
        comparison: null,
        error: error.message
      };
    }
  }

  /**
   * Get available model versions
   * @returns {Promise<Object>} Model versions info
   */
  async getModelVersions() {
    try {
      const response = await this.client.get('/reversal/models');
      return {
        success: true,
        versions: response.data.data,
        error: null
      };
    } catch (error) {
      logger.error('Failed to get model versions', { error: error.message });
      return {
        success: false,
        versions: null,
        error: error.message
      };
    }
  }

  /**
   * Switch active model version
   * @param {string} version - Version to switch to
   * @returns {Promise<Object>}
   */
  async switchModelVersion(version) {
    try {
      const response = await this.client.post(`/reversal/models/${version}/switch`);
      return {
        success: true,
        data: response.data.data,
        error: null
      };
    } catch (error) {
      logger.error('Failed to switch model version', {
        version,
        error: error.message
      });
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }
}

// Singleton instance
const mlEngineService = new MLEngineService();

module.exports = mlEngineService;
