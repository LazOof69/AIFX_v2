/**
 * Database Migration Runner
 * Handles running migrations for database schema changes
 */

const path = require('path');
const fs = require('fs').promises;
const { sequelize } = require('../backend/src/config/database');

/**
 * Migration tracking table schema
 */
const createMigrationsTable = async () => {
  const [result] = await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
      "name" VARCHAR(255) NOT NULL,
      PRIMARY KEY ("name"),
      UNIQUE ("name")
    );
  `);
  return result;
};

/**
 * Get list of completed migrations
 */
const getCompletedMigrations = async () => {
  try {
    const [results] = await sequelize.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
    return results.map(result => result.name);
  } catch (error) {
    return [];
  }
};

/**
 * Mark migration as completed
 */
const markMigrationCompleted = async (migrationName) => {
  await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (?)', {
    replacements: [migrationName],
  });
};

/**
 * Remove migration from completed list
 */
const removeMigrationCompleted = async (migrationName) => {
  await sequelize.query('DELETE FROM "SequelizeMeta" WHERE name = ?', {
    replacements: [migrationName],
  });
};

/**
 * Get list of migration files
 */
const getMigrationFiles = async () => {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = await fs.readdir(migrationsDir);
  return files
    .filter(file => file.endsWith('.js'))
    .sort();
};

/**
 * Run pending migrations
 */
const runMigrations = async () => {
  try {
    console.log('🔄 Starting database migrations...');

    // Ensure migrations table exists
    await createMigrationsTable();

    // Get completed migrations and available migration files
    const [completedMigrations, migrationFiles] = await Promise.all([
      getCompletedMigrations(),
      getMigrationFiles(),
    ]);

    // Find pending migrations
    const pendingMigrations = migrationFiles.filter(
      file => !completedMigrations.includes(file)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations found.');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migrations:`);
    pendingMigrations.forEach(migration => {
      console.log(`   - ${migration}`);
    });

    // Run each pending migration
    for (const migrationFile of pendingMigrations) {
      console.log(`🔄 Running migration: ${migrationFile}`);

      const migrationPath = path.join(__dirname, 'migrations', migrationFile);
      const migration = require(migrationPath);

      // Run the migration
      await migration.up(sequelize.getQueryInterface(), sequelize.constructor);

      // Mark as completed
      await markMigrationCompleted(migrationFile);

      console.log(`✅ Completed migration: ${migrationFile}`);
    }

    console.log('🎉 All migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    throw error;
  }
};

/**
 * Rollback last migration
 */
const rollbackMigration = async () => {
  try {
    console.log('🔄 Rolling back last migration...');

    // Ensure migrations table exists
    await createMigrationsTable();

    // Get completed migrations
    const completedMigrations = await getCompletedMigrations();

    if (completedMigrations.length === 0) {
      console.log('📋 No migrations to rollback.');
      return;
    }

    // Get last migration
    const lastMigration = completedMigrations[completedMigrations.length - 1];
    console.log(`🔄 Rolling back migration: ${lastMigration}`);

    // Load and run down method
    const migrationPath = path.join(__dirname, 'migrations', lastMigration);
    const migration = require(migrationPath);

    await migration.down(sequelize.getQueryInterface(), sequelize.constructor);

    // Remove from completed migrations
    await removeMigrationCompleted(lastMigration);

    console.log(`✅ Rollback completed: ${lastMigration}`);

  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    console.error(error.stack);
    throw error;
  }
};

/**
 * Show migration status
 */
const showMigrationStatus = async () => {
  try {
    // Ensure migrations table exists
    await createMigrationsTable();

    const [completedMigrations, migrationFiles] = await Promise.all([
      getCompletedMigrations(),
      getMigrationFiles(),
    ]);

    console.log('📋 Migration Status:');
    console.log('==================');

    migrationFiles.forEach(file => {
      const status = completedMigrations.includes(file) ? '✅ Completed' : '⏳ Pending';
      console.log(`${status} - ${file}`);
    });

    const pendingCount = migrationFiles.length - completedMigrations.length;
    console.log('');
    console.log(`Total migrations: ${migrationFiles.length}`);
    console.log(`Completed: ${completedMigrations.length}`);
    console.log(`Pending: ${pendingCount}`);

  } catch (error) {
    console.error('❌ Failed to show migration status:', error.message);
    throw error;
  }
};

// CLI interface
const main = async () => {
  const command = process.argv[2];

  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    switch (command) {
      case 'up':
        await runMigrations();
        break;
      case 'down':
        await rollbackMigration();
        break;
      case 'status':
        await showMigrationStatus();
        break;
      default:
        console.log('Usage: node migrate.js [up|down|status]');
        console.log('  up     - Run pending migrations');
        console.log('  down   - Rollback last migration');
        console.log('  status - Show migration status');
        process.exit(1);
    }

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runMigrations,
  rollbackMigration,
  showMigrationStatus,
};