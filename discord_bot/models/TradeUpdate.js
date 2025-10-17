const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TradeUpdate = sequelize.define('TradeUpdate', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    tradeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'trade_id'
    },

    // Price snapshot
    currentPrice: {
      type: DataTypes.DECIMAL(10, 5),
      allowNull: false,
      field: 'current_price'
    },
    currentPips: {
      type: DataTypes.DECIMAL(10, 2),
      field: 'current_pips'
    },
    currentPnl: {
      type: DataTypes.DECIMAL(10, 2),
      field: 'current_pnl'
    },

    // Update details
    updateType: {
      type: DataTypes.STRING(50),
      field: 'update_type' // 'price_update', 'sl_hit', 'tp_hit', 'manual_close'
    },
    message: {
      type: DataTypes.TEXT
    },

    // Discord notification
    discordNotified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'discord_notified'
    },
    discordMessageId: {
      type: DataTypes.STRING(255),
      field: 'discord_message_id'
    },

    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at'
    }
  }, {
    tableName: 'trade_updates',
    timestamps: false,
    underscored: true
  });

  TradeUpdate.associate = (models) => {
    TradeUpdate.belongsTo(models.UserTrade, {
      foreignKey: 'tradeId',
      as: 'trade'
    });
  };

  /**
   * Get update emoji based on type
   * @returns {string}
   */
  TradeUpdate.prototype.getUpdateEmoji = function() {
    const emojiMap = {
      'price_update': '📊',
      'sl_hit': '❌',
      'tp_hit': '✅',
      'manual_close': '🔒',
      'timeout': '⏰'
    };
    return emojiMap[this.updateType] || '📝';
  };

  /**
   * Get formatted P&L string
   * @returns {string}
   */
  TradeUpdate.prototype.getFormattedPnL = function() {
    const pips = parseFloat(this.currentPips || 0);
    const pnl = parseFloat(this.currentPnl || 0);

    const pipsStr = pips >= 0 ? `+${pips}` : `${pips}`;
    const pnlStr = pnl >= 0 ? `+$${pnl}` : `-$${Math.abs(pnl)}`;

    return `${pipsStr} pips (${pnlStr})`;
  };

  return TradeUpdate;
};
