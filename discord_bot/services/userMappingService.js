/**
 * Discord User Mapping Service
 *
 * Handles mapping between Discord users and backend users.
 * Automatically creates backend accounts for new Discord users.
 *
 * REFACTORED FOR MICROSERVICES ARCHITECTURE (Phase 4):
 * - Uses Backend API Client instead of direct database access
 * - Follows CLAUDE.md principles: API-only communication
 * - No direct Sequelize/database dependencies
 */

const logger = require('../utils/logger');
const backendApiClient = require('./backendApiClient');

class UserMappingService {
  /**
   * Get backend user ID from Discord user ID
   * Creates new user if not exists
   *
   * @param {string} discordId - Discord user ID (snowflake)
   * @param {string} discordUsername - Discord username
   * @returns {Promise<{userId: string, isNewUser: boolean, user: Object}>}
   */
  async getOrCreateUser(discordId, discordUsername) {
    try {
      logger.info(`Looking up user mapping for Discord: ${discordUsername} (${discordId})`);

      // Try to get existing user via Backend API
      let user = await backendApiClient.getUserByDiscordId(discordId);

      if (user) {
        logger.info(`Found existing user mapping: Discord ${discordId} -> User ${user.user.id}`);
        return {
          userId: user.user.id,
          isNewUser: false,
          user: user,
        };
      }

      // No mapping found - create new user via Backend API
      logger.info(`Creating new user for Discord: ${discordUsername} (${discordId})`);

      user = await backendApiClient.createOrUpdateUser({
        discordId,
        discordUsername,
        // Backend will auto-generate username and email
      });

      logger.info(`Created new user: Discord ${discordId} -> User ${user.user.id}`);

      return {
        userId: user.user.id,
        isNewUser: true,
        user: user,
      };
    } catch (error) {
      logger.error('Error in getOrCreateUser:', {
        discordId,
        discordUsername,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to get/create user for Discord ID ${discordId}: ${error.message}`);
    }
  }

  /**
   * Get user ID from Discord ID
   * Returns null if user doesn't exist (doesn't create)
   *
   * @param {string} discordId - Discord user ID
   * @returns {Promise<string|null>} User ID or null
   */
  async getUserId(discordId) {
    try {
      const user = await backendApiClient.getUserByDiscordId(discordId);
      return user ? user.user.id : null;
    } catch (error) {
      logger.error(`Error getting user ID for Discord ${discordId}:`, error.message);
      return null;
    }
  }

  /**
   * Get full user data from Discord ID
   *
   * @param {string} discordId - Discord user ID
   * @returns {Promise<Object|null>} Full user data or null
   */
  async getUserData(discordId) {
    try {
      return await backendApiClient.getUserByDiscordId(discordId);
    } catch (error) {
      logger.error(`Error getting user data for Discord ${discordId}:`, error.message);
      return null;
    }
  }

  /**
   * Update user's Discord settings
   *
   * @param {string} discordId - Discord user ID
   * @param {Object} settings - Settings to update
   * @returns {Promise<Object>} Updated settings
   */
  async updateSettings(discordId, settings) {
    try {
      logger.info(`Updating Discord settings for ${discordId}:`, settings);
      return await backendApiClient.updateDiscordSettings(discordId, settings);
    } catch (error) {
      logger.error(`Error updating settings for Discord ${discordId}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if user exists
   *
   * @param {string} discordId - Discord user ID
   * @returns {Promise<boolean>} True if user exists
   */
  async userExists(discordId) {
    try {
      const user = await backendApiClient.getUserByDiscordId(discordId);
      return user !== null;
    } catch (error) {
      logger.error(`Error checking if user exists (Discord ${discordId}):`, error.message);
      return false;
    }
  }

  /**
   * Get user's notification preferences
   *
   * @param {string} discordId - Discord user ID
   * @returns {Promise<Object|null>} Preferences or null
   */
  async getPreferences(discordId) {
    try {
      const userData = await backendApiClient.getUserByDiscordId(discordId);
      return userData?.preferences || null;
    } catch (error) {
      logger.error(`Error getting preferences for Discord ${discordId}:`, error.message);
      return null;
    }
  }

  /**
   * Enable notifications for user
   *
   * @param {string} discordId - Discord user ID
   * @param {string} pair - Currency pair to subscribe to
   * @returns {Promise<Object>} Updated settings
   */
  async enableNotifications(discordId, pair) {
    try {
      return await backendApiClient.subscribeToSignals(discordId, pair, {
        notificationsEnabled: true,
      });
    } catch (error) {
      logger.error(`Error enabling notifications for Discord ${discordId}:`, error.message);
      throw error;
    }
  }

  /**
   * Disable notifications for user
   *
   * @param {string} discordId - Discord user ID
   * @returns {Promise<Object>} Updated settings
   */
  async disableNotifications(discordId) {
    try {
      return await backendApiClient.unsubscribeFromSignals(discordId);
    } catch (error) {
      logger.error(`Error disabling notifications for Discord ${discordId}:`, error.message);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new UserMappingService();
