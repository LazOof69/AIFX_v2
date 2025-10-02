/**
 * Market Data Controller
 * Handles forex market data and technical indicators
 */

/**
 * Get current price for currency pair
 * @route GET /api/v1/market/price/:pair
 */
exports.getPrice = async (req, res) => {
  try {
    const { pair } = req.params;

    // Validate pair format
    const pairRegex = /^[A-Z]{3}\/[A-Z]{3}$/;
    if (!pairRegex.test(pair)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid currency pair format',
        timestamp: new Date().toISOString(),
      });
    }

    // Mock data for demonstration
    // In production, this would fetch from forex API or database
    const mockPrice = {
      pair,
      price: (1.0800 + Math.random() * 0.01).toFixed(5),
      bid: (1.0799 + Math.random() * 0.01).toFixed(5),
      ask: (1.0801 + Math.random() * 0.01).toFixed(5),
      spread: 0.0002,
      change: (Math.random() * 0.002 - 0.001).toFixed(5),
      changePercent: (Math.random() * 0.2 - 0.1).toFixed(3),
      timestamp: new Date().toISOString(),
    };

    res.status(200).json({
      success: true,
      data: mockPrice,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get price error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get historical data for currency pair
 * @route GET /api/v1/market/history/:pair
 */
exports.getHistory = async (req, res) => {
  try {
    const { pair } = req.params;
    const { timeframe = '1hour', limit = 100 } = req.query;

    // Validate pair
    const pairRegex = /^[A-Z]{3}\/[A-Z]{3}$/;
    if (!pairRegex.test(pair)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid currency pair format',
        timestamp: new Date().toISOString(),
      });
    }

    // Validate timeframe
    const validTimeframes = ['1min', '5min', '15min', '30min', '1hour', '4hour', 'daily', 'weekly'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid timeframe',
        timestamp: new Date().toISOString(),
      });
    }

    // Generate mock historical data
    const historicalData = [];
    const basePrice = 1.0850;
    const now = Date.now();
    const timeframeMs = timeframe === '1hour' ? 3600000 : 60000;

    for (let i = parseInt(limit) - 1; i >= 0; i--) {
      const timestamp = new Date(now - (i * timeframeMs));
      const open = basePrice + (Math.random() * 0.01 - 0.005);
      const close = open + (Math.random() * 0.01 - 0.005);
      const high = Math.max(open, close) + Math.random() * 0.005;
      const low = Math.min(open, close) - Math.random() * 0.005;

      historicalData.push({
        timestamp: timestamp.toISOString(),
        open: open.toFixed(5),
        high: high.toFixed(5),
        low: low.toFixed(5),
        close: close.toFixed(5),
        volume: Math.floor(Math.random() * 10000 + 1000),
      });
    }

    res.status(200).json({
      success: true,
      data: historicalData,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get market overview
 * @route GET /api/v1/market/overview
 */
exports.getOverview = async (req, res) => {
  try {
    const pairs = [
      'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF',
      'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/GBP',
    ];

    const overview = pairs.map(pair => {
      const price = (1.0800 + Math.random() * 0.2).toFixed(5);
      const change = (Math.random() * 0.004 - 0.002).toFixed(5);
      const changePercent = (parseFloat(change) / parseFloat(price) * 100).toFixed(3);

      return {
        pair,
        price: parseFloat(price),
        change: parseFloat(change),
        changePercent: parseFloat(changePercent),
        volume: Math.floor(Math.random() * 100000 + 10000),
        trend: parseFloat(change) > 0 ? 'up' : parseFloat(change) < 0 ? 'down' : 'neutral',
      };
    });

    res.status(200).json({
      success: true,
      data: overview,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get overview error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get technical indicators
 * @route GET /api/v1/market/indicators/:pair
 */
exports.getIndicators = async (req, res) => {
  try {
    const { pair } = req.params;
    const { indicators = 'sma,rsi,macd,bb' } = req.query;

    // Validate pair
    const pairRegex = /^[A-Z]{3}\/[A-Z]{3}$/;
    if (!pairRegex.test(pair)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid currency pair format',
        timestamp: new Date().toISOString(),
      });
    }

    const requestedIndicators = indicators.split(',');
    const indicatorData = { pair };

    // Generate mock indicator data
    requestedIndicators.forEach(indicator => {
      switch (indicator.trim()) {
        case 'sma':
          indicatorData.sma = (1.0800 + Math.random() * 0.01).toFixed(5);
          break;
        case 'rsi':
          indicatorData.rsi = (30 + Math.random() * 40).toFixed(2);
          break;
        case 'macd':
          indicatorData.macd = {
            value: (Math.random() * 0.002 - 0.001).toFixed(5),
            signal: (Math.random() * 0.002 - 0.001).toFixed(5),
            histogram: (Math.random() * 0.001).toFixed(5),
          };
          break;
        case 'bb':
          const middle = 1.0850;
          indicatorData.bb = {
            upper: (middle + 0.005).toFixed(5),
            middle: middle.toFixed(5),
            lower: (middle - 0.005).toFixed(5),
          };
          break;
      }
    });

    indicatorData.timestamp = new Date().toISOString();

    res.status(200).json({
      success: true,
      data: indicatorData,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get indicators error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};