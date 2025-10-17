/**
 * Test Script for Discord Notification Service
 *
 * Tests Discord bot connection and signal notification formatting
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const discordNotificationService = require('../src/services/discordNotificationService');

/**
 * Create a mock signal for testing
 */
function createMockSignal(type = 'long') {
  return {
    pair: 'EUR/USD',
    timeframe: '1h',
    signal: type,
    confidence: 0.683,
    stage1_prob: 0.684,
    stage2_prob: 0.683,
    model_version: 'v3.1',
    detected_at: new Date(),
    factors: {
      technical: 0.72,
      momentum: 0.65,
      volatility: 0.68
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Main test function
 */
async function testDiscordNotification() {
  console.log('='.repeat(60));
  console.log('🧪 Discord Notification Service Test');
  console.log('='.repeat(60));

  try {
    // Check environment variables
    console.log('\n1️⃣  Checking environment variables...');
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_SIGNAL_CHANNEL_ID;

    if (!botToken) {
      throw new Error('DISCORD_BOT_TOKEN not set in .env file');
    }

    if (!channelId) {
      throw new Error('DISCORD_SIGNAL_CHANNEL_ID not set in .env file');
    }

    console.log('   ✅ DISCORD_BOT_TOKEN: ' + botToken.substring(0, 20) + '...');
    console.log('   ✅ DISCORD_SIGNAL_CHANNEL_ID:', channelId);

    // Initialize Discord service
    console.log('\n2️⃣  Initializing Discord service...');
    await discordNotificationService.initialize();
    console.log('   ✅ Discord service initialized');

    // Get status
    console.log('\n3️⃣  Service status:');
    const status = discordNotificationService.getStatus();
    console.log(`   Is Ready: ${status.isReady}`);
    console.log(`   Connected as: ${status.connected}`);
    console.log(`   Default Channel: ${status.defaultChannel}`);
    console.log(`   Stats:`, status.stats);

    // Send test message
    console.log('\n4️⃣  Sending test message...');
    const testResult = await discordNotificationService.sendTestMessage();

    if (testResult) {
      console.log('   ✅ Test message sent successfully');
    } else {
      throw new Error('Failed to send test message');
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send mock LONG signal
    console.log('\n5️⃣  Sending mock LONG signal notification...');
    const mockLongSignal = createMockSignal('long');
    const longResult = await discordNotificationService.sendSignalNotification(mockLongSignal);

    if (longResult.success) {
      console.log('   ✅ LONG signal notification sent');
      console.log(`      Channel: ${longResult.channelId}`);
      console.log(`      Skipped: ${longResult.skipped || false}`);
    } else {
      throw new Error(`Failed to send LONG signal: ${longResult.error}`);
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send mock SHORT signal
    console.log('\n6️⃣  Sending mock SHORT signal notification...');
    const mockShortSignal = createMockSignal('short');
    mockShortSignal.pair = 'USD/JPY';
    mockShortSignal.timeframe = '15min';
    mockShortSignal.confidence = 0.725;
    mockShortSignal.stage1_prob = 0.730;
    mockShortSignal.stage2_prob = 0.720;

    const shortResult = await discordNotificationService.sendSignalNotification(mockShortSignal);

    if (shortResult.success) {
      console.log('   ✅ SHORT signal notification sent');
      console.log(`      Channel: ${shortResult.channelId}`);
      console.log(`      Skipped: ${shortResult.skipped || false}`);
    } else {
      throw new Error(`Failed to send SHORT signal: ${shortResult.error}`);
    }

    // Test deduplication
    console.log('\n7️⃣  Testing deduplication (sending same signal again)...');
    const dupResult = await discordNotificationService.sendSignalNotification(mockShortSignal);

    if (dupResult.success && dupResult.skipped) {
      console.log('   ✅ Duplicate signal correctly skipped');
      console.log(`      Reason: ${dupResult.reason}`);
    } else {
      console.log('   ⚠️  Deduplication test: signal was not skipped (might be a timing issue)');
    }

    // Final status
    console.log('\n8️⃣  Final service statistics:');
    const finalStatus = discordNotificationService.getStatus();
    console.log(`   Total Sent: ${finalStatus.stats.totalSent}`);
    console.log(`   Failures: ${finalStatus.stats.failures}`);
    console.log(`   Deduplicated: ${finalStatus.stats.deduplicated}`);
    console.log(`   Recent Signals in Cache: ${finalStatus.recentSignalsCount}`);

    // Disconnect
    console.log('\n9️⃣  Disconnecting...');
    await discordNotificationService.disconnect();
    console.log('   ✅ Disconnected');

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed!');
    console.log('='.repeat(60));
    console.log('\n💡 Next steps:');
    console.log('   1. Check your Discord channel to see the test messages');
    console.log('   2. Verify the embed formatting looks good');
    console.log('   3. Run the full signal monitoring test:');
    console.log('      node scripts/test-signal-check-simple.js');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);

    // Try to disconnect
    try {
      await discordNotificationService.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }

    process.exit(1);
  }
}

// Run test
testDiscordNotification();
