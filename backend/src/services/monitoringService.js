const logger = require('../utils/logger');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { PositionMonitoring, UserTradingHistory, UserPreferences } = require('../models');
const forexService = require('./forexService');
const positionService = require('./positionService');

/**
 * Position Monitoring Service
 * Continuous monitoring of open positions with ML-powered analysis
 * Part of Phase 3: Trading Lifecycle Management v3.0
 */
class MonitoringService {
  constructor() {
    this.ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  /**
   * Start the monitoring service (runs every minute)
   */
  startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Monitoring service already running');
      return;
    }

    logger.info('Starting position monitoring service');
    this.isMonitoring = true;

    // Run immediately
    this.monitorAllPositions();

    // Then run every minute
    this.monitoringInterval = setInterval(() => {
      this.monitorAllPositions();
    }, 60 * 1000); // 60 seconds
  }

  /**
   * Stop the monitoring service
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      logger.warn('Monitoring service not running');
      return;
    }

    logger.info('Stopping position monitoring service');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Monitor all open positions (called by monitoring loop)
   */
  async monitorAllPositions() {
    const startTime = Date.now();

    try {
      logger.info('📊 Monitoring cycle started');

      // 1. Get all open positions
      const positions = await UserTradingHistory.findAll({
        where: { status: 'open' },
        order: [['openedAt', 'DESC']],
      });

      if (positions.length === 0) {
        logger.info('No open positions to monitor');
        return {
          success: true,
          positionsMonitored: 0,
          duration: Date.now() - startTime,
        };
      }

      logger.info(`Found ${positions.length} open positions to monitor`);

      // 2. Process positions in parallel (batches of 10 to avoid overwhelming APIs)
      const batchSize = 10;
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < positions.length; i += batchSize) {
        const batch = positions.slice(i, i + batchSize);
        logger.debug(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(positions.length / batchSize)} (${batch.length} positions)`);

        // Process batch in parallel
        const batchResults = await Promise.allSettled(
          batch.map(position => this.monitorPosition(position))
        );

        // Count successes and errors
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value !== null) {
            successCount++;
            results.push(result.value);
          } else {
            errorCount++;
            const position = batch[index];
            logger.warn(`Failed to monitor position ${position.id}: ${result.reason || 'Unknown error'}`);
          }
        });

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < positions.length) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
      }

      const duration = Date.now() - startTime;
      const avgTimePerPosition = positions.length > 0 ? duration / positions.length : 0;

      logger.info(
        `✅ Monitoring cycle completed: ${successCount} success, ${errorCount} errors, ${duration}ms total (${avgTimePerPosition.toFixed(0)}ms/position)`
      );

      return {
        success: true,
        positionsMonitored: successCount,
        positionsFailed: errorCount,
        totalPositions: positions.length,
        duration,
        avgTimePerPosition: Math.round(avgTimePerPosition),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Error in monitoring cycle (${duration}ms): ${error.message}`);

      return {
        success: false,
        error: error.message,
        duration,
      };
    }
  }

  /**
   * Monitor a single position
   * @param {Object} position - Position data from user_trading_history
   * @returns {Promise<Object>} - Monitoring record
   */
  async monitorPosition(position) {
    try {
      logger.debug(`Monitoring position ${position.id}: ${position.pair} ${position.action} @ ${position.entryPrice}`);

      // 1. Get current market price
      const quote = await forexService.getQuote(position.pair);
      const currentPrice = parseFloat(quote.data.price);

      // 2. Calculate unrealized P&L
      const pnlData = this._calculateUnrealizedPnL(position, currentPrice);

      // 3. Calculate risk-reward distances
      const rrData = this.calculateRiskReward(
        currentPrice,
        position.action,
        position.stopLoss,
        position.takeProfit
      );

      // 4. Call ML API for position analysis
      const mlAnalysis = await this.analyzePositionWithML(
        position,
        currentPrice,
        pnlData.pnlPercentage
      );

      // 5. Check if trailing stop should be applied
      const trailingStopData = await this._checkTrailingStop(position, currentPrice, pnlData);

      // 6. Determine notification level
      const notificationDecision = await this.shouldNotify(position, mlAnalysis, {});

      // 7. Prepare monitoring data
      const monitoringData = {
        currentPrice,
        unrealizedPnlPips: pnlData.pnlPips,
        unrealizedPnlPercentage: pnlData.pnlPercentage,
        trendDirection: mlAnalysis.trend_direction,
        trendStrength: mlAnalysis.trend_strength,
        reversalProbability: mlAnalysis.reversal_probability,
        currentRisk: rrData.riskDistance,
        currentReward: rrData.rewardDistance,
        currentRrRatio: rrData.rrRatio,
        recommendation: mlAnalysis.recommendation,
        recommendationConfidence: mlAnalysis.confidence,
        reasoning: mlAnalysis.reasoning,
        notificationLevel: notificationDecision.level,
      };

      // 8. Record monitoring data to database
      const record = await this.recordMonitoring(position.id, monitoringData);

      // 9. Send notification if needed
      if (notificationDecision.shouldNotify) {
        await this.sendNotification(
          position.userId,
          position,
          record,
          notificationDecision.level
        );
      }

      // 10. Apply trailing stop if triggered
      if (trailingStopData.shouldAdjust) {
        await this._applyTrailingStop(position, trailingStopData);
      }

      logger.debug(`Position ${position.id} monitored: ${mlAnalysis.recommendation} (PnL: ${pnlData.pnlPercentage.toFixed(2)}%)`);

      return record;
    } catch (error) {
      logger.error(`Error monitoring position ${position.id}: ${error.message}`);
      // Don't throw - we want monitoring to continue for other positions
      return null;
    }
  }

  /**
   * Calculate unrealized P&L for a position
   * @private
   * @param {Object} position - Position data
   * @param {number} currentPrice - Current market price
   * @returns {Object} - { pnlPips, pnlPercentage }
   */
  _calculateUnrealizedPnL(position, currentPrice) {
    const entryPrice = parseFloat(position.entryPrice);
    let pnlPips = 0;
    let pnlPercentage = 0;

    if (position.action === 'buy') {
      // Long position: profit if price goes up
      pnlPips = (currentPrice - entryPrice) * 10000; // Convert to pips (4 decimal places)
      pnlPercentage = ((currentPrice - entryPrice) / entryPrice) * 100;
    } else if (position.action === 'sell') {
      // Short position: profit if price goes down
      pnlPips = (entryPrice - currentPrice) * 10000; // Convert to pips
      pnlPercentage = ((entryPrice - currentPrice) / entryPrice) * 100;
    }

    return {
      pnlPips: parseFloat(pnlPips.toFixed(2)),
      pnlPercentage: parseFloat(pnlPercentage.toFixed(4)),
    };
  }

  /**
   * Analyze position using ML API v3.0
   * @param {Object} position - Position data
   * @param {number} currentPrice - Current market price
   * @param {number} unrealizedPnlPercentage - Unrealized P&L percentage
   * @returns {Promise<Object>} - ML analysis result
   */
  async analyzePositionWithML(position, currentPrice, unrealizedPnlPercentage) {
    try {
      const holdingDuration = this.calculateHoldingDuration(position.openedAt);

      const requestData = {
        pair: position.pair,
        direction: position.action,
        entry_price: parseFloat(position.entryPrice),
        current_price: currentPrice,
        holding_duration: holdingDuration, // in minutes
        unrealized_pnl: unrealizedPnlPercentage,
        stop_loss: position.stopLoss ? parseFloat(position.stopLoss) : null,
        take_profit: position.takeProfit ? parseFloat(position.takeProfit) : null,
      };

      logger.debug(`Calling ML API v3.0 /analyze_position for ${position.pair} (holding: ${holdingDuration}m, PnL: ${unrealizedPnlPercentage}%)`);

      // TODO: Implement actual ML API call when ML v3.0 is ready
      // const response = await axios.post(
      //   `${this.ML_API_URL}/api/ml/v3/analyze_position`,
      //   requestData,
      //   { timeout: 5000 }
      // );
      // return response.data;

      // Mock response with intelligent simulation based on position state
      const mockAnalysis = this._generateMockAnalysis(position, currentPrice, unrealizedPnlPercentage, holdingDuration);
      return mockAnalysis;
    } catch (error) {
      logger.error(`ML API error for position ${position.id}: ${error.message}`);
      // Return fallback analysis if ML API fails
      return this.getFallbackAnalysis(position, currentPrice, unrealizedPnlPercentage);
    }
  }

  /**
   * Generate mock ML analysis (temporary until ML v3.0 is ready)
   * @private
   * @param {Object} position - Position data
   * @param {number} currentPrice - Current market price
   * @param {number} unrealizedPnlPercentage - Unrealized P&L percentage
   * @param {number} holdingDuration - Holding duration in minutes
   * @returns {Object} - Mock ML analysis
   */
  _generateMockAnalysis(position, currentPrice, unrealizedPnlPercentage, holdingDuration) {
    // Simulate intelligent ML analysis based on position state
    let recommendation = 'hold';
    let confidence = 0.65;
    let trendDirection = 'sideways';
    let trendStrength = 0.55;
    let reversalProbability = 0.30;
    let reasoning = 'Position is being monitored. ';

    // Check if position is profitable
    if (unrealizedPnlPercentage > 0.5) {
      trendDirection = position.action === 'buy' ? 'uptrend' : 'downtrend';
      trendStrength = 0.65 + Math.min(unrealizedPnlPercentage * 0.05, 0.15);
      reasoning += `Position is profitable (+${unrealizedPnlPercentage.toFixed(2)}%). `;

      // If very profitable (>1.5%), suggest partial exit
      if (unrealizedPnlPercentage > 1.5) {
        recommendation = 'take_partial';
        confidence = 0.75;
        reversalProbability = 0.45;
        reasoning += 'Strong profit achieved. Consider taking partial profits to secure gains.';
      } else {
        reasoning += 'Trend remains favorable. Continue holding.';
      }
    } else if (unrealizedPnlPercentage < -0.5) {
      // Position is losing
      reversalProbability = 0.55;
      trendDirection = position.action === 'buy' ? 'downtrend' : 'uptrend';
      reasoning += `Position is losing (${unrealizedPnlPercentage.toFixed(2)}%). `;

      // If significant loss (>-1.5%), suggest exit
      if (unrealizedPnlPercentage < -1.5) {
        recommendation = 'exit';
        confidence = 0.70;
        reversalProbability = 0.65;
        reasoning += 'Trend has reversed against position. Consider exiting to limit losses.';
      } else {
        reasoning += 'Monitor closely for further deterioration.';
      }
    } else {
      // Position is neutral
      reasoning += 'Position near breakeven. Wait for clearer trend.';
    }

    // Check holding duration
    if (holdingDuration > 1440) { // >24 hours
      reasoning += ` Position held for ${Math.floor(holdingDuration / 60)} hours with minimal progress.`;
      if (Math.abs(unrealizedPnlPercentage) < 0.3) {
        recommendation = 'exit';
        confidence = 0.60;
        reasoning += ' Consider closing due to lack of movement.';
      }
    }

    // Check if near stop loss or take profit
    const rrData = this.calculateRiskReward(
      currentPrice,
      position.action,
      position.stopLoss,
      position.takeProfit
    );

    return {
      trend_direction: trendDirection,
      trend_strength: parseFloat(trendStrength.toFixed(4)),
      reversal_probability: parseFloat(reversalProbability.toFixed(4)),
      current_rr_ratio: rrData.rrRatio,
      recommendation: recommendation,
      confidence: parseFloat(confidence.toFixed(4)),
      reasoning: reasoning,
      suggested_exit_percentage: recommendation === 'take_partial' ? 50 : null,
      suggested_new_sl: null,
      suggested_new_tp: null,
    };
  }

  /**
   * Fallback analysis if ML API is unavailable
   * @param {Object} position - Position data
   * @param {number} currentPrice - Current market price
   * @param {number} unrealizedPnl - Unrealized P&L percentage
   * @returns {Object} - Basic analysis
   */
  getFallbackAnalysis(position, currentPrice, unrealizedPnl) {
    // TODO: Implement rule-based fallback analysis
    //   - Check if stop loss or take profit hit
    //   - Check if holding too long (>24h with no progress)
    //   - Basic trend detection
    // TODO: Return analysis in same format as ML API

    return {
      trend_direction: 'unknown',
      trend_strength: 0.5,
      reversal_probability: 0.5,
      current_rr_ratio: 0,
      recommendation: 'hold',
      confidence: 0.3,
      reasoning: 'ML API unavailable. Using fallback analysis.',
      suggested_exit_percentage: null,
      suggested_new_sl: null,
      suggested_new_tp: null,
    };
  }

  /**
   * Record monitoring data to position_monitoring table
   * @param {string} positionId - Position ID
   * @param {Object} monitoringData - Monitoring data from ML analysis
   * @returns {Promise<Object>} - Created monitoring record
   */
  async recordMonitoring(positionId, monitoringData) {
    try {
      const {
        currentPrice,
        unrealizedPnlPips,
        unrealizedPnlPercentage,
        trendDirection,
        trendStrength,
        reversalProbability,
        currentRisk,
        currentReward,
        currentRrRatio,
        recommendation,
        recommendationConfidence,
        reasoning,
        notificationLevel,
      } = monitoringData;

      // Create monitoring record
      const record = await PositionMonitoring.create({
        positionId,
        timestamp: new Date(),
        currentPrice: parseFloat(currentPrice),
        unrealizedPnlPips: unrealizedPnlPips ? parseFloat(unrealizedPnlPips) : null,
        unrealizedPnlPercentage: unrealizedPnlPercentage ? parseFloat(unrealizedPnlPercentage) : null,
        trendDirection: trendDirection || 'unknown',
        trendStrength: trendStrength ? parseFloat(trendStrength) : null,
        reversalProbability: reversalProbability ? parseFloat(reversalProbability) : null,
        currentRisk: currentRisk ? parseFloat(currentRisk) : null,
        currentReward: currentReward ? parseFloat(currentReward) : null,
        currentRrRatio: currentRrRatio ? parseFloat(currentRrRatio) : null,
        recommendation: recommendation || 'hold',
        recommendationConfidence: recommendationConfidence ? parseFloat(recommendationConfidence) : null,
        reasoning: reasoning || null,
        notificationSent: false, // Initially not sent
        notificationLevel: notificationLevel || null,
      });

      logger.debug(`Monitoring record created for position ${positionId}: ${recommendation} (confidence: ${recommendationConfidence})`);

      return record.toJSON();
    } catch (error) {
      logger.error(`Error recording monitoring data for position ${positionId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get monitoring history for a position
   * @param {string} positionId - Position ID
   * @param {Object} options - Query options
   * @param {number} options.limit - Limit records (default: 100)
   * @param {Date} options.startDate - Filter by timestamp >= startDate (optional)
   * @param {Date} options.endDate - Filter by timestamp <= endDate (optional)
   * @returns {Promise<Array>} - Array of monitoring records
   */
  async getMonitoringHistory(positionId, options = {}) {
    try {
      const { limit = 100, startDate = null, endDate = null } = options;

      // TODO: Query position_monitoring table
      // TODO: Filter by positionId and date range
      // TODO: Order by timestamp DESC
      // TODO: Return records

      throw new Error('Not implemented');
    } catch (error) {
      logger.error(`Error fetching monitoring history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if notification should be sent based on 4-level urgency system
   * @param {Object} position - Position data
   * @param {Object} analysis - ML analysis result
   * @param {Object} userPreferences - User notification preferences
   * @returns {Promise<Object>} - { shouldNotify: boolean, level: number, reason: string }
   */
  async shouldNotify(position, analysis, userPreferences) {
    try {
      const { recommendation, confidence, reversal_probability } = analysis;
      const {
        urgencyThreshold = 2,
        level2Cooldown = 5,
        level3Cooldown = 30,
        muteHours = [],
      } = userPreferences.notification_settings || {};

      let level = 0;
      let reason = '';

      // Determine notification level based on recommendation and confidence

      // Level 1 (Critical/Urgent): Immediate action required
      if (
        recommendation === 'exit' && confidence >= 0.70 &&
        (reversal_probability >= 0.65 || Math.abs(analysis.unrealized_pnl || 0) < -1.5)
      ) {
        level = 1;
        reason = 'Critical exit recommendation with high confidence';
      }

      // Level 2 (Important): High-confidence actionable recommendations
      else if (
        (recommendation === 'take_partial' && confidence >= 0.70) ||
        (recommendation === 'exit' && confidence >= 0.60) ||
        (reversal_probability >= 0.60)
      ) {
        level = 2;
        reason = recommendation === 'take_partial'
          ? 'Partial profit-taking recommendation'
          : 'Exit recommendation or trend reversal detected';
      }

      // Level 3 (General): Informational updates
      else if (
        (recommendation === 'adjust_sl' || recommendation === 'trailing_stop') ||
        (confidence >= 0.50 && recommendation !== 'hold')
      ) {
        level = 3;
        reason = 'Position adjustment suggestion';
      }

      // Level 4 (Daily summary): Not handled in real-time monitoring
      // This is for scheduled daily summaries

      // If level is 0 or below threshold, don't notify
      if (level === 0 || level > urgencyThreshold) {
        return {
          shouldNotify: false,
          level,
          reason: level === 0 ? 'No actionable recommendation' : 'Below user urgency threshold',
        };
      }

      // Check cooldown for levels 2 and 3
      if (level === 2 || level === 3) {
        const cooldownMinutes = level === 2 ? level2Cooldown : level3Cooldown;
        const lastNotification = await this._getLastNotification(position.id, level);

        if (lastNotification) {
          const minutesSinceLastNotification = (Date.now() - new Date(lastNotification.timestamp).getTime()) / (1000 * 60);

          if (minutesSinceLastNotification < cooldownMinutes) {
            return {
              shouldNotify: false,
              level,
              reason: `Cooldown active (${Math.ceil(cooldownMinutes - minutesSinceLastNotification)}m remaining)`,
            };
          }
        }
      }

      // Check mute hours (skip for Level 1 - critical notifications)
      if (level > 1 && muteHours.length > 0) {
        const currentHour = new Date().getHours();
        const isMuted = muteHours.some(range => {
          const [start, end] = range.split('-').map(h => parseInt(h));
          return currentHour >= start && currentHour < end;
        });

        if (isMuted) {
          return {
            shouldNotify: false,
            level,
            reason: 'Mute hours active',
          };
        }
      }

      // All checks passed - send notification
      return {
        shouldNotify: true,
        level,
        reason,
      };
    } catch (error) {
      logger.error(`Error checking notification: ${error.message}`);
      return { shouldNotify: false, level: 0, reason: 'Error checking notification' };
    }
  }

  /**
   * Get last notification for a position at a specific level
   * @private
   * @param {string} positionId - Position ID
   * @param {number} level - Notification level
   * @returns {Promise<Object|null>} - Last notification record
   */
  async _getLastNotification(positionId, level) {
    try {
      const record = await PositionMonitoring.findOne({
        where: {
          positionId,
          notificationSent: true,
          notificationLevel: level,
        },
        order: [['timestamp', 'DESC']],
      });

      return record;
    } catch (error) {
      logger.error(`Error fetching last notification: ${error.message}`);
      return null;
    }
  }

  /**
   * Send notification to user about position update
   * @param {string} userId - User ID
   * @param {Object} position - Position data
   * @param {Object} monitoringData - Monitoring data
   * @param {number} level - Notification level (1-4)
   */
  async sendNotification(userId, position, monitoringData, level) {
    try {
      logger.info(`📨 Sending level ${level} notification to user ${userId} for position ${position.id}`);

      // Format notification message based on level and monitoring data
      const message = this._formatNotificationMessage(position, monitoringData, level);

      // TODO: Implement actual notification sending when notification service is ready
      // For now, just log the notification
      logger.info(`[NOTIFICATION Level ${level}] User ${userId}: ${message.title}`);
      logger.debug(`Notification details: ${JSON.stringify(message, null, 2)}`);

      // Update monitoring record to mark notification as sent
      if (monitoringData.id) {
        await PositionMonitoring.update(
          { notificationSent: true },
          { where: { id: monitoringData.id } }
        );
      }

      return {
        success: true,
        level,
        message,
      };
    } catch (error) {
      logger.error(`Error sending notification: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Format notification message
   * @private
   * @param {Object} position - Position data
   * @param {Object} monitoringData - Monitoring data
   * @param {number} level - Notification level
   * @returns {Object} - Formatted message
   */
  _formatNotificationMessage(position, monitoringData, level) {
    const { pair, action, entryPrice } = position;
    const {
      currentPrice,
      unrealizedPnlPips,
      unrealizedPnlPercentage,
      recommendation,
      recommendationConfidence,
      reasoning,
      reversalProbability,
      trendStrength,
    } = monitoringData;

    const levelEmoji = ['🚨', '⚠️', 'ℹ️', '📊'][level - 1] || 'ℹ️';
    const pnlEmoji = unrealizedPnlPercentage > 0 ? '💚' : unrealizedPnlPercentage < 0 ? '🔴' : '⚪';

    let title = '';
    let priority = '';

    switch (level) {
      case 1:
        title = `${levelEmoji} CRITICAL: ${pair} Position Alert`;
        priority = 'URGENT';
        break;
      case 2:
        title = `${levelEmoji} IMPORTANT: ${pair} Action Recommended`;
        priority = 'HIGH';
        break;
      case 3:
        title = `${levelEmoji} ${pair} Position Update`;
        priority = 'NORMAL';
        break;
      default:
        title = `${levelEmoji} ${pair} Summary`;
        priority = 'LOW';
    }

    return {
      title,
      priority,
      pair,
      position: {
        action: action.toUpperCase(),
        entryPrice,
        currentPrice,
        unrealizedPnl: `${unrealizedPnlPips > 0 ? '+' : ''}${unrealizedPnlPips.toFixed(1)} pips (${unrealizedPnlPercentage > 0 ? '+' : ''}${unrealizedPnlPercentage.toFixed(2)}%)`,
        emoji: pnlEmoji,
      },
      analysis: {
        recommendation: recommendation.toUpperCase(),
        confidence: `${(recommendationConfidence * 100).toFixed(0)}%`,
        reversalProbability: reversalProbability ? `${(reversalProbability * 100).toFixed(0)}%` : 'N/A',
        trendStrength: trendStrength ? `${(trendStrength * 100).toFixed(0)}%` : 'N/A',
        reasoning,
      },
      riskWarning:
        '⚠️ Risk Warning: Forex trading carries significant risk. Past performance does not guarantee future results. This is not financial advice.',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if trailing stop should be applied
   * @private
   * @param {Object} position - Position data
   * @param {number} currentPrice - Current market price
   * @param {Object} pnlData - P&L data
   * @returns {Promise<Object>} - { shouldAdjust: boolean, newStopLoss: number, reason: string }
   */
  async _checkTrailingStop(position, currentPrice, pnlData) {
    try {
      // Skip if no take profit set
      if (!position.takeProfit || !position.stopLoss) {
        return { shouldAdjust: false, reason: 'No TP/SL set' };
      }

      const entryPrice = parseFloat(position.entryPrice);
      const takeProfit = parseFloat(position.takeProfit);
      const stopLoss = parseFloat(position.stopLoss);

      // Calculate progress towards take profit
      let distanceToTP = 0;
      let progressPercentage = 0;

      if (position.action === 'buy') {
        const totalDistance = takeProfit - entryPrice;
        const currentDistance = currentPrice - entryPrice;
        progressPercentage = (currentDistance / totalDistance) * 100;
      } else if (position.action === 'sell') {
        const totalDistance = entryPrice - takeProfit;
        const currentDistance = entryPrice - currentPrice;
        progressPercentage = (currentDistance / totalDistance) * 100;
      }

      // Rule 1: If profit >= 50% of TP distance, move SL to breakeven (entry price)
      if (progressPercentage >= 50 && progressPercentage < 80) {
        // Check if SL is not already at or better than breakeven
        const currentSLAtBreakeven =
          (position.action === 'buy' && stopLoss >= entryPrice) ||
          (position.action === 'sell' && stopLoss <= entryPrice);

        if (!currentSLAtBreakeven) {
          return {
            shouldAdjust: true,
            newStopLoss: entryPrice,
            reason: `Profit reached 50% of TP (${progressPercentage.toFixed(1)}%). Moving SL to breakeven.`,
            type: 'breakeven',
          };
        }
      }

      // Rule 2: If profit >= 80% of TP distance, move SL to 50% TP level
      if (progressPercentage >= 80) {
        const fiftyPercentTP =
          position.action === 'buy'
            ? entryPrice + (takeProfit - entryPrice) * 0.5
            : entryPrice - (entryPrice - takeProfit) * 0.5;

        // Check if SL is not already at or better than 50% TP
        const currentSLAtFiftyPercent =
          (position.action === 'buy' && stopLoss >= fiftyPercentTP) ||
          (position.action === 'sell' && stopLoss <= fiftyPercentTP);

        if (!currentSLAtFiftyPercent) {
          return {
            shouldAdjust: true,
            newStopLoss: fiftyPercentTP,
            reason: `Profit reached 80% of TP (${progressPercentage.toFixed(1)}%). Moving SL to 50% TP level.`,
            type: '50percent_tp',
          };
        }
      }

      return { shouldAdjust: false, reason: 'No trailing stop trigger' };
    } catch (error) {
      logger.error(`Error checking trailing stop: ${error.message}`);
      return { shouldAdjust: false, reason: 'Error' };
    }
  }

  /**
   * Apply trailing stop adjustment
   * @private
   * @param {Object} position - Position data
   * @param {Object} trailingStopData - Trailing stop data
   */
  async _applyTrailingStop(position, trailingStopData) {
    try {
      const { newStopLoss, reason, type } = trailingStopData;

      logger.info(`🛡️ Applying trailing stop for position ${position.id}: ${reason}`);

      // Update position stop loss
      await positionService.adjustPosition(position.id, {
        stopLoss: newStopLoss,
      });

      // Log the adjustment
      logger.info(
        `✅ Trailing stop applied: ${position.pair} SL updated to ${newStopLoss} (type: ${type})`
      );

      return {
        success: true,
        newStopLoss,
        type,
      };
    } catch (error) {
      logger.error(`Error applying trailing stop: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Calculate holding duration in minutes
   * @param {Date} openedAt - Position opened timestamp
   * @returns {number} - Duration in minutes
   */
  calculateHoldingDuration(openedAt) {
    const now = new Date();
    const opened = new Date(openedAt);
    const diffMs = now - opened;
    return Math.floor(diffMs / (1000 * 60)); // Convert to minutes
  }

  /**
   * Calculate distance to stop loss and take profit
   * @param {number} currentPrice - Current market price
   * @param {string} action - Position direction: 'buy' or 'sell'
   * @param {number} stopLoss - Stop loss price
   * @param {number} takeProfit - Take profit price
   * @returns {Object} - { riskDistance, rewardDistance, rrRatio }
   */
  calculateRiskReward(currentPrice, action, stopLoss, takeProfit) {
    try {
      let riskDistance = 0;
      let rewardDistance = 0;
      let rrRatio = 0;

      if (action === 'buy') {
        // For long positions:
        // Risk = current price - stop loss (how much we can lose)
        // Reward = take profit - current price (how much we can gain)
        if (stopLoss) {
          riskDistance = Math.abs(currentPrice - stopLoss);
        }
        if (takeProfit) {
          rewardDistance = Math.abs(takeProfit - currentPrice);
        }
      } else if (action === 'sell') {
        // For short positions:
        // Risk = stop loss - current price (how much we can lose)
        // Reward = current price - take profit (how much we can gain)
        if (stopLoss) {
          riskDistance = Math.abs(stopLoss - currentPrice);
        }
        if (takeProfit) {
          rewardDistance = Math.abs(currentPrice - takeProfit);
        }
      }

      // Calculate RR ratio (reward / risk)
      if (riskDistance > 0 && rewardDistance > 0) {
        rrRatio = rewardDistance / riskDistance;
      }

      return {
        riskDistance: parseFloat(riskDistance.toFixed(5)),
        rewardDistance: parseFloat(rewardDistance.toFixed(5)),
        rrRatio: parseFloat(rrRatio.toFixed(2)),
      };
    } catch (error) {
      logger.error(`Error calculating risk-reward: ${error.message}`);
      return { riskDistance: 0, rewardDistance: 0, rrRatio: 0 };
    }
  }

  /**
   * Get monitoring service status
   * @returns {Object} - Status info
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      uptime: this.isMonitoring ? process.uptime() : 0,
      mlApiUrl: this.ML_API_URL,
    };
  }
}

module.exports = new MonitoringService();
