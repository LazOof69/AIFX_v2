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

// Export all models and sequelize instance
module.exports = {
  sequelize,
  User,
  MarketData,
  TradingSignal,
  UserPreferences,
  UserTradingHistory,
  PositionMonitoring,
};