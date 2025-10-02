/**
 * Deploy Commands Script
 * Registers slash commands with Discord API
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Load all commands
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
    console.log(`✅ Loaded command: ${command.data.name}`);
  } else {
    console.warn(`⚠️  Command at ${filePath} is missing required "data" or "execute" property`);
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

// Deploy commands
(async () => {
  try {
    console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);

    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!clientId) {
      throw new Error('DISCORD_CLIENT_ID is not set in environment variables');
    }

    let data;

    if (guildId) {
      // Deploy to specific guild (faster for development)
      console.log(`📍 Deploying to guild: ${guildId}`);
      data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
    } else {
      // Deploy globally (takes up to 1 hour to propagate)
      console.log('🌍 Deploying globally (may take up to 1 hour to propagate)');
      data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
    }

    console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
    console.log('\nDeployed commands:');
    data.forEach(cmd => {
      console.log(`  - /${cmd.name}: ${cmd.description}`);
    });
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
    process.exit(1);
  }
})();