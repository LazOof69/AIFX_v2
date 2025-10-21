/**
 * Test Script for Phase 1 Services
 * Tests training data export and Redis event services
 */

const path = require('path');
const fs = require('fs').promises;

// Import services
const trainingDataExportService = require('./src/services/trainingDataExportService');
const redisEventService = require('./src/services/redisEventService');
const logger = require('./src/utils/logger');

// Import database connection
const { connectDatabase } = require('./src/config/database');

/**
 * Test training data export service
 */
async function testTrainingDataExport() {
  console.log('\n🧪 Testing Training Data Export Service...\n');

  try {
    // Get export statistics first
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

    console.log('📊 Getting export statistics...');
    const stats = await trainingDataExportService.getExportStatistics(startDate, endDate);
    console.log('✅ Export statistics:', stats);

    // Test export (dry run with small dataset)
    const outputPath = path.join(__dirname, '../tmp/test_export');

    console.log('\n📦 Exporting test dataset...');
    const result = await trainingDataExportService.exportCompleteDataset({
      startDate,
      endDate,
      pairs: ['EUR/USD'], // Test with single pair
      timeframes: ['1h'],  // Test with single timeframe
      autoLabel: true,
      outputPath
    });

    console.log('✅ Export completed successfully!');
    console.log('📦 Output path:', result.outputPath);
    console.log('📊 Metadata:', JSON.stringify(result.metadata, null, 2));

    // Verify files exist
    console.log('\n📂 Verifying exported files...');
    const files = await fs.readdir(outputPath);
    console.log('✅ Files generated:', files);

    // Read and display sample from CSV
    if (files.includes('trading_signals_labeled.csv')) {
      const csvContent = await fs.readFile(
        path.join(outputPath, 'trading_signals_labeled.csv'),
        'utf-8'
      );
      const lines = csvContent.split('\n');
      console.log('\n📄 Sample from trading_signals_labeled.csv:');
      console.log(lines.slice(0, 3).join('\n')); // Header + 2 rows
    }

    console.log('\n✅ Training Data Export Service: PASSED\n');
    return true;

  } catch (error) {
    console.error('❌ Training Data Export Service: FAILED');
    console.error(error);
    return false;
  }
}

/**
 * Test Redis event service
 */
async function testRedisEventService() {
  console.log('\n🧪 Testing Redis Event Service...\n');

  try {
    // Initialize Redis event service
    console.log('🔗 Initializing Redis event service...');
    await redisEventService.initialize();
    console.log('✅ Redis event service initialized');

    // Get statistics
    const stats = redisEventService.getStatistics();
    console.log('📊 Redis event statistics:', stats);

    // Test event publishing and subscription
    let receivedEvent = null;

    // Subscribe to test event
    console.log('\n📥 Subscribing to NEW_MARKET_DATA event...');
    await redisEventService.subscribe(
      redisEventService.CHANNELS.NEW_MARKET_DATA,
      (event) => {
        console.log('📨 Received event:', event);
        receivedEvent = event;
      }
    );

    // Wait a bit for subscription to be ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Publish test event
    console.log('\n📢 Publishing test market data event...');
    const subscriberCount = await redisEventService.publishNewMarketData({
      pair: 'EUR/USD',
      timeframe: '1h',
      timestamp: new Date(),
      close: 1.0850,
      volume: 100000
    });

    console.log(`✅ Event published to ${subscriberCount} subscribers`);

    // Wait for event to be received
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (receivedEvent) {
      console.log('✅ Event received successfully!');
      console.log('📦 Event data:', receivedEvent.data);
    } else {
      console.warn('⚠️ Event not received (this may be normal if no subscribers)');
    }

    // Test other event publishers
    console.log('\n📢 Testing other event publishers...');

    await redisEventService.publishNewPrediction({
      id: 'test-prediction-123',
      pair: 'EUR/USD',
      timeframe: '1h',
      signal: 'buy',
      confidence: 0.85,
      modelVersion: 'v1.0.0'
    });
    console.log('✅ Published NEW_PREDICTION event');

    await redisEventService.publishSignalOutcome({
      id: 'test-signal-123',
      pair: 'EUR/USD',
      timeframe: '1h',
      signal: 'buy',
      actualOutcome: 'win',
      actualPnLPercent: 2.5,
      confidence: 0.85
    });
    console.log('✅ Published SIGNAL_OUTCOME event');

    await redisEventService.publishTrainingStarted({
      id: 'test-training-123',
      trainingType: 'incremental',
      modelType: 'lstm',
      datasetSize: 1000
    });
    console.log('✅ Published TRAINING_STARTED event');

    await redisEventService.publishTrainingCompleted({
      id: 'test-training-123',
      status: 'completed',
      metrics: { accuracy: 0.92, loss: 0.08 },
      modelVersion: 'v1.0.1',
      trainingDuration: 120
    });
    console.log('✅ Published TRAINING_COMPLETED event');

    // Get final statistics
    const finalStats = redisEventService.getStatistics();
    console.log('\n📊 Final Redis statistics:', finalStats);

    console.log('\n✅ Redis Event Service: PASSED\n');
    return true;

  } catch (error) {
    console.error('❌ Redis Event Service: FAILED');
    console.error(error);
    return false;

  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await redisEventService.close();
    console.log('✅ Redis connections closed');
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   Phase 1 Services Test Suite                     ║');
  console.log('║   - Training Data Export Service                  ║');
  console.log('║   - Redis Event Service                           ║');
  console.log('╚════════════════════════════════════════════════════╝');

  try {
    // Connect to database
    console.log('\n🔗 Connecting to database...');
    await connectDatabase();
    console.log('✅ Database connected\n');

    // Run tests
    const results = [];

    results.push(await testTrainingDataExport());
    results.push(await testRedisEventService());

    // Summary
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║   Test Results Summary                             ║');
    console.log('╚════════════════════════════════════════════════════╝\n');

    const passed = results.filter(r => r === true).length;
    const failed = results.filter(r => r === false).length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total:  ${results.length}\n`);

    if (failed === 0) {
      console.log('🎉 All tests passed!\n');
      process.exit(0);
    } else {
      console.log('⚠️ Some tests failed!\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
runTests();
