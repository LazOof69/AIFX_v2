/**
 * User Model
 * Defines user accounts with authentication and trading preferences
 */

const { DataTypes, Op } = require('sequelize');
const bcrypt = require('bcrypt');
const { sequelize } = require('../config/database');

/**
 * User model with authentication and trading preferences
 */
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50],
      isAlphanumeric: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'password_hash',
    validate: {
      len: [8, 255],
    },
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_verified',
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login',
  },
}, {
  tableName: 'users',
  paranoid: false,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['email'],
    },
    {
      unique: true,
      fields: ['username'],
    },
  ],
  hooks: {
    /**
     * Hash password before creating user
     */
    beforeCreate: async (user) => {
      if (user.password) {
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        user.password = await bcrypt.hash(user.password, saltRounds);
      }
    },

    /**
     * Hash password before updating user if password changed
     */
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        user.password = await bcrypt.hash(user.password, saltRounds);
      }
    },
  },
});

/**
 * Instance method to check password
 *
 * @param {string} candidatePassword - Password to check
 * @returns {Promise<boolean>} Password match result
 */
User.prototype.checkPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Instance method to get user data without sensitive information
 *
 * @returns {object} Safe user data
 */
User.prototype.toSafeObject = function() {
  const { password, refreshToken, ...safeUser } = this.toJSON();
  return safeUser;
};

/**
 * Class method to find user by email or username
 *
 * @param {string} identifier - Email or username
 * @returns {Promise<User|null>} User instance or null
 */
User.findByIdentifier = async function(identifier) {
  return await this.findOne({
    where: {
      [Op.or]: [
        { email: identifier },
        { username: identifier },
      ],
    },
  });
};

/**
 * Instance method to update last login timestamp
 *
 * @returns {Promise<void>}
 */
User.prototype.updateLastLogin = async function() {
  this.lastLoginAt = new Date();
  await this.save();
};

/**
 * Instance method to update trading preferences
 *
 * @param {object} preferences - New trading preferences
 * @returns {Promise<void>}
 */
User.prototype.updateTradingPreferences = async function(preferences) {
  const allowedFields = [
    'tradingFrequency',
    'riskLevel',
    'preferredPairs',
    'tradingStyle',
    'indicators',
    'notificationSettings',
  ];

  for (const [key, value] of Object.entries(preferences)) {
    if (allowedFields.includes(key)) {
      this[key] = value;
    }
  }

  await this.save();
};

module.exports = User;