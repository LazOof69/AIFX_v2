/**
 * CLI Script: Import CSV to Database
 *
 * Usage:
 *   node scripts/import-csv-to-db.js
 *
 * Purpose: Import forex data from CSV files into market_data table
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const MarketData = require('../src/models/MarketData');
const { sequelize } = require('../src/config/database');

async function importCSV(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        records.push({
          timestamp: new Date(row.timestamp),
          open: parseFloat(row.open),
          high: parseFloat(row.high),
          low: parseFloat(row.low),
          close: parseFloat(row.close),
          volume: parseInt(row.volume) || 0,
          pair: row.pair,
          timeframe: row.timeframe,
          source: row.source || 'yfinance',
          isRealTime: false, // Historical data
          technicalIndicators: {},
          dataQuality: {
            completeness: 1.0,
            accuracy: 1.0,
            timeliness: 1.0,
            consistency: 1.0
          }
        });
      })
      .on('end', () => resolve(records))
      .on('error', (error) => reject(error));
  });
}

async function bulkInsert(records, pair, timeframe) {
  console.log(`   Importing ${records.length} records...`);

  let inserted = 0;
  let skipped = 0;

  // Process in batches of 1000
  const batchSize = 1000;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    try {
      // Use bulkCreate with updateOnDuplicate to handle existing records
      const result = await MarketData.bulkCreate(batch, {
        updateOnDuplicate: ['open', 'high', 'low', 'close', 'volume', 'source'],
        returning: false // Don't return created records (performance)
      });

      inserted += result.length;

    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        skipped += batch.length;
      } else {
        console.error(`   ❌ Batch error:`, error.message);
      }
    }

    // Progress indicator
    const progress = Math.min(i + batchSize, records.length);
    process.stdout.write(`\r   Progress: ${progress}/${records.length} (${Math.round(progress/records.length*100)}%)`);
  }

  console.log(''); // New line after progress
  return { inserted, skipped };
}

async function main() {
  console.log('='.repeat(60));
  console.log('📥 CSV to Database Importer');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connected');
    console.log('');

    // CSV files to import
    const csvDir = '/root/AIFX_v2/ml_engine/data/intraday';
    const files = [
      { file: 'EURUSD_yfinance_1h.csv', pair: 'EUR/USD', timeframe: '1h' },
      { file: 'EURUSD_yfinance_15m.csv', pair: 'EUR/USD', timeframe: '15min' },
      { file: 'USDJPY_yfinance_1h.csv', pair: 'USD/JPY', timeframe: '1h' },
      { file: 'USDJPY_yfinance_15m.csv', pair: 'USD/JPY', timeframe: '15min' }
    ];

    const results = [];

    for (const { file, pair, timeframe } of files) {
      const filePath = path.join(csvDir, file);

      console.log(`📊 ${pair} ${timeframe}`);
      console.log('-'.repeat(40));

      if (!fs.existsSync(filePath)) {
        console.log(`   ⏭️  File not found, skipping`);
        console.log('');
        continue;
      }

      try {
        // Read CSV
        console.log(`   Reading CSV...`);
        const records = await importCSV(filePath);

        if (records.length === 0) {
          console.log(`   ⚠️  No records found in CSV`);
          console.log('');
          continue;
        }

        console.log(`   ✅ Parsed ${records.length} records`);

        // Calculate date range
        const timestamps = records.map(r => r.timestamp);
        const oldest = new Date(Math.min(...timestamps));
        const newest = new Date(Math.max(...timestamps));
        console.log(`   📅 Date range: ${oldest.toISOString()} to ${newest.toISOString()}`);

        // Calculate cache expiry
        const expiryMinutes = timeframe === '1h' ? 60 : 15;
        records.forEach(record => {
          record.cacheExpiresAt = new Date(record.timestamp.getTime() + expiryMinutes * 60 * 1000);
        });

        // Import to database
        const { inserted, skipped } = await bulkInsert(records, pair, timeframe);

        console.log(`   ✅ Inserted: ${inserted}, Skipped: ${skipped}`);
        console.log('');

        results.push({
          pair,
          timeframe,
          total: records.length,
          inserted,
          skipped,
          status: 'success'
        });

      } catch (error) {
        console.error(`   ❌ Error:`, error.message);
        console.log('');

        results.push({
          pair,
          timeframe,
          status: 'failed',
          error: error.message
        });
      }
    }

    // Summary
    console.log('='.repeat(60));
    console.log('📊 Import Summary');
    console.log('='.repeat(60));
    console.log('');

    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');

    if (successful.length > 0) {
      console.log(`✅ Successfully imported ${successful.length} datasets:`);
      successful.forEach(r => {
        console.log(`   ${r.pair} ${r.timeframe}: ${r.inserted} records inserted, ${r.skipped} skipped`);
      });
      console.log('');
    }

    if (failed.length > 0) {
      console.log(`❌ Failed ${failed.length} datasets:`);
      failed.forEach(r => {
        console.log(`   ${r.pair} ${r.timeframe}: ${r.error}`);
      });
      console.log('');
    }

    // Final verification
    console.log('📈 Database Verification:');
    const stats = await MarketData.findAll({
      attributes: [
        'pair',
        'timeframe',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('MIN', sequelize.col('timestamp')), 'oldest'],
        [sequelize.fn('MAX', sequelize.col('timestamp')), 'newest']
      ],
      group: ['pair', 'timeframe'],
      raw: true
    });

    stats.forEach(stat => {
      console.log(`   ${stat.pair} ${stat.timeframe}: ${stat.count} candles`);
      console.log(`     Range: ${stat.oldest} to ${stat.newest}`);
    });

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Done!');
    console.log('='.repeat(60));

    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ Fatal Error:', error.message);
    console.error('='.repeat(60));
    console.error(error.stack);
    await sequelize.close();
    process.exit(1);
  }
}

main();
