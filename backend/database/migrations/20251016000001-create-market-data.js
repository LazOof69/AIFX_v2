'use strict';

/**
 * Migration: Create Market Data Table
 *
 * Purpose: Store historical and real-time forex market data (OHLC)
 * Supports: Multiple currency pairs and timeframes for ML training and prediction
 *
 * Created: 2025-10-16
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('market_data', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },

      // Pair and timeframe identification
      pair: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Currency pair (e.g., EUR/USD, USD/JPY)'
      },
      timeframe: {
        type: Sequelize.ENUM('1min', '5min', '15min', '30min', '1h', '4h', '1d', '1w', '1M'),
        allowNull: false,
        comment: 'Candlestick timeframe'
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Candlestick timestamp (UTC)'
      },

      // OHLC data
      open: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: false,
        comment: 'Opening price'
      },
      high: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: false,
        comment: 'Highest price'
      },
      low: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: false,
        comment: 'Lowest price'
      },
      close: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: false,
        comment: 'Closing price'
      },
      volume: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: 0,
        comment: 'Trading volume'
      },

      // Technical indicators cache (JSON)
      technical_indicators: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Cached technical indicators (SMA, RSI, etc.)'
      },

      // Data source information
      source: {
        type: Sequelize.ENUM('alpha_vantage', 'twelve_data', 'manual', 'calculated', 'yfinance'),
        allowNull: false,
        defaultValue: 'alpha_vantage',
        comment: 'Data source API'
      },

      // Cache metadata
      cache_expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP + INTERVAL '1 minute'"),
        comment: 'Cache expiration timestamp'
      },
      is_real_time: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether this is real-time data'
      },

      // Market state
      market_state: {
        type: Sequelize.ENUM('open', 'closed', 'pre_market', 'after_hours'),
        allowNull: true,
        comment: 'Current market state'
      },
      spread: {
        type: Sequelize.DECIMAL(8, 5),
        allowNull: true,
        comment: 'Bid-ask spread'
      },

      // Data quality metrics
      data_quality: {
        type: Sequelize.JSONB,
        defaultValue: {
          completeness: 1.0,
          accuracy: 1.0,
          timeliness: 1.0,
          consistency: 1.0
        },
        allowNull: false,
        comment: 'Data quality metrics'
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create indexes for efficient querying
    await queryInterface.addIndex('market_data', ['pair', 'timeframe', 'timestamp'], {
      unique: true,
      name: 'unique_market_data_entry'
    });

    await queryInterface.addIndex('market_data', ['pair', 'timeframe'], {
      name: 'pair_timeframe_index'
    });

    await queryInterface.addIndex('market_data', ['timestamp'], {
      name: 'timestamp_index'
    });

    await queryInterface.addIndex('market_data', ['cache_expires_at'], {
      name: 'cache_expiry_index'
    });

    await queryInterface.addIndex('market_data', ['is_real_time'], {
      name: 'realtime_index'
    });

    await queryInterface.addIndex('market_data', ['source'], {
      name: 'source_index'
    });

    console.log('✅ market_data table created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('market_data');
    console.log('✅ market_data table dropped successfully');
  }
};
