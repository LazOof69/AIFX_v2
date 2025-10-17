const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserTrade = sequelize.define('UserTrade', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id'
    },
    signalNotificationId: {
      type: DataTypes.INTEGER,
      field: 'signal_notification_id'
    },

    // Trade details
    pair: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    direction: {
      type: DataTypes.STRING(10),
      allowNull: false // 'long', 'short'
    },

    // Entry
    entryPrice: {
      type: DataTypes.DECIMAL(10, 5),
      allowNull: false,
      field: 'entry_price'
    },
    entryTime: {
      type: DataTypes.DATE,
      field: 'entry_time'
    },
    lotSize: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'lot_size',
      validate: {
        min: 0.01,
        max: 100.0
      }
    },

    // Exit levels
    stopLoss: {
      type: DataTypes.DECIMAL(10, 5),
      allowNull: false,
      field: 'stop_loss'
    },
    takeProfit: {
      type: DataTypes.DECIMAL(10, 5),
      allowNull: false,
      field: 'take_profit'
    },

    // Close
    closePrice: {
      type: DataTypes.DECIMAL(10, 5),
      field: 'close_price'
    },
    closeTime: {
      type: DataTypes.DATE,
      field: 'close_time'
    },
    closeReason: {
      type: DataTypes.STRING(50),
      field: 'close_reason' // 'tp_hit', 'sl_hit', 'manual_close', 'timeout'
    },

    // P&L
    pips: {
      type: DataTypes.DECIMAL(10, 2)
    },
    profitLoss: {
      type: DataTypes.DECIMAL(10, 2),
      field: 'profit_loss'
    },
    profitLossPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      field: 'profit_loss_percentage'
    },

    // Status
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'open' // 'open', 'closed', 'cancelled'
    },
    result: {
      type: DataTypes.STRING(10) // 'win', 'loss', 'breakeven'
    },

    // Notes
    notes: {
      type: DataTypes.TEXT
    },

    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at'
    }
  }, {
    tableName: 'user_trades',
    timestamps: true,
    underscored: true
  });

  UserTrade.associate = (models) => {
    UserTrade.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });

    UserTrade.belongsTo(models.SignalNotification, {
      foreignKey: 'signalNotificationId',
      as: 'signal'
    });

    UserTrade.hasMany(models.TradeUpdate, {
      foreignKey: 'tradeId',
      as: 'updates'
    });
  };

  /**
   * Calculate current P&L
   * @param {number} currentPrice - Current market price
   * @returns {Object} - { pips, pnl, percentage }
   */
  UserTrade.prototype.calculatePnL = function(currentPrice) {
    const pipMultiplier = this.pair.includes('JPY') ? 100 : 10000;
    const direction = this.direction === 'long' ? 1 : -1;

    // Calculate pips
    const pips = Math.round(
      (currentPrice - this.entryPrice) * direction * pipMultiplier * 100
    ) / 100;

    // Calculate P&L (assuming $10 per pip per lot)
    const pnl = Math.round(pips * this.lotSize * 10 * 100) / 100;

    // Calculate percentage (assuming 1 lot = $100,000)
    const accountSize = this.lotSize * 100000;
    const percentage = Math.round((pnl / accountSize) * 10000) / 100;

    return { pips, pnl, percentage };
  };

  /**
   * Check if stop loss is hit
   * @param {number} currentPrice - Current market price
   * @returns {boolean}
   */
  UserTrade.prototype.isStopLossHit = function(currentPrice) {
    if (this.direction === 'long') {
      return currentPrice <= this.stopLoss;
    } else {
      return currentPrice >= this.stopLoss;
    }
  };

  /**
   * Check if take profit is hit
   * @param {number} currentPrice - Current market price
   * @returns {boolean}
   */
  UserTrade.prototype.isTakeProfitHit = function(currentPrice) {
    if (this.direction === 'long') {
      return currentPrice >= this.takeProfit;
    } else {
      return currentPrice <= this.takeProfit;
    }
  };

  /**
   * Close the trade
   * @param {number} closePrice - Closing price
   * @param {string} reason - Close reason
   * @returns {Promise<UserTrade>}
   */
  UserTrade.prototype.closeTrade = async function(closePrice, reason) {
    const pnl = this.calculatePnL(closePrice);

    this.closePrice = closePrice;
    this.closeTime = new Date();
    this.closeReason = reason;
    this.pips = pnl.pips;
    this.profitLoss = pnl.pnl;
    this.profitLossPercentage = pnl.percentage;
    this.status = 'closed';

    // Determine result
    if (pnl.pips > 0) {
      this.result = 'win';
    } else if (pnl.pips < 0) {
      this.result = 'loss';
    } else {
      this.result = 'breakeven';
    }

    return await this.save();
  };

  /**
   * Get duration in minutes
   * @returns {number}
   */
  UserTrade.prototype.getDurationMinutes = function() {
    const endTime = this.closeTime || new Date();
    const startTime = this.entryTime;
    return Math.round((endTime - startTime) / 1000 / 60);
  };

  /**
   * Format duration as human-readable string
   * @returns {string}
   */
  UserTrade.prototype.getFormattedDuration = function() {
    const minutes = this.getDurationMinutes();

    if (minutes < 60) {
      return `${minutes}m`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    } else {
      const days = Math.floor(minutes / 1440);
      const hours = Math.floor((minutes % 1440) / 60);
      return `${days}d ${hours}h`;
    }
  };

  return UserTrade;
};
