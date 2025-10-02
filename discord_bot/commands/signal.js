/**
 * Signal Command
 * Allows users to query real-time trading signals
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('signal')
    .setDescription('Get real-time trading signal for a currency pair')
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
          { name: '15 Minutes', value: '15min' },
          { name: '30 Minutes', value: '30min' },
          { name: '1 Hour', value: '1h' },
          { name: '4 Hours', value: '4h' },
          { name: '1 Day', value: '1d' }
        )
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const pair = interaction.options.getString('pair').toUpperCase();
      const timeframe = interaction.options.getString('timeframe') || '1h';

      // Validate pair format
      if (!pair.match(/^[A-Z]{3}\/[A-Z]{3}$/)) {
        return await interaction.editReply({
          content: '❌ Invalid currency pair format. Please use format: XXX/XXX (e.g., EUR/USD)'
        });
      }

      // Call backend API to get signal
      const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
      const response = await axios.get(
        `${backendUrl}/api/v1/trading/signal/${pair}`,
        {
          params: { timeframe },
          timeout: 30000
        }
      );

      if (response.data.success && response.data.data?.signal) {
        const signalData = response.data.data.signal;

        // Determine color based on signal
        let color = 0x808080; // Gray for hold
        if (signalData.signal === 'buy') color = 0x00FF00; // Green
        if (signalData.signal === 'sell') color = 0xFF0000; // Red

        // Determine emoji based on signal strength
        let strengthEmoji = '⭐';
        if (signalData.signalStrength === 'very_strong') strengthEmoji = '⭐⭐⭐⭐';
        else if (signalData.signalStrength === 'strong') strengthEmoji = '⭐⭐⭐';
        else if (signalData.signalStrength === 'moderate') strengthEmoji = '⭐⭐';

        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle(`📊 Trading Signal: ${pair}`)
          .setDescription(`**Signal:** ${signalData.signal.toUpperCase()} ${strengthEmoji}`)
          .addFields(
            {
              name: '💪 Confidence',
              value: `${(signalData.confidence * 100).toFixed(0)}%`,
              inline: true
            },
            {
              name: '📈 Signal Strength',
              value: signalData.signalStrength.replace('_', ' ').toUpperCase(),
              inline: true
            },
            {
              name: '⏰ Timeframe',
              value: timeframe.toUpperCase(),
              inline: true
            },
            {
              name: '💰 Entry Price',
              value: signalData.entryPrice?.toFixed(5) || 'N/A',
              inline: true
            },
            {
              name: '🛑 Stop Loss',
              value: signalData.stopLoss?.toFixed(5) || 'N/A',
              inline: true
            },
            {
              name: '🎯 Take Profit',
              value: signalData.takeProfit?.toFixed(5) || 'N/A',
              inline: true
            },
            {
              name: '📊 Market Condition',
              value: signalData.marketCondition?.toUpperCase() || 'N/A',
              inline: true
            },
            {
              name: '⚖️ Risk/Reward Ratio',
              value: signalData.riskRewardRatio ? `1:${signalData.riskRewardRatio}` : 'N/A',
              inline: true
            },
            {
              name: '📦 Position Size',
              value: signalData.positionSize ? `${signalData.positionSize}%` : 'N/A',
              inline: true
            }
          )
          .setFooter({ text: '⚠️ ' + signalData.riskWarning })
          .setTimestamp();

        // Add technical indicators if available
        if (signalData.technicalData?.indicators) {
          const indicators = signalData.technicalData.indicators;
          let indicatorText = '';

          if (indicators.sma) {
            indicatorText += `SMA(${indicators.sma.period}): ${indicators.sma.value.toFixed(5)} (${indicators.sma.signal})\n`;
          }
          if (indicators.rsi) {
            indicatorText += `RSI(${indicators.rsi.period}): ${indicators.rsi.value.toFixed(2)} (${indicators.rsi.signal})`;
          }

          if (indicatorText) {
            embed.addFields({
              name: '📉 Technical Indicators',
              value: indicatorText,
              inline: false
            });
          }
        }

        await interaction.editReply({ embeds: [embed] });

        logger.info(`Signal requested by ${interaction.user.username} for ${pair} (${timeframe})`);
      } else {
        throw new Error(response.data.error || 'Failed to retrieve signal');
      }
    } catch (error) {
      logger.error('Signal command error:', error);

      let errorMessage = '❌ Failed to retrieve trading signal. Please try again later.';

      if (error.response?.status === 429) {
        errorMessage = '❌ Too many requests. Please wait a moment and try again.';
      } else if (error.response?.status === 503) {
        errorMessage = '❌ ML model not available. Please contact an administrator.';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = '❌ Backend service is unavailable. Please contact an administrator.';
      } else if (error.message) {
        errorMessage = `❌ Error: ${error.message}`;
      }

      await interaction.editReply({
        content: errorMessage
      });
    }
  }
};