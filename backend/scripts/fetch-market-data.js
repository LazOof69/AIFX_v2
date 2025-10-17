/**
 * CLI Script: Fetch Market Data
 *
 * Usage:
 *   node scripts/fetch-market-data.js
 *
 * Purpose: Manually trigger market data collection for testing
 */

require('dotenv').config();
const marketDataService = require('../src/services/marketDataCollectionService');

async function main() {
  console.log('='.repeat(60));
  console.log('📊 Market Data Collection Script');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Check configuration
    if (!process.env.ALPHA_VANTAGE_KEY && !process.env.TWELVE_DATA_KEY) {
      console.error('❌ No API keys configured!');
      console.error('   Please set ALPHA_VANTAGE_KEY or TWELVE_DATA_KEY in .env file');
      process.exit(1);
    }

    console.log('✅ API keys configured');
    console.log('   Alpha Vantage:', process.env.ALPHA_VANTAGE_KEY ? 'Yes' : 'No');
    console.log('   Twelve Data:', process.env.TWELVE_DATA_KEY ? 'Yes' : 'No');
    console.log('');

    // Show current storage stats
    console.log('📈 Current Storage Stats:');
    const statsBefore = await marketDataService.getStorageStats();
    if (statsBefore.length === 0) {
      console.log('   No data stored yet');
    } else {
      statsBefore.forEach(stat => {
        console.log(`   ${stat.pair} ${stat.timeframe}: ${stat.count} candles (${stat.oldest} to ${stat.newest})`);
      });
    }
    console.log('');

    // Fetch latest data
    console.log('🔄 Fetching latest market data...');
    console.log('   Pairs: EUR/USD, USD/JPY');
    console.log('   Timeframes: 1h, 15min');
    console.log('');

    const results = await marketDataService.fetchLatestData();

    // Show results
    console.log('');
    console.log('='.repeat(60));
    console.log('📊 Results Summary');
    console.log('='.repeat(60));
    console.log('');

    if (results.success.length > 0) {
      console.log(`✅ Success (${results.success.length}):`);
      results.success.forEach(r => {
        console.log(`   ${r.pair} ${r.timeframe}: ${r.candlesStored} candles (latest: ${r.latestTimestamp})`);
      });
      console.log('');
    }

    if (results.skipped.length > 0) {
      console.log(`⏭️  Skipped (${results.skipped.length}):`);
      results.skipped.forEach(r => {
        console.log(`   ${r.pair} ${r.timeframe}: ${r.reason}`);
      });
      console.log('');
    }

    if (results.failed.length > 0) {
      console.log(`❌ Failed (${results.failed.length}):`);
      results.failed.forEach(r => {
        console.log(`   ${r.pair} ${r.timeframe}: ${r.error}`);
      });
      console.log('');
    }

    // Show updated storage stats
    console.log('📈 Updated Storage Stats:');
    const statsAfter = await marketDataService.getStorageStats();
    statsAfter.forEach(stat => {
      console.log(`   ${stat.pair} ${stat.timeframe}: ${stat.count} candles (${stat.oldest} to ${stat.newest})`);
    });
    console.log('');

    console.log('='.repeat(60));
    console.log('✅ Done!');
    console.log('='.repeat(60));

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ Error:', error.message);
    console.error('='.repeat(60));
    console.error(error.stack);
    process.exit(1);
  }
}

main();
