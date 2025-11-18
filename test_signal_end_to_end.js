#!/usr/bin/env node
/**
 * End-to-End Signal Detection Test
 *
 * Tests the complete signal generation pipeline:
 * 1. Fetch market data from database
 * 2. Call ML Engine for prediction
 * 3. Detect reversal signals
 * 4. (Optional) Send Discord notification
 */

require('./backend/node_modules/dotenv').config({ path: './backend/.env' });

const signalMonitoringService = require('./backend/src/services/signalMonitoringService');
const discordNotificationService = require('./backend/src/services/discordNotificationService');

async function main() {
  console.log('='.repeat(80));
  console.log('🔍 End-to-End Signal Detection Test');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Test all 8 combinations
    const pairs = ['EUR/USD', 'USD/JPY'];
    const timeframes = ['1h', '4h', '1d', '1w'];

    console.log(`Testing ${pairs.length * timeframes.length} combinations...`);
    console.log('');

    let signalsDetected = 0;
    const detectedSignals = [];

    for (const pair of pairs) {
      for (const timeframe of timeframes) {
        try {
          console.log(`Checking ${pair} ${timeframe}...`);
          const signal = await signalMonitoringService.checkSignal(pair, timeframe);

          if (signal) {
            console.log(`  🚨 SIGNAL DETECTED!`);
            console.log(`     Signal: ${signal.signal.toUpperCase()}`);
            console.log(`     Confidence: ${(signal.confidence * 100).toFixed(2)}%`);
            console.log(`     Stage 1 Prob: ${(signal.stage1_prob * 100).toFixed(2)}%`);
            console.log(`     Stage 2 Prob: ${(signal.stage2_prob * 100).toFixed(2)}%`);
            console.log(`     Model: ${signal.model_version}`);
            signalsDetected++;
            detectedSignals.push(signal);
          } else {
            console.log(`  ✅ No signal (HOLD)`);
          }
        } catch (error) {
          console.log(`  ❌ Error: ${error.message}`);
        }
        console.log('');
      }
    }

    console.log('='.repeat(80));
    console.log(`📊 Test Results`);
    console.log('='.repeat(80));
    console.log(`Total combinations tested: ${pairs.length * timeframes.length}`);
    console.log(`Signals detected: ${signalsDetected}`);
    console.log('');

    // Test Discord notification if enabled and signals detected
    const discordEnabled = process.env.DISCORD_ENABLED === 'true';

    if (discordEnabled && detectedSignals.length > 0) {
      console.log('📤 Testing Discord Notification...');

      try {
        await discordNotificationService.initialize();

        const testSignal = detectedSignals[0];
        const result = await discordNotificationService.sendSignalNotification(testSignal);

        if (result.success) {
          if (result.skipped) {
            console.log(`✅ Notification skipped (${result.reason})`);
          } else {
            console.log(`✅ Discord notification sent successfully!`);
          }
        } else {
          console.log(`❌ Discord notification failed: ${result.error}`);
        }

        await discordNotificationService.disconnect();
      } catch (error) {
        console.log(`❌ Discord test failed: ${error.message}`);
      }
    } else if (!discordEnabled) {
      console.log('⏭️  Discord notifications disabled (DISCORD_ENABLED=false)');
    } else {
      console.log('ℹ️  No signals detected to test Discord notification');
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ End-to-End Test Complete');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
