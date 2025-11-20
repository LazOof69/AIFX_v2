/**
 * Verify Discord Command Registration
 * Diagnostic script to check actual registered commands with Discord API
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

async function verifyCommands() {
  console.log('=== Discord Command Registration Verification ===\n');

  console.log('Environment Configuration:');
  console.log(`  Client ID: ${clientId}`);
  console.log(`  Guild ID: ${guildId || 'NOT SET (global commands)'}`);
  console.log(`  Bot Token: ${process.env.DISCORD_BOT_TOKEN ? '✅ Set' : '❌ Missing'}\n`);

  try {
    let guildCommands = [];
    let globalCommands = [];

    if (guildId) {
      // Check guild commands
      console.log('📋 Fetching GUILD commands...');
      guildCommands = await rest.get(
        Routes.applicationGuildCommands(clientId, guildId)
      );

      console.log(`\n✅ Found ${guildCommands.length} guild commands:\n`);

      if (guildCommands.length === 0) {
        console.log('⚠️  NO COMMANDS REGISTERED IN GUILD!');
        console.log('   This is the problem - commands need to be deployed.\n');
      } else {
        guildCommands.forEach(cmd => {
          console.log(`  Command: /${cmd.name}`);
          console.log(`    ID: ${cmd.id}`);
          console.log(`    Description: ${cmd.description}`);
          console.log(`    Version: ${cmd.version}`);
          console.log(`    Options: ${cmd.options?.length || 0}`);
          console.log('');
        });
      }
    }

    // Check global commands
    console.log('\n📋 Fetching GLOBAL commands...');
    globalCommands = await rest.get(
      Routes.applicationCommands(clientId)
    );

    console.log(`\n✅ Found ${globalCommands.length} global commands:\n`);

    if (globalCommands.length === 0) {
      console.log('ℹ️  No global commands registered (this is normal for guild-only bots)\n');
    } else {
      globalCommands.forEach(cmd => {
        console.log(`  Command: /${cmd.name}`);
        console.log(`    ID: ${cmd.id}`);
        console.log(`    Description: ${cmd.description}`);
        console.log(`    Version: ${cmd.version}`);
        console.log('');
      });
    }

    // Summary
    console.log('\n=== DIAGNOSIS ===');

    if (guildId && guildCommands.length === 0) {
      console.log('❌ PROBLEM IDENTIFIED:');
      console.log('   Guild commands are NOT registered in guild ' + guildId);
      console.log('   User is trying to use commands that don\'t exist in Discord.\n');
      console.log('SOLUTION:');
      console.log('   Run: node deploy-commands.js');
      console.log('   This will register all commands to the guild.\n');
    } else if (guildId && guildCommands.length > 0) {
      console.log('✅ Commands are properly registered.');
      console.log('   The /signal command exists with ID: 1437452216213442571');
      console.log('   If interaction is failing, the issue is likely:');
      console.log('   - User needs to restart Discord client (cache issue)');
      console.log('   - Interaction timing/handling issue in bot.js');
      console.log('   - Discord API latency causing "Unknown interaction"\n');
      console.log('NEXT STEPS:');
      console.log('   1. Ask user to completely restart Discord client');
      console.log('   2. Check bot.js logs for interaction.commandId');
      console.log('   3. Add more detailed logging to track the interaction\n');
    }

  } catch (error) {
    console.error('\n❌ Error verifying commands:', error);

    if (error.code === 50001) {
      console.log('\n⚠️  Bot is missing access to guild ' + guildId);
      console.log('   Make sure the bot is invited to this guild with application.commands scope.\n');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n⚠️  Network error - check internet connection\n');
    } else {
      console.log('\n⚠️  Error code:', error.code);
      console.log('   Error message:', error.message);
    }
  }
}

verifyCommands().catch(console.error);
