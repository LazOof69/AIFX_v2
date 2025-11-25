/**
 * Test Redis Signal Change Notification
 * 手动发布 Redis 事件来测试 Discord Bot 通知功能
 */

const redis = require('redis');

async function testNotification() {
  const client = redis.createClient({
    url: 'redis://localhost:6379'
  });

  await client.connect();

  const testEvent = {
    pair: 'EUR/USD',
    timeframe: '1h',
    oldSignal: 'hold',
    newSignal: 'buy',
    oldConfidence: 0.85,
    newConfidence: 0.92,
    signalStrength: 'strong',
    marketCondition: 'trending',
    entryPrice: 1.05234,
    indicators: {
      sma20: { value: 1.05123, signal: 'bullish' },
      rsi14: { value: 65.23, signal: 'neutral' }
    },
    subscribers: [
      {
        id: 'test-user-12345',
        username: 'TestUser'
      }
    ]
  };

  console.log('========================================');
  console.log('🧪 Testing Signal Change Notification');
  console.log('========================================');
  console.log('\nPublishing test event to signal-change channel...\n');
  console.log('Event:', JSON.stringify(testEvent, null, 2));

  await client.publish('signal-change', JSON.stringify(testEvent));

  console.log('\n✅ Event published successfully!');
  console.log('\nCheck Discord channel for notification.');
  console.log('========================================\n');

  await client.quit();
  process.exit(0);
}

testNotification().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
