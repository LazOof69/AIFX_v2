/**
 * Simple Signal Check Test
 * Tests signal monitoring logic without full service dependencies
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');
const { Client } = require('pg');

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/aifx_v2_dev';

// Monitoring configuration
const CONFIG = {
  pairs: ['EUR/USD', 'USD/JPY'],
  timeframes: ['1h']  // Start with just 1h for testing
};

/**
 * Fetch market data from database
 */
async function fetchMarketData(client, pair, timeframe, limit = 250) {
  const result = await client.query(`
    SELECT timestamp, open, high, low, close, volume
    FROM market_data
    WHERE pair = $1 AND timeframe = $2
    ORDER BY timestamp DESC
    LIMIT $3
  `, [pair, timeframe, limit]);

  return result.rows.reverse().map(row => ({
    timestamp: row.timestamp.toISOString(),
    open: parseFloat(row.open),
    high: parseFloat(row.high),
    low: parseFloat(row.low),
    close: parseFloat(row.close),
    volume: parseFloat(row.volume) || 0.0
  }));
}

/**
 * Check single pair/timeframe for reversal signal
 */
async function checkSignal(client, pair, timeframe) {
  try {
    console.log(`\n🔍 Checking ${pair} ${timeframe}...`);

    // Fetch market data
    const marketData = await fetchMarketData(client, pair, timeframe);
    console.log(`   ✅ Fetched ${marketData.length} candles`);

    // Call ML API
    const response = await axios.post(
      `${ML_API_URL}/reversal/predict_raw`,
      {
        pair: pair,
        timeframe: timeframe,
        data: marketData
      },
      { timeout: 30000 }
    );

    if (!response.data.success) {
      console.log(`   ❌ Prediction failed: ${response.data.error}`);
      return null;
    }

    const pred = response.data.data;

    if (pred.signal !== 'hold') {
      console.log(`   🚨 REVERSAL SIGNAL: ${pred.signal.toUpperCase()}`);
      console.log(`      Confidence: ${(pred.confidence * 100).toFixed(1)}%`);
      console.log(`      Stage 1 (Reversal): ${(pred.stage1_prob * 100).toFixed(1)}%`);
      console.log(`      Stage 2 (Direction): ${(pred.stage2_prob * 100).toFixed(1)}%`);
      console.log(`      Model: ${pred.model_version}`);

      return {
        pair: pred.pair,
        timeframe: pred.timeframe,
        signal: pred.signal,
        confidence: pred.confidence,
        stage1_prob: pred.stage1_prob,
        stage2_prob: pred.stage2_prob,
        model_version: pred.model_version,
        detected_at: new Date()
      };
    } else {
      console.log(`   ⏸️  No signal (hold)`);
      return null;
    }

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Main test function
 */
async function testSignalMonitoring() {
  console.log('='.repeat(60));
  console.log('🧪 Signal Monitoring Test (Simplified)');
  console.log('='.repeat(60));

  // Connect to database
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('✅ Database connected\n');

  // Check ML Engine health
  try {
    const healthResponse = await axios.get(`${ML_API_URL}/health`, { timeout: 5000 });
    if (healthResponse.data.status === 'healthy') {
      console.log('✅ ML Engine is healthy\n');
    }
  } catch (error) {
    console.log('❌ ML Engine not available');
    await client.end();
    process.exit(1);
  }

  // Check all configured combinations
  const signals = [];

  for (const pair of CONFIG.pairs) {
    for (const timeframe of CONFIG.timeframes) {
      const signal = await checkSignal(client, pair, timeframe);
      if (signal) {
        signals.push(signal);
      }
    }
  }

  await client.end();

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`Total checks: ${CONFIG.pairs.length * CONFIG.timeframes.length}`);
  console.log(`Signals detected: ${signals.length}`);

  if (signals.length > 0) {
    console.log('\n🚨 Detected Signals:');
    signals.forEach((s, i) => {
      console.log(`${i + 1}. ${s.pair} ${s.timeframe} - ${s.signal.toUpperCase()} (${(s.confidence * 100).toFixed(1)}%)`);
    });
  }

  console.log('\n✅ Test completed!');
  console.log('='.repeat(60));

  process.exit(0);
}

// Run test
testSignalMonitoring().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
