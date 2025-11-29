/**
 * Migration: Create User LINE Settings Table
 * Creates the user_line_settings table for LINE Bot user mappings and preferences
 *
 * Architecture: Backend database layer (microservices)
 * Purpose: Store LINE user ID mappings to backend users
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
    await queryInterface.createTable('user_line_settings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Reference to users table',
      },
      line_user_id: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: false,
        comment: 'LINE user ID (U...)',
      },
      line_display_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'LINE display name',
      },
      notifications_enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Enable/disable notifications',
      },
      enabled_timeframes: {
        type: Sequelize.JSONB,
        defaultValue: ['1h', '4h'],
        allowNull: false,
        comment: 'Enabled timeframes for notifications',
      },
      preferred_pairs: {
        type: Sequelize.JSONB,
        defaultValue: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
        allowNull: false,
        comment: 'Preferred currency pairs',
      },
      min_confidence: {
        type: Sequelize.DECIMAL(3, 2),
        defaultValue: 0.6,
        allowNull: false,
        comment: 'Minimum confidence level for notifications (0.0-1.0)',
      },
      only_ml_enhanced: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Only receive ML-enhanced signals',
      },
      max_notifications_per_day: {
        type: Sequelize.INTEGER,
        defaultValue: 20,
        allowNull: false,
        comment: 'Maximum notifications per day',
      },
      notification_cooldown_minutes: {
        type: Sequelize.INTEGER,
        defaultValue: 240,
        allowNull: false,
        comment: 'Cooldown period between notifications (minutes)',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Create indexes
    await queryInterface.addIndex('user_line_settings', ['line_user_id'], {
      unique: true,
      name: 'idx_line_user_id',
    });

    await queryInterface.addIndex('user_line_settings', ['user_id'], {
      unique: true,
      name: 'idx_line_settings_user_id',
    });

    await queryInterface.addIndex('user_line_settings', ['notifications_enabled'], {
      name: 'idx_line_notifications_enabled',
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
    await queryInterface.dropTable('user_line_settings');
  },
};
