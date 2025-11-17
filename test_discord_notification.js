/**
 * Test Discord notification flow
 * This script tests the complete notification flow from backend to Discord
 */

const redis = require('redis');

async function testDiscordNotification() {
  const redisClient = redis.createClient({
    url: 'redis://localhost:6379',
    database: 2
  });

  try {
    await redisClient.connect();
    console.log('✅ Connected to Redis');

    // Create a test notification
    const testNotification = {
      discordUserId: '1234567890', // Replace with actual Discord user ID for testing
      signal: {
        signal: 'buy',
        confidence: 0.85,
        mlEnhanced: true,
        source: 'ml_enhanced',
        entryPrice: 1.1519,
        stopLoss: 1.1450,
        takeProfit: 1.1650,
        signalStrength: 'strong',
        marketCondition: 'volatile',
        technicalData: {
          sma50: 1.1500,
          rsi: 65
        }
      },
      pair: 'EUR/USD',
      timeframe: '1h',
      timestamp: new Date().toISOString()
    };

    console.log('\n📤 Publishing test notification to trading-signals channel...');
    console.log('Notification:', JSON.stringify(testNotification, null, 2));

    // Publish to Redis
    await redisClient.publish('trading-signals', JSON.stringify(testNotification));

    console.log('\n✅ Notification published successfully!');
    console.log('📊 Check Discord bot logs for handling confirmation:');
    console.log('   tail -f /tmp/discord_bot.log');

    console.log('\n💡 Note: Replace discordUserId with a real Discord user ID to receive DM');
    console.log('   You can get your Discord user ID by enabling Developer Mode in Discord');
    console.log('   and right-clicking your username.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await redisClient.disconnect();
    console.log('\n✅ Disconnected from Redis');
  }
}

testDiscordNotification();
