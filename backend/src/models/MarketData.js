/**
 * MarketData Model
 * Stores cached forex market data for efficient retrieval
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * MarketData model for caching forex data
 */
const MarketData = sequelize.define('MarketData', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  pair: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      is: /^[A-Z]{3}\/[A-Z]{3}$/,
    },
  },
  timeframe: {
    type: DataTypes.ENUM('1min', '5min', '15min', '30min', '1h', '4h', '1d', '1w', '1M'),
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  open: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  high: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  low: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  close: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  volume: {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: 0,
  },
  // Technical Indicators Cache
  technicalIndicators: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    validate: {
      isValidIndicators(value) {
        if (value !== null && typeof value !== 'object') {
          throw new Error('Technical indicators must be an object');
        }
      },
    },
  },
  // Data source information
  source: {
    type: DataTypes.ENUM('alpha_vantage', 'twelve_data', 'manual', 'calculated'),
    allowNull: false,
    defaultValue: 'alpha_vantage',
  },
  // Cache metadata
  cacheExpiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: () => {
      // Default cache expiry: 1 minute for real-time data
      return new Date(Date.now() + 60 * 1000);
    },
  },
  isRealTime: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  // Market state information
  marketState: {
    type: DataTypes.ENUM('open', 'closed', 'pre_market', 'after_hours'),
    allowNull: true,
  },
  spread: {
    type: DataTypes.DECIMAL(8, 5),
    allowNull: true,
  },
  // Data quality metrics
  dataQuality: {
    type: DataTypes.JSON,
    defaultValue: {
      completeness: 1.0,
      accuracy: 1.0,
      timeliness: 1.0,
      consistency: 1.0,
    },
    allowNull: false,
  },
}, {
  tableName: 'market_data',
  indexes: [
    {
      unique: true,
      fields: ['pair', 'timeframe', 'timestamp'],
      name: 'unique_market_data_entry',
    },
    {
      fields: ['pair', 'timeframe'],
      name: 'pair_timeframe_index',
    },
    {
      fields: ['timestamp'],
      name: 'timestamp_index',
    },
    {
      fields: ['cacheExpiresAt'],
      name: 'cache_expiry_index',
    },
    {
      fields: ['isRealTime'],
      name: 'realtime_index',
    },
    {
      fields: ['source'],
      name: 'source_index',
    },
  ],
  validate: {
    /**
     * Validate OHLC data consistency
     */
    validateOHLC() {
      if (this.high < this.low) {
        throw new Error('High price cannot be less than low price');
      }
      if (this.open > this.high || this.open < this.low) {
        throw new Error('Open price must be between high and low prices');
      }
      if (this.close > this.high || this.close < this.low) {
        throw new Error('Close price must be between high and low prices');
      }
    },
  },
});

/**
 * Class method to find latest data for a pair and timeframe
 *
 * @param {string} pair - Currency pair (e.g., 'EUR/USD')
 * @param {string} timeframe - Timeframe (e.g., '1h')
 * @param {number} limit - Maximum number of records to return
 * @returns {Promise<MarketData[]>} Array of market data
 */
MarketData.findLatest = async function(pair, timeframe, limit = 100) {
  return await this.findAll({
    where: {
      pair,
      timeframe,
    },
    order: [['timestamp', 'DESC']],
    limit,
  });
};

/**
 * Class method to find data within a time range
 *
 * @param {string} pair - Currency pair
 * @param {string} timeframe - Timeframe
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<MarketData[]>} Array of market data
 */
MarketData.findByDateRange = async function(pair, timeframe, startDate, endDate) {
  return await this.findAll({
    where: {
      pair,
      timeframe,
      timestamp: {
        [sequelize.Op.between]: [startDate, endDate],
      },
    },
    order: [['timestamp', 'ASC']],
  });
};

/**
 * Class method to clean expired cache entries
 *
 * @returns {Promise<number>} Number of deleted records
 */
MarketData.cleanExpiredCache = async function() {
  const result = await this.destroy({
    where: {
      cacheExpiresAt: {
        [sequelize.Op.lt]: new Date(),
      },
    },
  });
  return result;
};

/**
 * Class method to get current market data
 *
 * @param {string} pair - Currency pair
 * @param {string} timeframe - Timeframe
 * @returns {Promise<MarketData|null>} Current market data or null
 */
MarketData.getCurrent = async function(pair, timeframe) {
  return await this.findOne({
    where: {
      pair,
      timeframe,
      cacheExpiresAt: {
        [sequelize.Op.gt]: new Date(),
      },
    },
    order: [['timestamp', 'DESC']],
  });
};

/**
 * Instance method to check if data is expired
 *
 * @returns {boolean} True if data is expired
 */
MarketData.prototype.isExpired = function() {
  return new Date() > this.cacheExpiresAt;
};

/**
 * Instance method to update cache expiry based on timeframe
 *
 * @returns {void}
 */
MarketData.prototype.updateCacheExpiry = function() {
  const now = new Date();
  let expiryMinutes;

  switch (this.timeframe) {
    case '1min':
      expiryMinutes = 1;
      break;
    case '5min':
      expiryMinutes = 5;
      break;
    case '15min':
      expiryMinutes = 15;
      break;
    case '30min':
      expiryMinutes = 30;
      break;
    case '1h':
      expiryMinutes = 60;
      break;
    case '4h':
      expiryMinutes = 240;
      break;
    case '1d':
      expiryMinutes = 1440; // 24 hours
      break;
    case '1w':
      expiryMinutes = 10080; // 7 days
      break;
    case '1M':
      expiryMinutes = 43200; // 30 days
      break;
    default:
      expiryMinutes = 60;
  }

  this.cacheExpiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);
};

/**
 * Instance method to calculate basic statistics
 *
 * @returns {object} Basic market statistics
 */
MarketData.prototype.getStatistics = function() {
  const priceChange = this.close - this.open;
  const priceChangePercent = (priceChange / this.open) * 100;
  const range = this.high - this.low;
  const rangePercent = (range / this.open) * 100;

  return {
    priceChange: parseFloat(priceChange.toFixed(5)),
    priceChangePercent: parseFloat(priceChangePercent.toFixed(2)),
    range: parseFloat(range.toFixed(5)),
    rangePercent: parseFloat(rangePercent.toFixed(2)),
    volume: parseInt(this.volume),
  };
};

/**
 * Class method to get market statistics for multiple pairs
 *
 * @param {string[]} pairs - Array of currency pairs
 * @param {string} timeframe - Timeframe
 * @returns {Promise<object>} Market statistics by pair
 */
MarketData.getMarketOverview = async function(pairs, timeframe = '1d') {
  const data = await Promise.all(
    pairs.map(async (pair) => {
      const latest = await this.getCurrent(pair, timeframe);
      return {
        pair,
        data: latest ? latest.getStatistics() : null,
        timestamp: latest ? latest.timestamp : null,
      };
    })
  );

  return data.reduce((acc, item) => {
    acc[item.pair] = {
      statistics: item.data,
      timestamp: item.timestamp,
    };
    return acc;
  }, {});
};

module.exports = MarketData;