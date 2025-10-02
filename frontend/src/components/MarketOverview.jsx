import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { marketAPI } from '../services/api';
import { subscribeToMarketUpdates } from '../services/socket';

/**
 * MarketOverview component showing all currency pairs
 */
const MarketOverview = () => {
  const navigate = useNavigate();
  const [marketData, setMarketData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('change');

  const majorPairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'];
  const crossPairs = ['EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY', 'EUR/AUD'];

  useEffect(() => {
    loadMarketData();

    // Subscribe to market updates
    const unsubscribe = subscribeToMarketUpdates((update) => {
      setMarketData((prev) =>
        prev.map((item) =>
          item.pair === update.pair
            ? { ...item, price: update.price, change: update.change, changePercent: update.changePercent }
            : item
        )
      );
    });

    // Refresh data every 60 seconds
    const interval = setInterval(loadMarketData, 60000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  /**
   * Load market overview data
   */
  const loadMarketData = async () => {
    try {
      const response = await marketAPI.getOverview();
      if (response.success) {
        setMarketData(response.data);
      }
    } catch (error) {
      console.error('Failed to load market data:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filter and sort market data
   */
  const getFilteredData = () => {
    let filtered = marketData;

    // Apply filter
    if (filter === 'major') {
      filtered = marketData.filter((item) => majorPairs.includes(item.pair));
    } else if (filter === 'cross') {
      filtered = marketData.filter((item) => crossPairs.includes(item.pair));
    }

    // Apply sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'change':
          return Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0);
        case 'gainers':
          return (b.changePercent || 0) - (a.changePercent || 0);
        case 'losers':
          return (a.changePercent || 0) - (b.changePercent || 0);
        case 'name':
          return a.pair.localeCompare(b.pair);
        default:
          return 0;
      }
    });
  };

  /**
   * Get change color class
   */
  const getChangeColor = (change) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  /**
   * Get change background class
   */
  const getChangeBg = (change) => {
    if (change > 0) return 'bg-green-50';
    if (change < 0) return 'bg-red-50';
    return 'bg-gray-50';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading market data...</p>
        </div>
      </div>
    );
  }

  const filteredData = getFilteredData();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Market Overview</h1>
            <div className="w-32"></div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex space-x-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Pairs
              </button>
              <button
                onClick={() => setFilter('major')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'major'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Major Pairs
              </button>
              <button
                onClick={() => setFilter('cross')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'cross'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cross Pairs
              </button>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="change">Most Volatile</option>
              <option value="gainers">Top Gainers</option>
              <option value="losers">Top Losers</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Market Data Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {filteredData.map((item) => (
            <Link
              key={item.pair}
              to={`/trading/${item.pair}`}
              className="bg-white rounded-lg shadow hover:shadow-md transition p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">{item.pair}</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${getChangeBg(item.changePercent)}`}>
                  {item.trend === 'up' ? '↗' : item.trend === 'down' ? '↘' : '→'}
                </div>
              </div>

              <div className="mb-3">
                <div className="text-3xl font-bold text-gray-900">
                  {item.price?.toFixed(5) || 'N/A'}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-600">Change: </span>
                  <span className={`font-semibold ${getChangeColor(item.changePercent)}`}>
                    {item.changePercent > 0 ? '+' : ''}
                    {item.changePercent?.toFixed(2)}%
                  </span>
                </div>
                <div className="text-gray-600">
                  {item.change > 0 ? '+' : ''}
                  {item.change?.toFixed(5)}
                </div>
              </div>

              {item.volume && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-600">
                    Volume: <span className="font-medium">{item.volume.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>

        {filteredData.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">No market data available</p>
          </div>
        )}

        {/* Market Summary */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Market Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-600 mb-1">Total Pairs</div>
              <div className="text-2xl font-bold text-gray-900">{marketData.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Gainers</div>
              <div className="text-2xl font-bold text-green-600">
                {marketData.filter((item) => (item.changePercent || 0) > 0).length}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Losers</div>
              <div className="text-2xl font-bold text-red-600">
                {marketData.filter((item) => (item.changePercent || 0) < 0).length}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Unchanged</div>
              <div className="text-2xl font-bold text-gray-600">
                {marketData.filter((item) => (item.changePercent || 0) === 0).length}
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
          <p className="text-sm text-yellow-800">
            ⚠️ <strong>Disclaimer:</strong> Market data is for informational purposes only.
            Prices may be delayed. Always verify prices with your broker before trading.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MarketOverview;