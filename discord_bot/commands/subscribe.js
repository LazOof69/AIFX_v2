/**
 * Subscribe Command
 * Allows users to subscribe to trading signal notifications
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('subscribe')
    .setDescription('Subscribe to trading signal notifications')
    .addStringOption(option =>
      option
        .setName('pair')
        .setDescription('Currency pair to subscribe to (e.g., EUR/USD)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('signal_type')
        .setDescription('Type of signals to receive')
        .setRequired(false)
        .addChoices(
          { name: 'All Signals', value: 'all' },
          { name: 'Buy Only', value: 'buy' },
          { name: 'Sell Only', value: 'sell' },
          { name: 'Strong Signals Only', value: 'strong' }
        )
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const pair = interaction.options.getString('pair').toUpperCase();
      const signalType = interaction.options.getString('signal_type') || 'all';
      const userId = interaction.user.id;
      const username = interaction.user.username;

      // Validate pair format
      if (!pair.match(/^[A-Z]{3}\/[A-Z]{3}$/)) {
        return await interaction.editReply({
          content: '❌ Invalid currency pair format. Please use format: XXX/XXX (e.g., EUR/USD)',
          ephemeral: true
        });
      }

      // Call backend API to subscribe
      const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
      const response = await axios.post(
        `${backendUrl}/api/v1/notifications/subscribe`,
        {
          discordUserId: userId,
          discordUsername: username,
          pair: pair,
          signalType: signalType,
          channel: 'discord'
        },
        {
          timeout: 10000
        }
      );

      if (response.data.success) {
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ Subscription Successful')
          .setDescription(`You are now subscribed to **${pair}** trading signals!`)
          .addFields(
            { name: 'Signal Type', value: signalType === 'all' ? 'All Signals' : signalType, inline: true },
            { name: 'Notifications', value: 'Discord DM', inline: true }
          )
          .setFooter({ text: 'AIFX_v2 Trading Bot' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed], ephemeral: true });

        logger.info(`User ${username} (${userId}) subscribed to ${pair} (${signalType})`);
      } else {
        throw new Error(response.data.error || 'Subscription failed');
      }
    } catch (error) {
      logger.error('Subscribe command error:', error);

      let errorMessage = '❌ Failed to subscribe. Please try again later.';

      if (error.response?.status === 429) {
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