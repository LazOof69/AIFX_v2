/**
 * Subscriptions Command
 * Shows user's current subscriptions
 */

const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('subscriptions')
    .setDescription('View your signal change subscriptions'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Call backend API
      const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
      const apiKey = process.env.DISCORD_BOT_API_KEY;

      const response = await axios.get(
        `${backendUrl}/api/v1/subscriptions/user/${interaction.user.id}`,
        {
          headers: {
            'x-api-key': apiKey
          }
        }
      );

      if (response.data.success) {
        const subscriptions = response.data.data;

        if (subscriptions.length === 0) {
          return await interaction.editReply({
            content: '📭 You have no active subscriptions.\n\nUse `/subscribe pair:EUR/USD` to subscribe to a currency pair.'
          });
        }

        // Format subscriptions list
        let message = `📊 **Your Subscriptions** (${subscriptions.length})\n\n`;

        subscriptions.forEach((sub, index) => {
          message += `${index + 1}. **${sub.pair}** (${sub.timeframe})\n`;
          message += `   Subscribed: ${new Date(sub.createdAt).toLocaleDateString()}\n\n`;
        });

        message += `\nUse \`/unsubscribe pair:XXX/XXX\` to unsubscribe.`;

        await interaction.editReply({ content: message });

        logger.info(`User ${interaction.user.username} viewed subscriptions (${subscriptions.length} total)`);
      } else {
        await interaction.editReply({
          content: `❌ Failed to fetch subscriptions: ${response.data.error}`
        });
      }

    } catch (error) {
      logger.error('Subscriptions command error:', error);

      try {
        await interaction.editReply({
          content: '❌ Failed to fetch subscriptions. Please try again later.'
        });
      } catch (replyError) {
        logger.error('Failed to send error message:', replyError);
      }
    }
  }
};
