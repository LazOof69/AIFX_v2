/**
 * Discord User Mapping Service
 *
 * Handles mapping between Discord users and backend users.
 * Automatically creates backend accounts for new Discord users.
 */

const logger = require('../utils/logger');
const { sequelize } = require('../../backend/src/config/database');
const User = require('../../backend/src/models/User');
const UserDiscordSettings = require('../../backend/src/models/UserDiscordSettings');
const UserPreferences = require('../../backend/src/models/UserPreferences');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

class UserMappingService {
  /**
   * Get backend user ID from Discord user ID
   * Creates new user if not exists
   *
   * @param {string} discordId - Discord user ID (snowflake)
   * @param {string} discordUsername - Discord username#discriminator
   * @returns {Promise<{userId: string, isNewUser: boolean}>}
   */
  async getOrCreateUser(discordId, discordUsername) {
    try {
      // Try to find existing mapping
      const discordSettings = await UserDiscordSettings.findOne({
        where: { discordUserId: discordId }
      });

      if (discordSettings) {
        logger.info(`Found existing user mapping: Discord ${discordId} -> User ${discordSettings.userId}`);
        return {
          userId: discordSettings.userId,
          isNewUser: false
        };
      }

      // No mapping found - create new user
      logger.info(`Creating new user for Discord: ${discordUsername} (${discordId})`);

      const transaction = await sequelize.transaction();

      try {
        // Generate username from Discord username
        const baseUsername = this._sanitizeUsername(discordUsername);
        const username = await this._generateUniqueUsername(baseUsername);

        // Generate email (Discord users don't need real email for bot-only access)
        const email = `${discordId}@discord.bot`;

        // Generate random password (user won't use it, only for Discord access)
        const randomPassword = uuidv4();
        const passwordHash = await bcrypt.hash(randomPassword, 10);

        // Create user
        const user = await User.create({
          id: uuidv4(),
          username,
          email,
          password: passwordHash,  // Model field is 'password' (maps to password_hash in DB)
          isActive: true,
          isVerified: true
        }, { transaction });

        logger.info(`✅ Created user: ${username} (${user.id})`);

        // Create Discord settings
        await UserDiscordSettings.create({
          userId: user.id,
          discordUserId: discordId,
          discordUsername: discordUsername,
          notificationsEnabled: true,
          enabledTimeframes: ['1h', '4h'],
          preferredPairs: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
          minConfidence: 0.6,
          onlyMlEnhanced: true,
          maxNotificationsPerDay: 20,
          notificationCooldownMinutes: 240
        }, { transaction });

        logger.info(`✅ Created Discord settings for ${discordUsername}`);

        // Create default user preferences
        await UserPreferences.create({
          userId: user.id,
          tradingFrequency: 'swing',
          riskLevel: 5,
          preferredPairs: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
          tradingStyle: 'trend',
          indicators: {
            sma: { enabled: true, period: 20 },
            ema: { enabled: true, period: 12 },
            rsi: { enabled: true, period: 14 },
            macd: { enabled: true },
            bollinger: { enabled: true },
            atr: { enabled: true }
          },
          notificationSettings: {
            emailEnabled: false,
            discordEnabled: true,
            signalAlerts: true,
            priceAlerts: true,
            positionAlerts: true,
            systemAlerts: true
          }
        }, { transaction });

        logger.info(`✅ Created default preferences for ${username}`);

        await transaction.commit();

        logger.info(`🎉 Successfully created complete user profile for Discord user ${discordUsername}`);

        return {
          userId: user.id,
          isNewUser: true
        };

      } catch (error) {
        await transaction.rollback();
        throw error;
      }

    } catch (error) {
      logger.error('Error in getOrCreateUser:', error);
      throw new Error(`Failed to get or create user: ${error.message}`);
    }
  }

  /**
   * Get user ID from Discord ID (no auto-creation)
   *
   * @param {string} discordId
   * @returns {Promise<string|null>}
   */
  async getUserIdByDiscordId(discordId) {
    try {
      const discordSettings = await UserDiscordSettings.findOne({
        where: { discordUserId: discordId },
        attributes: ['userId']
      });

      return discordSettings ? discordSettings.userId : null;
    } catch (error) {
      logger.error('Error getting user ID:', error);
      return null;
    }
  }

  /**
   * Link existing backend user to Discord account
   *
   * @param {string} userId - Backend user ID
   * @param {string} discordId - Discord user ID
   * @param {string} discordUsername - Discord username
   * @returns {Promise<boolean>}
   */
  async linkDiscordUser(userId, discordId, discordUsername) {
    try {
      // Check if user exists
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if Discord ID already linked
      const existing = await UserDiscordSettings.findOne({
        where: { discordUserId: discordId }
      });

      if (existing) {
        throw new Error('Discord account already linked to another user');
      }

      // Create or update Discord settings
      await UserDiscordSettings.upsert({
        userId,
        discordUserId: discordId,
        discordUsername,
        notificationsEnabled: true
      });

      logger.info(`✅ Linked Discord ${discordUsername} to user ${userId}`);
      return true;

    } catch (error) {
      logger.error('Error linking Discord user:', error);
      throw error;
    }
  }

  /**
   * Get Discord info from user ID
   *
   * @param {string} userId
   * @returns {Promise<{discordId: string, discordUsername: string}|null>}
   */
  async getDiscordInfoByUserId(userId) {
    try {
      const discordSettings = await UserDiscordSettings.findOne({
        where: { userId },
        attributes: ['discordUserId', 'discordUsername']
      });

      if (!discordSettings) {
        return null;
      }

      return {
        discordId: discordSettings.discordUserId,
        discordUsername: discordSettings.discordUsername
      };
    } catch (error) {
      logger.error('Error getting Discord info:', error);
      return null;
    }
  }

  /**
   * Sanitize Discord username for use as backend username
   * @private
   */
  _sanitizeUsername(discordUsername) {
    // Remove Discord discriminator (#1234)
    let username = discordUsername.split('#')[0];

    // Remove invalid characters, keep alphanumeric and underscore
    username = username.replace(/[^a-zA-Z0-9_]/g, '_');

    // Ensure starts with letter
    if (!/^[a-zA-Z]/.test(username)) {
      username = 'user_' + username;
    }

    // Truncate to 50 chars
    username = username.substring(0, 50);

    // Convert to lowercase
    return username.toLowerCase();
  }

  /**
   * Generate unique username by appending numbers if needed
   * @private
   */
  async _generateUniqueUsername(baseUsername) {
    let username = baseUsername;
    let suffix = 1;

    while (await User.findOne({ where: { username } })) {
      username = `${baseUsername}_${suffix}`;
      suffix++;

      // Safety limit
      if (suffix > 1000) {
        username = `${baseUsername}_${Date.now()}`;
        break;
      }
    }

    return username;
  }
}

module.exports = new UserMappingService();
