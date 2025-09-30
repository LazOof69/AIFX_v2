/**
 * Migration: Create Market Data Table
 * Creates the market_data table for caching forex market data
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
    await queryInterface.createTable('market_data', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
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
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      open: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      high: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      low: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      close: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      volume: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: 0,
      },
      technicalIndicators: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {},
      },
      source: {
        type: Sequelize.ENUM('alpha_vantage', 'twelve_data', 'manual', 'calculated'),
        allowNull: false,
        defaultValue: 'alpha_vantage',
      },
      cacheExpiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      isRealTime: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      marketState: {
        type: Sequelize.ENUM('open', 'closed', 'pre_market', 'after_hours'),
        allowNull: true,
      },
      spread: {
        type: Sequelize.DECIMAL(8, 5),
        allowNull: true,
      },
      dataQuality: {
        type: Sequelize.JSON,
        defaultValue: {
          completeness: 1.0,
          accuracy: 1.0,
          timeliness: 1.0,
          consistency: 1.0,
        },
        allowNull: false,
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

    // Create unique constraint on pair, timeframe, and timestamp
    await queryInterface.addIndex('market_data', ['pair', 'timeframe', 'timestamp'], {
      unique: true,
      name: 'unique_market_data_entry',
    });

    // Create indexes for efficient querying
    await queryInterface.addIndex('market_data', ['pair', 'timeframe'], {
      name: 'pair_timeframe_index',
    });

    await queryInterface.addIndex('market_data', ['timestamp'], {
      name: 'timestamp_index',
    });

    await queryInterface.addIndex('market_data', ['cacheExpiresAt'], {
      name: 'cache_expiry_index',
    });

    await queryInterface.addIndex('market_data', ['isRealTime'], {
      name: 'realtime_index',
    });

    await queryInterface.addIndex('market_data', ['source'], {
      name: 'source_index',
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
    await queryInterface.dropTable('market_data');
  },
};