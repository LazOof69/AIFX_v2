/**
 * Discord Notification Service
 *
 * Purpose: Send automated trading signal notifications to Discord channels
 * Features:
 * - Rich embed message formatting
 * - Multi-channel support
 * - Message deduplication
 * - Error handling and retry logic
 *
 * Created: 2025-10-17
 */

const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
const logger = require('../utils/logger');

/**
 * Discord Notification Service Class
 */
class DiscordNotificationService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.defaultChannelId = process.env.DISCORD_SIGNAL_CHANNEL_ID;
    this.recentSignals = new Map(); // For message deduplication
    this.stats = {
      totalSent: 0,
      failures: 0,
      deduplicated: 0
    };
  }

  /**
   * Initialize Discord client and connect
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.client) {
      logger.warn('Discord client already initialized');
      return;
    }

    try {
      const botToken = process.env.DISCORD_BOT_TOKEN;

      if (!botToken) {
        throw new Error('DISCORD_BOT_TOKEN not configured in environment variables');
      }

      // Create Discord client with minimal intents
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages
        ]
      });

      // Set up event handlers BEFORE login
      this.client.on('error', (error) => {
        logger.error('Discord client error:', error);
      });

      // Set up ready handler and login
      const readyPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Discord connection timeout'));
        }, 30000); // 30 second timeout

        this.client.once(Events.ClientReady, (client) => {
          clearTimeout(timeout);
          this.isReady = true;
          logger.info(`✅ Discord bot connected as ${client.user.tag}`);
          resolve();
        });
      });

      // Login to Discord
      await this.client.login(botToken);

      // Wait for ready event
      await readyPromise;

      logger.info('🚀 Discord Notification Service initialized');

    } catch (error) {
      logger.error('Failed to initialize Discord client:', error);
      throw error;
    }
  }

  /**
   * Disconnect Discord client
   */
  async disconnect() {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
      this.isReady = false;
      logger.info('🛑 Discord client disconnected');
    }
  }

  /**
   * Check if a signal was recently sent (for deduplication)
   * @param {Object} signal - Signal data
   * @returns {boolean} True if signal is duplicate
   */
  isDuplicateSignal(signal) {
    const key = `${signal.pair}_${signal.timeframe}_${signal.signal}`;
    const lastSent = this.recentSignals.get(key);

    if (lastSent) {
      const minutesSinceLastSent = (Date.now() - lastSent) / 1000 / 60;
      // Consider duplicate if same signal sent within 30 minutes
      if (minutesSinceLastSent < 30) {
        return true;
      }
    }

    return false;
  }

  /**
   * Mark signal as sent (for deduplication)
   * @param {Object} signal - Signal data
   */
  markSignalSent(signal) {
    const key = `${signal.pair}_${signal.timeframe}_${signal.signal}`;
    this.recentSignals.set(key, Date.now());

    // Clean up old entries (older than 1 hour)
    for (const [k, timestamp] of this.recentSignals.entries()) {
      if (Date.now() - timestamp > 3600000) {
        this.recentSignals.delete(k);
      }
    }
  }

  /**
   * Format signal data as Discord embed
   * @param {Object} signal - Signal data
   * @returns {EmbedBuilder} Discord embed
   */
  formatSignalEmbed(signal) {
    const isLong = signal.signal === 'long';
    const color = isLong ? 0x00FF00 : 0xFF0000; // Green for long, Red for short
    const emoji = isLong ? '⬆️' : '⬇️';
    const signalText = isLong ? 'LONG (做多)' : 'SHORT (做空)';

    const embed = new EmbedBuilder()
      .setTitle(`🚨 反轉訊號偵測`)
      .setColor(color)
      .addFields(
        {
          name: '💱 貨幣對',
          value: `\`${signal.pair}\``,
          inline: true
        },
        {
          name: '⏱️ 時間框架',
          value: `\`${signal.timeframe}\``,
          inline: true
        },
        {
          name: '📊 訊號',
          value: `**${signalText}** ${emoji}`,
          inline: true
        },
        {
          name: '🎯 信心度',
          value: `\`${(signal.confidence * 100).toFixed(1)}%\``,
          inline: true
        },
        {
          name: '🔄 反轉機率 (Stage 1)',
          value: `\`${(signal.stage1_prob * 100).toFixed(1)}%\``,
          inline: true
        },
        {
          name: '📈 方向機率 (Stage 2)',
          value: `\`${(signal.stage2_prob * 100).toFixed(1)}%\``,
          inline: true
        }
      )
      .setTimestamp(signal.detected_at || new Date())
      .setFooter({
        text: `AIFX v2 | Model: ${signal.model_version || 'v3.1'}`
      });

    // Add contributing factors if available
    if (signal.factors) {
      const factorsText = Object.entries(signal.factors)
        .map(([key, value]) => `• ${key}: ${(value * 100).toFixed(1)}%`)
        .join('\n');

      embed.addFields({
        name: '📋 主要因素',
        value: factorsText || 'N/A',
        inline: false
      });
    }

    // Add warning if present
    if (signal.metadata && signal.metadata.warning) {
      embed.addFields({
        name: '⚠️ 注意',
        value: signal.metadata.warning,
        inline: false
      });
    }

    return embed;
  }

  /**
   * Send message to Discord channel
   * @param {string} channelId - Discord channel ID
   * @param {EmbedBuilder} embed - Discord embed
   * @returns {Promise<boolean>} Success status
   */
  async sendToChannel(channelId, embed) {
    try {
      if (!this.isReady) {
        throw new Error('Discord client not ready');
      }

      const channel = await this.client.channels.fetch(channelId);

      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }

      if (!channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`);
      }

      await channel.send({ embeds: [embed] });
      return true;

    } catch (error) {
      logger.error(`Failed to send message to channel ${channelId}:`, error);
      throw error;
    }
  }

  /**
   * Send signal notification to Discord
   * @param {Object} signal - Signal data
   * @param {string} channelId - Optional channel ID (uses default if not provided)
   * @returns {Promise<Object>} Result object
   */
  async sendSignalNotification(signal, channelId = null) {
    try {
      // Check if service is initialized
      if (!this.isReady) {
        logger.warn('Discord service not initialized, attempting to initialize...');
        await this.initialize();
      }

      // Check for duplicate
      if (this.isDuplicateSignal(signal)) {
        logger.info(`⏭️  Skipping duplicate signal: ${signal.pair} ${signal.timeframe} ${signal.signal}`);
        this.stats.deduplicated++;
        return {
          success: true,
          skipped: true,
          reason: 'duplicate'
        };
      }

      // Use provided channel ID or default
      const targetChannelId = channelId || this.defaultChannelId;

      if (!targetChannelId) {
        throw new Error('No channel ID specified and no default channel configured');
      }

      logger.info(`📤 Sending signal notification: ${signal.pair} ${signal.timeframe} ${signal.signal}`);

      // Format embed
      const embed = this.formatSignalEmbed(signal);

      // Send to channel
      await this.sendToChannel(targetChannelId, embed);

      // Mark as sent
      this.markSignalSent(signal);
      this.stats.totalSent++;

      logger.info(`✅ Signal notification sent successfully`);

      return {
        success: true,
        skipped: false,
        channelId: targetChannelId
      };

    } catch (error) {
      logger.error('Failed to send signal notification:', {
        error: error.message,
        signal: {
          pair: signal.pair,
          timeframe: signal.timeframe,
          signal: signal.signal
        }
      });

      this.stats.failures++;

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send notification to multiple channels
   * @param {Object} signal - Signal data
   * @param {Array<string>} channelIds - Array of channel IDs
   * @returns {Promise<Object>} Results summary
   */
  async sendToMultipleChannels(signal, channelIds) {
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    for (const channelId of channelIds) {
      try {
        const result = await this.sendSignalNotification(signal, channelId);

        if (result.success) {
          if (result.skipped) {
            results.skipped++;
          } else {
            results.success++;
          }
        } else {
          results.failed++;
          results.errors.push({
            channelId,
            error: result.error
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          channelId,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get service status and statistics
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isReady: this.isReady,
      connected: this.client?.user?.tag || null,
      defaultChannel: this.defaultChannelId,
      stats: this.stats,
      recentSignalsCount: this.recentSignals.size
    };
  }

  /**
   * Test Discord connection by sending a test message
   * @param {string} channelId - Optional channel ID
   * @returns {Promise<boolean>} Success status
   */
  async sendTestMessage(channelId = null) {
    try {
      const targetChannelId = channelId || this.defaultChannelId;

      const embed = new EmbedBuilder()
        .setTitle('🧪 Discord Notification Test')
        .setDescription('This is a test message from AIFX v2 Signal Monitoring Service')
        .setColor(0x0099FF)
        .addFields(
          { name: 'Status', value: '✅ Connected', inline: true },
          { name: 'Bot', value: this.client.user.tag, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'AIFX v2 | Test Message' });

      await this.sendToChannel(targetChannelId, embed);

      logger.info('✅ Test message sent successfully');
      return true;

    } catch (error) {
      logger.error('Failed to send test message:', error);
      return false;
    }
  }
}

// Singleton instance
const discordNotificationService = new DiscordNotificationService();

module.exports = discordNotificationService;
