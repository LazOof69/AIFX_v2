const { SMA, RSI } = require('technicalindicators');
const logger = require('../utils/logger');

/**
 * Technical Analysis Service
 * Implements technical indicators for forex trading analysis
 */
class TechnicalAnalysisService {
  /**
   * Calculate Simple Moving Average (SMA)
   * @param {number[]} prices - Array of price values
   * @param {number} period - SMA period (default from user preferences or 20)
   * @returns {number|null} - Latest SMA value or null if insufficient data
   */
  calculateSMA(prices, period = 20) {
    try {
      // Validate input
      if (!Array.isArray(prices) || prices.length === 0) {
        logger.warn('SMA calculation: Invalid input data');
        return null;
      }

      // Check if we have sufficient data
      if (prices.length < period) {
        logger.warn(`SMA calculation: Insufficient data. Need ${period}, got ${prices.length}`);
        return null;
      }

      // Calculate SMA using technicalindicators library
      const smaValues = SMA.calculate({
        period: period,
        values: prices
      });

      // Return the latest SMA value
      if (smaValues && smaValues.length > 0) {
        return smaValues[smaValues.length - 1];
      }

      return null;
    } catch (error) {
      logger.error('Error calculating SMA:', error);
      return null;
    }
  }

  /**
   * Calculate Relative Strength Index (RSI)
   * @param {number[]} prices - Array of price values
   * @param {number} period - RSI period (default from user preferences or 14)
   * @returns {number|null} - Latest RSI value (0-100) or null if insufficient data
   */
  calculateRSI(prices, period = 14) {
    try {
      // Validate input
      if (!Array.isArray(prices) || prices.length === 0) {
        logger.warn('RSI calculation: Invalid input data');
        return null;
      }

      // Check if we have sufficient data (need at least period + 1)
      if (prices.length < period + 1) {
        logger.warn(`RSI calculation: Insufficient data. Need ${period + 1}, got ${prices.length}`);
        return null;
      }

      // Calculate RSI using technicalindicators library
      const rsiValues = RSI.calculate({
        period: period,
        values: prices
      });

      // Return the latest RSI value
      if (rsiValues && rsiValues.length > 0) {
        return rsiValues[rsiValues.length - 1];
      }

      return null;
    } catch (error) {
      logger.error('Error calculating RSI:', error);
      return null;
    }
  }

  /**
   * Calculate multiple SMAs with different periods
   * @param {number[]} prices - Array of price values
   * @param {number[]} periods - Array of SMA periods (e.g., [20, 50, 200])
   * @returns {Object} - Object with SMA values keyed by period
   */
  calculateMultipleSMA(prices, periods = [20, 50, 200]) {
    const results = {};

    for (const period of periods) {
      const sma = this.calculateSMA(prices, period);
      if (sma !== null) {
        results[`sma${period}`] = sma;
      }
    }

    return results;
  }

  /**
   * Analyze technical indicators based on user preferences
   * @param {number[]} prices - Array of price values
   * @param {Object} userPreferences - User's indicator preferences
   * @returns {Object} - Object with calculated indicators
   */
  analyzeWithPreferences(prices, userPreferences = {}) {
    try {
      const results = {
        timestamp: new Date().toISOString(),
        indicators: {}
      };

      // Calculate SMA if enabled in preferences
      if (userPreferences.indicators?.sma?.enabled !== false) {
        const smaPeriod = userPreferences.indicators?.sma?.period || 20;
        const smaValue = this.calculateSMA(prices, smaPeriod);

        if (smaValue !== null) {
          results.indicators.sma = {
            period: smaPeriod,
            value: smaValue,
            signal: this.getSMASignal(prices[prices.length - 1], smaValue)
          };
        }
      }

      // Calculate RSI if enabled in preferences
      if (userPreferences.indicators?.rsi?.enabled !== false) {
        const rsiPeriod = userPreferences.indicators?.rsi?.period || 14;
        const rsiValue = this.calculateRSI(prices, rsiPeriod);

        if (rsiValue !== null) {
          results.indicators.rsi = {
            period: rsiPeriod,
            value: rsiValue,
            signal: this.getRSISignal(rsiValue)
          };
        }
      }

      return results;
    } catch (error) {
      logger.error('Error analyzing with preferences:', error);
      throw error;
    }
  }

  /**
   * Determine trading signal from SMA
   * @param {number} currentPrice - Current price
   * @param {number} smaValue - SMA value
   * @returns {string} - 'bullish', 'bearish', or 'neutral'
   */
  getSMASignal(currentPrice, smaValue) {
    if (currentPrice > smaValue * 1.001) { // 0.1% threshold
      return 'bullish';
    } else if (currentPrice < smaValue * 0.999) {
      return 'bearish';
    }
    return 'neutral';
  }

  /**
   * Determine trading signal from RSI
   * @param {number} rsiValue - RSI value (0-100)
   * @returns {string} - 'overbought', 'oversold', or 'neutral'
   */
  getRSISignal(rsiValue) {
    if (rsiValue >= 70) {
      return 'overbought'; // Potential sell signal
    } else if (rsiValue <= 30) {
      return 'oversold'; // Potential buy signal
    }
    return 'neutral';
  }

  /**
   * Get comprehensive technical analysis
   * @param {Object} marketData - Market data with OHLC values
   * @param {Object} userPreferences - User preferences
   * @returns {Object} - Comprehensive analysis results
   */
  getComprehensiveAnalysis(marketData, userPreferences = {}) {
    try {
      // Extract closing prices from market data
      const closingPrices = marketData.timeSeries?.map(candle => parseFloat(candle.close)) || [];

      if (closingPrices.length === 0) {
        throw new Error('No price data available for analysis');
      }

      const analysis = this.analyzeWithPreferences(closingPrices, userPreferences);

      // Add current price info
      analysis.currentPrice = closingPrices[closingPrices.length - 1];
      analysis.priceChange = closingPrices.length > 1
        ? ((closingPrices[closingPrices.length - 1] - closingPrices[closingPrices.length - 2]) / closingPrices[closingPrices.length - 2]) * 100
        : 0;

      // Add overall signal
      analysis.overallSignal = this.determineOverallSignal(analysis.indicators);

      return analysis;
    } catch (error) {
      logger.error('Error in comprehensive analysis:', error);
      throw error;
    }
  }

  /**
   * Determine overall trading signal from multiple indicators
   * @param {Object} indicators - Object containing indicator results
   * @returns {string} - 'buy', 'sell', or 'hold'
   */
  determineOverallSignal(indicators) {
    let bullishCount = 0;
    let bearishCount = 0;

    // Analyze SMA signal
    if (indicators.sma) {
      if (indicators.sma.signal === 'bullish') bullishCount++;
      if (indicators.sma.signal === 'bearish') bearishCount++;
    }

    // Analyze RSI signal
    if (indicators.rsi) {
      if (indicators.rsi.signal === 'oversold') bullishCount++;
      if (indicators.rsi.signal === 'overbought') bearishCount++;
    }

    // Determine overall signal
    if (bullishCount > bearishCount) {
      return 'buy';
    } else if (bearishCount > bullishCount) {
      return 'sell';
    }
    return 'hold';
  }
}

module.exports = new TechnicalAnalysisService();