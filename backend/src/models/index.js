/**
 * Models Index
 * Centralizes model imports and establishes relationships
 */

const { sequelize } = require('../config/database');
const User = require('./User');
const MarketData = require('./MarketData');
const TradingSignal = require('./TradingSignal');

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

// Export all models and sequelize instance
module.exports = {
  sequelize,
  User,
  MarketData,
  TradingSignal,
};