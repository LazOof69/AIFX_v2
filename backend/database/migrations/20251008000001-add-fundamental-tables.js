'use strict';

/**
 * Migration: Add Fundamental Data and Economic Events Tables
 * For Phase 2 MVP - Fundamental + Event Integration
 *
 * Tables:
 * 1. fundamental_data - Economic indicators (GDP, CPI, interest rates, etc.)
 * 2. economic_events - Economic calendar events (NFP, Fed decisions, etc.)
 * 3. interest_rates - Optimized table for quick interest rate queries
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    // ==========================================
    // 1. FUNDAMENTAL DATA TABLE
    // ==========================================
    await queryInterface.createTable('fundamental_data', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Data date (YYYY-MM-DD)',
      },
      country: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: 'Country code: US, EU, GB, JP, AU, CA, CH, NZ',
      },
      indicator: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Indicator name: interest_rate, gdp, cpi, unemployment, inflation, pmi, trade_balance',
      },
      value: {
        type: Sequelize.DECIMAL(15, 6),
        allowNull: false,
        comment: 'Indicator value',
      },
      source: {
        type: Sequelize.STRING(50),
        defaultValue: 'FRED',
        comment: 'Data source: FRED, TradingEconomics, Manual, etc.',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes for fundamental_data
    await queryInterface.addIndex('fundamental_data', ['date', 'country', 'indicator'], {
      name: 'idx_fundamental_date_country_indicator',
      unique: true,
      comment: 'Prevent duplicate entries for same date/country/indicator',
    });

    await queryInterface.addIndex('fundamental_data', ['country', 'indicator'], {
      name: 'idx_fundamental_country_indicator',
      comment: 'Fast lookup by country and indicator',
    });

    await queryInterface.addIndex('fundamental_data', ['date'], {
      name: 'idx_fundamental_date',
      comment: 'Fast date range queries',
    });

    // ==========================================
    // 2. ECONOMIC EVENTS TABLE
    // ==========================================
    await queryInterface.createTable('economic_events', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      event_date: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Event datetime (UTC)',
      },
      currency: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: 'Affected currency: USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD',
      },
      event_name: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: 'Event name: Fed Rate Decision, Non-Farm Payrolls, CPI, etc.',
      },
      impact_level: {
        type: Sequelize.ENUM('high', 'medium', 'low'),
        allowNull: false,
        defaultValue: 'medium',
        comment: 'Expected market impact level',
      },
      forecast_value: {
        type: Sequelize.DECIMAL(15, 6),
        allowNull: true,
        comment: 'Forecasted/expected value',
      },
      actual_value: {
        type: Sequelize.DECIMAL(15, 6),
        allowNull: true,
        comment: 'Actual released value (filled after event)',
      },
      previous_value: {
        type: Sequelize.DECIMAL(15, 6),
        allowNull: true,
        comment: 'Previous period value',
      },
      source: {
        type: Sequelize.STRING(50),
        defaultValue: 'ForexFactory',
        comment: 'Data source: ForexFactory, TradingEconomics, Manual',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes for economic_events
    await queryInterface.addIndex('economic_events', ['event_date'], {
      name: 'idx_events_date',
      comment: 'Fast date range queries for upcoming events',
    });

    await queryInterface.addIndex('economic_events', ['currency', 'event_date'], {
      name: 'idx_events_currency_date',
      comment: 'Fast lookup for currency-specific events',
    });

    await queryInterface.addIndex('economic_events', ['impact_level'], {
      name: 'idx_events_impact',
      comment: 'Filter by impact level',
    });

    await queryInterface.addIndex('economic_events', ['currency', 'impact_level', 'event_date'], {
      name: 'idx_events_currency_impact_date',
      comment: 'Composite index for high-impact event queries',
    });

    // ==========================================
    // 3. INTEREST RATES TABLE (Optimized)
    // ==========================================
    await queryInterface.createTable('interest_rates', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        unique: true,
        comment: 'Date of interest rates',
      },
      fed_rate: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        comment: 'US Federal Reserve rate (%)',
      },
      ecb_rate: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        comment: 'European Central Bank rate (%)',
      },
      boe_rate: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        comment: 'Bank of England rate (%)',
      },
      boj_rate: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        comment: 'Bank of Japan rate (%)',
      },
      rba_rate: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        comment: 'Reserve Bank of Australia rate (%)',
      },
      boc_rate: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        comment: 'Bank of Canada rate (%)',
      },
      snb_rate: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        comment: 'Swiss National Bank rate (%)',
      },
      rbnz_rate: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        comment: 'Reserve Bank of New Zealand rate (%)',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes for interest_rates
    await queryInterface.addIndex('interest_rates', ['date'], {
      name: 'idx_interest_rates_date',
      unique: true,
      comment: 'Unique constraint on date',
    });

    console.log('✅ Fundamental data tables created successfully');
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order
    await queryInterface.dropTable('interest_rates');
    await queryInterface.dropTable('economic_events');
    await queryInterface.dropTable('fundamental_data');

    console.log('✅ Fundamental data tables dropped successfully');
  }
};
