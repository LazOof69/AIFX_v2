/**
 * Enhanced Debug Logging for Discord Interaction Issue
 *
 * This script adds comprehensive logging to diagnose the "Unknown interaction" error
 */

require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
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
    }
  }
}

// Event: Bot is ready
client.once(Events.ClientReady, async () => {
  logger.info(`✅ DEBUG BOT logged in as ${client.user.tag}`);
  logger.info(`📊 Bot is in ${client.guilds.cache.size} guilds`);

  // Load commands
  loadCommands();

  // Log guild information
  client.guilds.cache.forEach(guild => {
    logger.info(`📍 Guild: ${guild.name} (${guild.id})`);
  });

  client.user.setActivity('DEBUG MODE 🔍', { type: 'WATCHING' });
});

// Event: Handle interaction commands with EXTENSIVE logging
client.on(Events.InteractionCreate, async interaction => {
  console.log('\n========== NEW INTERACTION RECEIVED ==========');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Raw interaction type:', interaction.type);
  console.log('Is chat input command:', interaction.isChatInputCommand());

  if (!interaction.isChatInputCommand()) {
    console.log('Not a chat input command, ignoring');
    return;
  }

  // DETAILED INTERACTION LOGGING
  console.log('\n--- INTERACTION DETAILS ---');
  console.log('Command Name:', interaction.commandName);
  console.log('Command ID:', interaction.commandId);
  console.log('Command Type:', interaction.commandType);
  console.log('Guild ID:', interaction.guildId);
  console.log('Channel ID:', interaction.channelId);
  console.log('User:', `${interaction.user.username} (${interaction.user.id})`);
  console.log('Created Timestamp:', interaction.createdTimestamp);
  console.log('Creation Date:', new Date(interaction.createdTimestamp).toISOString());

  // TIMING INFORMATION
  const now = Date.now();
  const interactionAge = now - interaction.createdTimestamp;
  console.log('\n--- TIMING ANALYSIS ---');
  console.log('Current Time:', now);
  console.log('Interaction Age:', interactionAge + 'ms');
  console.log('Age in seconds:', (interactionAge / 1000).toFixed(3) + 's');

  // STATE INFORMATION
  console.log('\n--- INTERACTION STATE ---');
  console.log('Is Repliable:', interaction.isRepliable());
  console.log('Already Replied:', interaction.replied);
  console.log('Already Deferred:', interaction.deferred);
  console.log('Ephemeral:', interaction.ephemeral);

  // TOKEN INFORMATION
  console.log('\n--- TOKEN INFO ---');
  console.log('Has Token:', !!interaction.token);
  console.log('Token Length:', interaction.token?.length || 0);
  console.log('Token (first 20 chars):', interaction.token?.substring(0, 20) + '...');

  // APPLICATION INFO
  console.log('\n--- APPLICATION INFO ---');
  console.log('Application ID:', interaction.applicationId);
  console.log('Client Application ID:', client.application?.id);
  console.log('IDs Match:', interaction.applicationId === client.application?.id);

  // Check if command exists
  const command = client.commands.get(interaction.commandName);
  console.log('\n--- COMMAND RESOLUTION ---');
  console.log('Command Found in Collection:', !!command);
  console.log('Available Commands:', Array.from(client.commands.keys()).join(', '));

  if (!command) {
    console.log('❌ COMMAND NOT FOUND IN COLLECTION!');
    return;
  }

  // ATTEMPT TO DEFER
  console.log('\n--- ATTEMPTING TO DEFER ---');
  console.log('Time before defer:', Date.now() - interaction.createdTimestamp + 'ms');

  try {
    if (!interaction.replied && !interaction.deferred) {
      console.log('Calling interaction.deferReply()...');
      const deferStartTime = Date.now();

      await interaction.deferReply();

      const deferEndTime = Date.now();
      const deferDuration = deferEndTime - deferStartTime;
      const totalAge = deferEndTime - interaction.createdTimestamp;

      console.log('✅ DEFER SUCCESSFUL!');
      console.log('Defer Duration:', deferDuration + 'ms');
      console.log('Total Age After Defer:', totalAge + 'ms');
      console.log('New State - Replied:', interaction.replied, 'Deferred:', interaction.deferred);
    } else {
      console.log('⚠️ Skipping defer (already replied or deferred)');
    }

    // Execute command
    console.log('\n--- EXECUTING COMMAND ---');
    const execStartTime = Date.now();

    await command.execute(interaction);

    const execEndTime = Date.now();
    const execDuration = execEndTime - execStartTime;
    const totalProcessTime = execEndTime - interaction.createdTimestamp;

    console.log('✅ COMMAND EXECUTED SUCCESSFULLY!');
    console.log('Execution Duration:', execDuration + 'ms');
    console.log('Total Process Time:', totalProcessTime + 'ms');

  } catch (error) {
    console.log('\n--- ERROR OCCURRED ---');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    console.error('Error Status:', error.status);
    console.error('Error Method:', error.method);
    console.error('Error URL:', error.url);

    // Log full error for debugging
    console.error('\nFull Error Object:');
    console.error(JSON.stringify(error, null, 2));

    // Specific error analysis
    if (error.code === 10062) {
      console.log('\n🔴 ERROR 10062: Unknown Interaction');
      console.log('This means Discord does not recognize this interaction token/ID');
      console.log('Possible causes:');
      console.log('  1. Interaction expired (>3 seconds)');
      console.log('  2. Command ID mismatch (cached old command)');
      console.log('  3. Bot responded to interaction from different application');
      console.log('  4. Discord API issue/outage');

      const ageAtError = Date.now() - interaction.createdTimestamp;
      console.log(`\nInteraction age when error occurred: ${ageAtError}ms (${(ageAtError/1000).toFixed(3)}s)`);

      if (ageAtError > 3000) {
        console.log('❌ Interaction too old! This is the root cause.');
      } else {
        console.log('⚠️ Interaction age is OK. Issue is likely:');
        console.log('   - Command ID mismatch (user has cached old commands)');
        console.log('   - User needs to restart Discord client');
      }
    }

    if (error.code === 40060) {
      console.log('\n🔴 ERROR 40060: Interaction Already Acknowledged');
      console.log('The interaction was already replied to or deferred');
    }
  }

  console.log('\n========== END INTERACTION ==========\n');
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
  logger.info('🛑 Shutting down debug bot...');
  client.destroy();
  process.exit(0);
});

// Start the bot
const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  logger.error('❌ DISCORD_BOT_TOKEN is not set');
  process.exit(1);
}

console.log('Starting DEBUG Discord bot...');
console.log('This bot will provide extensive logging for interaction issues.\n');

client.login(token).catch(error => {
  logger.error('Failed to login:', error);
  process.exit(1);
});
