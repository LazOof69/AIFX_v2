/**
 * Subscribe Command
 * Allows users to subscribe to signal change notifications
 */

const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('subscribe')
    .setDescription('Subscribe to signal change notifications for a currency pair')
    .addStringOption(option =>
      option
        .setName('pair')
        .setDescription('Currency pair (e.g., EUR/USD)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('timeframe')
        .setDescription('Timeframe for analysis')
        .setRequired(false)
        .addChoices(
          { name: '1 Hour', value: '1h' },
          { name: '4 Hours', value: '4h' },
          { name: '1 Day', value: '1d' }
        )
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const pair = interaction.options.getString('pair').toUpperCase();
      const timeframe = interaction.options.getString('timeframe') || '1h';

      // Validate pair format
      if (!pair.match(/^[A-Z]{3}\/[A-Z]{3}$/)) {
        return await interaction.editReply({
          content: '❌ Invalid currency pair format. Please use format: XXX/XXX (e.g., EUR/USD)'
        });
      }

      // Call backend API
      const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
      const apiKey = process.env.DISCORD_BOT_API_KEY;

      const response = await axios.post(
        `${backendUrl}/api/v1/subscriptions`,
        {
          discordUserId: interaction.user.id,
          discordUsername: interaction.user.username,
          pair: pair,
          timeframe: timeframe,
          channelId: interaction.channelId
        },
        {
          headers: {
            'x-api-key': apiKey
          }
        }
      );

      if (response.data.success) {
        await interaction.editReply({
          content: `✅ Successfully subscribed to **${pair}** (${timeframe})!\n\n` +
                   `You will be notified in <#${process.env.DISCORD_SIGNAL_CHANNEL_ID}> when the signal changes.`
        });

        logger.info(`User ${interaction.user.username} subscribed to ${pair} (${timeframe})`);
      } else {
        await interaction.editReply({
          content: `❌ Failed to subscribe: ${response.data.error}`
        });
      }

    } catch (error) {
      logger.error('Subscribe command error:', error);

      let errorMessage = '❌ Failed to subscribe. Please try again later.';

      if (error.response?.status === 409) {
        errorMessage = '⚠️ You are already subscribed to this pair and timeframe.';
      } else if (error.response?.data?.error) {
        errorMessage = `❌ ${error.response.data.error}`;
      }

      try {
        await interaction.editReply({ content: errorMessage });
      } catch (replyError) {
        logger.error('Failed to send error message:', replyError);
      }
    }
  }
};
