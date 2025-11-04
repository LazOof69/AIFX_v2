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
    // Defer immediately at bot level to prevent timeout (3 second Discord limit)
    // Commands that need immediate responses can skip deferring in their execute()
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.deferReply();
      } catch (deferError) {
        // If defer fails, log and continue - command will handle it
        if (deferError.code !== 40060) { // Ignore "already acknowledged" error
          logger.warn(`Failed to defer interaction: ${deferError.message}`);
        }
      }
    }

    await command.execute(interaction);
    logger.info(`Command ${interaction.commandName} executed by ${interaction.user.username}`);
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}:`, error);

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