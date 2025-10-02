'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ENUM types first
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE enum_trading_signals_action AS ENUM('buy', 'sell', 'hold');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE enum_trading_signals_status AS ENUM('pending', 'active', 'closed', 'expired');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE enum_trading_signals_result AS ENUM('win', 'loss', 'breakeven');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('trading_signals', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      pair: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      action: {
        type: Sequelize.ENUM('buy', 'sell', 'hold'),
        allowNull: false,
      },
      confidence: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        validate: {
          min: 0,
          max: 1,
        },
      },
      entry_price: {
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
      risk_reward: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      timeframe: {
        type: Sequelize.STRING(10),
        defaultValue: '1hour',
      },
      technical_factors: {
        type: Sequelize.JSONB,
        defaultValue: {},
      },
      sentiment_factors: {
        type: Sequelize.JSONB,
        defaultValue: {},
      },
      ml_prediction: {
        type: Sequelize.JSONB,
        defaultValue: {},
      },
      status: {
        type: Sequelize.ENUM('pending', 'active', 'closed', 'expired'),
        defaultValue: 'active',
      },
      result: {
        type: Sequelize.ENUM('win', 'loss', 'breakeven'),
        allowNull: true,
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
    await queryInterface.addIndex('trading_signals', ['pair']);
    await queryInterface.addIndex('trading_signals', ['action']);
    await queryInterface.addIndex('trading_signals', ['status']);
    await queryInterface.addIndex('trading_signals', ['created_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('trading_signals');
  }
};