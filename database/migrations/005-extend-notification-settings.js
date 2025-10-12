/**
 * Migration: Extend Notification Settings
 * Extends user_preferences.notification_settings JSONB field with Phase 3 monitoring features
 * Adds: 4-level urgency system, cooldown periods, mute hours, trailing stop settings
 */

'use strict';

module.exports = {
  /**
   * Apply the migration
   *
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize')} Sequelize
   * @returns {Promise<void>}
   */
  up: async (queryInterface, Sequelize) => {
    // Updated default notification settings with Phase 3 features
    const newDefaultSettings = {
      // Phase 1 settings (existing)
      email: true,
      browser: true,
      discord: false,
      signalTypes: {
        buy: true,
        sell: true,
        hold: false,
      },
      minConfidence: 70,

      // Phase 3 settings (new)
      urgencyThreshold: 2, // 1=urgent, 2=important, 3=general, 4=daily summary
      level2Cooldown: 5, // minutes
      level3Cooldown: 30, // minutes
      dailySummaryTime: '22:00', // HH:MM format
      muteHours: ['00:00-07:00'], // Array of time ranges
      trailingStopEnabled: true,
      autoAdjustSl: false, // Auto-adjust stop loss when recommendation is made
      partialExitEnabled: true, // Allow partial position exits
    };

    // 1. Change default value for new user_preferences records
    await queryInterface.changeColumn('user_preferences', 'notification_settings', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: newDefaultSettings,
    });

    // 2. Update existing records to add Phase 3 fields (preserve existing values)
    await queryInterface.sequelize.query(`
      UPDATE user_preferences
      SET notification_settings = notification_settings ||
        '{
          "urgencyThreshold": 2,
          "level2Cooldown": 5,
          "level3Cooldown": 30,
          "dailySummaryTime": "22:00",
          "muteHours": ["00:00-07:00"],
          "trailingStopEnabled": true,
          "autoAdjustSl": false,
          "partialExitEnabled": true
        }'::jsonb
      WHERE NOT (notification_settings ? 'urgencyThreshold');
    `);

    console.log('✅ Extended notification_settings with Phase 3 features');
  },

  /**
   * Revert the migration
   *
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize')} Sequelize
   * @returns {Promise<void>}
   */
  down: async (queryInterface, Sequelize) => {
    // Original Phase 1 default settings
    const originalDefaultSettings = {
      email: true,
      browser: true,
      discord: false,
      signalTypes: {
        buy: true,
        sell: true,
        hold: false,
      },
      minConfidence: 70,
    };

    // 1. Revert default value
    await queryInterface.changeColumn('user_preferences', 'notification_settings', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: originalDefaultSettings,
    });

    // 2. Remove Phase 3 fields from existing records
    await queryInterface.sequelize.query(`
      UPDATE user_preferences
      SET notification_settings = notification_settings -
        'urgencyThreshold' - 'level2Cooldown' - 'level3Cooldown' -
        'dailySummaryTime' - 'muteHours' - 'trailingStopEnabled' -
        'autoAdjustSl' - 'partialExitEnabled';
    `);

    console.log('✅ Reverted notification_settings to Phase 1 structure');
  },
};
