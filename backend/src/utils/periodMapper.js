/**
 * Trading Period Mapper
 * Maps user-friendly trading periods to technical timeframes
 *
 * 將交易週期（日內、周內、月內、季內）映射到技術時間框架
 */

/**
 * Trading period to timeframe mapping
 * 交易週期到技術時間框架的映射
 */
const PERIOD_TIMEFRAME_MAP = {
  // 中文週期
  '日內': '15min',
  '周內': '1h',
  '月內': '1d',
  '季內': '1w',

  // 英文週期
  'intraday': '15min',
  'swing': '1h',
  'position': '1d',
  'longterm': '1w',

  // 別名支持
  'day': '15min',
  'week': '1h',
  'month': '1d',
  'quarter': '1w',
  'daily': '15min',
  'weekly': '1h',
  'monthly': '1d',
  'quarterly': '1w'
};

/**
 * Trading period detailed information
 * 交易週期詳細信息
 */
const PERIOD_INFO = {
  'intraday': {
    code: 'intraday',
    nameCn: '日內交易',
    nameEn: 'Day Trading',
    timeframe: '15min',
    holdingPeriod: '數分鐘到數小時',
    holdingPeriodEn: 'Minutes to Hours',
    tradingStyle: 'Intraday',
    riskLevel: 'high',
    riskLevelCn: '高',
    riskStars: 3,
    minCapital: 5000,
    minCapitalCurrency: 'USD',
    targetAudience: '專職交易者',
    targetAudienceEn: 'Full-time Traders',
    characteristics: [
      '高頻交易，需要緊盯盤面',
      '點差成本較高',
      '快速進出，當天平倉',
      '適合專職交易者'
    ],
    characteristicsEn: [
      'High-frequency trading',
      'Higher spread costs',
      'Quick in-and-out, close positions same day',
      'Suitable for full-time traders'
    ],
    emoji: '🔥',
    recommended: false
  },
  'swing': {
    code: 'swing',
    nameCn: '周內交易',
    nameEn: 'Swing Trading',
    timeframe: '1h',
    holdingPeriod: '2-10天',
    holdingPeriodEn: '2-10 Days',
    tradingStyle: 'Swing',
    riskLevel: 'medium',
    riskLevelCn: '中等',
    riskStars: 2,
    minCapital: 2000,
    minCapitalCurrency: 'USD',
    targetAudience: '上班族、兼職交易者',
    targetAudienceEn: 'Part-time Traders, Employees',
    characteristics: [
      '波段操作，捕捉短期趨勢',
      '隔夜持倉，需設止損',
      '適合上班族',
      '推薦新手首選'
    ],
    characteristicsEn: [
      'Swing trading, catch short-term trends',
      'Overnight positions with stop-loss',
      'Suitable for employees',
      'Recommended for beginners'
    ],
    emoji: '📈',
    recommended: true
  },
  'position': {
    code: 'position',
    nameCn: '月內交易',
    nameEn: 'Position Trading',
    timeframe: '1d',
    holdingPeriod: '數週到2個月',
    holdingPeriodEn: 'Weeks to 2 Months',
    tradingStyle: 'Position',
    riskLevel: 'medium-low',
    riskLevelCn: '中低',
    riskStars: 1,
    minCapital: 1000,
    minCapitalCurrency: 'USD',
    targetAudience: '耐心投資者',
    targetAudienceEn: 'Patient Investors',
    characteristics: [
      '趨勢跟隨，中期持倉',
      '基本面分析重要性增加',
      '容忍短期回撤',
      '適合耐心投資者'
    ],
    characteristicsEn: [
      'Trend following, medium-term positions',
      'Fundamental analysis more important',
      'Tolerate short-term drawdowns',
      'Suitable for patient investors'
    ],
    emoji: '📊',
    recommended: false
  },
  'longterm': {
    code: 'longterm',
    nameCn: '季內交易',
    nameEn: 'Long-term Trading',
    timeframe: '1w',
    holdingPeriod: '數月到1年',
    holdingPeriodEn: 'Months to 1 Year',
    tradingStyle: 'Long-term',
    riskLevel: 'low',
    riskLevelCn: '低',
    riskStars: 1,
    minCapital: 500,
    minCapitalCurrency: 'USD',
    targetAudience: '長期配置投資者',
    targetAudienceEn: 'Long-term Investors',
    characteristics: [
      '戰略配置，長期持有',
      '宏觀經濟視角',
      '經濟週期影響',
      '資金利用率低但穩定'
    ],
    characteristicsEn: [
      'Strategic allocation, long-term holding',
      'Macro-economic perspective',
      'Economic cycle impact',
      'Lower capital utilization but stable'
    ],
    emoji: '🎯',
    recommended: false
  }
};

/**
 * Supported timeframes for each period
 * 每個交易週期支持的時間框架
 */
const PERIOD_SUPPORTED_TIMEFRAMES = {
  'intraday': ['1min', '5min', '15min', '30min'],
  'swing': ['1h', '4h'],
  'position': ['1d'],
  'longterm': ['1w', '1M']
};

/**
 * Map trading period to timeframe
 *
 * @param {string} period - Trading period (e.g., '周內', 'swing')
 * @returns {string} - Technical timeframe (e.g., '1h')
 */
function mapPeriodToTimeframe(period) {
  if (!period) {
    return '1h'; // Default to swing trading
  }

  const normalizedPeriod = period.toLowerCase().trim();
  const timeframe = PERIOD_TIMEFRAME_MAP[normalizedPeriod] || PERIOD_TIMEFRAME_MAP[period];

  if (!timeframe) {
    console.warn(`Unknown trading period: ${period}, defaulting to 1h (swing trading)`);
    return '1h';
  }

  return timeframe;
}

/**
 * Get detailed information about a trading period
 *
 * @param {string} period - Trading period code (e.g., 'swing', 'intraday')
 * @returns {Object|null} - Period information or null if not found
 */
function getPeriodInfo(period) {
  if (!period) {
    return PERIOD_INFO['swing']; // Default to swing trading
  }

  const normalizedPeriod = period.toLowerCase().trim();

  // Try to find by code
  if (PERIOD_INFO[normalizedPeriod]) {
    return PERIOD_INFO[normalizedPeriod];
  }

  // Try to map period to code first
  const timeframe = mapPeriodToTimeframe(period);

  // Find period info by timeframe
  for (const [code, info] of Object.entries(PERIOD_INFO)) {
    if (info.timeframe === timeframe) {
      return info;
    }
  }

  return null;
}

/**
 * Normalize period input to standard code
 * 將輸入規範化為標準代碼
 *
 * @param {string} period - Any period input
 * @returns {string} - Normalized period code (intraday, swing, position, longterm)
 */
function normalizePeriod(period) {
  if (!period) {
    return 'swing'; // Default
  }

  const normalizedInput = period.toLowerCase().trim();

  // Map to standard codes
  const periodMapping = {
    '日內': 'intraday',
    'intraday': 'intraday',
    'day': 'intraday',
    'daily': 'intraday',

    '周內': 'swing',
    'swing': 'swing',
    'week': 'swing',
    'weekly': 'swing',

    '月內': 'position',
    'position': 'position',
    'month': 'position',
    'monthly': 'position',

    '季內': 'longterm',
    'longterm': 'longterm',
    'quarter': 'longterm',
    'quarterly': 'longterm'
  };

  return periodMapping[normalizedInput] || periodMapping[period] || 'swing';
}

/**
 * Get all supported periods
 *
 * @returns {Array} - Array of period info objects
 */
function getAllPeriods() {
  return Object.values(PERIOD_INFO);
}

/**
 * Get recommended period for beginners
 *
 * @returns {Object} - Recommended period info
 */
function getRecommendedPeriod() {
  return PERIOD_INFO['swing'];
}

/**
 * Validate if a timeframe is supported for a given period
 *
 * @param {string} period - Trading period code
 * @param {string} timeframe - Timeframe to validate
 * @returns {boolean} - True if supported
 */
function isTimeframeSupported(period, timeframe) {
  const normalizedPeriod = normalizePeriod(period);
  const supportedTimeframes = PERIOD_SUPPORTED_TIMEFRAMES[normalizedPeriod];

  if (!supportedTimeframes) {
    return false;
  }

  return supportedTimeframes.includes(timeframe);
}

/**
 * Get risk level emoji
 *
 * @param {number} stars - Risk stars (1-3)
 * @returns {string} - Risk emoji string
 */
function getRiskEmoji(stars) {
  return '⚠️'.repeat(stars);
}

module.exports = {
  mapPeriodToTimeframe,
  getPeriodInfo,
  normalizePeriod,
  getAllPeriods,
  getRecommendedPeriod,
  isTimeframeSupported,
  getRiskEmoji,
  PERIOD_TIMEFRAME_MAP,
  PERIOD_INFO,
  PERIOD_SUPPORTED_TIMEFRAMES
};
