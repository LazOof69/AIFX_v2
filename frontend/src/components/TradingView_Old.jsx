import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { marketAPI, tradingAPI } from '../services/api';
import { subscribeToPriceUpdates } from '../services/socket';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * TradingView component with live charts
 */
const TradingView = () => {
  const { pair: urlPair } = useParams();
  const navigate = useNavigate();
  const [selectedPair, setSelectedPair] = useState(urlPair || 'EUR/USD');
  const [timeframe, setTimeframe] = useState('1hour');
  const [chartData, setChartData] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [signal, setSignal] = useState(null);
  const [indicators, setIndicators] = useState(null);
  const [loading, setLoading] = useState(true);

  const popularPairs = [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF',
    'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/GBP'
  ];

  const timeframes = [
    { value: '5min', label: '5M' },
    { value: '15min', label: '15M' },
    { value: '1hour', label: '1H' },
    { value: '4hour', label: '4H' },
    { value: 'daily', label: '1D' },
  ];

  useEffect(() => {
    loadTradingData();

    // Subscribe to real-time price updates
    const unsubscribe = subscribeToPriceUpdates(selectedPair, (priceData) => {
      setCurrentPrice(priceData.price);
      // Update chart with new data point if needed
      if (chartData) {
        updateChartData(priceData);
      }
    });

    return () => unsubscribe();
  }, [selectedPair, timeframe]);

  /**
   * Load trading data
   */
  const loadTradingData = async () => {
    setLoading(true);
    try {
      const [historyRes, signalRes, indicatorsRes, priceRes] = await Promise.all([
        marketAPI.getHistory(selectedPair, timeframe, 100),
        tradingAPI.getSignal(selectedPair),
        marketAPI.getIndicators(selectedPair),
        marketAPI.getPrice(selectedPair),
      ]);

      // Prepare chart data
      const history = historyRes.data;
      setChartData({
        labels: history.map(item => new Date(item.timestamp).toLocaleTimeString()),
        datasets: [
          {
            label: selectedPair,
            data: history.map(item => item.close),
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
          },
        ],
      });

      setSignal(signalRes.data);
      setIndicators(indicatorsRes.data);
      setCurrentPrice(priceRes.data.price);
    } catch (error) {
      console.error('Failed to load trading data:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update chart with new price data
   */
  const updateChartData = (priceData) => {
    setChartData((prev) => {
      if (!prev) return prev;

      const newLabels = [...prev.labels.slice(1), new Date().toLocaleTimeString()];
      const newData = [...prev.datasets[0].data.slice(1), priceData.price];

      return {
        labels: newLabels,
        datasets: [
          {
            ...prev.datasets[0],
            data: newData,
          },
        ],
      };
    });
  };

  /**
   * Handle pair change
   */
  const handlePairChange = (pair) => {
    setSelectedPair(pair);
    navigate(`/trading/${pair}`);
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: (value) => value.toFixed(5),
        },
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading trading data...</p>
        </div>
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold text-gray-900">Trading View</h1>
            <div className="w-32"></div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Chart Area */}
          <div className="lg:col-span-3">
            {/* Pair Selector and Timeframe */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-4">
                  <select
                    value={selectedPair}
                    onChange={(e) => handlePairChange(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    {popularPairs.map((pair) => (
                      <option key={pair} value={pair}>
                        {pair}
                      </option>
                    ))}
                  </select>

                  {currentPrice && (
                    <div className="text-2xl font-bold text-gray-900">
                      {currentPrice.toFixed(5)}
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  {timeframes.map((tf) => (
                    <button
                      key={tf.value}
                      onClick={() => setTimeframe(tf.value)}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        timeframe === tf.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div style={{ height: '500px' }}>
                {chartData && <Line data={chartData} options={chartOptions} />}
              </div>
            </div>

            {/* Technical Indicators */}
            {indicators && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Technical Indicators
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {indicators.sma && (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="text-sm text-gray-600">SMA (20)</div>
                      <div className="text-xl font-bold text-gray-900">
                        {indicators.sma.toFixed(5)}
                      </div>
                    </div>
                  )}
                  {indicators.rsi && (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="text-sm text-gray-600">RSI (14)</div>
                      <div className={`text-xl font-bold ${
                        indicators.rsi > 70 ? 'text-red-600' :
                        indicators.rsi < 30 ? 'text-green-600' : 'text-gray-900'
                      }`}>
                        {indicators.rsi.toFixed(2)}
                      </div>
                    </div>
                  )}
                  {indicators.macd && (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="text-sm text-gray-600">MACD</div>
                      <div className="text-xl font-bold text-gray-900">
                        {indicators.macd.toFixed(5)}
                      </div>
                    </div>
                  )}
                  {indicators.bb && (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="text-sm text-gray-600">Bollinger Bands</div>
                      <div className="text-sm text-gray-900">
                        <div>U: {indicators.bb.upper.toFixed(5)}</div>
                        <div>L: {indicators.bb.lower.toFixed(5)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Trading Signal */}
          <div className="lg:col-span-1">
            {signal && (
              <div className="bg-white rounded-lg shadow p-6 sticky top-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Current Signal
                </h3>

                <div className={`text-center py-6 rounded-lg mb-4 ${
                  signal.action === 'buy'
                    ? 'bg-green-50 border-2 border-green-500'
                    : signal.action === 'sell'
                    ? 'bg-red-50 border-2 border-red-500'
                    : 'bg-gray-50 border-2 border-gray-300'
                }`}>
                  <div className={`text-3xl font-bold mb-2 ${
                    signal.action === 'buy'
                      ? 'text-green-600'
                      : signal.action === 'sell'
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }`}>
                    {signal.action.toUpperCase()}
                  </div>
                  <div className="text-sm text-gray-600">
                    Confidence: {Math.round(signal.confidence * 100)}%
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Entry Price:</span>
                    <span className="font-medium">{signal.entryPrice?.toFixed(5) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Stop Loss:</span>
                    <span className="font-medium text-red-600">
                      {signal.stopLoss?.toFixed(5) || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Take Profit:</span>
                    <span className="font-medium text-green-600">
                      {signal.takeProfit?.toFixed(5) || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="text-xs text-gray-500 mb-2">Risk/Reward Ratio</div>
                  <div className="text-lg font-bold text-gray-900">
                    {signal.riskReward || 'N/A'}
                  </div>
                </div>

                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    ⚠️ This is an advisory signal. Always perform your own analysis and risk management.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingView;