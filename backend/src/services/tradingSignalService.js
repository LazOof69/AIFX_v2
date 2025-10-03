const technicalAnalysis = require('./technicalAnalysis');
const forexService = require('./forexService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

/**
 * Trading Signal Service
 * Generates trading signals by integrating technical indicators and market analysis
 */
class TradingSignalService {
  /**
   * Generate trading signal for a currency pair
   * @param {string} pair - Currency pair (e.g., 'EUR/USD')
   * @param {Object} options - Options including timeframe, user preferences
   * @returns {Promise<Object>} - Trading signal with confidence and factors
   */
  async generateSignal(pair, options = {}) {
    try {
      const {
        timeframe = '1h',
        userPreferences = {},
        userId = null
      } = options;

      logger.info(`Generating trading signal for ${pair} on ${timeframe}`);

      // Fetch market data
      const marketData = await forexService.getHistoricalData(pair, {
        interval: this.mapTimeframeToInterval(timeframe),
        outputsize: 'compact' // Get ~100 data points
      });

      if (!marketData || !marketData.timeSeries || marketData.timeSeries.length === 0) {
        throw new Error('Insufficient market data for signal generation');
      }

      // Get current price
      const currentPrice = parseFloat(marketData.timeSeries[0].close);

      // Perform technical analysis
      const analysis = technicalAnalysis.getComprehensiveAnalysis(marketData, userPreferences);

      // Get ML prediction if available
      const mlPrediction = await this.getMLPrediction(pair, timeframe, marketData);

      // Merge ML prediction with technical analysis
      let finalSignal = analysis.overallSignal;
      let finalConfidence = this.calculateConfidence(analysis.indicators, userPreferences);
      let mlEnhanced = false;
      let factors = {
        technical: this.calculateTechnicalFactor(analysis.indicators),
        sentiment: 0.5, // Placeholder for future sentiment analysis
        pattern: 0.5 // Placeholder for future pattern recognition
      };

      if (mlPrediction && mlPrediction.prediction) {
        mlEnhanced = true;
        // Use ML prediction as primary signal
        finalSignal = mlPrediction.prediction;
        // Blend ML confidence with technical confidence
        finalConfidence = (mlPrediction.confidence * 0.7) + (finalConfidence * 0.3);
        // Update factors with ML prediction factors
        if (mlPrediction.factors) {
          factors = {
            technical: mlPrediction.factors.technical || factors.technical,
            sentiment: mlPrediction.factors.sentiment || factors.sentiment,
            pattern: mlPrediction.factors.pattern || factors.pattern
          };
        }
        logger.info(`ML-enhanced signal for ${pair}: ${finalSignal} (confidence: ${finalConfidence.toFixed(2)})`);
      }

      // Determine signal strength
      const signalStrength = this.determineSignalStrength(finalConfidence);

      // Calculate risk management parameters
      const riskParams = this.calculateRiskParameters(
        currentPrice,
        finalSignal,
        analysis.indicators,
        userPreferences.riskLevel || 5
      );

      // Determine market condition
      const marketCondition = this.determineMarketCondition(marketData.timeSeries);

      // Build trading signal
      const signal = {
        id: uuidv4(),
        userId: userId,
        pair: pair,
        timeframe: timeframe,
        signal: finalSignal,
        confidence: parseFloat(finalConfidence.toFixed(2)),
        factors: factors,
        mlEnhanced: mlEnhanced,
        entryPrice: currentPrice,
        stopLoss: riskParams.stopLoss,
        takeProfit: riskParams.takeProfit,
        riskRewardRatio: riskParams.riskRewardRatio,
        positionSize: riskParams.positionSize,
        source: mlEnhanced ? 'ml_enhanced' : 'technical_analysis',
        signalStrength: signalStrength,
        marketCondition: marketCondition,
        technicalData: {
          indicators: analysis.indicators,
          priceChange: analysis.priceChange
        },
        status: 'active',
        expiresAt: this.calculateExpiry(timeframe),
        timestamp: new Date().toISOString()
      };

      // Add risk warning
      signal.riskWarning = 'Trading forex carries significant risk. Never trade with money you cannot afford to lose.';

      logger.info(`Generated ${signal.signal} signal for ${pair} with ${confidence.toFixed(2)} confidence`);

      return signal;
    } catch (error) {
      logger.error(`Error generating signal for ${pair}:`, error);
      throw error;
    }
  }

  /**
   * Analyze multiple currency pairs and return signals
   * @param {string[]} pairs - Array of currency pairs
   * @param {Object} options - Options including timeframe, user preferences
   * @returns {Promise<Object[]>} - Array of trading signals
   */
  async analyzeMultiplePairs(pairs, options = {}) {
    try {
      const signals = [];

      for (const pair of pairs) {
        try {
          const signal = await this.generateSignal(pair, options);
          signals.push(signal);

          // Add delay to respect API rate limits
          await this.delay(1000);
        } catch (error) {
          logger.error(`Error analyzing ${pair}:`, error);
          signals.push({
            pair: pair,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }

      return signals;
    } catch (error) {
      logger.error('Error analyzing multiple pairs:', error);
      throw error;
    }
  }

  /**
   * Calculate confidence score based on indicators
   * @param {Object} indicators - Technical indicators
   * @param {Object} userPreferences - User preferences
   * @returns {number} - Confidence score (0.0-1.0)
   */
  calculateConfidence(indicators, userPreferences = {}) {
    let totalWeight = 0;
    let weightedSum = 0;

    // SMA contribution
    if (indicators.sma) {
      const smaWeight = userPreferences.indicators?.sma?.weight || 0.5;
      const smaScore = indicators.sma.signal === 'bullish' ? 0.8 :
                       indicators.sma.signal === 'bearish' ? 0.8 : 0.5;
      weightedSum += smaScore * smaWeight;
      totalWeight += smaWeight;
    }

    // RSI contribution
    if (indicators.rsi) {
      const rsiWeight = userPreferences.indicators?.rsi?.weight || 0.5;
      const rsiValue = indicators.rsi.value;
      let rsiScore;

      if (rsiValue >= 70 || rsiValue <= 30) {
        rsiScore = 0.85; // Strong signal in overbought/oversold
      } else if (rsiValue >= 60 || rsiValue <= 40) {
        rsiScore = 0.65; // Moderate signal
      } else {
        rsiScore = 0.5; // Neutral
      }

      weightedSum += rsiScore * rsiWeight;
      totalWeight += rsiWeight;
    }

    // Calculate final confidence
    const confidence = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

    // Ensure confidence is between 0 and 1
    return Math.max(0.0, Math.min(1.0, confidence));
  }

  /**
   * Calculate technical factor score
   * @param {Object} indicators - Technical indicators
   * @returns {number} - Technical factor (0.0-1.0)
   */
  calculateTechnicalFactor(indicators) {
    let bullishCount = 0;
    let bearishCount = 0;
    let totalIndicators = 0;

    if (indicators.sma) {
      totalIndicators++;
      if (indicators.sma.signal === 'bullish') bullishCount++;
      if (indicators.sma.signal === 'bearish') bearishCount++;
    }

    if (indicators.rsi) {
      totalIndicators++;
      if (indicators.rsi.signal === 'oversold') bullishCount++;
      if (indicators.rsi.signal === 'overbought') bearishCount++;
    }

    if (totalIndicators === 0) return 0.5;

    // Calculate factor: >0.5 is bullish, <0.5 is bearish, 0.5 is neutral
    return (bullishCount + (totalIndicators - bullishCount - bearishCount) * 0.5) / totalIndicators;
  }

  /**
   * Determine signal strength based on confidence
   * @param {number} confidence - Confidence score (0.0-1.0)
   * @returns {string} - Signal strength
   */
  determineSignalStrength(confidence) {
    if (confidence >= 0.85) return 'very_strong';
    if (confidence >= 0.75) return 'strong';
    if (confidence >= 0.60) return 'moderate';
    return 'weak';
  }

  /**
   * Calculate risk management parameters
   * @param {number} entryPrice - Entry price
   * @param {string} signal - Trading signal (buy/sell/hold)
   * @param {Object} indicators - Technical indicators
   * @param {number} riskLevel - User risk level (1-10)
   * @returns {Object} - Risk parameters
   */
  calculateRiskParameters(entryPrice, signal, indicators, riskLevel = 5) {
    // Risk percentage based on user risk level
    const riskPercent = riskLevel * 0.01; // 1% to 10%

    // Calculate stop loss and take profit based on signal
    let stopLoss, takeProfit, riskRewardRatio;

    if (signal === 'buy') {
      // For buy signals
      stopLoss = entryPrice * (1 - riskPercent);
      takeProfit = entryPrice * (1 + riskPercent * 2); // 2:1 risk-reward ratio
      riskRewardRatio = 2.0;
    } else if (signal === 'sell') {
      // For sell signals
      stopLoss = entryPrice * (1 + riskPercent);
      takeProfit = entryPrice * (1 - riskPercent * 2);
      riskRewardRatio = 2.0;
    } else {
      // Hold signal - no position
      stopLoss = null;
      takeProfit = null;
      riskRewardRatio = null;
    }

    // Calculate position size based on risk level
    const positionSize = Math.min(riskLevel * 5, 50); // Max 50% of account

    return {
      stopLoss: stopLoss ? parseFloat(stopLoss.toFixed(5)) : null,
      takeProfit: takeProfit ? parseFloat(takeProfit.toFixed(5)) : null,
      riskRewardRatio: riskRewardRatio,
      positionSize: positionSize
    };
  }

  /**
   * Determine market condition from price data
   * @param {Array} timeSeries - Historical price data
   * @returns {string} - Market condition
   */
  determineMarketCondition(timeSeries) {
    if (!timeSeries || timeSeries.length < 20) {
      return 'calm';
    }

    // Calculate price volatility
    const prices = timeSeries.slice(0, 20).map(candle => parseFloat(candle.close));
    const returns = [];

    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    // Calculate standard deviation of returns
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Determine if trending
    const firstPrice = prices[prices.length - 1];
    const lastPrice = prices[0];
    const trend = (lastPrice - firstPrice) / firstPrice;

    // Classify market condition
    if (stdDev > 0.02) {
      return 'volatile';
    } else if (Math.abs(trend) > 0.01) {
      return 'trending';
    } else if (stdDev < 0.005) {
      return 'calm';
    } else {
      return 'ranging';
    }
  }

  /**
   * Calculate signal expiry time based on timeframe
   * @param {string} timeframe - Signal timeframe
   * @returns {Date} - Expiry timestamp
   */
  calculateExpiry(timeframe) {
    const now = new Date();
    const expiryHours = {
      '1min': 0.25,
      '5min': 1,
      '15min': 3,
      '30min': 6,
      '1h': 12,
      '4h': 24,
      '1d': 48,
      '1w': 168,
      '1M': 720
    };

    const hours = expiryHours[timeframe] || 24;
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
  }

  /**
   * Map timeframe to forex service interval
   * @param {string} timeframe - Timeframe string
   * @returns {string} - Interval string for forex service
   */
  mapTimeframeToInterval(timeframe) {
    const mapping = {
      '1min': '1min',
      '5min': '5min',
      '15min': '15min',
      '30min': '30min',
      '1h': '60min',
      '4h': '60min', // Use hourly data for 4h
      '1d': 'daily',
      '1w': 'weekly',
      '1M': 'monthly'
    };

    return mapping[timeframe] || '60min';
  }

  /**
   * Helper function to add delay
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get ML prediction from ML Engine API
   * @param {string} pair - Currency pair
   * @param {string} timeframe - Timeframe
   * @param {Object} marketData - Market data object
   * @returns {Promise<Object|null>} - ML prediction result or null if ML is disabled/failed
   */
  async getMLPrediction(pair, timeframe, marketData) {
    if (!process.env.ML_API_ENABLED || process.env.ML_API_ENABLED === 'false') {
      logger.debug('ML API is disabled');
      return null;
    }

    try {
      logger.info(`Requesting ML prediction for ${pair} from ${process.env.ML_API_URL}`);

      // Convert market data to ML API format
      const mlData = marketData.timeSeries.map(candle => ({
        timestamp: candle.timestamp || new Date().toISOString(),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume || 0)
      }));

      const response = await axios.post(`${process.env.ML_API_URL}/predict`, {
        pair: pair,
        timeframe: timeframe,
        data: mlData,
        add_indicators: true
      }, {
        timeout: 10000 // 10 second timeout
      });

      if (response.data && response.data.success) {
        logger.info(`ML prediction received for ${pair}: ${response.data.data.prediction}`);
        return response.data.data;
      } else {
        logger.warn(`ML prediction failed for ${pair}: ${response.data?.error || 'Unknown error'}`);
        return null;
      }
    } catch (error) {
      logger.error('ML prediction failed:', error.message);
      return null;
    }
  }

  /**
   * Get signal history for a user
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object[]>} - Array of historical signals
   */
  async getSignalHistory(userId, filters = {}) {
    try {
      // This would query the database in a real implementation
      // For now, return a placeholder
      logger.info(`Fetching signal history for user ${userId}`);

      // TODO: Implement database query when models are available
      return [];
    } catch (error) {
      logger.error('Error fetching signal history:', error);
      throw error;
    }
  }

  /**
   * Validate trading signal parameters
   * @param {string} pair - Currency pair
   * @param {string} timeframe - Timeframe
   * @throws {Error} - Validation error
   */
  validateSignalParams(pair, timeframe) {
    const validTimeframes = ['1min', '5min', '15min', '30min', '1h', '4h', '1d', '1w', '1M'];
    const pairRegex = /^[A-Z]{3}\/[A-Z]{3}$/;

    if (!pairRegex.test(pair)) {
      throw new Error('Invalid currency pair format. Expected format: XXX/XXX');
    }

    if (!validTimeframes.includes(timeframe)) {
      throw new Error(`Invalid timeframe. Valid options: ${validTimeframes.join(', ')}`);
    }
  }
}

module.exports = new TradingSignalService();