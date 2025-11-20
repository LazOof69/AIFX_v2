/**
 * Discord Bot Integration Test
 * Tests Backend → Redis → Discord Bot notification flow
 */

const redis = require('./backend/node_modules/redis');

async function testDiscordIntegration() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('         Discord Bot Integration Test');
  console.log('═══════════════════════════════════════════════════════════\n');

  let redisClient;

  try {
    // Step 1: Connect to Redis
    console.log('📡 Step 1: Connecting to Redis...');
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      database: 2 // Discord bot uses DB 2
    });

    redisClient.on('error', (err) => console.error('Redis error:', err));

    await redisClient.connect();
    console.log('✅ Connected to Redis (database 2)\n');

    // Step 2: Check if Discord bot is subscribed
    console.log('📡 Step 2: Checking Discord bot subscription...');
    const channels = await redisClient.sendCommand(['PUBSUB', 'CHANNELS']);
    console.log('   Active channels:', channels);

    const subscribers = await redisClient.sendCommand(['PUBSUB', 'NUMSUB', 'trading-signals']);
    console.log('   trading-signals subscribers:', subscribers[1]);

    if (parseInt(subscribers[1]) === 0) {
      console.log('⚠️  WARNING: No subscribers on trading-signals channel!');
      console.log('   Make sure Discord bot is running.\n');
    } else {
      console.log('✅ Discord bot is subscribed to trading-signals\n');
    }

    // Step 3: Publish a test notification
    console.log('📡 Step 3: Publishing test notification...');

    const testNotification = {
      discordUserId: '1428608046509068368', // Test Discord user ID
      signal: {
        signal: 'buy',
        confidence: 0.89,
        signalStrength: 'strong',
        entryPrice: 1.16050,
        stopLoss: 1.15850,
        takeProfit: 1.16450,
        pair: 'EUR/USD',
        timeframe: '1h',
        mlEnhanced: true,
        timestamp: new Date().toISOString()
      },
      pair: 'EUR/USD',
      timeframe: '1h',
      timestamp: new Date().toISOString()
    };

    console.log('   Notification payload:');
    console.log(JSON.stringify(testNotification, null, 2));

    const publishResult = await redisClient.publish(
      'trading-signals',
      JSON.stringify(testNotification)
    );

    console.log(`\n✅ Published to ${publishResult} subscriber(s)\n`);

    // Step 4: Wait for Discord bot to process
    console.log('⏳ Step 4: Waiting 2 seconds for Discord bot to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('✅ Test notification sent!\n');

    // Step 5: Instructions for manual verification
    console.log('═══════════════════════════════════════════════════════════');
    console.log('         Manual Verification Steps');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('1. Check Discord bot logs:');
    console.log('   tail -20 /tmp/discord_bot.log\n');
    console.log('2. Expected log entries:');
    console.log('   - "Notification sent to user [discordUserId] for EUR/USD"');
    console.log('   - No errors about "Unknown interaction" or "40060"\n');
    console.log('3. Check Discord DMs:');
    console.log('   - User should receive trading signal embed message');
    console.log('   - Message should show BUY signal for EUR/USD\n');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error during integration test:', error);
    process.exit(1);
  } finally {
    if (redisClient) {
      await redisClient.quit();
      console.log('🔌 Disconnected from Redis\n');
    }
  }

  console.log('✅ Integration test completed successfully!\n');
  process.exit(0);
}

// Run test
testDiscordIntegration();
