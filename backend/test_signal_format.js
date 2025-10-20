/**
 * Test Signal Format
 * Quick test to verify Discord notification format after fixes
 */

const discordNotificationService = require('./src/services/discordNotificationService');

// Simulate a signal from ML API (with proper factors format)
const testSignal = {
  pair: 'EUR/USD',
  timeframe: '1h',
  signal: 'short',
  confidence: 0.6834,
  stage1_prob: 0.6836,
  stage2_prob: 0.6832,
  model_version: 'v3.1',
  factors: {
    reversal_detected: true,  // Boolean
    direction: 'short'          // String
  },
  detected_at: new Date(),
  metadata: {
    timestamp: new Date().toISOString()
  }
};

console.log('\n🧪 Testing Discord signal format...\n');
console.log('Test Signal:', JSON.stringify(testSignal, null, 2));

// Test embed formatting (without actually sending)
const embed = discordNotificationService.formatSignalEmbed(testSignal);

console.log('\n📋 Formatted Embed Fields:');
embed.data.fields.forEach(field => {
  console.log(`\n${field.name}:`);
  console.log(`  ${field.value}`);
});

console.log('\n✅ Format test complete\n');
console.log('Expected "主要因素":');
console.log('  • reversal_detected: ✅');
console.log('  • direction: short');
console.log('\n');

process.exit(0);
