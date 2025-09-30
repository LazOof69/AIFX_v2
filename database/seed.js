/**
 * Database Seeder Runner
 * Handles running seeders for development data
 */

const path = require('path');
const fs = require('fs').promises;
const { sequelize } = require('../backend/src/config/database');

/**
 * Seeder tracking table schema
 */
const createSeedersTable = async () => {
  const [result] = await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "SequelizeSeeds" (
      "name" VARCHAR(255) NOT NULL,
      PRIMARY KEY ("name"),
      UNIQUE ("name")
    );
  `);
  return result;
};

/**
 * Get list of completed seeders
 */
const getCompletedSeeders = async () => {
  try {
    const [results] = await sequelize.query('SELECT name FROM "SequelizeSeeds" ORDER BY name');
    return results.map(result => result.name);
  } catch (error) {
    return [];
  }
};

/**
 * Mark seeder as completed
 */
const markSeederCompleted = async (seederName) => {
  await sequelize.query('INSERT INTO "SequelizeSeeds" (name) VALUES (?)', {
    replacements: [seederName],
  });
};

/**
 * Remove seeder from completed list
 */
const removeSeederCompleted = async (seederName) => {
  await sequelize.query('DELETE FROM "SequelizeSeeds" WHERE name = ?', {
    replacements: [seederName],
  });
};

/**
 * Get list of seeder files
 */
const getSeederFiles = async () => {
  const seedersDir = path.join(__dirname, 'seeders');
  const files = await fs.readdir(seedersDir);
  return files
    .filter(file => file.endsWith('.js'))
    .sort();
};

/**
 * Run pending seeders
 */
const runSeeders = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Ensure seeders table exists
    await createSeedersTable();

    // Get completed seeders and available seeder files
    const [completedSeeders, seederFiles] = await Promise.all([
      getCompletedSeeders(),
      getSeederFiles(),
    ]);

    // Find pending seeders
    const pendingSeeders = seederFiles.filter(
      file => !completedSeeders.includes(file)
    );

    if (pendingSeeders.length === 0) {
      console.log('✅ No pending seeders found.');
      return;
    }

    console.log(`📋 Found ${pendingSeeders.length} pending seeders:`);
    pendingSeeders.forEach(seeder => {
      console.log(`   - ${seeder}`);
    });

    // Run each pending seeder
    for (const seederFile of pendingSeeders) {
      console.log(`🌱 Running seeder: ${seederFile}`);

      const seederPath = path.join(__dirname, 'seeders', seederFile);
      const seeder = require(seederPath);

      // Run the seeder
      await seeder.up(sequelize.getQueryInterface(), sequelize.constructor);

      // Mark as completed
      await markSeederCompleted(seederFile);

      console.log(`✅ Completed seeder: ${seederFile}`);
    }

    console.log('🎉 All seeders completed successfully!');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error.stack);
    throw error;
  }
};

/**
 * Rollback all seeders
 */
const rollbackSeeders = async () => {
  try {
    console.log('🔄 Rolling back all seeders...');

    // Ensure seeders table exists
    await createSeedersTable();

    // Get completed seeders
    const completedSeeders = await getCompletedSeeders();

    if (completedSeeders.length === 0) {
      console.log('📋 No seeders to rollback.');
      return;
    }

    // Rollback seeders in reverse order
    const reversedSeeders = [...completedSeeders].reverse();

    for (const seederFile of reversedSeeders) {
      console.log(`🔄 Rolling back seeder: ${seederFile}`);

      const seederPath = path.join(__dirname, 'seeders', seederFile);
      const seeder = require(seederPath);

      await seeder.down(sequelize.getQueryInterface(), sequelize.constructor);

      // Remove from completed seeders
      await removeSeederCompleted(seederFile);

      console.log(`✅ Rollback completed: ${seederFile}`);
    }

    console.log('🎉 All seeders rolled back successfully!');

  } catch (error) {
    console.error('❌ Seeder rollback failed:', error.message);
    console.error(error.stack);
    throw error;
  }
};

/**
 * Show seeder status
 */
const showSeederStatus = async () => {
  try {
    // Ensure seeders table exists
    await createSeedersTable();

    const [completedSeeders, seederFiles] = await Promise.all([
      getCompletedSeeders(),
      getSeederFiles(),
    ]);

    console.log('🌱 Seeder Status:');
    console.log('================');

    seederFiles.forEach(file => {
      const status = completedSeeders.includes(file) ? '✅ Completed' : '⏳ Pending';
      console.log(`${status} - ${file}`);
    });

    const pendingCount = seederFiles.length - completedSeeders.length;
    console.log('');
    console.log(`Total seeders: ${seederFiles.length}`);
    console.log(`Completed: ${completedSeeders.length}`);
    console.log(`Pending: ${pendingCount}`);

  } catch (error) {
    console.error('❌ Failed to show seeder status:', error.message);
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
        await runSeeders();
        break;
      case 'down':
        await rollbackSeeders();
        break;
      case 'status':
        await showSeederStatus();
        break;
      default:
        console.log('Usage: node seed.js [up|down|status]');
        console.log('  up     - Run pending seeders');
        console.log('  down   - Rollback all seeders');
        console.log('  status - Show seeder status');
        process.exit(1);
    }

  } catch (error) {
    console.error('❌ Seeder error:', error.message);
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
  runSeeders,
  rollbackSeeders,
  showSeederStatus,
};