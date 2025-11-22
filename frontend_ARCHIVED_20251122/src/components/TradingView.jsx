import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { tradingAPI, authAPI } from '../services/api';
import CandlestickChart from './CandlestickChart';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  LogOut,
  Bell,
  BarChart3,
  Zap
} from 'lucide-react';

/**
 * Simple TradingView component showing signal details
 */
const TradingView = () => {
  const { pair: urlPair } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [selectedPair, setSelectedPair] = useState(urlPair || 'EUR/USD');
  const [signals, setSignals] = useState([]);
  const [currentSignal, setCurrentSignal] = useState(null);
  const [loading, setLoading] = useState(true);

  const popularPairs = [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF',
    'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/GBP'
  ];

  useEffect(() => {
    loadData();
  }, [selectedPair]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userRes, signalsRes] = await Promise.all([
        authAPI.getProfile(),
        tradingAPI.getSignals({ limit: 50 }),
      ]);

      setUser(userRes.data.user);
      const allSignals = signalsRes.data.history || [];
      setSignals(allSignals);

      // Find signal for selected pair
      const pairSignal = allSignals.find(s => s.pair === selectedPair);
      setCurrentSignal(pairSignal || null);
    } catch (error) {
      console.error('Failed to load data:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handlePairChange = (pair) => {
    setSelectedPair(pair);
    navigate(`/trading/${pair}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center glass-card rounded-2xl p-8 animate-fade-in">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 border-t-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading trading view...</p>
        </div>
      </div>
    );
  }

  const action = currentSignal ? (currentSignal.signal || currentSignal.action || 'hold').toLowerCase() : 'hold';
  const confidence = currentSignal ? (currentSignal.confidence || 0) : 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-card border-b border-white/30 sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <div className="bg-gradient-to-br from-primary-500 to-purple-600 p-2 rounded-xl shadow-lg">
                  <Activity className="text-white" size={24} />
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                  AIFX
                </h1>
              </div>
              <nav className="hidden md:flex space-x-1">
                <Link to="/dashboard" className="px-4 py-2 rounded-lg text-gray-700 hover:bg-white/50 font-medium transition">
                  Dashboard
                </Link>
                <Link to="/trading" className="px-4 py-2 rounded-lg bg-primary-500 text-white font-medium shadow-md">
                  Trading
                </Link>
                <Link to="/market" className="px-4 py-2 rounded-lg text-gray-700 hover:bg-white/50 font-medium transition">
                  Market
                </Link>
                <Link to="/settings" className="px-4 py-2 rounded-lg text-gray-700 hover:bg-white/50 font-medium transition">
                  Settings
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-3">
              <button className="p-2 rounded-lg hover:bg-white/50 transition relative">
                <Bell size={20} className="text-gray-700" />
              </button>
              <div className="h-8 w-px bg-gray-300"></div>
              <span className="text-sm text-gray-700 font-medium">Welcome, {user?.username}</span>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:text-red-600 border border-gray-300 rounded-lg hover:bg-red-50 hover:border-red-300 transition"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Pair Selector */}
        <div className="glass-card rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <BarChart3 className="text-primary-600" size={28} />
              <h2 className="text-2xl font-bold text-gray-900">Select Currency Pair</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {popularPairs.map((pair) => (
              <button
                key={pair}
                onClick={() => handlePairChange(pair)}
                className={`p-4 rounded-xl font-bold text-lg transition-all ${
                  selectedPair === pair
                    ? 'bg-gradient-to-r from-primary-500 to-purple-600 text-white shadow-lg scale-105'
                    : 'bg-white/50 text-gray-700 hover:bg-white hover:shadow-md'
                }`}
              >
                {pair}
              </button>
            ))}
          </div>
        </div>

        {/* Signal Card */}
        {currentSignal ? (
          <div className="glass-card rounded-2xl p-8 mb-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                {action === 'buy' ? <TrendingUp className="text-green-600" size={48} /> :
                 action === 'sell' ? <TrendingDown className="text-red-600" size={48} /> :
                 <Activity className="text-gray-600" size={48} />}
                <div>
                  <h2 className="text-4xl font-black text-gray-900">{selectedPair}</h2>
                  <p className="text-gray-600 mt-1">Trading Signal Analysis</p>
                </div>
              </div>
              <div className={`px-8 py-4 rounded-2xl text-2xl font-black uppercase shadow-lg ${
                action === 'buy' ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' :
                action === 'sell' ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white' :
                'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
              }`}>
                {action}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Confidence */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200">
                <div className="flex items-center space-x-3 mb-4">
                  <Target className="text-purple-600" size={28} />
                  <h3 className="text-lg font-bold text-gray-900">Confidence</h3>
                </div>
                <p className="text-5xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {Math.round(confidence * 100)}%
                </p>
              </div>

              {/* Entry Price */}
              {currentSignal.entryPrice && (
                <div className="bg-gradient-to-br from-blue-50 to-primary-50 rounded-2xl p-6 border-2 border-blue-200">
                  <div className="flex items-center space-x-3 mb-4">
                    <DollarSign className="text-blue-600" size={28} />
                    <h3 className="text-lg font-bold text-gray-900">Entry Price</h3>
                  </div>
                  <p className="text-4xl font-black text-blue-600">
                    {parseFloat(currentSignal.entryPrice).toFixed(5)}
                  </p>
                </div>
              )}

              {/* Status */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200">
                <div className="flex items-center space-x-3 mb-4">
                  <Zap className="text-green-600" size={28} />
                  <h3 className="text-lg font-bold text-gray-900">Status</h3>
                </div>
                <p className="text-3xl font-black text-green-600 uppercase">
                  {currentSignal.status || 'Active'}
                </p>
              </div>
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {currentSignal.stopLoss && (
                <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-red-900">Stop Loss</span>
                    <span className="text-lg font-bold text-red-600">
                      {parseFloat(currentSignal.stopLoss).toFixed(5)}
                    </span>
                  </div>
                </div>
              )}

              {currentSignal.takeProfit && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-green-900">Take Profit</span>
                    <span className="text-lg font-bold text-green-600">
                      {parseFloat(currentSignal.takeProfit).toFixed(5)}
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Timeframe</span>
                  <span className="text-lg font-bold text-gray-700">
                    {currentSignal.timeframe || '1hour'}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center space-x-2">
                  <Clock size={18} className="text-gray-600" />
                  <span className="text-sm text-gray-600">
                    {new Date(currentSignal.createdAt || currentSignal.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-12 text-center">
            <BarChart3 className="mx-auto text-gray-400 mb-4" size={64} />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Signal Available</h3>
            <p className="text-gray-600">
              No trading signal found for {selectedPair}. Try selecting a different pair.
            </p>
          </div>
        )}

        {/* Price Chart with Signals */}
        <div className="mb-8">
          <CandlestickChart
            priceData={[]} // Will use mock data
            signals={signals.filter(s => s.pair === selectedPair)}
            pair={selectedPair}
            timeframe="1h"
          />
        </div>

        {/* All Signals for this Pair */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">All Signals for {selectedPair}</h3>
          <div className="space-y-4">
            {signals.filter(s => s.pair === selectedPair).map((signal) => {
              const signalAction = (signal.signal || signal.action || 'hold').toLowerCase();
              return (
                <div key={signal.id} className="bg-white/50 rounded-xl p-4 border border-gray-200 hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {signalAction === 'buy' ? <ArrowUpRight className="text-green-600" size={24} /> :
                       signalAction === 'sell' ? <ArrowDownRight className="text-red-600" size={24} /> :
                       <Activity className="text-gray-600" size={24} />}
                      <div>
                        <div className="font-bold text-gray-900">{signal.pair}</div>
                        <div className="text-sm text-gray-600">
                          {new Date(signal.createdAt || signal.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className={`px-4 py-2 rounded-full text-sm font-bold uppercase ${
                        signalAction === 'buy' ? 'bg-green-500 text-white' :
                        signalAction === 'sell' ? 'bg-red-500 text-white' :
                        'bg-gray-500 text-white'
                      }`}>
                        {signalAction}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Confidence</div>
                        <div className="text-lg font-bold text-gray-900">
                          {Math.round((signal.confidence || 0) * 100)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {signals.filter(s => s.pair === selectedPair).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Activity className="mx-auto mb-2" size={32} />
                <p>No signals available for this pair</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TradingView;
