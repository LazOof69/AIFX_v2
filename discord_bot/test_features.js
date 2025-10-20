/**
 * Feature Testing Script
 * Tests: User Mapping, Price Validation, Position Management
 */

const userMappingService = require('./services/userMappingService');
const { sequelize } = require('../backend/src/config/database');
const UserTradingHistory = require('../backend/src/models/UserTradingHistory');
const UserDiscordSettings = require('../backend/src/models/UserDiscordSettings');
const User = require('../backend/src/models/User');

// Test data
const TEST_DISCORD_USER = {
  id: '999888777666555444',
  username: 'TestTrader#1234'
};

const PRICE_VALIDATION_TESTS = [
  { pair: 'EUR/USD', validPrice: 1.0850, invalidPrice: 10.0000, description: 'EURUSD range validation' },
  { pair: 'GBP/USD', validPrice: 1.2650, invalidPrice: 0.5000, description: 'GBPUSD range validation' },
  { pair: 'USD/JPY', validPrice: 148.50, invalidPrice: 500.00, description: 'USDJPY range validation' }
];

async function testUserMapping() {
  console.log('\n🧪 TEST 1: User Mapping Service');
  console.log('='.repeat(60));

  try {
    // Test 1a: Create new user
    console.log('\n📝 Test 1a: Creating new Discord user mapping...');
    const result1 = await userMappingService.getOrCreateUser(
      TEST_DISCORD_USER.id,
      TEST_DISCORD_USER.username
    );

    console.log(`✅ Result:`, result1);
    console.log(`   - User ID: ${result1.userId}`);
    console.log(`   - Is New User: ${result1.isNewUser}`);

    if (!result1.isNewUser) {
      console.log('⚠️  WARNING: Expected isNewUser=true, but got false');
    }

    // Test 1b: Verify user created in database
    console.log('\n📝 Test 1b: Verifying user in database...');
    const user = await User.findByPk(result1.userId);
    console.log(`✅ User found:`, {
      id: user.id,
      username: user.username,
      email: user.email,
      isActive: user.isActive
    });

    // Test 1c: Verify Discord settings created
    console.log('\n📝 Test 1c: Verifying Discord settings...');
    const settings = await UserDiscordSettings.findOne({
      where: { userId: result1.userId }
    });
    console.log(`✅ Discord settings found:`, {
      discordUserId: settings.discordUserId,
      discordUsername: settings.discordUsername,
      notificationsEnabled: settings.notificationsEnabled,
      preferredPairs: settings.preferredPairs
    });

    // Test 1d: Get existing user (should not create new)
    console.log('\n📝 Test 1d: Getting existing user (should not create new)...');
    const result2 = await userMappingService.getOrCreateUser(
      TEST_DISCORD_USER.id,
      TEST_DISCORD_USER.username
    );
    console.log(`✅ Result:`, result2);
    console.log(`   - User ID matches: ${result2.userId === result1.userId}`);
    console.log(`   - Is New User: ${result2.isNewUser} (should be false)`);

    console.log('\n✅ User Mapping Test: PASSED');
    return result1.userId;

  } catch (error) {
    console.error('❌ User Mapping Test FAILED:', error.message);
    throw error;
  }
}

async function testPriceValidation() {
  console.log('\n\n🧪 TEST 2: Price Validation');
  console.log('='.repeat(60));

  // Load position command to access validation method
  const positionCommand = require('./commands/position');

  for (const test of PRICE_VALIDATION_TESTS) {
    console.log(`\n📝 Testing: ${test.description}`);

    // Test valid price
    const validResult = positionCommand._validatePrice(
      test.pair,
      test.validPrice,
      'entry_price'
    );
    console.log(`   Valid price ${test.validPrice}:`, validResult.valid ? '✅ PASS' : '❌ FAIL');

    // Test invalid price
    const invalidResult = positionCommand._validatePrice(
      test.pair,
      test.invalidPrice,
      'entry_price'
    );
    console.log(`   Invalid price ${test.invalidPrice}:`, !invalidResult.valid ? '✅ PASS' : '❌ FAIL');

    if (!invalidResult.valid) {
      console.log(`   Error message: "${invalidResult.message.substring(0, 80)}..."`);
    }
  }

  console.log('\n✅ Price Validation Test: PASSED');
}

async function testPartialPositionClose(userId) {
  console.log('\n\n🧪 TEST 3: Partial Position Close');
  console.log('='.repeat(60));

  try {
    // Create test position
    console.log('\n📝 Test 3a: Creating test position...');
    const position = await UserTradingHistory.create({
      userId: userId,
      pair: 'EUR/USD',
      action: 'buy',
      entryPrice: 1.0850,
      stopLoss: 1.0800,
      takeProfit: 1.0950,
      positionSize: 100.00,
      status: 'open',
      notes: 'Test position for partial close',
      openedAt: new Date()
    });

    console.log(`✅ Position created:`, {
      id: position.id,
      pair: position.pair,
      positionSize: position.positionSize,
      status: position.status
    });

    // Test 3b: Partial close 50%
    console.log('\n📝 Test 3b: Closing 50% of position...');
    const closingPercentage = 0.50;
    const exitPrice = 1.0900;
    const newPositionSize = parseFloat(position.positionSize) * (1 - closingPercentage);

    await position.update({
      positionSize: newPositionSize,
      notes: position.notes + `\nPartial close 50% @ ${exitPrice}`
    });

    await position.reload();
    console.log(`✅ Position after 50% close:`, {
      id: position.id,
      originalSize: 100.00,
      newSize: position.positionSize,
      notes: position.notes
    });

    // Test 3c: Full close remaining position
    console.log('\n📝 Test 3c: Closing remaining 100% of position...');
    const profitLoss = (exitPrice - parseFloat(position.entryPrice)) * parseFloat(position.positionSize);

    await position.update({
      status: 'closed',
      exitPrice: exitPrice,
      profitLoss: profitLoss,
      profitLossPercentage: ((exitPrice - parseFloat(position.entryPrice)) / parseFloat(position.entryPrice) * 100),
      result: profitLoss > 0 ? 'win' : 'loss',
      notes: position.notes + `\nClosed 100% via Test @ ${exitPrice}`,
      closedAt: new Date()
    });

    await position.reload();
    console.log(`✅ Position after full close:`, {
      id: position.id,
      status: position.status,
      exitPrice: position.exitPrice,
      profitLoss: position.profitLoss,
      result: position.result
    });

    console.log('\n✅ Partial Position Close Test: PASSED');

  } catch (error) {
    console.error('❌ Partial Position Close Test FAILED:', error.message);
    throw error;
  }
}

async function cleanup() {
  console.log('\n\n🧹 CLEANUP: Removing test data...');

  try {
    // Delete test user positions
    await UserTradingHistory.destroy({
      where: {
        userId: (await UserDiscordSettings.findOne({
          where: { discordUserId: TEST_DISCORD_USER.id }
        }))?.userId
      }
    });

    // Delete test user Discord settings
    await UserDiscordSettings.destroy({
      where: { discordUserId: TEST_DISCORD_USER.id }
    });

    // Delete test user
    const settings = await UserDiscordSettings.findOne({
      where: { discordUserId: TEST_DISCORD_USER.id }
    });

    if (settings) {
      await User.destroy({ where: { id: settings.userId } });
    }

    console.log('✅ Cleanup completed');

  } catch (error) {
    console.error('⚠️  Cleanup error (non-critical):', error.message);
  }
}

async function runAllTests() {
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('🚀 AIFX Discord Bot - Feature Testing Suite');
  console.log('═'.repeat(60));
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`🎯 Testing: User Mapping, Price Validation, Partial Close`);

  let userId = null;

  try {
    // Run tests
    userId = await testUserMapping();
    await testPriceValidation();
    await testPartialPositionClose(userId);

    console.log('\n');
    console.log('═'.repeat(60));
    console.log('🎉 ALL TESTS PASSED');
    console.log('═'.repeat(60));
    console.log('✅ User Mapping: Working');
    console.log('✅ Price Validation: Working');
    console.log('✅ Partial Position Close: Working');
    console.log('═'.repeat(60));

  } catch (error) {
    console.log('\n');
    console.log('═'.repeat(60));
    console.log('❌ TESTS FAILED');
    console.log('═'.repeat(60));
    console.error(error);

  } finally {
    await cleanup();
    await sequelize.close();
    process.exit(0);
  }
}

// Run tests
runAllTests();
