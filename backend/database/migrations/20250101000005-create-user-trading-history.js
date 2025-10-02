'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ENUM types first
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE enum_user_trading_history_action AS ENUM('buy', 'sell');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE enum_user_trading_history_status AS ENUM('open', 'closed', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE enum_user_trading_history_result AS ENUM('win', 'loss', 'breakeven');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('user_trading_history', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      signal_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'trading_signals',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      pair: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      action: {
        type: Sequelize.ENUM('buy', 'sell'),
        allowNull: false,
      },
      entry_price: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: false,
      },
      exit_price: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: true,
      },
      stop_loss: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: true,
      },
      take_profit: {
        type: Sequelize.DECIMAL(10, 5),
        allowNull: true,
      },
      position_size: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      profit_loss: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      profit_loss_percentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('open', 'closed', 'cancelled'),
        defaultValue: 'open',
      },
      result: {
        type: Sequelize.ENUM('win', 'loss', 'breakeven'),
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      opened_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      closed_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    // Add indexes
    await queryInterface.addIndex('user_trading_history', ['user_id']);
    await queryInterface.addIndex('user_trading_history', ['signal_id']);
    await queryInterface.addIndex('user_trading_history', ['pair']);
    await queryInterface.addIndex('user_trading_history', ['status']);
    await queryInterface.addIndex('user_trading_history', ['opened_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('user_trading_history');
  }
};