/**
 * Migration: Create Trading Signals Table
 * Creates the trading_signals table for storing AI-generated trading signals
 */

'use strict';

module.exports = {
  /**
   * Apply the migration
   *
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize')} Sequelize
   * @returns {Promise<void>}
   */
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('trading_signals', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: true, // null for system-wide signals
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      pair: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          is: /^[A-Z]{3}\/[A-Z]{3}$/,
        },
      },
      timeframe: {
        type: Sequelize.ENUM('1min', '5min', '15min', '30min', '1h', '4h', '1d', '1w', '1M'),
        allowNull: false,
      },
      signal: {
        type: Sequelize.ENUM('buy', 'sell', 'hold'),
        allowNull: false,
      },
      confidence: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        validate: {
          min: 0.0,
          max: 1.0,
        },
      },
      factors: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: {
          technical: 0.0,
          sentiment: 0.0,
          pattern: 0.0,
        },
      },
      entryPrice: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      stopLoss: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: true,
        validate: {
          min: 0,
        },
      },
      takeProfit: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: true,
        validate: {
          min: 0,
        },
      },
      riskRewardRatio: {
        type: Sequelize.DECIMAL(4, 2),
        allowNull: true,
        validate: {
          min: 0,
        },
      },
      positionSize: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        validate: {
          min: 0,
          max: 100,
        },
      },
      source: {
        type: Sequelize.ENUM('ml_engine', 'technical_analysis', 'manual', 'hybrid'),
        allowNull: false,
        defaultValue: 'ml_engine',
      },
      signalStrength: {
        type: Sequelize.ENUM('weak', 'moderate', 'strong', 'very_strong'),
        allowNull: false,
        defaultValue: 'moderate',
      },
      marketCondition: {
        type: Sequelize.ENUM('trending', 'ranging', 'volatile', 'calm'),
        allowNull: true,
      },
      technicalData: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {},
      },
      status: {
        type: Sequelize.ENUM('active', 'triggered', 'stopped', 'expired', 'cancelled'),
        allowNull: false,
        defaultValue: 'active',
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      triggeredAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      triggeredPrice: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: true,
      },
      actualOutcome: {
        type: Sequelize.ENUM('win', 'loss', 'breakeven', 'pending'),
        allowNull: true,
        defaultValue: 'pending',
      },
      actualPnL: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      actualPnLPercent: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: true,
      },
      durationMinutes: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      isNotified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      notifiedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      notificationChannels: {
        type: Sequelize.JSON,
        defaultValue: [],
        allowNull: false,
      },
      marketDataSnapshot: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      backtestId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      // Timestamps
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Create indexes for efficient querying
    await queryInterface.addIndex('trading_signals', ['userId'], {
      name: 'user_signals_index',
    });

    await queryInterface.addIndex('trading_signals', ['pair', 'timeframe'], {
      name: 'pair_timeframe_signals_index',
    });

    await queryInterface.addIndex('trading_signals', ['signal', 'confidence'], {
      name: 'signal_confidence_index',
    });

    await queryInterface.addIndex('trading_signals', ['status'], {
      name: 'signal_status_index',
    });

    await queryInterface.addIndex('trading_signals', ['createdAt'], {
      name: 'signal_created_index',
    });

    await queryInterface.addIndex('trading_signals', ['expiresAt'], {
      name: 'signal_expiry_index',
    });

    await queryInterface.addIndex('trading_signals', ['source'], {
      name: 'signal_source_index',
    });

    await queryInterface.addIndex('trading_signals', ['actualOutcome'], {
      name: 'signal_outcome_index',
    });
  },

  /**
   * Revert the migration
   *
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize')} Sequelize
   * @returns {Promise<void>}
   */
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('trading_signals');
  },
};