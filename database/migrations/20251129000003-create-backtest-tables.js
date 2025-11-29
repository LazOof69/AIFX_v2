'use strict';

/**
 * Migration: Create Backtest Tables
 * Creates tables for storing backtest results and trade details
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create backtest_results table
    await queryInterface.createTable('backtest_results', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      pair: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Currency pair (e.g., EUR/USD)'
      },
      period: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: 'Trading period: intraday/swing/position/longterm'
      },
      timeframe: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: 'Timeframe: 15min/1h/1d/1w'
      },

      // Backtest parameters
      start_date: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Backtest start date'
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Backtest end date'
      },
      initial_balance: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 10000.00,
        comment: 'Initial account balance'
      },
      risk_per_trade: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 2.00,
        comment: 'Risk per trade as percentage'
      },

      // Basic metrics
      total_trades: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total number of trades'
      },
      winning_trades: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of winning trades'
      },
      losing_trades: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of losing trades'
      },
      win_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Win rate percentage'
      },

      // Profit/Loss metrics
      total_profit: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total profit from winning trades'
      },
      total_loss: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total loss from losing trades'
      },
      net_profit: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Net profit (total_profit - total_loss)'
      },
      net_profit_pct: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: true,
        comment: 'Net profit as percentage of initial balance'
      },

      avg_profit: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Average profit per winning trade'
      },
      avg_loss: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Average loss per losing trade'
      },
      profit_factor: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Profit factor (total_profit / total_loss)'
      },

      // Advanced metrics
      max_drawdown: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Maximum drawdown amount'
      },
      max_drawdown_pct: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: true,
        comment: 'Maximum drawdown percentage'
      },
      sharpe_ratio: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: true,
        comment: 'Sharpe ratio (risk-adjusted return)'
      },

      final_balance: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Final account balance'
      },

      // Metadata
      exit_strategy: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'signal_reversal',
        comment: 'Exit strategy used'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Additional notes'
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

    // Create backtest_trades table
    await queryInterface.createTable('backtest_trades', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      backtest_result_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'backtest_results',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Reference to backtest result'
      },

      // Signal reference
      entry_signal_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Reference to entry trading signal'
      },
      exit_signal_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Reference to exit trading signal'
      },

      // Trade timing
      entry_time: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Trade entry timestamp'
      },
      exit_time: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Trade exit timestamp'
      },
      duration_hours: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Trade duration in hours'
      },

      // Trade details
      direction: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: 'Trade direction: long/short'
      },
      entry_price: {
        type: Sequelize.DECIMAL(15, 5),
        allowNull: false,
        comment: 'Entry price'
      },
      exit_price: {
        type: Sequelize.DECIMAL(15, 5),
        allowNull: true,
        comment: 'Exit price'
      },
      position_size: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Position size (units or lots)'
      },

      // Exit details
      exit_reason: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Exit reason: signal_reversal/signal_change/end_of_data'
      },
      exit_signal: {
        type: Sequelize.STRING(10),
        allowNull: true,
        comment: 'Exit signal type: long/short/standby'
      },

      // P&L
      profit_loss: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Profit/loss in account currency'
      },
      profit_loss_pct: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: true,
        comment: 'Profit/loss as percentage'
      },
      profit_loss_pips: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Profit/loss in pips'
      },

      // Account state
      balance_before: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Account balance before trade'
      },
      balance_after: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Account balance after trade'
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

    // Create indexes
    await queryInterface.addIndex('backtest_results', ['pair', 'period', 'timeframe'], {
      name: 'idx_backtest_results_pair_period_timeframe'
    });

    await queryInterface.addIndex('backtest_results', ['created_at'], {
      name: 'idx_backtest_results_created_at'
    });

    await queryInterface.addIndex('backtest_trades', ['backtest_result_id'], {
      name: 'idx_backtest_trades_result_id'
    });

    await queryInterface.addIndex('backtest_trades', ['entry_time'], {
      name: 'idx_backtest_trades_entry_time'
    });

    console.log('✅ Backtest tables created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('backtest_trades');
    await queryInterface.dropTable('backtest_results');
    console.log('✅ Backtest tables dropped successfully');
  }
};
