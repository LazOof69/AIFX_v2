/**
 * Discord Bot Backend API Client Tests - Phase 4
 *
 * Tests to verify Discord Bot uses Backend APIs correctly
 * Following microservices architecture principles (CLAUDE.md)
 */

const backendApiClient = require('../services/backendApiClient');

// Test state
let testUserId = null;
let testTradeId = null;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function printHeader(title) {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`   ${title}`);
  console.log(`${'═'.repeat(50)}\n`);
}

function printTest(name) {
  console.log(`${colors.blue}🧪 Testing: ${name}${colors.reset}`);
}

function printSuccess(message) {
  console.log(`${colors.green}✅ PASSED: ${message}${colors.reset}\n`);
}

function printError(message, error) {
  console.log(`${colors.red}❌ FAILED: ${message}${colors.reset}`);
  console.log(`   Error: ${error}`);
  console.log();
}

function printInfo(message) {
  console.log(`   ${message}`);
}

/**
 * Test 1: Health Check
 */
async function testHealthCheck() {
  printTest('1. Backend API Health Check');
  try {
    const health = await backendApiClient.checkHealth();
    printInfo(`Status: ${health.status}`);
    printInfo(`Service: ${health.service}`);
    printSuccess('1. Backend API Health Check');
  } catch (error) {
    printError('1. Backend API Health Check', error.message);
    throw error;
  }
}

/**
 * Test 2: Get/Create User
 */
async function testGetOrCreateUser() {
  printTest('2. Get or Create User');
  try {
    const discordId = '123456789012345678';
    const discordUsername = 'test_user_phase4';

    const user = await backendApiClient.getOrCreateUser(discordId, discordUsername);
    testUserId = user.id;

    printInfo(`User ID: ${testUserId}`);
    printInfo(`Discord ID: ${user.discordId || 'N/A'}`);
    printInfo(`Username: ${user.username}`);
    printSuccess('2. Get or Create User');
  } catch (error) {
    printError('2. Get or Create User', error.message);
    throw error;
  }
}

/**
 * Test 3: Get User by Discord ID
 */
async function testGetUserByDiscordId() {
  printTest('3. Get User by Discord ID');
  try {
    const discordId = '123456789012345678';
    const user = await backendApiClient.getUserByDiscordId(discordId);

    if (user) {
      printInfo(`User found: ${user.username}`);
      printInfo(`User ID: ${user.id}`);
      printSuccess('3. Get User by Discord ID');
    } else {
      throw new Error('User not found');
    }
  } catch (error) {
    printError('3. Get User by Discord ID', error.message);
    throw error;
  }
}

/**
 * Test 4: Update Discord Settings
 */
async function testUpdateDiscordSettings() {
  printTest('4. Update Discord Settings');
  try {
    const discordId = '123456789012345678';
    const settings = {
      notificationsEnabled: true,
      preferredPairs: ['EUR/USD', 'GBP/USD'],
      minConfidence: 0.7,
    };

    const updated = await backendApiClient.updateDiscordSettings(discordId, settings);
    printInfo(`Notifications: ${updated.discordSettings?.notificationsEnabled || 'N/A'}`);
    printInfo(`Preferred pairs: ${updated.discordSettings?.preferredPairs?.length || 0}`);
    printSuccess('4. Update Discord Settings');
  } catch (error) {
    printError('4. Update Discord Settings', error.message);
    throw error;
  }
}

/**
 * Test 5: Record Trade
 */
async function testRecordTrade() {
  printTest('5. Record Trade');
  try {
    const discordId = '123456789012345678';
    const tradeData = {
      discordId,
      pair: 'EUR/USD',
      action: 'buy',
      amount: 1000,  // Required field
      entryPrice: 1.0950,
      stopLoss: 1.0900,
      takeProfit: 1.1050,
      positionSize: 2.5,
      notes: 'Phase 4 test trade',
    };

    const result = await backendApiClient.recordTrade(tradeData);
    testTradeId = result.tradeId;

    printInfo(`Trade ID: ${testTradeId}`);
    printInfo(`Pair: ${result.pair}`);
    printInfo(`Action: ${result.action}`);
    printInfo(`Entry Price: ${result.entryPrice}`);
    printSuccess('5. Record Trade');
  } catch (error) {
    printError('5. Record Trade', error.message);
    throw error;
  }
}

/**
 * Test 6: Get Trading History
 */
async function testGetTradingHistory() {
  printTest('6. Get Trading History');
  try {
    const discordId = '123456789012345678';
    const filters = {
      status: 'open',
      limit: 10,
    };

    const result = await backendApiClient.getTradingHistory(discordId, filters);
    printInfo(`Total trades: ${result.pagination?.total || result.trades?.length}`);
    printInfo(`Open trades: ${result.trades?.length || 0}`);

    if (result.trades && result.trades.length > 0) {
      printInfo(`Latest trade: ${result.trades[0].pair} ${result.trades[0].action}`);
    }

    printSuccess('6. Get Trading History');
  } catch (error) {
    printError('6. Get Trading History', error.message);
    throw error;
  }
}

/**
 * Test 7: Close Trade
 */
async function testCloseTrade() {
  printTest('7. Close Trade');
  try {
    if (!testTradeId) {
      throw new Error('No test trade ID available');
    }

    const exitPrice = 1.1000;
    const result = await backendApiClient.closeTrade(testTradeId, exitPrice, 100, 'Phase 4 test close');

    printInfo(`Trade closed: ${testTradeId.substring(0, 8)}`);
    printInfo(`Exit price: ${exitPrice}`);
    printInfo(`Status: ${result.trade?.status || 'closed'}`);
    printSuccess('7. Close Trade');
  } catch (error) {
    printError('7. Close Trade', error.message);
    throw error;
  }
}

/**
 * Test 8: Get Pending Signals
 */
async function testGetPendingSignals() {
  printTest('8. Get Pending Signals');
  try {
    const filters = {
      pair: 'EUR/USD',
      limit: 5,
    };

    const result = await backendApiClient.getPendingSignals(filters);
    printInfo(`Signals found: ${result.signals?.length || 0}`);

    if (result.signals && result.signals.length > 0) {
      printInfo(`Latest signal: ${result.signals[0].signal} ${result.signals[0].pair}`);
    }

    printSuccess('8. Get Pending Signals');
  } catch (error) {
    printError('8. Get Pending Signals', error.message);
    throw error;
  }
}

/**
 * Test 9: Verify No Direct Database Access
 */
async function testNoDirectDatabaseAccess() {
  printTest('9. Verify No Direct Database Access');
  try {
    // Check that backendApiClient doesn't import database modules
    const fs = require('fs');
    const path = require('path');

    const clientPath = path.join(__dirname, '../services/backendApiClient.js');
    const clientCode = fs.readFileSync(clientPath, 'utf8');

    const forbiddenImports = [
      'require(\'../../backend/src/config/database\')',
      'require(\'../../backend/src/models/',
      'require("../../backend/src/config/database")',
      'require("../../backend/src/models/',
      'sequelize',
    ];

    let hasDirectAccess = false;
    const violations = [];

    for (const forbidden of forbiddenImports) {
      if (clientCode.includes(forbidden)) {
        hasDirectAccess = true;
        violations.push(forbidden);
      }
    }

    if (hasDirectAccess) {
      throw new Error(`Found direct database access: ${violations.join(', ')}`);
    }

    printInfo('✓ No database imports found');
    printInfo('✓ Uses axios for API calls only');
    printInfo('✓ Follows microservices architecture');
    printSuccess('9. Verify No Direct Database Access');
  } catch (error) {
    printError('9. Verify No Direct Database Access', error.message);
    throw error;
  }
}

/**
 * Test 10: Invalid API Key (should fail)
 */
async function testInvalidApiKey() {
  printTest('10. Invalid API Key (should fail)');
  try {
    // Temporarily change API key
    const originalKey = backendApiClient.apiKey;
    backendApiClient.apiKey = 'invalid_key_12345';
    backendApiClient.client.defaults.headers['Authorization'] = 'Bearer invalid_key_12345';

    try {
      await backendApiClient.checkHealth();
      throw new Error('Should have failed with invalid API key');
    } catch (error) {
      if (error.response && error.response.status === 403) {
        printInfo('Correctly rejected invalid API key (403)');
        printSuccess('10. Invalid API Key (should fail)');
      } else {
        throw error;
      }
    } finally {
      // Restore original key
      backendApiClient.apiKey = originalKey;
      backendApiClient.client.defaults.headers['Authorization'] = `Bearer ${originalKey}`;
    }
  } catch (error) {
    printError('10. Invalid API Key (should fail)', error.message);
    throw error;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  printHeader('Discord Bot Backend API Client Tests - Phase 4');
  console.log(`Base URL: ${backendApiClient.baseURL}`);
  console.log(`API Key: ${backendApiClient.apiKey.substring(0, 20)}...`);
  console.log();

  let passed = 0;
  let failed = 0;

  const tests = [
    testHealthCheck,
    testGetOrCreateUser,
    testGetUserByDiscordId,
    testUpdateDiscordSettings,
    testRecordTrade,
    testGetTradingHistory,
    testCloseTrade,
    testGetPendingSignals,
    testNoDirectDatabaseAccess,
    testInvalidApiKey,
  ];

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      failed++;
      // Continue with other tests
    }
  }

  // Summary
  printHeader('Test Summary');
  console.log(`${colors.green}✅ Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${failed}${colors.reset}`);
  console.log(`${colors.blue}📊 Total:  ${tests.length}${colors.reset}`);
  console.log();

  if (failed === 0) {
    console.log(`${colors.green}🎉 All tests passed!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.yellow}⚠️  Some tests failed. Please review the errors above.${colors.reset}\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
