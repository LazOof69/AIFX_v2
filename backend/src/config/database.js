/**
 * Sequelize Database Configuration
 * PostgreSQL connection setup with environment-based configuration
 */

const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Database configuration object
 * Supports both DATABASE_URL and individual connection parameters
 */
const config = {
  development: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'aifx_v2',
    username: process.env.DB_USER || 'aifx_user',
    password: process.env.DB_PASSWORD || 'aifx_password',
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: {
      ssl: false,
    },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: false, // Disable soft deletes (no deleted_at column in DB)
    },
  },
  test: {
    url: process.env.TEST_DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME + '_test' || 'aifx_v2_test',
    username: process.env.DB_USER || 'aifx_user',
    password: process.env.DB_PASSWORD || 'aifx_password',
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: {
      ssl: false,
    },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: false, // Disable soft deletes (no deleted_at column in DB)
    },
  },
  production: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 20,
      min: 5,
      acquire: 60000,
      idle: 10000,
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: false, // Disable soft deletes (no deleted_at column in DB)
    },
  },
};

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

let sequelize;

/**
 * Initialize Sequelize instance
 * Uses DATABASE_URL if available, otherwise uses individual parameters
 */
if (dbConfig.url) {
  sequelize = new Sequelize(dbConfig.url, {
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: dbConfig.pool,
    dialectOptions: dbConfig.dialectOptions,
    define: dbConfig.define,
  });
} else {
  sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
      host: dbConfig.host,
      port: dbConfig.port,
      dialect: dbConfig.dialect,
      logging: dbConfig.logging,
      pool: dbConfig.pool,
      dialectOptions: dbConfig.dialectOptions,
      define: dbConfig.define,
    }
  );
}

/**
 * Test database connection
 *
 * @returns {Promise<boolean>} Connection success status
 */
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection has been established successfully.');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    return false;
  }
};

/**
 * Sync database models
 * Use with caution in production
 *
 * @param {boolean} force - Force recreate tables
 * @param {boolean} alter - Alter existing tables
 * @returns {Promise<void>}
 */
const syncDatabase = async (force = false, alter = false) => {
  try {
    if (process.env.NODE_ENV === 'production' && force) {
      console.warn('⚠️  Force sync is disabled in production');
      return;
    }

    const options = { force, alter };

    if (process.env.NODE_ENV === 'development') {
      options.logging = console.log;
    }

    await sequelize.sync(options);
    console.log('✅ Database synchronized successfully.');
  } catch (error) {
    console.error('❌ Database synchronization failed:', error.message);
    throw error;
  }
};

/**
 * Close database connection gracefully
 *
 * @returns {Promise<void>}
 */
const closeConnection = async () => {
  try {
    await sequelize.close();
    console.log('✅ Database connection closed successfully.');
  } catch (error) {
    console.error('❌ Error closing database connection:', error.message);
    throw error;
  }
};

module.exports = {
  sequelize,
  Sequelize,
  config,
  testConnection,
  syncDatabase,
  closeConnection,
};