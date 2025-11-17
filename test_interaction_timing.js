/**
 * Test to understand Discord interaction timing issue
 */

const { Client, GatewayIntentBits, Events } = require('discord.js');
require('dotenv').config({ path: '/root/AIFX_v2/discord_bot/.env' });

// Create minimal Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Track timing
let interactionReceived = null;
let deferAttempted = null;
let deferCompleted = null;

client.once(Events.ClientReady, () => {
  console.log(`✅ Test bot logged in as ${client.user.tag}`);
  console.log('⏰ Waiting for /signal command to test timing...\n');
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // Mark when interaction was received
  interactionReceived = Date.now();
  console.log(`\n📨 Interaction received at: ${interactionReceived}`);
  console.log(`   Command: /${interaction.commandName}`);
  console.log(`   Already replied: ${interaction.replied}`);
  console.log(`   Already deferred: ${interaction.deferred}`);
  console.log(`   Created timestamp: ${interaction.createdTimestamp}`);
  console.log(`   Age at receipt: ${Date.now() - interaction.createdTimestamp}ms`);

  // Attempt defer IMMEDIATELY
  deferAttempted = Date.now();
  console.log(`\n⏱️  Attempting defer at: ${deferAttempted} (${deferAttempted - interactionReceived}ms after receipt)`);

  try {
    await interaction.deferReply();
    deferCompleted = Date.now();
    console.log(`✅ Defer successful at: ${deferCompleted}`);
    console.log(`   Time to defer: ${deferCompleted - interactionReceived}ms`);
    console.log(`   Interaction age at defer: ${deferCompleted - interaction.createdTimestamp}ms`);

    // Try to edit reply
    setTimeout(async () => {
      try {
        await interaction.editReply({ content: '✅ Test completed successfully!' });
        console.log(`✅ Edit reply successful`);
      } catch (error) {
        console.log(`❌ Edit reply failed: ${error.message}`);
      }
    }, 1000);

  } catch (error) {
    deferCompleted = Date.now();
    console.log(`❌ Defer FAILED at: ${deferCompleted}`);
    console.log(`   Time to defer attempt: ${deferCompleted - interactionReceived}ms`);
    console.log(`   Interaction age at defer: ${deferCompleted - interaction.createdTimestamp}ms`);
    console.log(`   Error code: ${error.code}`);
    console.log(`   Error message: ${error.message}`);
    console.log(`   Error name: ${error.name}`);

    // Try to reply as fallback
    try {
      await interaction.reply({ content: '❌ Defer failed, but reply worked!', ephemeral: true });
      console.log(`✅ Direct reply worked as fallback`);
    } catch (replyError) {
      console.log(`❌ Direct reply also failed: ${replyError.message}`);
    }
  }
});

// Login
client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
  console.error('Failed to login:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down test bot...');
  client.destroy();
  process.exit(0);
});
