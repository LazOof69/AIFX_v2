/**
 * Ping Command
 * Simple test command to verify bot responsiveness and latency
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Test bot responsiveness and check latency'),

  async execute(interaction) {
    try {
      // Record start time for latency calculation
      const startTime = Date.now();
      const interactionAge = startTime - interaction.createdTimestamp;

      logger.info('🏓 Ping command received', {
        user: interaction.user.username,
        interactionAge: interactionAge
      });

      // Check interaction state
      logger.info('🔍 Interaction state:', {
        id: interaction.id,
        age: interactionAge,
        replied: interaction.replied,
        deferred: interaction.deferred,
        isRepliable: interaction.isRepliable()
      });

      // Defer immediately to test defer mechanism
      let deferredSuccessfully = false;
      try {
        await interaction.deferReply();
        deferredSuccessfully = true;
        logger.info('✅ Successfully deferred ping interaction');
      } catch (deferError) {
        logger.error('Defer error in ping command', {
          age: Date.now() - interaction.createdTimestamp,
          code: deferError.code
        });

        // Handle specific error codes
        if (deferError.code === 40060) {
          // Defer actually succeeded (race condition)
          deferredSuccessfully = true;
          logger.info('✅ Defer succeeded despite error (race condition)');
        } else if (deferError.code === 10062) {
          // Interaction expired
          logger.warn('❌ Interaction expired (10062), cannot respond');
          return;
        } else {
          // Unknown error
          logger.error('❌ Unexpected defer error in ping:', deferError);
          return;
        }
      }

      // Calculate defer latency
      const deferLatency = Date.now() - startTime;

      // Simulate some processing (optional)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Calculate total response time
      const totalLatency = Date.now() - startTime;
      const apiLatency = interaction.client.ws.ping;

      // Get uptime
      const uptimeSeconds = process.uptime();
      const uptimeMinutes = Math.floor(uptimeSeconds / 60);
      const uptimeHours = Math.floor(uptimeMinutes / 60);

      // Create embed response
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🏓 Pong!')
        .setDescription('Bot is online and responding')
        .addFields(
          {
            name: '⏱️ Response Time',
            value: `${totalLatency}ms`,
            inline: true
          },
          {
            name: '📡 WebSocket Ping',
            value: `${apiLatency}ms`,
            inline: true
          },
          {
            name: '🔄 Defer Latency',
            value: `${deferLatency}ms`,
            inline: true
          },
          {
            name: '📅 Interaction Age',
            value: `${interactionAge}ms`,
            inline: true
          },
          {
            name: '⏰ Bot Uptime',
            value: uptimeHours > 0
              ? `${uptimeHours}h ${uptimeMinutes % 60}m`
              : `${uptimeMinutes}m ${Math.floor(uptimeSeconds % 60)}s`,
            inline: true
          },
          {
            name: '✅ Status',
            value: deferredSuccessfully ? 'Deferred ✓' : 'Replied ✓',
            inline: true
          }
        )
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add backend health check (non-blocking)
      try {
        const axios = require('axios');
        const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
        const backendStart = Date.now();

        const response = await axios.get(`${backendUrl}/api/v1/health`, {
          timeout: 5000
        });

        const backendLatency = Date.now() - backendStart;

        if (response.data.success) {
          embed.addFields({
            name: '🔗 Backend API',
            value: `✅ Healthy (${backendLatency}ms)`,
            inline: true
          });
        }
      } catch (backendError) {
        embed.addFields({
          name: '🔗 Backend API',
          value: `❌ Unreachable`,
          inline: true
        });
        logger.warn('Backend API unreachable in ping command:', backendError.message);
      }

      // Edit the deferred reply with our embed
      if (deferredSuccessfully || interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        // Fallback: use editReply anyway
        await interaction.editReply({ embeds: [embed] });
      }

      logger.info(`✅ Ping command completed successfully for ${interaction.user.username}`, {
        totalLatency: totalLatency,
        deferLatency: deferLatency,
        interactionAge: interactionAge
      });

    } catch (error) {
      logger.error('Ping command error:', error);

      // Check if this is a Discord API error (interaction timeout)
      if (error.code === 10062 || error.code === 'InteractionNotReplied') {
        logger.warn('Interaction expired before we could respond');
        return; // Can't reply to expired interaction
      }

      const errorMessage = '❌ An error occurred while processing ping command.';

      // Try to edit the deferred reply with error message
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: errorMessage });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      } catch (replyError) {
        logger.error('Failed to send error message:', replyError);
      }
    }
  }
};
