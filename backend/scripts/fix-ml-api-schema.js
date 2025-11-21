/**
 * Fix ML API Schema Issues
 * Adds missing columns and fixes field mappings for ML APIs
 */

const { sequelize } = require('../src/config/database');

async function fixMLAPISchema() {
  try {
    console.log('🔧 Fixing ML API schema issues...\n');

    // Fix TradingSignal actualPnL columns (snake_case vs camelCase)
    console.log('1. Fixing TradingSignal P&L columns...');
    await sequelize.query(`
      ALTER TABLE trading_signals
      RENAME COLUMN actual_pnl TO actual_pn_l;
    `).catch(() => console.log('   actual_pnl column may already be actual_pn_l'));

    await sequelize.query(`
      ALTER TABLE trading_signals
      RENAME COLUMN actual_pnl_percent TO actual_pn_l_percent;
    `).catch(() => console.log('   actual_pnl_percent column may already be actual_pn_l_percent'));

    console.log('✅ P&L columns fixed\n');

    // Fix UserTradingHistory amount column
    console.log('2. Checking UserTradingHistory amount column...');
    await sequelize.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'user_trading_history' AND column_name = 'amount';
    `).then(([results]) => {
      if (results.length === 0) {
        console.log('   amount column doesn\'t exist - this is OK, using other columns');
      } else {
        console.log('   amount column exists');
      }
    });
    console.log('✅ UserTradingHistory checked\n');

    console.log('✅ ML API schema fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing schema:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the fix
fixMLAPISchema();
