const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SignalNotification = sequelize.define('SignalNotification', {
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

    // Signal details
    pair: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    timeframe: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    signalType: {
      type: DataTypes.STRING(10),
      allowNull: false, // 'long', 'short', 'hold'
      field: 'signal_type'
    },
    confidence: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false
    },

    // Price levels
    entryPrice: {
      type: DataTypes.DECIMAL(10, 5),
      allowNull: false,
      field: 'entry_price'
    },
    stopLoss: {
      type: DataTypes.DECIMAL(10, 5),
      field: 'stop_loss'
    },
    takeProfit: {
      type: DataTypes.DECIMAL(10, 5),
      field: 'take_profit'
    },
    riskRewardRatio: {
      type: DataTypes.DECIMAL(5, 2),
      field: 'risk_reward_ratio'
    },

    // ML info
    modelVersion: {
      type: DataTypes.STRING(20),
      field: 'model_version'
    },
    stage1Prob: {
      type: DataTypes.DECIMAL(5, 4),
      field: 'stage1_prob'
    },
    stage2Prob: {
      type: DataTypes.DECIMAL(5, 4),
      field: 'stage2_prob'
    },

    // Discord message
    discordMessageId: {
      type: DataTypes.STRING(255),
      field: 'discord_message_id'
    },
    discordChannelId: {
      type: DataTypes.STRING(255),
      field: 'discord_channel_id'
    },

    // Status
    sentAt: {
      type: DataTypes.DATE,
      field: 'sent_at'
    },
    acknowledged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    acknowledgedAt: {
      type: DataTypes.DATE,
      field: 'acknowledged_at'
    },

    // Linked trade
    tradeId: {
      type: DataTypes.INTEGER,
      field: 'trade_id'
    },

    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at'
    }
  }, {
    tableName: 'signal_notifications',
    timestamps: false,
    underscored: true
  });

  SignalNotification.associate = (models) => {
    SignalNotification.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });

    SignalNotification.belongsTo(models.UserTrade, {
      foreignKey: 'tradeId',
      as: 'trade'
    });
  };

  /**
   * Calculate pips from entry to target
   * @param {number} target - Target price (SL or TP)
   * @returns {number} - Pips
   */
  SignalNotification.prototype.calculatePips = function(target) {
    const pipMultiplier = this.pair.includes('JPY') ? 100 : 10000;
    const direction = this.signalType === 'long' ? 1 : -1;
    return Math.round((target - this.entryPrice) * direction * pipMultiplier * 100) / 100;
  };

  /**
   * Get signal emoji
   * @returns {string}
   */
  SignalNotification.prototype.getSignalEmoji = function() {
    const emojiMap = {
      'long': '📈',
      'short': '📉',
      'hold': '⏸️'
    };
    return emojiMap[this.signalType] || '❓';
  };

  /**
   * Get confidence level emoji
   * @returns {string}
   */
  SignalNotification.prototype.getConfidenceEmoji = function() {
    const confidence = parseFloat(this.confidence);
    if (confidence >= 0.80) return '🔥';
    if (confidence >= 0.70) return '💪';
    if (confidence >= 0.60) return '👍';
    return '🤷';
  };

  return SignalNotification;
};
