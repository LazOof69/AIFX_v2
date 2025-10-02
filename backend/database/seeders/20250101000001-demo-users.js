'use strict';

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const userId1 = uuidv4();
    const userId2 = uuidv4();
    const userId3 = uuidv4();

    // Hash passwords
    const hashedPassword1 = await bcrypt.hash('password123', 10);
    const hashedPassword2 = await bcrypt.hash('trader2023', 10);
    const hashedPassword3 = await bcrypt.hash('demo1234', 10);

    await queryInterface.bulkInsert('users', [
      {
        id: userId1,
        username: 'john_trader',
        email: 'john@example.com',
        password_hash: hashedPassword1,
        is_active: true,
        last_login: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: userId2,
        username: 'sarah_fx',
        email: 'sarah@example.com',
        password_hash: hashedPassword2,
        is_active: true,
        last_login: new Date(Date.now() - 86400000), // 1 day ago
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: userId3,
        username: 'demo_user',
        email: 'demo@example.com',
        password_hash: hashedPassword3,
        is_active: true,
        last_login: new Date(Date.now() - 172800000), // 2 days ago
        created_at: new Date(),
        updated_at: new Date(),
      },
    ], {});

    // Store user IDs for other seeders
    return { userId1, userId2, userId3 };
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', null, {});
  }
};