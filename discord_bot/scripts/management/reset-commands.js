/**
 * Reset Discord Commands
 *
 * This script completely removes and re-registers all commands.
 * Use this if users are experiencing "Unknown interaction" errors due to cache issues.
 *
 * WARNING: This will temporarily break commands for all users until they restart Discord.
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

async function resetCommands() {
  console.log('=== Discord Command Reset Utility ===\n');

  if (!clientId) {
    console.error('❌ DISCORD_CLIENT_ID not set');
    process.exit(1);
  }

  try {
    // Step 1: Delete all existing commands
    console.log('Step 1: Deleting all existing commands...');

    if (guildId) {
      console.log(`  Guild commands in guild ${guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: [] }
      );
      console.log('  ✅ Guild commands deleted');
    }

    console.log('  Global commands...');
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: [] }
    );
    console.log('  ✅ Global commands deleted\n');

    // Step 2: Wait for Discord to process deletion
    console.log('Step 2: Waiting 5 seconds for Discord to process...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('  ✅ Wait complete\n');

    // Step 3: Load commands from files
    console.log('Step 3: Loading command definitions...');
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);

      // Clear require cache to ensure fresh load
      delete require.cache[require.resolve(filePath)];

      const command = require(filePath);

      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`  ✅ Loaded: ${command.data.name}`);
      } else {
        console.warn(`  ⚠️  Skipped: ${file} (missing data or execute)`);
      }
    }

    if (commands.length === 0) {
      console.error('\n❌ No commands loaded! Check commands directory.');
      process.exit(1);
    }

    console.log(`\n  Total commands loaded: ${commands.length}\n`);

    // Step 4: Re-register commands
    console.log('Step 4: Re-registering commands with Discord...');

    let registeredCommands;

    if (guildId) {
      console.log(`  Registering to guild ${guildId}...`);
      registeredCommands = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      console.log(`  ✅ ${registeredCommands.length} guild commands registered`);
    } else {
      console.log('  Registering globally (will take up to 1 hour)...');
      registeredCommands = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      console.log(`  ✅ ${registeredCommands.length} global commands registered`);
    }

    // Step 5: Display new command IDs
    console.log('\nStep 5: New command IDs:');
    registeredCommands.forEach(cmd => {
      console.log(`  /${cmd.name}`);
      console.log(`    ID: ${cmd.id}`);
      console.log(`    Version: ${cmd.version}`);
      console.log('');
    });

    // Success summary
    console.log('=== RESET COMPLETE ===\n');
    console.log('✅ All commands have been reset successfully!');
    console.log('');
    console.log('IMPORTANT: Users must restart their Discord clients');
    console.log('to see the updated commands. Commands will not work');
    console.log('until users restart Discord.');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Notify users to completely restart Discord');
    console.log('  2. Wait 30 seconds after restart');
    console.log('  3. Test commands again');
    console.log('');

  } catch (error) {
    console.error('\n❌ Error during command reset:', error);

    if (error.code === 50001) {
      console.log('\n⚠️  Missing Access');
      console.log('Bot needs to be invited to guild with application.commands scope');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n⚠️  Network Error');
      console.log('Check internet connection');
    } else {
      console.log('\nError details:');
      console.log('  Code:', error.code);
      console.log('  Message:', error.message);
    }

    process.exit(1);
  }
}

// Run the reset
console.log('⚠️  WARNING: This will temporarily break commands for all users!');
console.log('Only proceed if you\'ve notified users or are debugging.\n');

// In non-interactive environment, just run it
// In interactive environment, you could add a prompt here

resetCommands().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
