/**
 * Discord API Test Script
 * Tests the new Discord Bot APIs (Phase 2)
 *
 * This script tests all Discord API endpoints with proper API Key authentication
 *
 * Usage:
 *   node src/tests/api/test-discord-api.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.DISCORD_BOT_API_KEY || 'dev_discord_bot_key_replace_in_production';

// Test Discord user data
const TEST_DISCORD_ID = '123456789012345678';
const TEST_DISCORD_USERNAME = 'test_trader#1234';

// Axios instance with API Key
const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1/discord`,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'X-Service-Name': 'discord-bot',
    'Content-Type': 'application/json',
  },
});

// Test results tracking
let testsPassed = 0;
let testsFailed = 0;

/**
 * Test helper function
 */
async function runTest(name, testFn) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await testFn();
    console.log(`✅ PASSED: ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ FAILED: ${name}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    testsFailed++;
  }
}

/**
 * Test 1: Health check
 */
async function testHealthCheck() {
  const response = await apiClient.get('/health');
  if (response.data.success && response.data.data.status === 'healthy') {
    console.log(`   Health status: ${response.data.data.status}`);
  } else {
    throw new Error('Health check failed');
  }
}

/**
 * Test 2: Create or update user
 */
async function testCreateUser() {
  const response = await apiClient.post('/users', {
    discordId: TEST_DISCORD_ID,
    discordUsername: TEST_DISCORD_USERNAME,
    username: 'test_trader',
    notificationsEnabled: true,
  });

  if (response.data.success) {
    console.log(`   User created: ${response.data.data.username}`);
    console.log(`   User ID: ${response.data.data.userId}`);
  } else {
    throw new Error('User creation failed');
  }
}

/**
 * Test 3: Get user by Discord ID
 */
async function testGetUser() {
  const response = await apiClient.get(`/users/${TEST_DISCORD_ID}`);

  if (response.data.success && response.data.data.discordId === TEST_DISCORD_ID) {
    console.log(`   Found user: ${response.data.data.username}`);
    console.log(`   Notifications enabled: ${response.data.data.discordSettings.notificationsEnabled}`);
  } else {
    throw new Error('User retrieval failed');
  }
}

/**
 * Test 4: Update Discord settings
 */
async function testUpdateSettings() {
  const response = await apiClient.put(`/users/${TEST_DISCORD_ID}/settings`, {
    notificationsEnabled: true,
    enabledTimeframes: ['1h', '4h', '1d'],
    preferredPairs: ['EUR/USD', 'GBP/USD'],
    minConfidence: 0.7,
    maxNotificationsPerDay: 10,
  });

  if (response.data.success) {
    console.log(`   Settings updated`);
    console.log(`   Min confidence: ${response.data.data.settings.minConfidence}`);
    console.log(`   Preferred pairs: ${response.data.data.settings.preferredPairs.join(', ')}`);
  } else {
    throw new Error('Settings update failed');
  }
}

/**
 * Test 5: Get pending signals
 */
async function testGetSignals() {
  const response = await apiClient.get('/signals?limit=5');

  if (response.data.success) {
    const signalCount = response.data.data.signals.length;
    console.log(`   Found ${signalCount} pending signals`);
    if (signalCount > 0) {
      const signal = response.data.data.signals[0];
      console.log(`   First signal: ${signal.signal} ${signal.pair} (confidence: ${signal.confidence})`);
    }
  } else {
    throw new Error('Signals retrieval failed');
  }
}

/**
 * Test 6: Get trading history
 */
async function testGetTrades() {
  try {
    const response = await apiClient.get(`/trades?discordId=${TEST_DISCORD_ID}&limit=5`);

    if (response.data.success) {
      const tradeCount = response.data.data.trades.length;
      console.log(`   Found ${tradeCount} trades`);
    } else {
      throw new Error('Trades retrieval failed');
    }
  } catch (error) {
    // It's okay if there are no trades yet
    if (error.response && error.response.status === 404) {
      console.log(`   No trades found (expected for new user)`);
    } else {
      throw error;
    }
  }
}

/**
 * Test 7: Record a trade
 */
async function testRecordTrade() {
  const response = await apiClient.post('/trades', {
    discordId: TEST_DISCORD_ID,
    pair: 'EUR/USD',
    action: 'buy',
    amount: 1000,
    entryPrice: 1.1234,
    stopLoss: 1.1200,
    takeProfit: 1.1300,
  });

  if (response.data.success && response.status === 201) {
    console.log(`   Trade recorded: ${response.data.data.action} ${response.data.data.pair}`);
    console.log(`   Trade ID: ${response.data.data.tradeId}`);
    console.log(`   Entry price: ${response.data.data.entryPrice}`);
  } else {
    throw new Error('Trade recording failed');
  }
}

/**
 * Test 8: Invalid API key (should fail)
 */
async function testInvalidApiKey() {
  const invalidClient = axios.create({
    baseURL: `${BASE_URL}/api/v1/discord`,
    headers: {
      'Authorization': 'Bearer invalid_key_12345',
      'Content-Type': 'application/json',
    },
  });

  try {
    await invalidClient.get('/health');
    throw new Error('Should have rejected invalid API key');
  } catch (error) {
    if (error.response && error.response.status === 403) {
      console.log(`   Correctly rejected invalid API key (403)`);
    } else {
      throw new Error('Expected 403 status for invalid API key');
    }
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Discord API Tests - Phase 2            ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 20)}...`);

  // Run all tests
  await runTest('1. Health Check', testHealthCheck);
  await runTest('2. Create/Update User', testCreateUser);
  await runTest('3. Get User by Discord ID', testGetUser);
  await runTest('4. Update Discord Settings', testUpdateSettings);
  await runTest('5. Get Pending Signals', testGetSignals);
  await runTest('6. Get Trading History', testGetTrades);
  await runTest('7. Record Trade', testRecordTrade);
  await runTest('8. Invalid API Key (should fail)', testInvalidApiKey);

  // Print summary
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Test Summary                           ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📊 Total:  ${testsPassed + testsFailed}`);

  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('\n💥 Unexpected error:', error.message);
  process.exit(1);
});
