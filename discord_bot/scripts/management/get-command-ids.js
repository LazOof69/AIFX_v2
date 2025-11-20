require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

(async () => {
  try {
    console.log('📋 Fetching registered commands...\n');

    // Get guild commands
    if (guildId) {
      console.log(`Guild Commands (Guild ID: ${guildId}):`);
      const guildCommands = await rest.get(
        Routes.applicationGuildCommands(clientId, guildId)
      );

      if (guildCommands.length === 0) {
        console.log('  ❌ No guild commands found');
      } else {
        guildCommands.forEach(cmd => {
          console.log(`  ✅ /${cmd.name}`);
          console.log(`     ID: ${cmd.id}`);
          console.log(`     Version: ${cmd.version}`);
          console.log('');
        });
      }
    } else {
      console.log('⚠️  No DISCORD_GUILD_ID set, checking global commands only\n');
    }

    // Get global commands
    console.log('Global Commands:');
    const globalCommands = await rest.get(
      Routes.applicationCommands(clientId)
    );

    if (globalCommands.length === 0) {
      console.log('  ❌ No global commands found');
    } else {
      globalCommands.forEach(cmd => {
        console.log(`  ✅ /${cmd.name}`);
        console.log(`     ID: ${cmd.id}`);
        console.log(`     Version: ${cmd.version}`);
        console.log('');
      });
    }

    console.log('\n📊 Summary:');
    console.log(`   Guild commands: ${guildId ? guildCommands.length : 'N/A'}`);
    console.log(`   Global commands: ${globalCommands.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
