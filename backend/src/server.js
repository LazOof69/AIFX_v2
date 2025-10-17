/**
 * Server Entry Point
 * Initializes database and starts the Express server
 */

const { app, server } = require('./app');
const { testConnection, syncDatabase } = require('./config/database');
const { handleUnhandledRejection, handleUncaughtException } = require('./middleware/errorHandler');
const monitoringService = require('./services/monitoringService');
const signalMonitoringService = require('./services/signalMonitoringService');

// Handle uncaught exceptions
process.on('uncaughtException', handleUncaughtException);

// Handle unhandled promise rejections
process.on('unhandledRejection', handleUnhandledRejection);

/**
 * Initialize and start the server
 */
const startServer = async () => {
  try {
    console.log('🔄 Starting AIFX_v2 Backend Server...');

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Sync database models (only in development)
    // Disabled - use migrations instead
    // if (process.env.NODE_ENV === 'development') {
    //   await syncDatabase(false, true); // alter: true for development
    // }

    // Import models to ensure relationships are established
    require('./models');

    const PORT = process.env.PORT || 3000;

    server.listen(PORT, () => {
      console.log('✅ AIFX_v2 Backend Server started successfully!');
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/v1/health`);

      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Development mode: Database auto-sync enabled');
      }

      // Start position monitoring service (Phase 3)
      console.log('🔄 Starting position monitoring service...');
      monitoringService.startMonitoring();
      console.log('✅ Position monitoring service started (checks every 60 seconds)');

      // Start signal monitoring service (Discord notifications)
      console.log('🔄 Starting signal monitoring service...');
      signalMonitoringService.start();
      console.log('✅ Signal monitoring service started (checks every 15 minutes)');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown handler
const gracefulShutdown = async () => {
  console.log('\n⏳ Graceful shutdown initiated...');

  // Stop monitoring services
  console.log('🛑 Stopping position monitoring service...');
  monitoringService.stopMonitoring();

  console.log('🛑 Stopping signal monitoring service...');
  await signalMonitoringService.stop();

  // Close server
  server.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the server
startServer();