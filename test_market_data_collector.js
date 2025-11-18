/**
 * Market Data Collector Test Script
 * Tests the fixed data collection pipeline and initializes historical data
 */

const path = require('path');

// Set environment before requiring services
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('./backend/node_modules/dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const { sequelize } = require('./backend/src/models');
const marketDataCollector = require('./backend/src/services/marketDataCollector');

async function testDataCollection() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('       Market Data Collector - Test & Initialize');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Test database connection
    console.log('📡 Step 1: Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Test single data collection (small batch)
    console.log('📡 Step 2: Testing single data collection (5 candles)...');
    const testResult = await marketDataCollector.collectData('EUR/USD', '1h', 5);

    if (testResult.success) {
      console.log(`✅ Test collection successful:`);
      console.log(`   - Pair: ${testResult.pair}`);
      console.log(`   - Timeframe: ${testResult.timeframe}`);
      console.log(`   - Candles collected: ${testResult.candlesCollected}`);
      console.log(`   - Candles stored: ${testResult.candlesStored}`);
      console.log(`   - From cache: ${testResult.cached ? 'Yes' : 'No'}\n`);
    } else {
      console.log(`❌ Test collection failed: ${testResult.error}\n`);
      throw new Error(testResult.error);
    }

    // Initialize historical data (60+ candles for ML)
    console.log('📡 Step 3: Initializing historical data (100 candles per pair)...');
    console.log('   This will take a few seconds...\n');

    const pairs = ['EUR/USD', 'USD/JPY'];
    const timeframes = ['1h', '4h', '1d', '1w'];

    let totalCollected = 0;
    let totalStored = 0;

    for (const pair of pairs) {
      for (const timeframe of timeframes) {
        console.log(`   📊 Collecting ${pair} ${timeframe}...`);

        const result = await marketDataCollector.collectData(pair, timeframe, 100);

        if (result.success) {
          console.log(`      ✅ Collected: ${result.candlesCollected}, Stored: ${result.candlesStored}`);
          totalCollected += result.candlesCollected;
          totalStored += result.candlesStored;
        } else {
          console.log(`      ❌ Failed: ${result.error}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   Summary');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Total candles collected: ${totalCollected}`);
    console.log(`   Total candles stored in DB: ${totalStored}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Verify database contents
    console.log('📡 Step 4: Verifying database contents...');

    const MarketData = require('./backend/src/models/MarketData');

    for (const pair of pairs) {
      for (const timeframe of timeframes) {
        const count = await MarketData.count({
          where: { pair, timeframe }
        });
        console.log(`   ${pair} ${timeframe}: ${count} candles in database`);
      }
    }

    console.log('\n✅ Market data initialization completed successfully!\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('   Next Steps');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('1. Signal Monitoring Service should now work correctly');
    console.log('2. Check logs: tail -f backend/logs/combined.log');
    console.log('3. Wait for next automated check (every 15 minutes)');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('🔌 Database connection closed\n');
  }

  process.exit(0);
}

// Run test
console.log('Starting Market Data Collector test...\n');
testDataCollection();
