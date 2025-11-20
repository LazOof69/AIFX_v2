/**
 * Simple Discord Connection Test
 * Minimal test to diagnose connection issues
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client, GatewayIntentBits, Events } = require('discord.js');

const token = process.env.DISCORD_BOT_TOKEN;

console.log('Testing Discord connection...');
console.log('Token:', token ? token.substring(0, 30) + '...' : 'NOT SET');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.on(Events.ClientReady, (c) => {
  console.log('✅ Bot is ready!');
  console.log(`✅ Logged in as ${c.user.tag}`);
  console.log(`✅ Bot ID: ${c.user.id}`);
  console.log(`✅ Connected to ${c.guilds.cache.size} servers`);

  // List all guilds
  c.guilds.cache.forEach(guild => {
    console.log(`   - ${guild.name} (${guild.id})`);
  });

  process.exit(0);
});

client.on(Events.Error, (error) => {
  console.error('❌ Discord error:', error);
  process.exit(1);
});

client.on(Events.Debug, (info) => {
  console.log('DEBUG:', info);
});

console.log('Attempting to login...');

client.login(token).then(() => {
  console.log('Login command sent, waiting for ready event...');
}).catch(error => {
  console.error('❌ Login failed:', error.message);
  process.exit(1);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.error('❌ Connection timeout after 30 seconds');
  process.exit(1);
}, 30000);
