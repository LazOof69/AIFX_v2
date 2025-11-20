/**
 * Test Script for Signal Monitoring Service
 *
 * Tests the automated signal monitoring without starting the cron job
 */

require('dotenv').config();
const signalMonitoringService = require('../src/services/signalMonitoringService');

async function testSignalMonitoring() {
  console.log('='.repeat(60));
  console.log('🧪 Signal Monitoring Service Test');
  console.log('='.repeat(60));

  try {
    // Get initial status
    console.log('\n1️⃣  Service Status:');
    const status = signalMonitoringService.getStatus();
    console.log(`   Is Running: ${status.isRunning}`);
    console.log(`   Total Checks: ${status.stats.totalChecks}`);
    console.log(`   Signals Detected: ${status.stats.signalsDetected}`);
    console.log(`   Config:`, status.config);

    // Manually trigger a check
    console.log('\n2️⃣  Triggering manual signal check...');
    await signalMonitoringService.triggerManualCheck();

    // Get updated status
    console.log('\n3️⃣  Updated Status:');
    const updatedStatus = signalMonitoringService.getStatus();
    console.log(`   Total Checks: ${updatedStatus.stats.totalChecks}`);
    console.log(`   Signals Detected: ${updatedStatus.stats.signalsDetected}`);
    console.log(`   Errors: ${updatedStatus.stats.errors}`);
    console.log(`   Last Check: ${updatedStatus.lastCheckTime}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(60));

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testSignalMonitoring();
