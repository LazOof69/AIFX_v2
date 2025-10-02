'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get user IDs from users table
    const users = await queryInterface.sequelize.query(
      'SELECT id FROM users;',
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (users.length === 0) {
      console.log('No users found. Please run user seeder first.');
      return;
    }

    const notificationTypes = ['signal', 'alert', 'system', 'news'];
    const priorities = ['low', 'medium', 'high', 'urgent'];

    const notifications = [];

    // Generate notifications for each user
    users.forEach((user) => {
      // 5 notifications per user
      for (let i = 0; i < 5; i++) {
        const type = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];
        const isRead = Math.random() > 0.5;
        const createdAt = new Date(Date.now() - (i * 1800000)); // 30 minutes apart

        let title, message, data;

        switch (type) {
          case 'signal':
            title = 'New Trading Signal';
            message = `${['EUR/USD', 'GBP/USD', 'USD/JPY'][Math.floor(Math.random() * 3)]}: ${['BUY', 'SELL'][Math.floor(Math.random() * 2)]} signal detected with ${(60 + Math.random() * 35).toFixed(0)}% confidence`;
            data = {
              pair: ['EUR/USD', 'GBP/USD', 'USD/JPY'][Math.floor(Math.random() * 3)],
              action: ['buy', 'sell'][Math.floor(Math.random() * 2)],
              confidence: (0.6 + Math.random() * 0.35).toFixed(2),
            };
            break;
          case 'alert':
            title = 'Price Alert';
            message = `EUR/USD has reached your target price of ${(1.08 + Math.random() * 0.02).toFixed(5)}`;
            data = {
              pair: 'EUR/USD',
              price: (1.08 + Math.random() * 0.02).toFixed(5),
            };
            break;
          case 'system':
            title = 'System Update';
            message = 'New features have been added to your trading dashboard';
            data = {
              version: '2.1.0',
              features: ['Enhanced charting', 'Improved notifications'],
            };
            break;
          case 'news':
            title = 'Market News';
            message = 'Federal Reserve announces interest rate decision';
            data = {
              category: 'economic',
              impact: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
            };
            break;
        }

        notifications.push({
          id: uuidv4(),
          user_id: user.id,
          type,
          title,
          message,
          data: JSON.stringify(data),
          is_read: isRead,
          priority,
          channels: ['browser', 'email'],
          sent_at: createdAt,
          read_at: isRead ? new Date(createdAt.getTime() + 600000) : null,
          created_at: createdAt,
          updated_at: createdAt,
        });
      }
    });

    await queryInterface.bulkInsert('notifications', notifications, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('notifications', null, {});
  }
};