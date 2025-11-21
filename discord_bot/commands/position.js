/**
 * Position Command
 * Manage trading positions (open, list, close)
 *
 * REFACTORED FOR MICROSERVICES ARCHITECTURE (Phase 4):
 * - Uses Backend API Client instead of direct database access
 * - Follows CLAUDE.md principles: API-only communication
 * - No direct Sequelize/database dependencies
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const userMappingService = require('../services/userMappingService');
const backendApiClient = require('../services/backendApiClient');

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
            .setName('position_size')
            .setDescription('Position size (e.g., 2.5 for 2.5% of account)')
            .setRequired(false)
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
        .setDescription('Close a trading position')
        .addStringOption(option =>
          option
            .setName('position_id')
            .setDescription('Position ID (get from /position list)')
            .setRequired(true)
        )
        .addNumberOption(option =>
          option
            .setName('exit_price')
            .setDescription('Exit price')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('notes')
            .setDescription('Closing notes')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      // Get or create user mapping
      const discordId = interaction.user.id;
      const discordUsername = interaction.user.username;

      if (subcommand === 'open') {
        await this.handleOpenPosition(interaction, discordId, discordUsername);
      } else if (subcommand === 'list') {
        await this.handleListPositions(interaction, discordId, discordUsername);
      } else if (subcommand === 'close') {
        await this.handleClosePosition(interaction, discordId, discordUsername);
      }
    } catch (error) {
      logger.error(`Position command error (${subcommand}):`, error);

      const errorMessage = error.response?.data?.error || error.message || 'An unexpected error occurred';

      await interaction.editReply({
        content: `❌ Error: ${errorMessage}`,
        ephemeral: true
      }).catch(err => logger.error('Failed to send error reply:', err));
    }
  },

  /**
   * Handle opening a new position
   */
  async handleOpenPosition(interaction, discordId, discordUsername) {
    await interaction.deferReply({ ephemeral: true });

    // Get options
    const pair = interaction.options.getString('pair').toUpperCase();
    const action = interaction.options.getString('action');
    const entryPrice = interaction.options.getNumber('entry_price');
    const positionSize = interaction.options.getNumber('position_size') || 1.0;
    const stopLoss = interaction.options.getNumber('stop_loss');
    const takeProfit = interaction.options.getNumber('take_profit');
    const notes = interaction.options.getString('notes');

    // Validate pair format
    if (!pair.match(/^[A-Z]{3}\/[A-Z]{3}$/)) {
      return await interaction.editReply({
        content: '❌ Invalid currency pair format. Please use format: XXX/XXX (e.g., EUR/USD)',
        ephemeral: true
      });
    }

    // Create trade via Backend API
    const tradeData = {
      discordId,
      pair,
      action,
      entryPrice,
      positionSize,
      stopLoss,
      takeProfit,
      notes,
    };

    logger.info(`Opening position for Discord ${discordId}:`, tradeData);

    const trade = await backendApiClient.recordTrade(tradeData);

    // Calculate risk/reward if stop loss and take profit are provided
    let riskReward = null;
    if (stopLoss && takeProfit) {
      const risk = Math.abs(entryPrice - stopLoss);
      const reward = Math.abs(takeProfit - entryPrice);
      riskReward = (reward / risk).toFixed(2);
    }

    // Create success embed
    const embed = new EmbedBuilder()
      .setColor(action === 'buy' ? 0x00FF00 : 0xFF0000)
      .setTitle(`${action === 'buy' ? '📈' : '📉'} Position Opened`)
      .setDescription(`${pair} ${action.toUpperCase()}`)
      .addFields(
        { name: 'Position ID', value: trade.trade.id.substring(0, 8), inline: true },
        { name: 'Entry Price', value: entryPrice.toFixed(5), inline: true },
        { name: 'Position Size', value: `${positionSize}%`, inline: true }
      )
      .setFooter({ text: 'AIFX_v2 Trading Bot' })
      .setTimestamp();

    if (stopLoss) {
      embed.addFields({ name: 'Stop Loss', value: stopLoss.toFixed(5), inline: true });
    }
    if (takeProfit) {
      embed.addFields({ name: 'Take Profit', value: takeProfit.toFixed(5), inline: true });
    }
    if (riskReward) {
      embed.addFields({ name: 'Risk:Reward', value: `1:${riskReward}`, inline: true });
    }

    await interaction.editReply({ embeds: [embed], ephemeral: true });
    logger.info(`Position opened successfully: ${trade.trade.id}`);
  },

  /**
   * Handle listing positions
   */
  async handleListPositions(interaction, discordId, discordUsername) {
    await interaction.deferReply({ ephemeral: true });

    const pairFilter = interaction.options.getString('pair')?.toUpperCase();

    // Get trading history from Backend API
    const filters = {
      status: 'open',
      limit: 10,
    };

    if (pairFilter) {
      filters.pair = pairFilter;
    }

    logger.info(`Fetching positions for Discord ${discordId}:`, filters);

    const result = await backendApiClient.getTradingHistory(discordId, filters);

    if (!result.trades || result.trades.length === 0) {
      return await interaction.editReply({
        content: `📊 You have no open positions${pairFilter ? ` for ${pairFilter}` : ''}.`,
        ephemeral: true
      });
    }

    // Create embed with positions
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📊 Your Open Positions')
      .setDescription(pairFilter ? `Filtered by: ${pairFilter}` : `Showing ${result.trades.length} position(s)`)
      .setFooter({ text: 'AIFX_v2 Trading Bot' })
      .setTimestamp();

    result.trades.forEach((trade, index) => {
      const shortId = trade.id.substring(0, 8);
      const action = trade.action.toUpperCase();
      const emoji = trade.action === 'buy' ? '📈' : '📉';

      let fieldValue = `${emoji} **${action}** at ${trade.entryPrice}\n`;
      fieldValue += `Size: ${trade.positionSize || 'N/A'}%\n`;

      if (trade.stopLoss) {
        fieldValue += `SL: ${trade.stopLoss}\n`;
      }
      if (trade.takeProfit) {
        fieldValue += `TP: ${trade.takeProfit}\n`;
      }

      const openedAt = new Date(trade.createdAt);
      fieldValue += `Opened: ${openedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

      embed.addFields({
        name: `${trade.pair} (ID: ${shortId})`,
        value: fieldValue,
        inline: false
      });
    });

    await interaction.editReply({ embeds: [embed], ephemeral: true });
  },

  /**
   * Handle closing a position
   */
  async handleClosePosition(interaction, discordId, discordUsername) {
    await interaction.deferReply({ ephemeral: true });

    const positionIdInput = interaction.options.getString('position_id');
    const exitPrice = interaction.options.getNumber('exit_price');
    const notes = interaction.options.getString('notes');

    // Find matching trade by ID prefix or full ID
    const result = await backendApiClient.getTradingHistory(discordId, {
      status: 'open',
      limit: 100,
    });

    const trade = result.trades?.find(t =>
      t.id === positionIdInput || t.id.startsWith(positionIdInput)
    );

    if (!trade) {
      return await interaction.editReply({
        content: `❌ Position not found with ID: ${positionIdInput}\nUse \`/position list\` to see your open positions.`,
        ephemeral: true
      });
    }

    // Close position via Backend API
    logger.info(`Closing position ${trade.id} at ${exitPrice}`);

    const updatedTrade = await backendApiClient.closeTrade(
      trade.id,
      exitPrice,
      100, // Full close
      notes
    );

    // Calculate P&L (Backend should do this, but we can display it)
    const pnl = trade.action === 'buy'
      ? (exitPrice - trade.entryPrice) * (trade.positionSize || 1)
      : (trade.entryPrice - exitPrice) * (trade.positionSize || 1);

    const pnlPercent = ((pnl / trade.entryPrice) * 100).toFixed(2);
    const isProfit = pnl > 0;

    // Create result embed
    const embed = new EmbedBuilder()
      .setColor(isProfit ? 0x00FF00 : 0xFF0000)
      .setTitle(`${isProfit ? '✅' : '❌'} Position Closed`)
      .setDescription(`${trade.pair} ${trade.action.toUpperCase()}`)
      .addFields(
        { name: 'Entry Price', value: trade.entryPrice.toString(), inline: true },
        { name: 'Exit Price', value: exitPrice.toFixed(5), inline: true },
        { name: 'Position Size', value: `${trade.positionSize || 'N/A'}%`, inline: true },
        { name: 'P&L', value: `${isProfit ? '+' : ''}${pnl.toFixed(2)}`, inline: true },
        { name: 'P&L %', value: `${isProfit ? '+' : ''}${pnlPercent}%`, inline: true },
        { name: 'Result', value: isProfit ? '✅ Profit' : '❌ Loss', inline: true }
      )
      .setFooter({ text: 'AIFX_v2 Trading Bot' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed], ephemeral: true });
    logger.info(`Position closed successfully: ${trade.id} (P&L: ${pnl.toFixed(2)})`);
  }
};
