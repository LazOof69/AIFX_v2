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
      // ═══════════════════════════════════════════════════════
      // 🔍 诊断日志 - 检查 interaction 到达时的状态
      // ═══════════════════════════════════════════════════════
      logger.info('🔍 INTERACTION 状态诊断:', {
        id: interaction.id,
        commandId: interaction.commandId,
        age: Date.now() - interaction.createdTimestamp,
        replied: interaction.replied,      // ← 关键！如果是 true = Discord 自动确认了
        deferred: interaction.deferred,     // ← 关键！如果是 true = Discord 自动确认了
        isRepliable: interaction.isRepliable(),
        type: interaction.type
      });

      // ⚠️ 如果已经被确认，不要尝试 defer
      if (interaction.replied || interaction.deferred) {
        logger.error('❌ CRITICAL: Interaction 到达时已经被确认!', {
          replied: interaction.replied,
          deferred: interaction.deferred,
          possibleCauses: [
            '1. Discord 参数验证失败',
            '2. Bot 权限不足',
            '3. Discord 客户端 bug',
            '4. 隐藏的 bot 实例'
          ]
        });

        // 尝试直接 editReply (如果已 defer)
        if (interaction.deferred) {
          await interaction.editReply({
            content: '❌ 诊断模式：Interaction 预先被确认了。请联系管理员。'
          });
        }
        return;
      }

      logger.info('✅ Interaction 状态正常，开始 defer...');

      // CRITICAL: Defer immediately - backend API takes ~1 second
      // Must acknowledge within 3 seconds or Discord times out
      let deferredSuccessfully = false;
      try {
        await interaction.deferReply();
        deferredSuccessfully = true;
        logger.info('✅ Successfully deferred interaction');
      } catch (deferError) {
        logger.error('Interaction has already been acknowledged.', {
          age: Date.now() - interaction.createdTimestamp,
          code: deferError.code
        });

        // Error 40060 means interaction was already acknowledged
        // This can happen due to race conditions or duplicate events
        // CRITICAL: Must verify interaction.deferred state, not just trust error code
        if (deferError.code === 40060) {
          // Check if defer actually succeeded by verifying interaction state
          if (interaction.deferred) {
            deferredSuccessfully = true;
            logger.info('✅ Defer succeeded despite error (race condition - verified)');
          } else {
            // 40060 but not deferred means interaction is invalid/expired
            logger.error('❌ Error 40060 but interaction NOT deferred - invalid interaction', {
              age: Date.now() - interaction.createdTimestamp,
              deferred: interaction.deferred,
              replied: interaction.replied
            });
            return; // Exit - cannot respond to invalid interaction
          }
        } else if (deferError.code === 10062) {
          // Unknown interaction - it expired before we could acknowledge
          logger.warn('❌ Interaction expired (10062), cannot respond');
          return; // Exit early - can't respond to expired interaction
        } else {
          // Other error - log and exit
          logger.error('❌ Unexpected defer error:', deferError);
          return;
        }
      }

      const pair = interaction.options.getString('pair').toUpperCase();
      const timeframe = interaction.options.getString('timeframe') || '1h';

      // Validate pair format
      if (!pair.match(/^[A-Z]{3}\/[A-Z]{3}$/)) {
        return await interaction.editReply({
          content: '❌ Invalid currency pair format. Please use format: XXX/XXX (e.g., EUR/USD)'
        });
      }

      // Note: bot.js already acknowledged the interaction (either deferred or replied)

      // Call backend API to get signal
      const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
      const apiKey = process.env.DISCORD_BOT_API_KEY;

      const headers = {};
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      // Use query parameter version (no URL encoding issues)
      const response = await axios.get(
        `${backendUrl}/api/v1/trading/signal`,
        {
          params: {
            pair: pair,      // axios handles URL encoding automatically
            timeframe: timeframe
          },
          headers: headers,
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
              name: '📊 Market Condition',
              value: signalData.marketCondition?.toUpperCase() || 'N/A',
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

        // Use editReply or update based on how we acknowledged
        if (deferredSuccessfully || interaction.deferred) {
          await interaction.editReply({ embeds: [embed] });
        } else {
          // We used reply() instead of defer, so edit that reply
          await interaction.editReply({ content: null, embeds: [embed] });
        }

        logger.info(`Signal requested by ${interaction.user.username} for ${pair} (${timeframe})`);
      } else {
        throw new Error(response.data.error || 'Failed to retrieve signal');
      }
    } catch (error) {
      logger.error('Signal command error:', error);

      // Check if this is a Discord API error (interaction timeout)
      if (error.code === 10062 || error.code === 'InteractionNotReplied') {
        logger.warn('Interaction expired before we could respond');
        return; // Can't reply to expired interaction
      }

      let errorMessage = '❌ Failed to retrieve trading signal. Please try again later.';

      if (error.response?.status === 429) {
        errorMessage = '❌ Too many requests. Please wait a moment and try again.';
      } else if (error.response?.status === 503) {
        errorMessage = '❌ ML model not available. Please contact an administrator.';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = '❌ Backend service is unavailable. Please contact an administrator.';
      } else if (error.message && !error.message.includes('interaction')) {
        errorMessage = `❌ Error: ${error.message}`;
      }

      // Try to edit the deferred reply with error message
      try {
        await interaction.editReply({ content: errorMessage });
      } catch (replyError) {
        logger.error('Failed to send error message:', replyError);
      }
    }
  }
};