/**
 * Ultra-detailed diagnostic test for Discord interaction issues
 * This will log EVERY detail about incoming interactions
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.once(Events.ClientReady, () => {
  console.log(`✅ Diagnostic bot ready as ${client.user.tag}`);
  console.log(`📊 In ${client.guilds.cache.size} guilds`);
  console.log('\n⏳ Waiting for slash command interactions...\n');
});

client.on(Events.InteractionCreate, async interaction => {
  const receiveTime = Date.now();
  const interactionAge = receiveTime - interaction.createdTimestamp;

  console.log('\n========================================');
  console.log('🔔 INTERACTION RECEIVED');
  console.log('========================================');
  console.log('Type:', interaction.type);
  console.log('Command Name:', interaction.commandName || 'N/A');
  console.log('Command ID:', interaction.commandId || 'N/A');
  console.log('User:', interaction.user.tag);
  console.log('Guild ID:', interaction.guildId || 'DM');
  console.log('Channel ID:', interaction.channelId);
  console.log('\n⏱️  TIMING ANALYSIS:');
  console.log('Created Timestamp:', new Date(interaction.createdTimestamp).toISOString());
  console.log('Received Timestamp:', new Date(receiveTime).toISOString());
  console.log('Age at receipt:', `${interactionAge}ms`);
  console.log('\n🔍 INTERACTION STATE:');
  console.log('isChatInputCommand:', interaction.isChatInputCommand());
  console.log('isRepliable:', interaction.isRepliable());
  console.log('replied:', interaction.replied);
  console.log('deferred:', interaction.deferred);
  console.log('ephemeral:', interaction.ephemeral || false);

  if (interaction.isChatInputCommand()) {
    console.log('\n📝 COMMAND OPTIONS:');
    interaction.options.data.forEach(opt => {
      console.log(`  - ${opt.name}: ${opt.value} (type: ${opt.type})`);
    });
  }

  // Test 1: Immediate defer (0ms delay)
  console.log('\n🧪 TEST 1: Immediate defer (0ms delay)');
  try {
    const deferStart = Date.now();
    await interaction.deferReply();
    const deferEnd = Date.now();
    const deferTime = deferEnd - deferStart;
    const totalAge = deferEnd - interaction.createdTimestamp;

    console.log('✅ Defer SUCCEEDED');
    console.log('   Defer took:', `${deferTime}ms`);
    console.log('   Total age when deferred:', `${totalAge}ms`);
    console.log('   Deferred status:', interaction.deferred);

    // Test editing the reply
    console.log('\n🧪 TEST 2: Edit deferred reply');
    const editStart = Date.now();
    await interaction.editReply('✅ Test successful! Interaction is working correctly.');
    const editEnd = Date.now();
    console.log('✅ Edit SUCCEEDED');
    console.log('   Edit took:', `${editEnd - editStart}ms`);

  } catch (error) {
    console.log('❌ Defer or Edit FAILED');
    console.log('   Error code:', error.code);
    console.log('   Error message:', error.message);
    console.log('   Age when failed:', `${Date.now() - interaction.createdTimestamp}ms`);
    console.log('   Error details:', JSON.stringify(error, null, 2));
  }

  console.log('========================================\n');
});

client.on(Events.Error, error => {
  console.error('❌ Discord client error:', error);
});

client.on(Events.Warn, warning => {
  console.warn('⚠️  Discord client warning:', warning);
});

// Raw event to see if we're getting interactions before discord.js processes them
client.on('raw', packet => {
  if (packet.t === 'INTERACTION_CREATE') {
    console.log('\n🔴 RAW INTERACTION_CREATE PACKET RECEIVED');
    console.log('Packet received at:', new Date().toISOString());
    console.log('Interaction ID:', packet.d.id);
    console.log('Interaction Type:', packet.d.type);
    console.log('Command:', packet.d.data?.name || 'N/A');
  }
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN not set');
  process.exit(1);
}

client.login(token).catch(error => {
  console.error('Failed to login:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down diagnostic bot...');
  client.destroy();
  process.exit(0);
});
