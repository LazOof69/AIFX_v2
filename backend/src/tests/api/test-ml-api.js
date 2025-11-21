/**
 * ML Engine API Tests - Phase 3
 * Comprehensive test suite for ML Engine Backend APIs
 *
 * Following microservices architecture principles (CLAUDE.md):
 * - ML Engine uses Backend APIs to fetch training data
 * - ML Engine submits predictions via API
 * - ML Engine manages model versions via API
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.ML_ENGINE_API_KEY || 'dev_ml_engine_key_replace_in_production';

// Create axios client with ML Engine API Key
const client = axios.create({
  baseURL: `${BASE_URL}/api/v1/ml`,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'X-Service-Name': 'ml-engine',
  },
});

// Test state
let testModelId = null;
let testPredictionId = null;

// Generate unique version using timestamp
const uniqueVersion = `2.0.0-test-${Date.now()}`;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function printHeader(title) {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`   ${title}`);
  console.log(`${'═'.repeat(50)}\n`);
}

function printTest(name) {
  console.log(`${colors.blue}🧪 Testing: ${name}${colors.reset}`);
}

function printSuccess(message) {
  console.log(`${colors.green}✅ PASSED: ${message}${colors.reset}\n`);
}

function printError(message, error) {
  console.log(`${colors.red}❌ FAILED: ${message}${colors.reset}`);
  console.log(`   Error: ${error}`);
  console.log();
}

function printInfo(message) {
  console.log(`   ${message}`);
}

/**
 * Test 1: Health Check
 */
async function testHealthCheck() {
  printTest('1. Health Check');
  try {
    const response = await client.get('/health');
    printInfo(`Health status: ${response.data.data.status}`);
    printInfo(`Service: ${response.data.data.service}`);
    printSuccess('1. Health Check');
  } catch (error) {
    printError('1. Health Check', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 2: Register Model Version
 */
async function testRegisterModelVersion() {
  printTest('2. Register Model Version');
  try {
    const modelData = {
      modelName: 'signal_predictor_v2',
      version: uniqueVersion,
      algorithm: 'LSTM',
      hyperparameters: {
        layers: 3,
        units: 128,
        dropout: 0.2,
        learningRate: 0.001,
      },
      trainingMetrics: {
        accuracy: 0.85,
        precision: 0.83,
        recall: 0.87,
        f1Score: 0.85,
        loss: 0.23,
      },
      trainingDataInfo: {
        startDate: '2024-01-01',
        endDate: '2024-10-31',
        totalSamples: 100000,
        features: 45,
      },
      description: 'Test model for Phase 3 ML APIs',
    };

    const response = await client.post('/models/version', modelData);
    testModelId = response.data.data.modelId;

    printInfo(`Model registered: ${response.data.data.modelName}`);
    printInfo(`Version: ${response.data.data.version}`);
    printInfo(`Model ID: ${testModelId}`);
    printSuccess('2. Register Model Version');
  } catch (error) {
    printError('2. Register Model Version', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 3: Get Model Versions
 */
async function testGetModelVersions() {
  printTest('3. Get Model Versions');
  try {
    const response = await client.get('/models', {
      params: {
        modelName: 'signal_predictor_v2',
        limit: 10,
      },
    });

    const models = response.data.data.models;
    printInfo(`Found ${models.length} model versions`);
    if (models.length > 0) {
      printInfo(`Latest model: ${models[0].modelName}:${models[0].version}`);
    }
    printSuccess('3. Get Model Versions');
  } catch (error) {
    printError('3. Get Model Versions', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 4: Update Model Status
 */
async function testUpdateModelStatus() {
  printTest('4. Update Model Status');
  try {
    const response = await client.put(`/models/${testModelId}/status`, {
      status: 'deployed',
      isActive: true,
    });

    printInfo(`Model status: ${response.data.data.status}`);
    printInfo(`Is active: ${response.data.data.isActive}`);
    printSuccess('4. Update Model Status');
  } catch (error) {
    printError('4. Update Model Status', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 5: Log Training Session
 */
async function testLogTrainingSession() {
  printTest('5. Log Training Session');
  try {
    const trainingLog = {
      modelVersion: uniqueVersion,
      trainingType: 'full',
      dataStartDate: '2025-01-01',
      dataEndDate: '2025-11-01',
      numSamples: 10000,
      trainingMetrics: {
        accuracy: 0.86,
        loss: 0.21,
        epochs: 50,
        trainSamples: 8000,
      },
      validationMetrics: {
        accuracy: 0.84,
        loss: 0.24,
        valSamples: 2000,
      },
      hyperparameters: {
        batchSize: 32,
        learningRate: 0.001,
      },
      duration: 3600,
      notes: 'Training session test',
    };

    const response = await client.post(`/models/${testModelId}/training-logs`, trainingLog);
    printInfo(`Training log ID: ${response.data.data.logId}`);
    printSuccess('5. Log Training Session');
  } catch (error) {
    printError('5. Log Training Session', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 6: Submit Prediction
 */
async function testSubmitPrediction() {
  printTest('6. Submit Prediction');
  try {
    const predictionData = {
      pair: 'EUR/USD',
      timeframe: '1h',
      signal: 'buy',
      confidence: 0.85,
      factors: {
        technical: 0.82,
        sentiment: 0.88,
        pattern: 0.85,
      },
      entryPrice: 1.0950,
      stopLoss: 1.0900,
      takeProfit: 1.1050,
      riskRewardRatio: 2.0,
      positionSize: 2.5,
      signalStrength: 'strong',
      marketCondition: 'trending',
      technicalData: {
        sma20: 1.0920,
        rsi: 62,
        macd: 0.0015,
      },
      modelVersionId: testModelId,
    };

    const response = await client.post('/predictions', predictionData);
    testPredictionId = response.data.data.predictionId;

    printInfo(`Prediction ID: ${testPredictionId}`);
    printInfo(`Signal: ${response.data.data.signal} ${response.data.data.pair}`);
    printInfo(`Confidence: ${response.data.data.confidence}`);
    printSuccess('6. Submit Prediction');
  } catch (error) {
    printError('6. Submit Prediction', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 7: Get Recent Predictions
 */
async function testGetRecentPredictions() {
  printTest('7. Get Recent Predictions');
  try {
    const response = await client.get('/predictions', {
      params: {
        pair: 'EUR/USD',
        limit: 10,
      },
    });

    const predictions = response.data.data.predictions;
    printInfo(`Found ${predictions.length} predictions`);
    if (predictions.length > 0) {
      printInfo(`Latest: ${predictions[0].signal} ${predictions[0].pair} (confidence: ${predictions[0].confidence})`);
    }
    printSuccess('7. Get Recent Predictions');
  } catch (error) {
    printError('7. Get Recent Predictions', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 8: Update Prediction Outcome
 */
async function testUpdatePredictionOutcome() {
  printTest('8. Update Prediction Outcome');
  try {
    const outcomeData = {
      outcome: 'win',
      actualPnL: 125.50,
      actualPnLPercent: 2.5,
    };

    const response = await client.put(`/predictions/${testPredictionId}/outcome`, outcomeData);
    printInfo(`Outcome: ${response.data.data.outcome}`);
    printInfo(`P&L: $${response.data.data.actualPnL}`);
    printInfo(`P&L %: ${response.data.data.actualPnLPercent}%`);
    printSuccess('8. Update Prediction Outcome');
  } catch (error) {
    printError('8. Update Prediction Outcome', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 9: Get Prediction Accuracy
 */
async function testGetPredictionAccuracy() {
  printTest('9. Get Prediction Accuracy');
  try {
    const response = await client.get('/predictions/accuracy', {
      params: {
        pair: 'EUR/USD',
      },
    });

    const data = response.data.data;
    printInfo(`Total predictions: ${data.overall.totalPredictions}`);
    printInfo(`Win rate: ${data.overall.winRate}%`);
    printInfo(`Average P&L: $${data.overall.averagePnL}`);
    printSuccess('9. Get Prediction Accuracy');
  } catch (error) {
    printError('9. Get Prediction Accuracy', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 10: Get Training Data - Market Data
 */
async function testGetMarketData() {
  printTest('10. Get Training Data - Market Data');
  try {
    // URL encode the pair to handle the slash
    const pair = encodeURIComponent('EUR/USD');
    const response = await client.get(`/training-data/market/${pair}`, {
      params: {
        timeframe: '1h',
        limit: 100,
      },
    });

    const data = response.data.data;
    printInfo(`Pair: ${data.pair}`);
    printInfo(`Timeframe: ${data.timeframe}`);
    printInfo(`Records fetched: ${data.marketData.length}`);
    printInfo(`Total available: ${data.pagination.total}`);
    printSuccess('10. Get Training Data - Market Data');
  } catch (error) {
    printError('10. Get Training Data - Market Data', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 11: Get Training Data - Historical Signals
 */
async function testGetHistoricalSignals() {
  printTest('11. Get Training Data - Historical Signals');
  try {
    const response = await client.get('/training-data/signals', {
      params: {
        pair: 'EUR/USD',
        limit: 50,
      },
    });

    const signals = response.data.data.signals;
    printInfo(`Signals fetched: ${signals.length}`);
    printInfo(`Total available: ${response.data.data.pagination.total}`);
    printSuccess('11. Get Training Data - Historical Signals');
  } catch (error) {
    printError('11. Get Training Data - Historical Signals', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 12: Get Training Data - User Trades
 */
async function testGetUserTrades() {
  printTest('12. Get Training Data - User Trades');
  try {
    const response = await client.get('/training-data/trades', {
      params: {
        pair: 'EUR/USD',
        limit: 50,
      },
    });

    const trades = response.data.data.trades;
    printInfo(`Trades fetched: ${trades.length}`);
    printInfo(`Total available: ${response.data.data.pagination.total}`);
    printSuccess('12. Get Training Data - User Trades');
  } catch (error) {
    printError('12. Get Training Data - User Trades', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 13: Get Training Data Statistics
 */
async function testGetTrainingDataStats() {
  printTest('13. Get Training Data Statistics');
  try {
    const response = await client.get('/training-data/stats', {
      params: {
        pair: 'EUR/USD',
      },
    });

    const data = response.data.data;
    printInfo(`Market data records: ${data.marketData.count}`);
    printInfo(`Signals records: ${data.signals.count}`);
    printInfo(`Trades records: ${data.trades.count}`);
    printSuccess('13. Get Training Data Statistics');
  } catch (error) {
    printError('13. Get Training Data Statistics', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 14: Invalid API Key (should fail)
 */
async function testInvalidApiKey() {
  printTest('14. Invalid API Key (should fail)');

  const invalidClient = axios.create({
    baseURL: `${BASE_URL}/api/v1/ml`,
    headers: {
      'Authorization': 'Bearer invalid_key_12345',
      'Content-Type': 'application/json',
    },
  });

  try {
    await invalidClient.get('/health');
    throw new Error('Should have rejected invalid API key');
  } catch (error) {
    if (error.response && error.response.status === 403) {
      printInfo(`Correctly rejected invalid API key (403)`);
      printSuccess('14. Invalid API Key (should fail)');
    } else {
      throw new Error('Expected 403 status for invalid API key');
    }
  }
}

/**
 * Main test runner
 */
async function runTests() {
  printHeader('ML Engine API Tests - Phase 3');

  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 20)}...`);
  console.log();

  const tests = [
    { name: '1. Health Check', fn: testHealthCheck },
    { name: '2. Register Model Version', fn: testRegisterModelVersion },
    { name: '3. Get Model Versions', fn: testGetModelVersions },
    { name: '4. Update Model Status', fn: testUpdateModelStatus },
    { name: '5. Log Training Session', fn: testLogTrainingSession },
    { name: '6. Submit Prediction', fn: testSubmitPrediction },
    { name: '7. Get Recent Predictions', fn: testGetRecentPredictions },
    { name: '8. Update Prediction Outcome', fn: testUpdatePredictionOutcome },
    { name: '9. Get Prediction Accuracy', fn: testGetPredictionAccuracy },
    { name: '10. Get Training Data - Market Data', fn: testGetMarketData },
    { name: '11. Get Training Data - Historical Signals', fn: testGetHistoricalSignals },
    { name: '12. Get Training Data - User Trades', fn: testGetUserTrades },
    { name: '13. Get Training Data Statistics', fn: testGetTrainingDataStats },
    { name: '14. Invalid API Key (should fail)', fn: testInvalidApiKey },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (error) {
      failed++;
    }
  }

  // Print summary
  printHeader('Test Summary');
  console.log(`${colors.green}✅ Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${failed}${colors.reset}`);
  console.log(`${colors.blue}📊 Total:  ${tests.length}${colors.reset}`);
  console.log();

  if (failed === 0) {
    console.log(`${colors.green}🎉 All tests passed!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.yellow}⚠️  Some tests failed. Please review the errors above.${colors.reset}\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error(`\n${colors.red}Fatal error:${colors.reset}`, error.message);
  process.exit(1);
});
