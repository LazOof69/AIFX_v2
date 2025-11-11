require('dotenv').config();
const { REST, Routes } = require('discord.js');
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  const guildCmds = await rest.get(Routes.applicationGuildCommands(clientId, guildId));
  const signalCmd = guildCmds.find(c => c.name === 'signal');

  console.log('Signal Command Registered:');
  console.log('  ID:', signalCmd.id);
  console.log('  Name:', signalCmd.name);
  console.log('  Version:', signalCmd.version);
  console.log('  Guild ID:', signalCmd.guild_id);
  console.log('  Options:', signalCmd.options.length);
  console.log('');
  console.log('When user runs /signal, Discord sends this command ID in the interaction.');
  console.log('If the ID does not match, we get "Unknown interaction" error.');
})();
