/**
 * Manual Signal Change Test Script
 * 手动触发信号变化检测测试
 */

require('dotenv').config();
const { sequelize } = require('./src/models');
const signalChangeNotificationService = require('./src/services/signalChangeNotificationService');
const logger = require('./src/utils/logger');

async function testSignalChangeDetection() {
  try {
    logger.info('========================================');
    logger.info('🧪 Manual Signal Change Detection Test');
    logger.info('========================================');

    // Check all signal changes (service is already instantiated)
    logger.info('🔍 Starting signal change check...');
    await signalChangeNotificationService.checkAllSignalChanges();

    logger.info('✅ Signal change check completed');
    logger.info('========================================');

    // Close database connection
    await sequelize.close();
    logger.info('Database connection closed');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
testSignalChangeDetection();
