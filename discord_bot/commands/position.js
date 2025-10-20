/**
 * Position Command
 * Manage trading positions (open, list, close)
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const userMappingService = require('../services/userMappingService');

// Database models (direct access to avoid authentication issues)
const { sequelize } = require('../../backend/src/config/database');
const UserTradingHistory = require('../../backend/src/models/UserTradingHistory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('position')
    .setDescription('Manage your trading positions')
    .addSubcommand(subcommand =>
      subcommand
        .setName('open')
        .setDescription('Open a new trading position')
        .addStringOption(option =>
          option
            .setName('pair')
            .setDescription('Currency pair (e.g., EUR/USD)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('action')
            .setDescription('Buy or Sell')
            .setRequired(true)
            .addChoices(
              { name: 'Buy (做多)', value: 'buy' },
              { name: 'Sell (做空)', value: 'sell' }
            )
        )
        .addNumberOption(option =>
          option
            .setName('entry_price')
            .setDescription('Entry price')
            .setRequired(true)
        )
        .addNumberOption(option =>
          option
            .setName('stop_loss')
            .setDescription('Stop loss price')
            .setRequired(false)
        )
        .addNumberOption(option =>
          option
            .setName('take_profit')
            .setDescription('Take profit price')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('notes')
            .setDescription('Optional notes')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List your open positions')
        .addStringOption(option =>
          option
            .setName('pair')
            .setDescription('Filter by currency pair (optional)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('close')
        .setDescription('Close a trading position (full or partial)')
        .addStringOption(option =>
          option
            .setName('position_id')
            .setDescription('Position ID (get from /position list)')
            .setRequired(true)
        )
        .addNumberOption(option =>
          option
            .setName('exit_price')
            .setDescription('Exit price (exchange rate, e.g., 1.0850)')
            .setRequired(true)
        )
        .addNumberOption(option =>
          option
            .setName('percentage')
            .setDescription('Percentage to close (1-100, default: 100 = full close)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(100)
        )
        .addStringOption(option =>
          option
            .setName('notes')
            .setDescription('Optional closing notes')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'open':
          await this.handleOpen(interaction);
          break;
        case 'list':
          await this.handleList(interaction);
          break;
        case 'close':
          await this.handleClose(interaction);
          break;
        default:
          await interaction.reply({
            content: '❌ Unknown subcommand',
            ephemeral: true
          });
      }
    } catch (error) {
      logger.error('Error executing /position command:', error);

      const errorMessage = {
        content: `❌ Error: ${error.message}`,
        ephemeral: true
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },

  /**
   * Get or create user from Discord interaction
   * @private
   */
  async _getUserId(interaction) {
    const discordId = interaction.user.id;
    const discordUsername = `${interaction.user.username}#${interaction.user.discriminator}`;

    const { userId, isNewUser} = await userMappingService.getOrCreateUser(discordId, discordUsername);

    if (isNewUser) {
      logger.info(`🎉 New user registered via Discord: ${discordUsername} -> ${userId}`);
    }

    return userId;
  },

  /**
   * Price validation ranges for major pairs
   * @private
   */
  PAIR_PRICE_RANGES: {
    'EUR/USD': { min: 0.9000, max: 1.3000, decimals: 5, name: 'EUR/USD' },
    'EURUSD': { min: 0.9000, max: 1.3000, decimals: 5, name: 'EUR/USD' },
    'GBP/USD': { min: 1.0000, max: 1.5000, decimals: 5, name: 'GBP/USD' },
    'GBPUSD': { min: 1.0000, max: 1.5000, decimals: 5, name: 'GBP/USD' },
    'USD/JPY': { min: 100.00, max: 160.00, decimals: 3, name: 'USD/JPY' },
    'USDJPY': { min: 100.00, max: 160.00, decimals: 3, name: 'USD/JPY' },
    'AUD/USD': { min: 0.5000, max: 0.9000, decimals: 5, name: 'AUD/USD' },
    'AUDUSD': { min: 0.5000, max: 0.9000, decimals: 5, name: 'AUD/USD' },
    'USD/CAD': { min: 1.0000, max: 1.5000, decimals: 5, name: 'USD/CAD' },
    'USDCAD': { min: 1.0000, max: 1.5000, decimals: 5, name: 'USD/CAD' },
    'NZD/USD': { min: 0.5000, max: 0.8000, decimals: 5, name: 'NZD/USD' },
    'NZDUSD': { min: 0.5000, max: 0.8000, decimals: 5, name: 'NZD/USD' }
  },

  /**
   * Validate price for currency pair
   * @private
   */
  _validatePrice(pair, price, priceType) {
    const normalizedPair = pair.replace('/', '').toUpperCase();
    const range = this.PAIR_PRICE_RANGES[normalizedPair];

    if (!range) {
      // Unknown pair - allow with warning
      logger.warn(`Unknown currency pair for validation: ${pair}`);
      return { valid: true, message: null };
    }

    if (price < range.min || price > range.max) {
      return {
        valid: false,
        message: `❌ Invalid ${priceType} for **${range.name}**\n` +
                 `Expected range: **${range.min.toFixed(range.decimals === 5 ? 4 : 2)}** - **${range.max.toFixed(range.decimals === 5 ? 4 : 2)}**\n` +
                 `You entered: **${price}**\n\n` +
                 `💡 **Tip**: ${range.name} typically trades around ${((range.min + range.max) / 2).toFixed(range.decimals === 5 ? 4 : 2)}`
      };
    }

    // Check decimal places (warn only, don't block)
    const decimalPlaces = (price.toString().split('.')[1] || '').length;
    if (decimalPlaces > range.decimals) {
      logger.warn(`Price has more decimal places than expected: ${price} (${decimalPlaces} vs ${range.decimals})`);
    }

    return { valid: true, message: null };
  },

  /**
   * Handle /position open
   */
  async handleOpen(interaction) {
    await interaction.deferReply();

    const pair = interaction.options.getString('pair').toUpperCase();
    const action = interaction.options.getString('action');
    const entryPrice = interaction.options.getNumber('entry_price');
    const stopLoss = interaction.options.getNumber('stop_loss');
    const takeProfit = interaction.options.getNumber('take_profit');
    const notes = interaction.options.getString('notes');

    // Validate pair format
    if (!pair.match(/^[A-Z]{3}\/[A-Z]{3}$/)) {
      return await interaction.editReply({
        content: '❌ Invalid currency pair format. Please use: XXX/XXX (e.g., EUR/USD)'
      });
    }

    // Validate entry price
    const entryValidation = this._validatePrice(pair, entryPrice, 'entry price');
    if (!entryValidation.valid) {
      return await interaction.editReply({
        content: entryValidation.message
      });
    }

    // Validate stop loss
    if (stopLoss) {
      const slValidation = this._validatePrice(pair, stopLoss, 'stop loss');
      if (!slValidation.valid) {
        return await interaction.editReply({
          content: slValidation.message
        });
      }
    }

    // Validate take profit
    if (takeProfit) {
      const tpValidation = this._validatePrice(pair, takeProfit, 'take profit');
      if (!tpValidation.valid) {
        return await interaction.editReply({
          content: tpValidation.message
        });
      }
    }

    // Validate price logic
    if (stopLoss && takeProfit) {
      if (action === 'buy' && stopLoss >= entryPrice) {
        return await interaction.editReply({
          content: '❌ For BUY positions, stop loss must be below entry price'
        });
      }
      if (action === 'sell' && stopLoss <= entryPrice) {
        return await interaction.editReply({
          content: '❌ For SELL positions, stop loss must be above entry price'
        });
      }
    }

    try {
      // Get user ID from Discord ID
      const userId = await this._getUserId(interaction);

      // Create position in database
      const position = await UserTradingHistory.create({
        userId,
        pair,
        action,
        entryPrice,
        stopLoss,
        takeProfit,
        status: 'open',
        notes: notes || `Opened via Discord by ${interaction.user.username}`,
        openedAt: new Date()
      });

      // Calculate risk/reward ratio
      let rrRatio = null;
      if (stopLoss && takeProfit) {
        const risk = Math.abs(entryPrice - stopLoss);
        const reward = Math.abs(takeProfit - entryPrice);
        rrRatio = (reward / risk).toFixed(2);
      }

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(action === 'buy' ? 0x00FF00 : 0xFF0000)
        .setTitle(`✅ Position Opened: ${pair}`)
        .setDescription(`**${action.toUpperCase()}** @ ${entryPrice}`)
        .addFields(
          {
            name: '📊 Position ID',
            value: position.id.substring(0, 8) + '...',
            inline: true
          },
          {
            name: '💰 Entry Price',
            value: entryPrice.toString(),
            inline: true
          },
          {
            name: '📈 Direction',
            value: action === 'buy' ? '📈 LONG (做多)' : '📉 SHORT (做空)',
            inline: true
          }
        );

      if (stopLoss) {
        embed.addFields({
          name: '🛑 Stop Loss',
          value: stopLoss.toString(),
          inline: true
        });
      }

      if (takeProfit) {
        embed.addFields({
          name: '🎯 Take Profit',
          value: takeProfit.toString(),
          inline: true
        });
      }

      if (rrRatio) {
        embed.addFields({
          name: '⚖️ Risk/Reward',
          value: `1:${rrRatio}`,
          inline: true
        });
      }

      embed.setFooter({
        text: `Position will be monitored automatically | Full ID: ${position.id}`
      });
      embed.setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      logger.info(`Position opened via Discord: ${pair} ${action} @ ${entryPrice} by ${interaction.user.username}`);

    } catch (error) {
      logger.error('Error opening position:', error);
      throw new Error(`Failed to open position: ${error.message}`);
    }
  },

  /**
   * Handle /position list
   */
  async handleList(interaction) {
    await interaction.deferReply();

    const filterPair = interaction.options.getString('pair')?.toUpperCase();

    try {
      // Get user ID from Discord ID
      const userId = await this._getUserId(interaction);

      // Query open positions
      const where = {
        userId,
        status: 'open'
      };

      if (filterPair) {
        where.pair = filterPair;
      }

      const positions = await UserTradingHistory.findAll({
        where,
        order: [['openedAt', 'DESC']],
        limit: 25
      });

      if (positions.length === 0) {
        return await interaction.editReply({
          content: filterPair
            ? `ℹ️ No open positions for ${filterPair}`
            : 'ℹ️ No open positions found'
        });
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`📊 Open Positions (${positions.length})`)
        .setDescription(filterPair ? `Filtered by: ${filterPair}` : 'All open positions')
        .setTimestamp();

      // Add positions as fields (max 25 fields in Discord)
      for (const pos of positions.slice(0, 25)) {
        const actionEmoji = pos.action === 'buy' ? '📈' : '📉';
        const posIdShort = pos.id.substring(0, 8);

        let fieldValue = `**Entry:** ${pos.entryPrice}`;
        if (pos.stopLoss) fieldValue += ` | **SL:** ${pos.stopLoss}`;
        if (pos.takeProfit) fieldValue += ` | **TP:** ${pos.takeProfit}`;
        fieldValue += `\n*Opened: <t:${Math.floor(new Date(pos.openedAt).getTime() / 1000)}:R>*`;
        // Show full ID in codeblock for easy copying
        fieldValue += `\n\`\`\`${pos.id}\`\`\``;
        fieldValue += `*Short ID: \`${posIdShort}\`*`;

        embed.addFields({
          name: `${actionEmoji} ${pos.pair} ${pos.action.toUpperCase()}`,
          value: fieldValue,
          inline: false
        });
      }

      if (positions.length > 25) {
        embed.setFooter({
          text: `Showing first 25 of ${positions.length} positions`
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error listing positions:', error);
      throw new Error(`Failed to list positions: ${error.message}`);
    }
  },

  /**
   * Handle /position close
   */
  async handleClose(interaction) {
    await interaction.deferReply();

    const positionIdInput = interaction.options.getString('position_id');
    const exitPrice = interaction.options.getNumber('exit_price');
    const percentage = interaction.options.getNumber('percentage') || 100; // Default to 100% (full close)
    const notes = interaction.options.getString('notes');

    try {
      // Get user ID from Discord ID
      const userId = await this._getUserId(interaction);

      // Find position (support both full UUID and short ID)
      let position;

      if (positionIdInput.length === 36) {
        // Full UUID
        position = await UserTradingHistory.findByPk(positionIdInput);
      } else {
        // Short ID - search by prefix
        const allPositions = await UserTradingHistory.findAll({
          where: {
            userId,
            status: 'open'
          }
        });
        position = allPositions.find(p => p.id.startsWith(positionIdInput));
      }

      if (!position) {
        return await interaction.editReply({
          content: '❌ Position not found. Use `/position list` to see available positions.'
        });
      }

      if (position.status !== 'open') {
        return await interaction.editReply({
          content: '❌ This position is already closed.'
        });
      }

      if (position.userId !== userId) {
        return await interaction.editReply({
          content: '❌ You do not have permission to close this position.'
        });
      }

      // Validate exit price
      const exitValidation = this._validatePrice(position.pair, exitPrice, 'exit price');
      if (!exitValidation.valid) {
        return await interaction.editReply({
          content: exitValidation.message
        });
      }

      // Calculate P&L
      const entryPrice = parseFloat(position.entryPrice);
      const closingPercentage = percentage / 100; // Convert to decimal
      let profitLoss = 0;
      let profitLossPercentage = 0;

      if (position.action === 'buy') {
        profitLoss = exitPrice - entryPrice;
        profitLossPercentage = ((exitPrice - entryPrice) / entryPrice) * 100;
      } else {
        profitLoss = entryPrice - exitPrice;
        profitLossPercentage = ((entryPrice - exitPrice) / entryPrice) * 100;
      }

      // Determine result
      let result;
      if (profitLoss > 0.0001) result = 'win';
      else if (profitLoss < -0.0001) result = 'loss';
      else result = 'breakeven';

      const isFullClose = percentage >= 100;

      // Update position
      if (isFullClose) {
        // Full close: mark position as closed
        await position.update({
          status: 'closed',
          exitPrice,
          profitLoss,
          profitLossPercentage,
          result,
          notes: position.notes + `\nClosed 100% via Discord by ${interaction.user.username}` + (notes ? `: ${notes}` : ''),
          closedAt: new Date()
        });
      } else {
        // Partial close: keep position open, add note
        const currentPositionSize = parseFloat(position.positionSize) || 100;
        const newPositionSize = currentPositionSize * (1 - closingPercentage);

        await position.update({
          positionSize: newPositionSize,
          notes: position.notes + `\nPartial close ${percentage}% @ ${exitPrice} via Discord by ${interaction.user.username}` + (notes ? `: ${notes}` : '')
        });
      }

      // Calculate pips (for the closed portion)
      const isJPYPair = position.pair.includes('JPY');
      const pipMultiplier = isJPYPair ? 100 : 10000;
      const pips = profitLoss * pipMultiplier;

      // Calculate actual P&L for the closed percentage
      const actualProfitLoss = profitLoss * closingPercentage;
      const actualPips = pips * closingPercentage;

      // Create result embed
      const isProfit = profitLoss > 0;
      const closeTypeEmoji = isFullClose ? '🔒' : '🔓';
      const closeTypeText = isFullClose ? 'Closed (100%)' : `Partial Close (${percentage}%)`;

      const embed = new EmbedBuilder()
        .setColor(isProfit ? 0x00FF00 : profitLoss < 0 ? 0xFF0000 : 0x808080)
        .setTitle(`${closeTypeEmoji} ${closeTypeText}: ${position.pair}`)
        .setDescription(`**${position.action.toUpperCase()}** @ ${entryPrice} → ${exitPrice}`)
        .addFields(
          {
            name: '📊 Result',
            value: result.toUpperCase(),
            inline: true
          },
          {
            name: '💰 P&L (Price)',
            value: `${actualProfitLoss > 0 ? '+' : ''}${actualProfitLoss.toFixed(5)}`,
            inline: true
          },
          {
            name: '📈 P&L %',
            value: `${profitLossPercentage > 0 ? '+' : ''}${profitLossPercentage.toFixed(2)}%`,
            inline: true
          },
          {
            name: '📏 Pips',
            value: `${actualPips > 0 ? '+' : ''}${actualPips.toFixed(1)}`,
            inline: true
          },
          {
            name: '⚖️ Closed Amount',
            value: `${percentage}%`,
            inline: true
          },
          {
            name: isFullClose ? '⏱️ Duration' : '📍 Remaining',
            value: isFullClose
              ? `<t:${Math.floor(new Date(position.openedAt).getTime() / 1000)}:R> to <t:${Math.floor(Date.now() / 1000)}:R>`
              : `${(100 - percentage)}% still open`,
            inline: false
          }
        )
        .setFooter({ text: `Position ID: ${position.id}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      const closeAction = isFullClose ? 'fully closed' : `partially closed (${percentage}%)`;
      logger.info(`Position ${closeAction} via Discord: ${position.pair} P&L: ${actualProfitLoss.toFixed(5)} (${profitLossPercentage.toFixed(2)}%) by ${interaction.user.username}`);

    } catch (error) {
      logger.error('Error closing position:', error);
      throw new Error(`Failed to close position: ${error.message}`);
    }
  }
};
