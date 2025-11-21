/**
 * Fix Database Schema
 * Adds missing columns for Phase 2 Discord APIs
 */

const { sequelize } = require('../src/config/database');

async function fixSchema() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('🔧 Fixing database schema...\n');

    // Add all missing columns to trading_signals
    const alterations = [
      { col: 'is_notified', sql: 'ADD COLUMN IF NOT EXISTS is_notified BOOLEAN DEFAULT false' },
      { col: 'notified_at', sql: 'ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP' },
      { col: 'factors', sql: 'ADD COLUMN IF NOT EXISTS factors JSONB DEFAULT \'{"technical": 0.0, "sentiment": 0.0, "pattern": 0.0}\'' },
      { col: 'user_id', sql: 'ADD COLUMN IF NOT EXISTS user_id UUID' },
      { col: 'source', sql: 'ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT \'ml_engine\'' },
      { col: 'signal_strength', sql: 'ADD COLUMN IF NOT EXISTS signal_strength VARCHAR(20) DEFAULT \'moderate\'' },
      { col: 'market_condition', sql: 'ADD COLUMN IF NOT EXISTS market_condition VARCHAR(20)' },
      { col: 'technical_data', sql: 'ADD COLUMN IF NOT EXISTS technical_data JSONB DEFAULT \'{}\'' },
      { col: 'expires_at', sql: 'ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP' },
      { col: 'triggered_at', sql: 'ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMP' },
      { col: 'triggered_price', sql: 'ADD COLUMN IF NOT EXISTS triggered_price DECIMAL(10, 5)' },
      { col: 'actual_outcome', sql: 'ADD COLUMN IF NOT EXISTS actual_outcome VARCHAR(20) DEFAULT \'pending\'' },
      { col: 'actual_pnl', sql: 'ADD COLUMN IF NOT EXISTS actual_pnl DECIMAL(10, 2)' },
      { col: 'actual_pnl_percent', sql: 'ADD COLUMN IF NOT EXISTS actual_pnl_percent DECIMAL(6, 2)' },
      { col: 'duration_minutes', sql: 'ADD COLUMN IF NOT EXISTS duration_minutes INTEGER' },
      { col: 'notification_channels', sql: 'ADD COLUMN IF NOT EXISTS notification_channels JSONB DEFAULT \'[]\'' },
      { col: 'market_data_snapshot', sql: 'ADD COLUMN IF NOT EXISTS market_data_snapshot JSONB' },
      { col: 'backtest_id', sql: 'ADD COLUMN IF NOT EXISTS backtest_id UUID' },
      { col: 'position_size', sql: 'ADD COLUMN IF NOT EXISTS position_size DECIMAL(5, 2)' },
    ];

    for (const { col, sql } of alterations) {
      try {
        await sequelize.query(`ALTER TABLE trading_signals ${sql};`);
        console.log(`✅ Added/checked ${col} column`);
      } catch (error) {
        console.log(`ℹ️  ${col} column may already exist`);
      }
    }

    // Make signal_id nullable in user_trading_history
    try {
      await sequelize.query(`
        ALTER TABLE user_trading_history
        ALTER COLUMN signal_id DROP NOT NULL;
      `);
      console.log('✅ Made signal_id nullable in user_trading_history');
    } catch (error) {
      console.log('ℹ️  signal_id may already be nullable');
    }

    console.log('\n✅ Database schema fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing schema:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixSchema();
