/**
 * Preferences Command
 * Allows users to set their notification preferences
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('preferences')
    .setDescription('Set your notification preferences')
    .addIntegerOption(option =>
      option
        .setName('risk_level')
        .setDescription('Risk level (1-10, where 10 is highest risk)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10)
    )
    .addStringOption(option =>
      option
        .setName('trading_style')
        .setDescription('Preferred trading style')
        .setRequired(false)
        .addChoices(
          { name: 'Trend Following', value: 'trend' },
          { name: 'Counter-Trend', value: 'counter-trend' },
          { name: 'Mixed', value: 'mixed' }
        )
    )
    .addNumberOption(option =>
      option
        .setName('min_confidence')
        .setDescription('Minimum confidence level for notifications (0.0-1.0)')
        .setRequired(false)
        .setMinValue(0.0)
        .setMaxValue(1.0)
    )
    .addBooleanOption(option =>
      option
        .setName('strong_signals_only')
        .setDescription('Only receive strong and very strong signals')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const userId = interaction.user.id;
      const username = interaction.user.username;

      const preferences = {};

      // Collect provided preferences
      const riskLevel = interaction.options.getInteger('risk_level');
      const tradingStyle = interaction.options.getString('trading_style');
      const minConfidence = interaction.options.getNumber('min_confidence');
      const strongSignalsOnly = interaction.options.getBoolean('strong_signals_only');

      if (riskLevel !== null) preferences.riskLevel = riskLevel;
      if (tradingStyle !== null) preferences.tradingStyle = tradingStyle;
      if (minConfidence !== null) preferences.minConfidence = minConfidence;
      if (strongSignalsOnly !== null) preferences.strongSignalsOnly = strongSignalsOnly;

      // Check if any preferences were provided
      if (Object.keys(preferences).length === 0) {
        // If no preferences provided, show current preferences
        return await this.showCurrentPreferences(interaction, userId);
      }

      // Call backend API to update preferences
      const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
      const response = await axios.post(
        `${backendUrl}/api/v1/notifications/preferences`,
        {
          discordUserId: userId,
          discordUsername: username,
          preferences: preferences
        },
        {
          timeout: 10000
        }
      );

      if (response.data.success) {
        const updatedPrefs = response.data.data.preferences || preferences;

        const embed = new EmbedBuilder()
          .setColor(0x0099FF)
          .setTitle('✅ Preferences Updated')
          .setDescription('Your notification preferences have been updated successfully!')
          .addFields(
            {
              name: '⚖️ Risk Level',
              value: updatedPrefs.riskLevel?.toString() || 'Not set',
              inline: true
            },
            {
              name: '📊 Trading Style',
              value: updatedPrefs.tradingStyle || 'Not set',
              inline: true
            },
            {
              name: '💪 Min Confidence',
              value: updatedPrefs.minConfidence ? `${(updatedPrefs.minConfidence * 100).toFixed(0)}%` : 'Not set',
              inline: true
            },
            {
              name: '⭐ Strong Signals Only',
              value: updatedPrefs.strongSignalsOnly ? 'Yes' : 'No',
              inline: true
            }
          )
          .setFooter({ text: 'AIFX_v2 Trading Bot' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed], ephemeral: true });

        logger.info(`User ${username} (${userId}) updated preferences`);
      } else {
        throw new Error(response.data.error || 'Failed to update preferences');
      }
    } catch (error) {
      logger.error('Preferences command error:', error);

      let errorMessage = '❌ Failed to update preferences. Please try again later.';

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
  },

  async showCurrentPreferences(interaction, userId) {
    try {
      const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
      const response = await axios.get(
        `${backendUrl}/api/v1/notifications/preferences/${userId}`,
        { timeout: 10000 }
      );

      if (response.data.success && response.data.data) {
        const prefs = response.data.data.preferences || {};

        const embed = new EmbedBuilder()
          .setColor(0x0099FF)
          .setTitle('📋 Your Current Preferences')
          .setDescription('Use the command options to update your preferences.')
          .addFields(
            {
              name: '⚖️ Risk Level',
              value: prefs.riskLevel?.toString() || 'Not set (default: 5)',
              inline: true
            },
            {
              name: '📊 Trading Style',
              value: prefs.tradingStyle || 'Not set (default: mixed)',
              inline: true
            },
            {
              name: '💪 Min Confidence',
              value: prefs.minConfidence ? `${(prefs.minConfidence * 100).toFixed(0)}%` : 'Not set (default: 50%)',
              inline: true
            },
            {
              name: '⭐ Strong Signals Only',
              value: prefs.strongSignalsOnly ? 'Yes' : 'No (default)',
              inline: true
            }
          )
          .setFooter({ text: 'AIFX_v2 Trading Bot' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed], ephemeral: true });
      } else {
        await interaction.editReply({
          content: '📋 No preferences set yet. Use the command options to set your preferences.',
          ephemeral: true
        });
      }
    } catch (error) {
      logger.error('Error fetching current preferences:', error);
      await interaction.editReply({
        content: '❌ Failed to fetch current preferences.',
        ephemeral: true
      });
    }
  }
};