/**
 * Test script to measure exact timing of Discord bot interaction flow
 * This will help identify where the timeout is occurring
 */

const axios = require('axios');

// Test configuration
const BACKEND_URL = 'http://localhost:3000';
const API_KEY = '091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109';
const TEST_PAIR = 'EUR/USD';
const TEST_TIMEFRAME = '1h';

// Timing constants
const DISCORD_INTERACTION_TIMEOUT = 3000; // 3 seconds
const DISCORD_DEFER_EXPIRY = 15 * 60 * 1000; // 15 minutes after defer

/**
 * Measure timing of backend API call
 */
async function testBackendAPITiming() {
  console.log('\n=== Testing Backend API Call Timing ===\n');

  const startTime = Date.now();

  try {
    console.log(`[${Date.now() - startTime}ms] Starting API request to ${BACKEND_URL}/api/v1/trading/signal`);

    const response = await axios.get(
      `${BACKEND_URL}/api/v1/trading/signal`,
      {
        params: {
          pair: TEST_PAIR,
          timeframe: TEST_TIMEFRAME
        },
        headers: {
          'x-api-key': API_KEY
        },
        timeout: 30000
      }
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`[${duration}ms] API response received`);
    console.log(`\nTiming Analysis:`);
    console.log(`- Total API call duration: ${duration}ms`);
    console.log(`- Discord interaction timeout: ${DISCORD_INTERACTION_TIMEOUT}ms`);
    console.log(`- Time remaining: ${DISCORD_INTERACTION_TIMEOUT - duration}ms`);

    if (duration > DISCORD_INTERACTION_TIMEOUT) {
      console.log('\n❌ PROBLEM IDENTIFIED: API call takes longer than Discord\'s 3-second timeout!');
      console.log(`   The API call took ${duration}ms, but Discord requires response within ${DISCORD_INTERACTION_TIMEOUT}ms`);
    } else {
      console.log('\n✅ API timing is acceptable (within 3-second window)');
    }

    console.log(`\nResponse status: ${response.status}`);
    console.log(`Response data:`, JSON.stringify(response.data, null, 2));

  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.error(`\n❌ API call failed after ${duration}ms`);

    if (error.code === 'ECONNREFUSED') {
      console.error('   Backend service is not running!');
    } else if (error.code === 'ECONNABORTED') {
      console.error('   Request timeout exceeded');
    } else {
      console.error(`   Error: ${error.message}`);
    }
  }
}

/**
 * Simulate Discord bot interaction flow with exact timing
 */
async function simulateDiscordInteractionFlow() {
  console.log('\n\n=== Simulating Discord Bot Interaction Flow ===\n');

  const interactionReceived = Date.now();

  console.log(`[0ms] Discord interaction received`);
  console.log(`[~5-10ms] Bot.js InteractionCreate event fires`);
  console.log(`[~10-20ms] Command retrieved from collection`);
  console.log(`[~20-30ms] Starting deferReply()...`);

  // Simulate defer timing
  const deferStartTime = Date.now();
  const deferSimulatedDelay = Math.floor(Math.random() * 500) + 100; // 100-600ms

  await new Promise(resolve => setTimeout(resolve, deferSimulatedDelay));

  const deferEndTime = Date.now();
  console.log(`[${deferEndTime - interactionReceived}ms] deferReply() completed`);

  // Check if defer succeeded within 3-second window
  if (deferEndTime - interactionReceived > DISCORD_INTERACTION_TIMEOUT) {
    console.log(`\n❌ CRITICAL ISSUE: deferReply() took too long!`);
    console.log(`   Defer completed at ${deferEndTime - interactionReceived}ms, but Discord timeout is ${DISCORD_INTERACTION_TIMEOUT}ms`);
    console.log(`   This means the interaction expired BEFORE we could defer it!`);
    return;
  }

  console.log(`\nDeferring successful. Now executing command.execute()...`);

  // Now simulate the command execution (API call)
  const commandStartTime = Date.now();
  console.log(`[${commandStartTime - interactionReceived}ms] Command.execute() starts`);
  console.log(`[${commandStartTime - interactionReceived}ms] Validating pair format...`);
  console.log(`[${commandStartTime - interactionReceived + 5}ms] Starting backend API call...`);

  try {
    const apiCallStart = Date.now();
    const response = await axios.get(
      `${BACKEND_URL}/api/v1/trading/signal`,
      {
        params: {
          pair: TEST_PAIR,
          timeframe: TEST_TIMEFRAME
        },
        headers: {
          'x-api-key': API_KEY
        },
        timeout: 30000
      }
    );

    const apiCallEnd = Date.now();
    const apiDuration = apiCallEnd - apiCallStart;
    const totalTime = apiCallEnd - interactionReceived;

    console.log(`[${totalTime}ms] API response received (API call took ${apiDuration}ms)`);
    console.log(`[${totalTime + 50}ms] Building Discord embed...`);
    console.log(`[${totalTime + 100}ms] Calling interaction.editReply()...`);

    const editReplyTime = totalTime + 150;
    console.log(`[${editReplyTime}ms] Response sent to user via editReply()`);

    console.log(`\n✅ Success! Full interaction flow completed in ${editReplyTime}ms`);
    console.log(`   Time remaining in defer window: ${DISCORD_DEFER_EXPIRY - editReplyTime}ms (~${Math.floor((DISCORD_DEFER_EXPIRY - editReplyTime) / 1000)}s)`);

  } catch (error) {
    const errorTime = Date.now() - interactionReceived;
    console.log(`[${errorTime}ms] ❌ Error occurred: ${error.message}`);

    if (error.code === 'ECONNREFUSED') {
      console.log(`   Backend is not running - cannot complete test`);
    }
  }
}

/**
 * Test potential blocking operations
 */
async function testBlockingOperations() {
  console.log('\n\n=== Testing for Blocking Operations ===\n');

  // Check if there are any synchronous file operations
  console.log('1. Checking command loading (synchronous)...');
  const fs = require('fs');
  const path = require('path');
  const commandsPath = path.join(__dirname, 'discord_bot', 'commands');

  const loadStart = Date.now();
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  const loadEnd = Date.now();

  console.log(`   Command files loaded in ${loadEnd - loadStart}ms`);
  console.log(`   Files found: ${commandFiles.join(', ')}`);

  if (loadEnd - loadStart > 100) {
    console.log(`   ⚠️  Warning: Command loading took > 100ms, may delay defer`);
  } else {
    console.log(`   ✅ Command loading is fast`);
  }
}

/**
 * Check Discord API latency
 */
async function checkDiscordAPILatency() {
  console.log('\n\n=== Discord API Latency Considerations ===\n');

  console.log('Discord API Timing Requirements:');
  console.log(`- Initial response/defer: Must complete within ${DISCORD_INTERACTION_TIMEOUT}ms (3 seconds)`);
  console.log(`- Edit reply after defer: Can take up to ${DISCORD_DEFER_EXPIRY}ms (15 minutes)`);
  console.log(`- Network latency to Discord: ~50-300ms (varies by region)`);
  console.log('');
  console.log('Flow:');
  console.log('1. User types /signal → Discord sends interaction to bot');
  console.log('2. Bot receives interaction (network latency: ~50-150ms)');
  console.log('3. Bot.js InteractionCreate fires (processing: ~10-50ms)');
  console.log('4. Bot calls deferReply() (processing + network: ~100-500ms)');
  console.log('5. ⏱️  TOTAL TIME MUST BE < 3000ms or interaction expires!');
  console.log('');
  console.log('After defer succeeds:');
  console.log('6. Command executes and calls backend API (can take longer)');
  console.log('7. Bot calls editReply() with results (must complete within 15 minutes of defer)');
}

/**
 * Main test execution
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Discord Bot Interaction Timing Analysis');
  console.log('='.repeat(80));

  // Test 1: Backend API timing
  await testBackendAPITiming();

  // Test 2: Full interaction flow simulation
  await simulateDiscordInteractionFlow();

  // Test 3: Check for blocking operations
  await testBlockingOperations();

  // Test 4: Discord API latency info
  await checkDiscordAPILatency();

  console.log('\n' + '='.repeat(80));
  console.log('Analysis Complete');
  console.log('='.repeat(80));
}

main().catch(console.error);
