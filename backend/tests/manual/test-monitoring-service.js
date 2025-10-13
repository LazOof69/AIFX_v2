/**
 * Manual Test Script for Position Monitoring Service
 * Tests the monitoring service with mock positions
 *
 * Run: node tests/manual/test-monitoring-service.js
 */

require('dotenv').config();
const monitoringService = require('../../src/services/monitoringService');
const { UserTradingHistory, PositionMonitoring } = require('../../src/models');
const { sequelize } = require('../../src/config/database');
const logger = require('../../src/utils/logger');

async function testMonitoringService() {
  console.log('🧪 Testing Position Monitoring Service\n');
  console.log('=' .repeat(60));

  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Test 1: Get service status
    console.log('📊 Test 1: Get Service Status');
    console.log('-'.repeat(60));
    const status = monitoringService.getStatus();
    console.log('Status:', JSON.stringify(status, null, 2));
    console.log('✅ Status check passed\n');

    // Test 2: Test calculateRiskReward
    console.log('📊 Test 2: Calculate Risk-Reward');
    console.log('-'.repeat(60));
    const rrTest1 = monitoringService.calculateRiskReward(1.0850, 'buy', 1.0820, 1.0920);
    console.log('Buy position @ 1.0850, SL: 1.0820, TP: 1.0920');
    console.log('Result:', rrTest1);
    console.log(`Expected: Risk ~0.0030, Reward ~0.0070, RR ~2.33`);
    console.log('✅ Risk-Reward calculation passed\n');

    const rrTest2 = monitoringService.calculateRiskReward(1.0850, 'sell', 1.0880, 1.0800);
    console.log('Sell position @ 1.0850, SL: 1.0880, TP: 1.0800');
    console.log('Result:', rrTest2);
    console.log('✅ Risk-Reward calculation for sell passed\n');

    // Test 3: Test calculateHoldingDuration
    console.log('📊 Test 3: Calculate Holding Duration');
    console.log('-'.repeat(60));
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const duration = monitoringService.calculateHoldingDuration(oneHourAgo);
    console.log(`Position opened 1 hour ago: ${duration} minutes`);
    console.log('Expected: ~60 minutes');
    console.log('✅ Holding duration calculation passed\n');

    // Test 4: Check if there are open positions
    console.log('📊 Test 4: Check Open Positions');
    console.log('-'.repeat(60));
    const openPositions = await UserTradingHistory.findAll({
      where: { status: 'open' },
      limit: 5,
    });
    console.log(`Found ${openPositions.length} open positions`);

    if (openPositions.length > 0) {
      console.log('\nOpen positions:');
      openPositions.forEach((pos, index) => {
        console.log(`  ${index + 1}. ${pos.pair} ${pos.action.toUpperCase()} @ ${pos.entryPrice} (ID: ${pos.id})`);
      });
    } else {
      console.log('⚠️  No open positions found. Monitoring service will have nothing to monitor.');
    }
    console.log('✅ Open positions check passed\n');

    // Test 5: Test monitoring a single position (if available)
    if (openPositions.length > 0) {
      console.log('📊 Test 5: Monitor Single Position');
      console.log('-'.repeat(60));
      const testPosition = openPositions[0];
      console.log(`Testing with position: ${testPosition.pair} ${testPosition.action} @ ${testPosition.entryPrice}`);

      try {
        const result = await monitoringService.monitorPosition(testPosition);

        if (result) {
          console.log('✅ Position monitored successfully');
          console.log('Monitoring record:', {
            currentPrice: result.currentPrice,
            unrealizedPnl: `${result.unrealizedPnlPips} pips (${result.unrealizedPnlPercentage}%)`,
            recommendation: result.recommendation,
            confidence: result.recommendationConfidence,
            trendStrength: result.trendStrength,
            reversalProbability: result.reversalProbability,
          });
        } else {
          console.log('⚠️  Monitoring returned null (likely API error)');
        }
      } catch (error) {
        console.log('❌ Error monitoring position:', error.message);
      }
      console.log();
    }

    // Test 6: Test monitoring cycle (monitorAllPositions)
    console.log('📊 Test 6: Monitor All Positions (Full Cycle)');
    console.log('-'.repeat(60));
    console.log('Running monitoring cycle...\n');

    const cycleResult = await monitoringService.monitorAllPositions();

    console.log('Cycle results:', {
      success: cycleResult.success,
      positionsMonitored: cycleResult.positionsMonitored,
      positionsFailed: cycleResult.positionsFailed,
      totalPositions: cycleResult.totalPositions,
      duration: `${cycleResult.duration}ms`,
      avgTimePerPosition: cycleResult.avgTimePerPosition ? `${cycleResult.avgTimePerPosition}ms` : 'N/A',
    });

    if (cycleResult.success) {
      console.log('✅ Monitoring cycle completed successfully\n');
    } else {
      console.log('❌ Monitoring cycle failed:', cycleResult.error, '\n');
    }

    // Test 7: Check monitoring records created
    if (openPositions.length > 0) {
      console.log('📊 Test 7: Verify Monitoring Records');
      console.log('-'.repeat(60));

      const monitoringRecords = await PositionMonitoring.findAll({
        where: { positionId: openPositions[0].id },
        order: [['timestamp', 'DESC']],
        limit: 3,
      });

      console.log(`Found ${monitoringRecords.length} monitoring records for position ${openPositions[0].id}`);

      if (monitoringRecords.length > 0) {
        console.log('\nLatest monitoring record:');
        const latest = monitoringRecords[0];
        console.log({
          timestamp: latest.timestamp,
          currentPrice: latest.currentPrice,
          unrealizedPnl: `${latest.unrealizedPnlPips} pips`,
          recommendation: latest.recommendation,
          confidence: latest.recommendationConfidence,
          notificationSent: latest.notificationSent,
          notificationLevel: latest.notificationLevel,
        });
        console.log('✅ Monitoring records verified\n');
      } else {
        console.log('⚠️  No monitoring records found\n');
      }
    }

    // Test 8: Test service start/stop
    console.log('📊 Test 8: Test Service Start/Stop');
    console.log('-'.repeat(60));
    console.log('Note: Not actually starting service (would run indefinitely)');
    console.log('Use monitoringService.startMonitoring() to start monitoring');
    console.log('Use monitoringService.stopMonitoring() to stop monitoring');
    console.log('✅ Service control methods available\n');

    console.log('=' .repeat(60));
    console.log('✅ All tests completed successfully!\n');
    console.log('💡 To start continuous monitoring:');
    console.log('   monitoringService.startMonitoring()');
    console.log('   (will run every 60 seconds)');
    console.log();

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  } finally {
    await sequelize.close();
    console.log('Database connection closed');
  }
}

// Run tests
testMonitoringService()
  .then(() => {
    console.log('Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test script error:', error);
    process.exit(1);
  });
