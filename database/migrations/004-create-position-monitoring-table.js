/**
 * Migration: Create Position Monitoring Table
 * Creates the position_monitoring table for storing real-time position analysis data
 * Part of Phase 3: Trading Lifecycle Management v3.0
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
    await queryInterface.createTable('position_monitoring', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      positionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'user_trading_history',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      // Current market state
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      currentPrice: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      // Unrealized P&L
      unrealizedPnlPips: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      unrealizedPnlPercentage: {
        type: Sequelize.DECIMAL(8, 4),
        allowNull: true,
      },
      // Trend analysis (from ML model)
      trendDirection: {
        type: Sequelize.STRING(20),
        allowNull: true,
        validate: {
          isIn: [['uptrend', 'downtrend', 'sideways', 'reversal', 'unknown']],
        },
      },
      trendStrength: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        validate: {
          min: 0.0,
          max: 1.0,
        },
      },
      reversalProbability: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        validate: {
          min: 0.0,
          max: 1.0,
        },
      },
      // Risk-reward analysis
      currentRisk: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: true,
        comment: 'Current distance to stop loss in price units',
      },
      currentReward: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: true,
        comment: 'Current distance to take profit in price units',
      },
      currentRrRatio: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Current risk-reward ratio',
      },
      // Recommendation
      recommendation: {
        type: Sequelize.STRING(20),
        allowNull: true,
        validate: {
          isIn: [['hold', 'exit', 'take_partial', 'adjust_sl', 'adjust_tp', 'trailing_stop']],
        },
      },
      recommendationConfidence: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        validate: {
          min: 0.0,
          max: 1.0,
        },
      },
      reasoning: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'AI-generated explanation for the recommendation',
      },
      // Notification tracking
      notificationSent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      notificationLevel: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 4,
        },
        comment: '1=urgent, 2=important (5min cooldown), 3=general (30min cooldown), 4=daily summary',
      },
      // Timestamps
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Create indexes for efficient querying
    await queryInterface.addIndex('position_monitoring', ['positionId'], {
      name: 'position_monitoring_position_id_index',
    });

    await queryInterface.addIndex('position_monitoring', ['timestamp'], {
      name: 'position_monitoring_timestamp_index',
    });

    await queryInterface.addIndex('position_monitoring', ['positionId', 'timestamp'], {
      name: 'position_monitoring_position_time_index',
    });

    await queryInterface.addIndex('position_monitoring', ['recommendation'], {
      name: 'position_monitoring_recommendation_index',
    });

    await queryInterface.addIndex('position_monitoring', ['notificationSent'], {
      name: 'position_monitoring_notification_sent_index',
    });

    await queryInterface.addIndex('position_monitoring', ['notificationLevel'], {
      name: 'position_monitoring_notification_level_index',
    });

    // Composite index for monitoring service queries
    await queryInterface.addIndex('position_monitoring', ['positionId', 'notificationSent', 'timestamp'], {
      name: 'position_monitoring_service_query_index',
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
    await queryInterface.dropTable('position_monitoring');
  },
};
