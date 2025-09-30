/**
 * Server Entry Point
 * Initializes database and starts the Express server
 */

const { app, server } = require('./app');
const { testConnection, syncDatabase } = require('./config/database');
const { handleUnhandledRejection, handleUncaughtException } = require('./middleware/errorHandler');

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
    if (process.env.NODE_ENV === 'development') {
      await syncDatabase(false, true); // alter: true for development
    }

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
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Start the server
startServer();