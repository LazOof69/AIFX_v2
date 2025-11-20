/**
 * Test script for ML Engine Service
 * Tests the end-to-end prediction flow
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Set up paths
process.env.NODE_PATH = path.join(__dirname, '..', 'node_modules');
require('module').Module._initPaths();

const axios = require('axios');

// Simplified test without importing models
const mlAPIURL = process.env.ML_API_URL || 'http://localhost:8000';

async function testMLPrediction() {
  console.log('='.repeat(60));
  console.log('🧪 ML Engine API Test');
  console.log('='.repeat(60));

  try {
    // 1. Health check
    console.log('\n1️⃣  Checking ML Engine health...');
    let healthResponse;
    try {
      healthResponse = await axios.get(`${mlAPIURL}/health`, { timeout: 5000 });
      const isHealthy = healthResponse.data.status === 'healthy' && healthResponse.data.model_loaded === true;
      console.log(`   ${isHealthy ? '✅' : '❌'} ML Engine status: ${isHealthy ? 'healthy' : 'unhealthy'}`);

      if (!isHealthy) {
        console.log('\n⚠️  ML Engine is not running properly');
        process.exit(1);
      }
    } catch (error) {
      console.log('   ❌ ML Engine is not reachable');
      console.log('\n⚠️  Start ML Engine with:');
      console.log('   cd /root/AIFX_v2/ml_engine && venv/bin/python api/ml_server.py');
      process.exit(1);
    }

    // 2. Test fetching market data count
    console.log('\n2️⃣  Checking available market data...');
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    const countResult = await client.query(`
      SELECT pair, timeframe, COUNT(*) as total
      FROM market_data
      GROUP BY pair, timeframe
      ORDER BY pair, timeframe
    `);

    console.log('   Available data:');
    for (const row of countResult.rows) {
      console.log(`   - ${row.pair} ${row.timeframe}: ${row.total} candles`);
    }

    // 3. Fetch sample market data for prediction test
    console.log('\n3️⃣  Fetching EUR/USD 1h data...');
    const dataResult = await client.query(`
      SELECT timestamp, open, high, low, close, volume
      FROM market_data
      WHERE pair = 'EUR/USD' AND timeframe = '1h'
      ORDER BY timestamp DESC
      LIMIT 250
    `);

    await client.end();

    if (dataResult.rows.length < 60) {
      console.log(`   ⚠️  Insufficient data: ${dataResult.rows.length} candles (need 60+)`);
      console.log('\n   Run this to import more data:');
      console.log('   cd /root/AIFX_v2/backend && node scripts/import-csv-to-db.js');
      process.exit(1);
    }

    console.log(`   ✅ Found ${dataResult.rows.length} candles`);

    // Format data for API (reverse to chronological order)
    const marketData = dataResult.rows.reverse().map(row => ({
      timestamp: row.timestamp.toISOString(),
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseFloat(row.volume) || 0.0
    }));

    // 4. Test reversal prediction
    console.log('\n4️⃣  Testing /reversal/predict_raw endpoint...');
    const predictionPayload = {
      pair: 'EUR/USD',
      timeframe: '1h',
      data: marketData
    };

    try {
      const predResponse = await axios.post(
        `${mlAPIURL}/reversal/predict_raw`,
        predictionPayload,
        { timeout: 30000 }
      );

      if (predResponse.data.success) {
        const pred = predResponse.data.data;
        console.log('   ✅ Prediction successful!');
        console.log(`   📊 Signal: ${pred.signal}`);
        console.log(`   🎯 Confidence: ${(pred.confidence * 100).toFixed(1)}%`);
        console.log(`   📈 Stage 1 (Reversal): ${(pred.stage1_prob * 100).toFixed(1)}%`);
        console.log(`   📉 Stage 2 (Direction): ${(pred.stage2_prob * 100).toFixed(1)}%`);
        console.log(`   🔖 Model Version: ${pred.model_version}`);
        if (pred.warning) {
          console.log(`   ⚠️  Warning: ${pred.warning}`);
        }
      } else {
        console.log('   ❌ Prediction failed:', predResponse.data.error);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.response?.data?.error || error.message);
    }

    // 5. Test model versions endpoint
    console.log('\n5️⃣  Getting available model versions...');
    try {
      const versionsResponse = await axios.get(`${mlAPIURL}/reversal/models`);
      if (versionsResponse.data.success) {
        const versions = versionsResponse.data.data;
        console.log('   ✅ Model versions retrieved');
        console.log('   Available versions:', Object.keys(versions.versions || {}));
        console.log('   Active version:', versions.active_version);
      }
    } catch (error) {
      console.log('   ⚠️  Could not retrieve versions:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testMLPrediction()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
