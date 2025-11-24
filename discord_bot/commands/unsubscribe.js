/**
 * Unsubscribe Command
 * Allows users to unsubscribe from signal change notifications
 */

const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unsubscribe')
    .setDescription('Unsubscribe from signal change notifications')
    .addStringOption(option =>
      option
        .setName('pair')
        .setDescription('Currency pair (e.g., EUR/USD)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('timeframe')
        .setDescription('Timeframe')
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

      // Call backend API
      const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
      const apiKey = process.env.DISCORD_BOT_API_KEY;

      const response = await axios.delete(
        `${backendUrl}/api/v1/subscriptions/user/${interaction.user.id}/pair/${encodeURIComponent(pair)}?timeframe=${timeframe}`,
        {
          headers: {
            'x-api-key': apiKey
          }
        }
      );

      if (response.data.success) {
        await interaction.editReply({
          content: `✅ Successfully unsubscribed from **${pair}** (${timeframe}).`
        });

        logger.info(`User ${interaction.user.username} unsubscribed from ${pair} (${timeframe})`);
      } else {
        await interaction.editReply({
          content: `❌ Failed to unsubscribe: ${response.data.error}`
        });
      }

    } catch (error) {
      logger.error('Unsubscribe command error:', error);

      let errorMessage = '❌ Failed to unsubscribe. Please try again later.';

      if (error.response?.status === 404) {
        errorMessage = '⚠️ You are not subscribed to this pair.';
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
