/**
 * End-to-End Signal Monitoring with Discord Notification Test
 *
 * Tests the complete flow:
 * 1. Fetch market data from database
 * 2. Call ML API for reversal detection
 * 3. Send Discord notification if signal detected
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');
const { Client } = require('pg');
const discordNotificationService = require('../src/services/discordNotificationService');

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/aifx_v2_dev';

// Monitoring configuration
const CONFIG = {
  pairs: ['EUR/USD', 'USD/JPY'],
  timeframes: ['1h']
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
        detected_at: new Date(),
        factors: pred.factors || {}
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
async function testSignalWithDiscord() {
  console.log('='.repeat(60));
  console.log('🧪 End-to-End Signal Monitoring + Discord Test');
  console.log('='.repeat(60));

  let pgClient = null;

  try {
    // Step 1: Initialize Discord
    console.log('\n1️⃣  Initializing Discord notification service...');
    await discordNotificationService.initialize();
    console.log('   ✅ Discord service ready');

    const discordStatus = discordNotificationService.getStatus();
    console.log(`   Connected as: ${discordStatus.connected}`);
    console.log(`   Channel: ${discordStatus.defaultChannel}`);

    // Step 2: Connect to database
    console.log('\n2️⃣  Connecting to database...');
    pgClient = new Client({ connectionString: DATABASE_URL });
    await pgClient.connect();
    console.log('   ✅ Database connected');

    // Step 3: Check ML Engine health
    console.log('\n3️⃣  Checking ML Engine health...');
    const healthResponse = await axios.get(`${ML_API_URL}/health`, { timeout: 5000 });
    if (healthResponse.data.status === 'healthy') {
      console.log('   ✅ ML Engine is healthy');
    } else {
      throw new Error('ML Engine is not healthy');
    }

    // Step 4: Check all configured combinations
    console.log('\n4️⃣  Checking for reversal signals...');
    const signals = [];

    for (const pair of CONFIG.pairs) {
      for (const timeframe of CONFIG.timeframes) {
        const signal = await checkSignal(pgClient, pair, timeframe);
        if (signal) {
          signals.push(signal);
        }
      }
    }

    // Step 5: Send Discord notifications
    console.log('\n5️⃣  Processing detected signals...');

    if (signals.length === 0) {
      console.log('   ℹ️  No signals detected - creating mock signal for testing');

      // Create a mock signal for testing
      const mockSignal = {
        pair: 'EUR/USD',
        timeframe: '1h',
        signal: 'long',
        confidence: 0.750,
        stage1_prob: 0.755,
        stage2_prob: 0.745,
        model_version: 'v3.1 (TEST)',
        detected_at: new Date(),
        factors: {
          technical: 0.78,
          momentum: 0.72
        },
        metadata: {
          warning: 'This is a TEST signal for demonstration purposes'
        }
      };

      signals.push(mockSignal);
    }

    console.log(`\n   📤 Sending ${signals.length} notification(s)...`);

    for (const signal of signals) {
      console.log(`\n   Processing: ${signal.pair} ${signal.timeframe} ${signal.signal.toUpperCase()}`);

      const notificationResult = await discordNotificationService.sendSignalNotification(signal);

      if (notificationResult.success) {
        if (notificationResult.skipped) {
          console.log(`      ⏭️  Skipped (${notificationResult.reason})`);
        } else {
          console.log(`      ✅ Discord notification sent`);
        }
      } else {
        console.log(`      ❌ Failed: ${notificationResult.error}`);
      }
    }

    // Step 6: Display summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    console.log(`Total checks: ${CONFIG.pairs.length * CONFIG.timeframes.length}`);
    console.log(`Signals detected: ${signals.length}`);

    const finalStatus = discordNotificationService.getStatus();
    console.log(`Discord notifications sent: ${finalStatus.stats.totalSent}`);
    console.log(`Discord failures: ${finalStatus.stats.failures}`);
    console.log(`Deduplicated: ${finalStatus.stats.deduplicated}`);

    if (signals.length > 0) {
      console.log('\n🚨 Detected Signals:');
      signals.forEach((s, i) => {
        console.log(`${i + 1}. ${s.pair} ${s.timeframe} - ${s.signal.toUpperCase()} (${(s.confidence * 100).toFixed(1)}%)`);
      });
    }

    console.log('\n✅ Test completed successfully!');
    console.log('='.repeat(60));
    console.log('\n💡 Check your Discord channel to see the notifications!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);

  } finally {
    // Cleanup
    if (pgClient) {
      await pgClient.end();
    }

    await discordNotificationService.disconnect();
    process.exit(0);
  }
}

// Run test
testSignalWithDiscord();
