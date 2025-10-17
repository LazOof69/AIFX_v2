/**
 * Models Index
 * Centralizes model imports and establishes relationships
 */

const { sequelize } = require('../config/database');
const User = require('./User');
const MarketData = require('./MarketData');
const TradingSignal = require('./TradingSignal');
const UserPreferences = require('./UserPreferences');
const UserTradingHistory = require('./UserTradingHistory');
const PositionMonitoring = require('./PositionMonitoring');

// Discord automation models (imported from discord_bot folder)
const UserDiscordSettings = require('../../../discord_bot/models/UserDiscordSettings')(sequelize);
const SignalNotification = require('../../../discord_bot/models/SignalNotification')(sequelize);
const UserTrade = require('../../../discord_bot/models/UserTrade')(sequelize);
const TradeUpdate = require('../../../discord_bot/models/TradeUpdate')(sequelize);

// Establish model relationships

/**
 * User -> TradingSignal (One-to-Many)
 * A user can have many trading signals
 */
User.hasMany(TradingSignal, {
  foreignKey: 'userId',
  as: 'tradingSignals',
  onDelete: 'SET NULL', // Keep signals when user is deleted for historical data
});

TradingSignal.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

/**
 * User -> UserPreferences (One-to-One)
 * A user has one preferences record
 */
User.hasOne(UserPreferences, {
  foreignKey: 'userId',
  as: 'preferences',
  onDelete: 'CASCADE',
});

UserPreferences.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

/**
 * User -> UserTradingHistory (One-to-Many)
 * A user can have many trading positions
 */
User.hasMany(UserTradingHistory, {
  foreignKey: 'userId',
  as: 'tradingHistory',
  onDelete: 'CASCADE',
});

UserTradingHistory.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

/**
 * TradingSignal -> UserTradingHistory (One-to-Many)
 * A signal can be used for multiple positions
 */
TradingSignal.hasMany(UserTradingHistory, {
  foreignKey: 'signalId',
  as: 'positions',
  onDelete: 'CASCADE',
});

UserTradingHistory.belongsTo(TradingSignal, {
  foreignKey: 'signalId',
  as: 'signal',
});

/**
 * UserTradingHistory -> PositionMonitoring (One-to-Many)
 * A position has many monitoring records
 */
UserTradingHistory.hasMany(PositionMonitoring, {
  foreignKey: 'positionId',
  as: 'monitoringRecords',
  onDelete: 'CASCADE',
});

PositionMonitoring.belongsTo(UserTradingHistory, {
  foreignKey: 'positionId',
  as: 'position',
});

/**
 * Discord Automation Relationships
 */

// User -> UserDiscordSettings (One-to-One)
User.hasOne(UserDiscordSettings, {
  foreignKey: 'userId',
  as: 'discordSettings',
  onDelete: 'CASCADE',
});

UserDiscordSettings.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// User -> SignalNotification (One-to-Many)
User.hasMany(SignalNotification, {
  foreignKey: 'userId',
  as: 'signalNotifications',
  onDelete: 'CASCADE',
});

SignalNotification.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// User -> UserTrade (One-to-Many)
User.hasMany(UserTrade, {
  foreignKey: 'userId',
  as: 'trades',
  onDelete: 'CASCADE',
});

UserTrade.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// SignalNotification -> UserTrade (One-to-One)
SignalNotification.hasOne(UserTrade, {
  foreignKey: 'signalNotificationId',
  as: 'trade',
  onDelete: 'SET NULL',
});

UserTrade.belongsTo(SignalNotification, {
  foreignKey: 'signalNotificationId',
  as: 'signal',
});

// UserTrade -> TradeUpdate (One-to-Many)
UserTrade.hasMany(TradeUpdate, {
  foreignKey: 'tradeId',
  as: 'updates',
  onDelete: 'CASCADE',
});

TradeUpdate.belongsTo(UserTrade, {
  foreignKey: 'tradeId',
  as: 'trade',
});

// Export all models and sequelize instance
module.exports = {
  sequelize,
  User,
  MarketData,
  TradingSignal,
  UserPreferences,
  UserTradingHistory,
  PositionMonitoring,
  // Discord automation models
  UserDiscordSettings,
  SignalNotification,
  UserTrade,
  TradeUpdate,
};