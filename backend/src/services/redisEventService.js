/**
 * Redis Event Service
 * Provides pub/sub event system for continuous learning
 *
 * Events:
 * - new_market_data: New market data received
 * - new_prediction: New ML prediction generated
 * - signal_outcome: Trading signal outcome confirmed
 * - training_started: ML training started
 * - training_completed: ML training completed
 * - model_deployed: New model version deployed
 */

const redis = require('redis');
const logger = require('../utils/logger');

/**
 * Event channel names
 */
const CHANNELS = {
  NEW_MARKET_DATA: 'ml:new_market_data',
  NEW_PREDICTION: 'ml:new_prediction',
  SIGNAL_OUTCOME: 'ml:signal_outcome',
  TRAINING_STARTED: 'ml:training_started',
  TRAINING_COMPLETED: 'ml:training_completed',
  MODEL_DEPLOYED: 'ml:model_deployed',
  AB_TEST_CREATED: 'ml:ab_test_created',
  AB_TEST_COMPLETED: 'ml:ab_test_completed'
};

/**
 * Redis publisher client
 */
let publisherClient = null;

/**
 * Redis subscriber client
 */
let subscriberClient = null;

/**
 * Event handlers registry
 */
const eventHandlers = {};

/**
 * Initialize Redis event service
 *
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    if (publisherClient && subscriberClient) {
      logger.info('⚠️ Redis event service already initialized');
      return;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // Create publisher client
    publisherClient = redis.createClient({ url: redisUrl });
    publisherClient.on('error', (err) => {
      logger.error('❌ Redis publisher error:', err);
    });
    await publisherClient.connect();
    logger.info('✅ Redis publisher connected');

    // Create subscriber client
    subscriberClient = redis.createClient({ url: redisUrl });
    subscriberClient.on('error', (err) => {
      logger.error('❌ Redis subscriber error:', err);
    });
    await subscriberClient.connect();
    logger.info('✅ Redis subscriber connected');

    logger.info('✅ Redis event service initialized');

  } catch (error) {
    logger.error('❌ Failed to initialize Redis event service:', error);
    throw error;
  }
}

/**
 * Publish an event
 *
 * @param {string} channel - Event channel name
 * @param {object} data - Event data
 * @returns {Promise<number>} Number of subscribers that received the message
 */
async function publish(channel, data) {
  try {
    if (!publisherClient) {
      logger.warn('⚠️ Redis publisher not initialized, event not published');
      return 0;
    }

    const message = JSON.stringify({
      timestamp: new Date().toISOString(),
      channel,
      data
    });

    const subscriberCount = await publisherClient.publish(channel, message);

    logger.debug(`📢 Published event to ${channel}`, {
      subscriberCount,
      data
    });

    return subscriberCount;

  } catch (error) {
    logger.error(`❌ Failed to publish event to ${channel}:`, error);
    throw error;
  }
}

/**
 * Subscribe to an event channel
 *
 * @param {string} channel - Event channel name
 * @param {function} handler - Event handler function
 * @returns {Promise<void>}
 */
async function subscribe(channel, handler) {
  try {
    if (!subscriberClient) {
      throw new Error('Redis subscriber not initialized');
    }

    // Register handler
    if (!eventHandlers[channel]) {
      eventHandlers[channel] = [];
    }
    eventHandlers[channel].push(handler);

    // Subscribe to channel
    await subscriberClient.subscribe(channel, (message) => {
      try {
        const event = JSON.parse(message);
        logger.debug(`📥 Received event from ${channel}`, event);

        // Call all registered handlers for this channel
        if (eventHandlers[channel]) {
          eventHandlers[channel].forEach(h => {
            try {
              h(event);
            } catch (handlerError) {
              logger.error(`❌ Event handler error for ${channel}:`, handlerError);
            }
          });
        }

      } catch (error) {
        logger.error(`❌ Failed to process event from ${channel}:`, error);
      }
    });

    logger.info(`✅ Subscribed to channel: ${channel}`);

  } catch (error) {
    logger.error(`❌ Failed to subscribe to ${channel}:`, error);
    throw error;
  }
}

/**
 * Unsubscribe from an event channel
 *
 * @param {string} channel - Event channel name
 * @returns {Promise<void>}
 */
async function unsubscribe(channel) {
  try {
    if (!subscriberClient) {
      return;
    }

    await subscriberClient.unsubscribe(channel);
    delete eventHandlers[channel];

    logger.info(`✅ Unsubscribed from channel: ${channel}`);

  } catch (error) {
    logger.error(`❌ Failed to unsubscribe from ${channel}:`, error);
    throw error;
  }
}

/**
 * Publish new market data event
 *
 * @param {object} marketData - Market data object
 * @returns {Promise<number>} Subscriber count
 */
async function publishNewMarketData(marketData) {
  return await publish(CHANNELS.NEW_MARKET_DATA, {
    pair: marketData.pair,
    timeframe: marketData.timeframe,
    timestamp: marketData.timestamp,
    close: marketData.close,
    volume: marketData.volume
  });
}

/**
 * Publish new prediction event
 *
 * @param {object} prediction - Prediction object
 * @returns {Promise<number>} Subscriber count
 */
async function publishNewPrediction(prediction) {
  return await publish(CHANNELS.NEW_PREDICTION, {
    signalId: prediction.id,
    pair: prediction.pair,
    timeframe: prediction.timeframe,
    signal: prediction.signal,
    confidence: prediction.confidence,
    modelVersion: prediction.modelVersion || null
  });
}

/**
 * Publish signal outcome event
 *
 * @param {object} signal - Trading signal with outcome
 * @returns {Promise<number>} Subscriber count
 */
async function publishSignalOutcome(signal) {
  return await publish(CHANNELS.SIGNAL_OUTCOME, {
    signalId: signal.id,
    pair: signal.pair,
    timeframe: signal.timeframe,
    signal: signal.signal,
    outcome: signal.actualOutcome,
    pnlPercent: signal.actualPnLPercent,
    confidence: signal.confidence
  });
}

/**
 * Publish training started event
 *
 * @param {object} trainingInfo - Training information
 * @returns {Promise<number>} Subscriber count
 */
async function publishTrainingStarted(trainingInfo) {
  return await publish(CHANNELS.TRAINING_STARTED, {
    trainingLogId: trainingInfo.id,
    trainingType: trainingInfo.trainingType,
    modelType: trainingInfo.modelType,
    datasetSize: trainingInfo.datasetSize,
    startedAt: new Date().toISOString()
  });
}

/**
 * Publish training completed event
 *
 * @param {object} trainingResult - Training result
 * @returns {Promise<number>} Subscriber count
 */
async function publishTrainingCompleted(trainingResult) {
  return await publish(CHANNELS.TRAINING_COMPLETED, {
    trainingLogId: trainingResult.id,
    status: trainingResult.status,
    metrics: trainingResult.metrics,
    modelVersion: trainingResult.modelVersion,
    duration: trainingResult.trainingDuration,
    completedAt: new Date().toISOString()
  });
}

/**
 * Publish model deployed event
 *
 * @param {object} modelVersion - Model version object
 * @returns {Promise<number>} Subscriber count
 */
async function publishModelDeployed(modelVersion) {
  return await publish(CHANNELS.MODEL_DEPLOYED, {
    modelVersionId: modelVersion.id,
    version: modelVersion.version,
    modelType: modelVersion.modelType,
    status: modelVersion.status,
    deployedAt: new Date().toISOString()
  });
}

/**
 * Publish A/B test created event
 *
 * @param {object} abTest - A/B test object
 * @returns {Promise<number>} Subscriber count
 */
async function publishABTestCreated(abTest) {
  return await publish(CHANNELS.AB_TEST_CREATED, {
    testId: abTest.id,
    modelAVersion: abTest.modelAVersion,
    modelBVersion: abTest.modelBVersion,
    trafficSplit: abTest.trafficSplit,
    createdAt: new Date().toISOString()
  });
}

/**
 * Publish A/B test completed event
 *
 * @param {object} abTest - Completed A/B test
 * @returns {Promise<number>} Subscriber count
 */
async function publishABTestCompleted(abTest) {
  return await publish(CHANNELS.AB_TEST_COMPLETED, {
    testId: abTest.id,
    winner: abTest.winner,
    winnerMetrics: abTest.winnerMetrics,
    completedAt: new Date().toISOString()
  });
}

/**
 * Subscribe to all ML events (for ML engine)
 *
 * @param {object} handlers - Event handlers object
 * @returns {Promise<void>}
 */
async function subscribeToAllMLEvents(handlers) {
  if (handlers.onNewMarketData) {
    await subscribe(CHANNELS.NEW_MARKET_DATA, handlers.onNewMarketData);
  }

  if (handlers.onSignalOutcome) {
    await subscribe(CHANNELS.SIGNAL_OUTCOME, handlers.onSignalOutcome);
  }

  if (handlers.onModelDeployed) {
    await subscribe(CHANNELS.MODEL_DEPLOYED, handlers.onModelDeployed);
  }

  logger.info('✅ Subscribed to all ML events');
}

/**
 * Close all connections
 *
 * @returns {Promise<void>}
 */
async function close() {
  try {
    if (publisherClient) {
      await publisherClient.quit();
      publisherClient = null;
      logger.info('✅ Redis publisher disconnected');
    }

    if (subscriberClient) {
      await subscriberClient.quit();
      subscriberClient = null;
      logger.info('✅ Redis subscriber disconnected');
    }

  } catch (error) {
    logger.error('❌ Error closing Redis event service:', error);
  }
}

/**
 * Get event statistics
 *
 * @returns {object} Event statistics
 */
function getStatistics() {
  return {
    publisherConnected: publisherClient ? publisherClient.isReady : false,
    subscriberConnected: subscriberClient ? subscriberClient.isReady : false,
    subscribedChannels: Object.keys(eventHandlers),
    handlerCount: Object.values(eventHandlers).reduce((sum, handlers) => sum + handlers.length, 0)
  };
}

module.exports = {
  // Core functions
  initialize,
  publish,
  subscribe,
  unsubscribe,
  close,
  getStatistics,

  // Event publishers
  publishNewMarketData,
  publishNewPrediction,
  publishSignalOutcome,
  publishTrainingStarted,
  publishTrainingCompleted,
  publishModelDeployed,
  publishABTestCreated,
  publishABTestCompleted,

  // Helper functions
  subscribeToAllMLEvents,

  // Channel constants
  CHANNELS
};
