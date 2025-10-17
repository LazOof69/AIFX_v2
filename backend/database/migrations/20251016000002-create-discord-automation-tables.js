'use strict';

/**
 * Migration: Create Discord Automation Tables
 *
 * Tables:
 * - user_discord_settings: User Discord notification preferences
 * - signal_notifications: Record of signals sent to Discord
 * - user_trades: User trading positions tracking
 * - trade_updates: Trade position update history
 *
 * Created: 2025-10-16
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create user_discord_settings table
    await queryInterface.createTable('user_discord_settings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.UUID,  // ← Fixed: Changed from INTEGER to UUID
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      discord_user_id: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: true
      },
      discord_username: {
        type: Sequelize.STRING(255),
        allowNull: true
      },

      // Notification settings
      notifications_enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      enabled_timeframes: {
        type: Sequelize.JSONB,
        defaultValue: ['1h', '4h']
      },
      preferred_pairs: {
        type: Sequelize.JSONB,
        defaultValue: ['EUR/USD', 'GBP/USD', 'USD/JPY']
      },

      // Signal filtering
      min_confidence: {
        type: Sequelize.DECIMAL(3, 2),
        defaultValue: 0.60
      },
      only_ml_enhanced: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },

      // Rate limiting
      max_notifications_per_day: {
        type: Sequelize.INTEGER,
        defaultValue: 20
      },
      notification_cooldown_minutes: {
        type: Sequelize.INTEGER,
        defaultValue: 240 // 4 hours
      },

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create indexes for user_discord_settings
    await queryInterface.addIndex('user_discord_settings', ['discord_user_id'], {
      name: 'idx_discord_user_id'
    });
    await queryInterface.addIndex('user_discord_settings', ['notifications_enabled'], {
      name: 'idx_notifications_enabled'
    });

    // 2. Create signal_notifications table
    await queryInterface.createTable('signal_notifications', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.UUID,  // ← Fixed: Changed from INTEGER to UUID
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      // Signal details
      pair: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      timeframe: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      signal_type: {
        type: Sequelize.STRING(10),
        allowNull: false // 'long', 'short', 'hold'
      },
      confidence: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false
      },

      // Price levels
      entry_price: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: false
      },
      stop_loss: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: true
      },
      take_profit: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: true
      },
      risk_reward_ratio: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },

      // ML info
      model_version: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      stage1_prob: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true
      },
      stage2_prob: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true
      },

      // Discord message
      discord_message_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      discord_channel_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },

      // Status
      sent_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      acknowledged: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      acknowledged_at: {
        type: Sequelize.DATE,
        allowNull: true
      },

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create indexes for signal_notifications
    await queryInterface.addIndex('signal_notifications', ['user_id', 'pair', 'sent_at'], {
      name: 'idx_signal_user_pair'
    });
    await queryInterface.addIndex('signal_notifications', ['sent_at'], {
      name: 'idx_signal_sent_at'
    });

    // 3. Create user_trades table
    await queryInterface.createTable('user_trades', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.UUID,  // ← Fixed: Changed from INTEGER to UUID
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      signal_notification_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'signal_notifications',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },

      // Trade details
      pair: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      direction: {
        type: Sequelize.STRING(10),
        allowNull: false // 'long', 'short'
      },

      // Entry
      entry_price: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: false
      },
      entry_time: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      lot_size: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false // 0.01 - 100.00
      },

      // Exit levels
      stop_loss: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: false
      },
      take_profit: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: false
      },

      // Close
      close_price: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: true
      },
      close_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      close_reason: {
        type: Sequelize.STRING(50),
        allowNull: true // 'tp_hit', 'sl_hit', 'manual_close', 'timeout'
      },

      // P&L
      pips: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      profit_loss: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true // in account currency
      },
      profit_loss_percentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },

      // Status
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'open' // 'open', 'closed', 'cancelled'
      },
      result: {
        type: Sequelize.STRING(10),
        allowNull: true // 'win', 'loss', 'breakeven'
      },

      // Notes
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create indexes for user_trades
    await queryInterface.addIndex('user_trades', ['user_id', 'status'], {
      name: 'idx_trade_user_status'
    });
    await queryInterface.addIndex('user_trades', ['status'], {
      name: 'idx_trade_status'
    });
    await queryInterface.addIndex('user_trades', ['entry_time'], {
      name: 'idx_trade_entry_time'
    });

    // 4. Create trade_updates table
    await queryInterface.createTable('trade_updates', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      trade_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'user_trades',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      // Price snapshot
      current_price: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: false
      },
      current_pips: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      current_pnl: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },

      // Update details
      update_type: {
        type: Sequelize.STRING(50),
        allowNull: true // 'price_update', 'sl_hit', 'tp_hit', 'manual_close'
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      // Discord notification
      discord_notified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      discord_message_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create index for trade_updates
    await queryInterface.addIndex('trade_updates', ['trade_id'], {
      name: 'idx_trade_updates_trade_id'
    });

    // 5. Add trade_id foreign key to signal_notifications (after user_trades exists)
    await queryInterface.addColumn('signal_notifications', 'trade_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'user_trades',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    console.log('✅ Discord automation tables created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Drop tables in reverse order (respecting foreign keys)
    // First remove the trade_id foreign key from signal_notifications
    await queryInterface.removeColumn('signal_notifications', 'trade_id');

    await queryInterface.dropTable('trade_updates');
    await queryInterface.dropTable('user_trades');
    await queryInterface.dropTable('signal_notifications');
    await queryInterface.dropTable('user_discord_settings');

    console.log('✅ Discord automation tables dropped successfully');
  }
};
