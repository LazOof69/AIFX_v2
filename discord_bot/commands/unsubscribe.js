/**
 * Unsubscribe Command
 * Allows users to unsubscribe from trading signal notifications
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unsubscribe')
    .setDescription('Unsubscribe from trading signal notifications')
    .addStringOption(option =>
      option
        .setName('pair')
        .setDescription('Currency pair to unsubscribe from (leave empty for all)')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const pair = interaction.options.getString('pair')?.toUpperCase();
      const userId = interaction.user.id;
      const username = interaction.user.username;

      // Validate pair format if provided
      if (pair && !pair.match(/^[A-Z]{3}\/[A-Z]{3}$/)) {
        return await interaction.editReply({
          content: '❌ Invalid currency pair format. Please use format: XXX/XXX (e.g., EUR/USD)',
          ephemeral: true
        });
      }

      // Call backend API to unsubscribe
      const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
      const response = await axios.post(
        `${backendUrl}/api/v1/notifications/unsubscribe`,
        {
          discordUserId: userId,
          discordUsername: username,
          pair: pair || 'all'
        },
        {
          timeout: 10000
        }
      );

      if (response.data.success) {
        const embed = new EmbedBuilder()
          .setColor(0xFF9900)
          .setTitle('✅ Unsubscribed Successfully')
          .setDescription(
            pair
              ? `You have been unsubscribed from **${pair}** trading signals.`
              : 'You have been unsubscribed from **all** trading signals.'
          )
          .setFooter({ text: 'AIFX_v2 Trading Bot' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed], ephemeral: true });

        logger.info(`User ${username} (${userId}) unsubscribed from ${pair || 'all'}`);
      } else {
        throw new Error(response.data.error || 'Unsubscribe failed');
      }
    } catch (error) {
      logger.error('Unsubscribe command error:', error);

      let errorMessage = '❌ Failed to unsubscribe. Please try again later.';

      if (error.response?.status === 404) {
        errorMessage = '❌ No active subscriptions found.';
      } else if (error.response?.status === 429) {
        errorMessage = '❌ Too many requests. Please wait a moment and try again.';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = '❌ Backend service is unavailable. Please contact an administrator.';
      } else if (error.message) {
        errorMessage = `❌ Error: ${error.message}`;
      }

      await interaction.editReply({
        content: errorMessage,
        ephemeral: true
      });
    }
  }
};