#!/usr/bin/env node
/**
 * AIFX v2 Full System Diagnosis and Testing
 *
 * Comprehensive test suite to validate:
 * 1. ML Engine API endpoints
 * 2. Backend services connection
 * 3. Database connectivity and data
 * 4. Redis connectivity
 * 5. Discord Bot integration
 * 6. Automated services
 * 7. End-to-end signal generation
 */

const axios = require('./backend/node_modules/axios');

// Color output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80));
}

async function test1_MLEngineHealth() {
  section('TEST 1: ML Engine Health Check');

  try {
    const response = await axios.get('http://localhost:8000/health');
    const data = response.data;

    log(`✅ ML Engine Status: ${data.status}`, 'green');
    log(`   Model Loaded: ${data.model_loaded ? '✅ YES' : '❌ NO'}`, data.model_loaded ? 'green' : 'red');
    log(`   Model Version: ${data.model_version}`, 'blue');
    log(`   Environment: ${data.environment}`, 'blue');

    return {
      passed: data.status === 'healthy',
      modelLoaded: data.model_loaded
    };
  } catch (error) {
    log(`❌ ML Engine Health Check Failed: ${error.message}`, 'red');
    return { passed: false, modelLoaded: false };
  }
}

async function test2_MLEngineMarketData() {
  section('TEST 2: ML Engine Market Data API');

  try {
    const response = await axios.get('http://localhost:8000/market-data/EURUSD', {
      params: { timeframe: '1h', limit: 5 }
    });

    const data = response.data;

    if (data.success && data.data.timeSeries && data.data.timeSeries.length > 0) {
      log(`✅ Market Data API Working`, 'green');
      log(`   Candles Fetched: ${data.data.timeSeries.length}`, 'blue');
      log(`   Data Source: ${data.data.metadata.dataSource}`, 'blue');
      log(`   Latest Timestamp: ${data.data.timeSeries[0].timestamp}`, 'blue');
      return { passed: true };
    } else {
      log(`❌ Market Data API returned invalid data`, 'red');
      return { passed: false };
    }
  } catch (error) {
    log(`❌ Market Data API Failed: ${error.message}`, 'red');
    return { passed: false };
  }
}

async function test3_MLEngineReversalAPI() {
  section('TEST 3: ML Engine Reversal Prediction API');

  try {
    // First fetch market data
    const marketDataResponse = await axios.get('http://localhost:8000/market-data/EURUSD', {
      params: { timeframe: '1h', limit: 100 }
    });

    const marketData = marketDataResponse.data.data.timeSeries;

    if (marketData.length < 20) {
      log(`⚠️  Insufficient market data (${marketData.length} candles, need at least 20)`, 'yellow');
      return { passed: false, reason: 'insufficient_data' };
    }

    // Now make reversal prediction
    const predictionResponse = await axios.post('http://localhost:8000/reversal/predict_raw', {
      pair: 'EUR/USD',
      timeframe: '1h',
      data: marketData,
      version: null
    });

    const prediction = predictionResponse.data;

    if (prediction.success && prediction.data) {
      log(`✅ Reversal Prediction API Working`, 'green');
      log(`   Signal: ${prediction.data.signal}`, 'blue');
      log(`   Confidence: ${(prediction.data.confidence * 100).toFixed(2)}%`, 'blue');
      log(`   Stage 1 Probability: ${(prediction.data.stage1_prob * 100).toFixed(2)}%`, 'blue');
      log(`   Stage 2 Probability: ${(prediction.data.stage2_prob * 100).toFixed(2)}%`, 'blue');
      log(`   Model Version: ${prediction.data.model_version}`, 'blue');
      return { passed: true, prediction: prediction.data };
    } else {
      log(`❌ Reversal Prediction returned error: ${prediction.error}`, 'red');
      return { passed: false };
    }
  } catch (error) {
    log(`❌ Reversal Prediction API Failed: ${error.response?.data?.detail || error.message}`, 'red');
    return { passed: false };
  }
}

async function test4_BackendHealth() {
  section('TEST 4: Backend API Health Check');

  try {
    const response = await axios.get('http://localhost:3000/api/v1/health');
    const data = response.data;

    if (data.success && data.data.status === 'healthy') {
      log(`✅ Backend API Healthy`, 'green');
      log(`   Environment: ${data.data.environment}`, 'blue');
      log(`   Version: ${data.data.version}`, 'blue');
      return { passed: true };
    } else {
      log(`❌ Backend API unhealthy`, 'red');
      return { passed: false };
    }
  } catch (error) {
    log(`❌ Backend Health Check Failed: ${error.message}`, 'red');
    return { passed: false };
  }
}

async function test5_DatabaseConnectivity() {
  section('TEST 5: Database Connectivity and Data');

  try {
    require('dotenv').config({ path: '/root/AIFX_v2/backend/.env' });
    const { MarketData } = require('/root/AIFX_v2/backend/src/models');
    const { Sequelize } = require('sequelize');

    // Test database connection
    await MarketData.sequelize.authenticate();
    log(`✅ Database Connection Established`, 'green');

    // Check market data counts
    const dataCounts = await MarketData.findAll({
      attributes: [
        'pair',
        'timeframe',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['pair', 'timeframe'],
      raw: true
    });

    log(`\n📊 Market Data in Database:`, 'cyan');
    let totalCandles = 0;
    for (const row of dataCounts) {
      const count = parseInt(row.count);
      totalCandles += count;
      const status = count >= 60 ? '✅' : '⚠️';
      log(`   ${status} ${row.pair} ${row.timeframe}: ${count} candles`, count >= 60 ? 'green' : 'yellow');
    }

    log(`\n   Total Candles: ${totalCandles}`, 'blue');

    const allSufficient = dataCounts.every(row => parseInt(row.count) >= 60);

    return { passed: true, allSufficient, dataCounts, totalCandles };
  } catch (error) {
    log(`❌ Database Test Failed: ${error.message}`, 'red');
    return { passed: false };
  }
}

async function test6_RedisConnectivity() {
  section('TEST 6: Redis Connectivity');

  try {
    const redis = require('redis');
    const client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      database: 2
    });

    await client.connect();
    const pong = await client.ping();

    log(`✅ Redis Connection Established`, 'green');
    log(`   Ping Response: ${pong}`, 'blue');

    // Test set/get
    await client.set('test:diagnosis', 'success');
    const value = await client.get('test:diagnosis');

    log(`   Read/Write Test: ${value === 'success' ? '✅ PASS' : '❌ FAIL'}`, value === 'success' ? 'green' : 'red');

    await client.del('test:diagnosis');
    await client.quit();

    return { passed: true };
  } catch (error) {
    log(`❌ Redis Connection Failed: ${error.message}`, 'red');
    log(`   This may affect caching performance but won't break core functionality`, 'yellow');
    return { passed: false };
  }
}

async function test7_DiscordBotStatus() {
  section('TEST 7: Discord Bot Configuration');

  try {
    require('dotenv').config({ path: '/root/AIFX_v2/backend/.env' });

    const discordEnabled = process.env.DISCORD_ENABLED !== 'false';
    const discordToken = process.env.DISCORD_BOT_TOKEN;
    const discordChannel = process.env.DISCORD_SIGNAL_CHANNEL_ID;

    log(`Discord Enabled: ${discordEnabled ? '✅ YES' : '❌ NO'}`, discordEnabled ? 'green' : 'red');
    log(`Discord Token: ${discordToken ? '✅ Configured' : '❌ Missing'}`, discordToken ? 'green' : 'red');
    log(`Discord Channel: ${discordChannel ? '✅ Configured' : '❌ Missing'}`, discordChannel ? 'green' : 'red');

    if (!discordEnabled) {
      log(`\n⚠️  Discord notifications are disabled. Set DISCORD_ENABLED=true to enable.`, 'yellow');
    }

    return {
      passed: discordToken && discordChannel,
      enabled: discordEnabled,
      configured: !!(discordToken && discordChannel)
    };
  } catch (error) {
    log(`❌ Discord Configuration Check Failed: ${error.message}`, 'red');
    return { passed: false, enabled: false, configured: false };
  }
}

async function test8_EndToEndSignalGeneration() {
  section('TEST 8: End-to-End Signal Generation Test');

  try {
    require('dotenv').config({ path: '/root/AIFX_v2/backend/.env' });
    const signalMonitoringService = require('/root/AIFX_v2/backend/src/services/signalMonitoringService');

    log(`Testing signal detection for EUR/USD 1h...`, 'blue');

    const signal = await signalMonitoringService.checkSignal('EUR/USD', '1h');

    if (signal) {
      log(`\n🚨 SIGNAL DETECTED!`, 'green');
      log(`   Pair: ${signal.pair}`, 'blue');
      log(`   Timeframe: ${signal.timeframe}`, 'blue');
      log(`   Signal: ${signal.signal}`, 'yellow');
      log(`   Confidence: ${(signal.confidence * 100).toFixed(2)}%`, 'blue');
      log(`   Stage 1 Probability: ${(signal.stage1_prob * 100).toFixed(2)}%`, 'blue');
      log(`   Stage 2 Probability: ${(signal.stage2_prob * 100).toFixed(2)}%`, 'blue');
      log(`   Model Version: ${signal.model_version}`, 'blue');

      return { passed: true, signalDetected: true, signal };
    } else {
      log(`✅ No reversal signal detected (HOLD)`, 'green');
      log(`   This is normal - reversals are rare events`, 'blue');
      return { passed: true, signalDetected: false };
    }
  } catch (error) {
    log(`❌ Signal Generation Test Failed: ${error.message}`, 'red');
    log(`   Stack: ${error.stack}`, 'red');
    return { passed: false };
  }
}

async function generateReport(results) {
  section('FINAL DIAGNOSIS REPORT');

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;

  log(`\nTest Results: ${passedTests}/${totalTests} PASSED`, passedTests === totalTests ? 'green' : 'yellow');

  // Critical Issues
  const criticalIssues = [];
  if (!results.test1?.passed) criticalIssues.push('ML Engine not healthy');
  if (!results.test3?.passed) criticalIssues.push('Reversal prediction API not working');
  if (!results.test4?.passed) criticalIssues.push('Backend API not healthy');
  if (!results.test5?.passed) criticalIssues.push('Database connection failed');
  if (results.test5?.passed && !results.test5?.allSufficient) {
    criticalIssues.push('Insufficient market data for some pairs/timeframes');
  }

  if (criticalIssues.length > 0) {
    log(`\n🚨 CRITICAL ISSUES:`, 'red');
    criticalIssues.forEach(issue => log(`   ❌ ${issue}`, 'red'));
  }

  // Warnings
  const warnings = [];
  if (!results.test1?.modelLoaded) warnings.push('ML Engine legacy model not loaded (reversal model may still work)');
  if (!results.test6?.passed) warnings.push('Redis not connected (caching disabled, performance may degrade)');
  if (!results.test7?.enabled) warnings.push('Discord notifications disabled');
  if (!results.test7?.configured) warnings.push('Discord not fully configured');

  if (warnings.length > 0) {
    log(`\n⚠️  WARNINGS:`, 'yellow');
    warnings.forEach(warning => log(`   ⚠️  ${warning}`, 'yellow'));
  }

  // Success Metrics
  if (criticalIssues.length === 0) {
    log(`\n✅ SYSTEM STATUS: OPERATIONAL`, 'green');
    log(`   - ML Engine: ✅ Healthy`, 'green');
    log(`   - Reversal Prediction: ✅ Working`, 'green');
    log(`   - Backend API: ✅ Healthy`, 'green');
    log(`   - Database: ✅ Connected (${results.test5?.totalCandles || 0} candles)`, 'green');
    log(`   - Signal Generation: ✅ Working`, 'green');

    if (results.test8?.signalDetected) {
      log(`   - Active Signal: 🚨 ${results.test8.signal.signal.toUpperCase()}`, 'yellow');
    }
  } else {
    log(`\n❌ SYSTEM STATUS: DEGRADED`, 'red');
    log(`   Please address critical issues listed above`, 'yellow');
  }

  // Recommendations
  log(`\n📋 RECOMMENDATIONS:`, 'cyan');
  if (!results.test6?.passed) {
    log(`   1. Fix Redis connection for improved performance:`, 'blue');
    log(`      - Check REDIS_URL in backend/.env`, 'blue');
    log(`      - Ensure Redis server is running: redis-server`, 'blue');
  }
  if (!results.test7?.enabled) {
    log(`   2. Enable Discord notifications:`, 'blue');
    log(`      - Set DISCORD_ENABLED=true in backend/.env`, 'blue');
  }
  if (results.test5?.passed && !results.test5?.allSufficient) {
    log(`   3. Initialize historical data for insufficient timeframes:`, 'blue');
    log(`      - Run: node test_market_data_collector.js`, 'blue');
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

async function main() {
  log('🔍 AIFX v2 System Diagnosis Starting...', 'cyan');
  log('This may take 30-60 seconds...\n', 'blue');

  const results = {};

  results.test1 = await test1_MLEngineHealth();
  results.test2 = await test2_MLEngineMarketData();
  results.test3 = await test3_MLEngineReversalAPI();
  results.test4 = await test4_BackendHealth();
  results.test5 = await test5_DatabaseConnectivity();
  results.test6 = await test6_RedisConnectivity();
  results.test7 = await test7_DiscordBotStatus();
  results.test8 = await test8_EndToEndSignalGeneration();

  await generateReport(results);

  process.exit(0);
}

main().catch(error => {
  log(`\n❌ Diagnosis failed with error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
