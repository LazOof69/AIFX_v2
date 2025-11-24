/**
 * AIFX_v2 Discord Bot
 * Main bot file for handling Discord interactions and notifications
 */

require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const redis = require('redis');
const logger = require('./utils/logger');

/**
 * Sleep utility for retry logic
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Defer interaction with retry logic to handle Discord Gateway-to-REST-API sync delays
 *
 * Discord's distributed architecture can cause race conditions where:
 * - Gateway creates interaction and sends to bot via WebSocket
 * - Bot tries to defer via REST API
 * - REST API doesn't know about interaction yet (eventual consistency)
 * - Result: "Unknown interaction" error (10062)
 *
 * Solution: Retry with exponential backoff to wait for Discord's internal sync
 *
 * @param {Interaction} interaction - Discord interaction
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @returns {Promise<{success: boolean, method: string}>} - Defer result
 */
async function deferWithRetry(interaction, maxRetries = 3) {
  const interactionAge = Date.now() - interaction.createdTimestamp;

  logger.info(`🚀 Attempting to defer ${interaction.commandName} (age: ${interactionAge}ms)`);

  // Strategy 1: Try defer with retry logic
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Add small delay before first attempt to let Discord sync (50ms buffer)
      if (attempt === 1) {
        await sleep(50);
      }

      await interaction.deferReply();
      logger.info(`✅ Successfully deferred ${interaction.commandName} on attempt ${attempt}/${maxRetries} (total age: ${Date.now() - interaction.createdTimestamp}ms)`);
      return { success: true, method: 'defer' };
    } catch (error) {
      const currentAge = Date.now() - interaction.createdTimestamp;

      logger.warn(`⚠️ Defer attempt ${attempt}/${maxRetries} failed: ${error.message}`, {
        code: error.code,
        age: currentAge,
        command: interaction.commandName
      });

      // Error 10062: Unknown interaction - Discord API doesn't know about it yet
      if (error.code === 10062 && attempt < maxRetries) {
        // Exponential backoff: 50ms, 100ms, 150ms
        const delay = attempt * 50;
        logger.info(`⏳ Retrying defer in ${delay}ms (Gateway-to-REST sync delay suspected)...`);
        await sleep(delay);
        continue; // Try again
      }

      // Error 40060: Already acknowledged - someone else handled it
      if (error.code === 40060) {
        logger.warn('⚠️ Interaction already acknowledged - another process handled it');
        return { success: false, method: 'defer', error: 'already_acknowledged' };
      }

      // If max retries exceeded with 10062, try immediate reply fallback
      if (error.code === 10062 && attempt === maxRetries) {
        logger.warn(`⚠️ Defer failed after ${maxRetries} attempts, trying immediate reply fallback...`);
        break; // Exit loop to try immediate reply
      }

      // Other errors - don't retry
      logger.error(`❌ Defer failed with unrecoverable error: ${error.message} (code: ${error.code})`);
      return { success: false, method: 'defer', error: error.code };
    }
  }

  // Strategy 2: Fallback to immediate reply (doesn't require REST API lookup)
  try {
    logger.info(`🔄 Attempting immediate reply fallback for ${interaction.commandName}...`);
    await interaction.reply({
      content: '⏳ Processing your request...',
      ephemeral: false
    });
    logger.info(`✅ Successfully used immediate reply fallback for ${interaction.commandName}`);
    return { success: true, method: 'immediate_reply' };
  } catch (replyError) {
    logger.error(`❌ Immediate reply fallback failed: ${replyError.message} (code: ${replyError.code})`);
    return { success: false, method: 'immediate_reply', error: replyError.code };
  }
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

// Initialize command collection
client.commands = new Collection();

// Rate limiting map (in-memory, consider using Redis for production)
const rateLimiter = new Map();

/**
 * Load commands from commands directory
 */
function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      logger.info(`Loaded command: ${command.data.name}`);
    } else {
      logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
    }
  }
}

/**
 * Initialize Redis client for pub/sub
 */
let redisClient = null;
let redisSubscriber = null;

async function initializeRedis() {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisDb = parseInt(process.env.REDIS_DB) || 2;

    redisClient = redis.createClient({
      url: redisUrl,
      database: redisDb
    });

    redisSubscriber = redisClient.duplicate();

    redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
    redisSubscriber.on('error', (err) => logger.error('Redis Subscriber Error:', err));

    await redisClient.connect();
    await redisSubscriber.connect();

    logger.info('Redis connected successfully');

    // Subscribe to notification channel
    await redisSubscriber.subscribe('trading-signals', async (message) => {
      try {
        const notification = JSON.parse(message);
        await handleNotification(notification);
      } catch (error) {
        logger.error('Error handling notification:', error);
      }
    });

    logger.info('Subscribed to trading-signals channel');

    // Subscribe to signal-change channel (MVP: Signal Change Notifications)
    await redisSubscriber.subscribe('signal-change', async (message) => {
      try {
        const event = JSON.parse(message);
        await handleSignalChangeNotification(event);
      } catch (error) {
        logger.error('Error handling signal-change event:', error);
      }
    });

    logger.info('Subscribed to signal-change channel');
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    logger.warn('Bot will continue without Redis pub/sub functionality');
  }
}

/**
 * Handle incoming notification from backend
 */
async function handleNotification(notification) {
  try {
    const { discordUserId, signal, pair, timeframe } = notification;

    if (!discordUserId || !signal) {
      logger.warn('Invalid notification format:', notification);
      return;
    }

    // Check rate limiting
    if (!checkRateLimit(discordUserId)) {
      logger.warn(`Rate limit exceeded for user ${discordUserId}`);
      return;
    }

    // Get user
    const user = await client.users.fetch(discordUserId).catch(() => null);
    if (!user) {
      logger.warn(`User ${discordUserId} not found`);
      return;
    }

    // Create embed for notification
    const { EmbedBuilder } = require('discord.js');

    let color = 0x808080; // Gray for hold
    if (signal.signal === 'buy') color = 0x00FF00; // Green
    if (signal.signal === 'sell') color = 0xFF0000; // Red

    let strengthEmoji = '⭐';
    if (signal.signalStrength === 'very_strong') strengthEmoji = '⭐⭐⭐⭐';
    else if (signal.signalStrength === 'strong') strengthEmoji = '⭐⭐⭐';
    else if (signal.signalStrength === 'moderate') strengthEmoji = '⭐⭐';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`🔔 New Trading Signal: ${pair}`)
      .setDescription(`**Signal:** ${signal.signal.toUpperCase()} ${strengthEmoji}`)
      .addFields(
        {
          name: '💪 Confidence',
          value: `${(signal.confidence * 100).toFixed(0)}%`,
          inline: true
        },
        {
          name: '⏰ Timeframe',
          value: timeframe?.toUpperCase() || 'N/A',
          inline: true
        },
        {
          name: '📊 Signal Strength',
          value: signal.signalStrength?.replace('_', ' ').toUpperCase() || 'N/A',
          inline: true
        },
        {
          name: '💰 Entry Price',
          value: signal.entryPrice?.toFixed(5) || 'N/A',
          inline: true
        },
        {
          name: '🛑 Stop Loss',
          value: signal.stopLoss?.toFixed(5) || 'N/A',
          inline: true
        },
        {
          name: '🎯 Take Profit',
          value: signal.takeProfit?.toFixed(5) || 'N/A',
          inline: true
        }
      )
      .setFooter({ text: '⚠️ Trading carries significant risk. Always do your own research.' })
      .setTimestamp();

    // Send DM to user
    await user.send({ embeds: [embed] });
    logger.info(`Notification sent to user ${discordUserId} for ${pair}`);

  } catch (error) {
    logger.error('Error sending notification:', error);
  }
}

/**
 * Handle signal change notification from backend
 * MVP: Signal Change Notifications Feature
 */
async function handleSignalChangeNotification(event) {
  try {
    logger.info(`📬 Received signal-change event: ${event.pair} (${event.timeframe})`);

    const channelId = process.env.DISCORD_SIGNAL_CHANNEL_ID;
    if (!channelId) {
      logger.warn('DISCORD_SIGNAL_CHANNEL_ID not set, cannot send notification');
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      logger.error(`Channel ${channelId} not found`);
      return;
    }

    // Format user mentions
    const mentions = event.subscribers.map(s => `<@${s.id}>`).join(' ');

    // Determine emoji based on signal
    let emoji = '⚪';
    if (event.newSignal === 'buy') emoji = '🟢';
    if (event.newSignal === 'sell') emoji = '🔴';

    // Format message
    let message = `${emoji} **Signal Change Alert**\n\n`;
    message += `**${event.pair}** (${event.timeframe})\n`;
    message += `${event.oldSignal ? event.oldSignal.toUpperCase() : 'N/A'} → **${event.newSignal.toUpperCase()}**\n\n`;
    message += `📊 Confidence: ${(event.newConfidence * 100).toFixed(0)}%\n`;
    message += `💪 Strength: ${event.signalStrength?.toUpperCase() || 'N/A'}\n`;
    message += `📈 Market: ${event.marketCondition?.toUpperCase() || 'N/A'}\n`;

    if (event.entryPrice) {
      message += `💰 Entry Price: ${event.entryPrice.toFixed(5)}\n`;
    }

    if (event.indicators) {
      message += `\n📉 Indicators:\n`;
      if (event.indicators.sma) {
        message += `SMA(${event.indicators.sma.period}): ${event.indicators.sma.value.toFixed(5)} (${event.indicators.sma.signal})\n`;
      }
      if (event.indicators.rsi) {
        message += `RSI(${event.indicators.rsi.period}): ${event.indicators.rsi.value.toFixed(2)} (${event.indicators.rsi.signal})\n`;
      }
    }

    message += `\n👥 ${mentions}`;
    message += `\n⏰ ${new Date().toLocaleString()}`;

    await channel.send(message);
    logger.info(`✅ Signal change notification sent to ${event.subscribers.length} subscribers`);

  } catch (error) {
    logger.error('Error sending signal change notification:', error);
  }
}

/**
 * Check rate limiting for notifications
 * Max 1 notification per minute per user
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const maxNotificationsPerMinute = parseInt(process.env.RATE_LIMIT_MAX_NOTIFICATIONS_PER_MINUTE) || 1;
  const windowMs = 60000; // 1 minute

  if (!rateLimiter.has(userId)) {
    rateLimiter.set(userId, []);
  }

  const userTimestamps = rateLimiter.get(userId);

  // Remove timestamps older than window
  const validTimestamps = userTimestamps.filter(timestamp => now - timestamp < windowMs);

  if (validTimestamps.length >= maxNotificationsPerMinute) {
    return false;
  }

  validTimestamps.push(now);
  rateLimiter.set(userId, validTimestamps);

  return true;
}

/**
 * Clean up rate limiter periodically
 */
setInterval(() => {
  const now = Date.now();
  const windowMs = 60000;

  for (const [userId, timestamps] of rateLimiter.entries()) {
    const validTimestamps = timestamps.filter(timestamp => now - timestamp < windowMs);

    if (validTimestamps.length === 0) {
      rateLimiter.delete(userId);
    } else {
      rateLimiter.set(userId, validTimestamps);
    }
  }
}, 60000); // Clean up every minute

// Event: Bot is ready
client.once(Events.ClientReady, async () => {
  logger.info(`✅ Discord bot logged in as ${client.user.tag}`);
  logger.info(`📊 Bot is in ${client.guilds.cache.size} guilds`);

  // Load commands
  loadCommands();

  // Initialize Redis
  await initializeRedis();

  // Set bot status
  client.user.setActivity('forex markets 📊', { type: 'WATCHING' });
});

// Event: Handle interaction commands
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    logger.warn(`Command ${interaction.commandName} not found`);
    return;
  }

  try {
    // Check interaction age - Discord interactions expire after 3 seconds
    const interactionAge = Date.now() - interaction.createdTimestamp;

    logger.info(`⏱️ Interaction received for ${interaction.commandName}, age: ${interactionAge}ms`);
    logger.info(`🔑 Interaction details:`, {
      interactionId: interaction.id,
      commandId: interaction.commandId,
      commandName: interaction.commandName,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      createdTimestamp: interaction.createdTimestamp,
      currentTime: Date.now(),
      age: interactionAge
    });

    if (interactionAge > 2500) {
      logger.warn(`Interaction too old (${interactionAge}ms), skipping command ${interaction.commandName}`);
      return;
    }

    // Simply execute the command - let it handle its own reply/defer logic
    logger.info(`📝 Executing ${interaction.commandName} command...`);
    await command.execute(interaction);
    logger.info(`✅ Command ${interaction.commandName} executed successfully by ${interaction.user.username}`);
  } catch (error) {
    logger.error(`❌ Error executing command ${interaction.commandName}:`, error);

    const errorMessage = {
      content: '❌ There was an error executing this command!',
      ephemeral: true
    };

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    } catch (replyError) {
      logger.error(`Failed to send error message: ${replyError.message}`);
    }
  }
});

// Event: Handle errors
client.on(Events.Error, error => {
  logger.error('Discord client error:', error);
});

client.on(Events.Warn, warning => {
  logger.warn('Discord client warning:', warning);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Shutting down Discord bot...');

  if (redisClient) {
    await redisClient.quit();
  }
  if (redisSubscriber) {
    await redisSubscriber.quit();
  }

  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Shutting down Discord bot...');

  if (redisClient) {
    await redisClient.quit();
  }
  if (redisSubscriber) {
    await redisSubscriber.quit();
  }

  client.destroy();
  process.exit(0);
});

// Start the bot
const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  logger.error('❌ DISCORD_BOT_TOKEN is not set in environment variables');
  process.exit(1);
}

client.login(token).catch(error => {
  logger.error('Failed to login to Discord:', error);
  process.exit(1);
});