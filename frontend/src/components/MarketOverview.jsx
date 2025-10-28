import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { tradingAPI, authAPI } from '../services/api';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Target,
  Zap,
  LogOut,
  Bell,
  Globe
} from 'lucide-react';

/**
 * Simple MarketOverview component showing trading signals as market data
 */
const MarketOverview = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userRes, signalsRes] = await Promise.all([
        authAPI.getProfile(),
        tradingAPI.getSignals({ limit: 50 }),
      ]);

      setUser(userRes.data.user);
      setSignals(signalsRes.data.history || []);
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

  const getFilteredSignals = () => {
    if (filter === 'all') return signals;
    return signals.filter(s => (s.signal || s.action) === filter);
  };

  const filteredSignals = getFilteredSignals();
  const buyCount = signals.filter(s => (s.signal || s.action) === 'buy').length;
  const sellCount = signals.filter(s => (s.signal || s.action) === 'sell').length;
  const holdCount = signals.filter(s => (s.signal || s.action) === 'hold').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center glass-card rounded-2xl p-8 animate-fade-in">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 border-t-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading market overview...</p>
        </div>
      </div>
    );
  }

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
                <Link to="/trading" className="px-4 py-2 rounded-lg text-gray-700 hover:bg-white/50 font-medium transition">
                  Trading
                </Link>
                <Link to="/market" className="px-4 py-2 rounded-lg bg-primary-500 text-white font-medium shadow-md">
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
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Globe className="text-primary-600" size={32} />
              <Target className="text-gray-400" size={20} />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Pairs</h3>
            <p className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
              {signals.length}
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="text-green-600" size={32} />
              <ArrowUpRight className="text-green-500" size={20} />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">Buy Signals</h3>
            <p className="text-4xl font-bold text-green-600">{buyCount}</p>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <TrendingDown className="text-red-600" size={32} />
              <ArrowDownRight className="text-red-500" size={20} />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">Sell Signals</h3>
            <p className="text-4xl font-bold text-red-600">{sellCount}</p>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Activity className="text-gray-600" size={32} />
              <Clock className="text-gray-400" size={20} />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">Hold Signals</h3>
            <p className="text-4xl font-bold text-gray-600">{holdCount}</p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="glass-card rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Globe className="text-primary-600" size={24} />
              <h2 className="text-xl font-bold text-gray-800">Market Signals</h2>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'all'
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'bg-white/50 text-gray-700 hover:bg-white'
                }`}
              >
                All ({signals.length})
              </button>
              <button
                onClick={() => setFilter('buy')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'buy'
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-white/50 text-gray-700 hover:bg-white'
                }`}
              >
                Buy ({buyCount})
              </button>
              <button
                onClick={() => setFilter('sell')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'sell'
                    ? 'bg-red-500 text-white shadow-md'
                    : 'bg-white/50 text-gray-700 hover:bg-white'
                }`}
              >
                Sell ({sellCount})
              </button>
              <button
                onClick={() => setFilter('hold')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'hold'
                    ? 'bg-gray-500 text-white shadow-md'
                    : 'bg-white/50 text-gray-700 hover:bg-white'
                }`}
              >
                Hold ({holdCount})
              </button>
            </div>
          </div>
        </div>

        {/* Signals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSignals.map((signal) => {
            const action = (signal.signal || signal.action || 'hold').toLowerCase();
            const colorClass = action === 'buy' ? 'border-green-500 bg-green-50/50' : action === 'sell' ? 'border-red-500 bg-red-50/50' : 'border-gray-500 bg-gray-50/50';
            const iconColorClass = action === 'buy' ? 'text-green-600' : action === 'sell' ? 'text-red-600' : 'text-gray-600';

            return (
              <div key={signal.id} className={`glass-card rounded-2xl p-6 border-2 ${colorClass} hover:shadow-lg transition-all`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {action === 'buy' ? <TrendingUp className={iconColorClass} size={28} /> :
                     action === 'sell' ? <TrendingDown className={iconColorClass} size={28} /> :
                     <Activity className={iconColorClass} size={28} />}
                    <h3 className="text-xl font-bold text-gray-900">{signal.pair}</h3>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-bold uppercase ${
                    action === 'buy' ? 'bg-green-500 text-white' :
                    action === 'sell' ? 'bg-red-500 text-white' :
                    'bg-gray-500 text-white'
                  }`}>
                    {action}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Confidence</span>
                    <span className="text-lg font-bold text-gray-900">{Math.round((signal.confidence || 0) * 100)}%</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Timeframe</span>
                    <span className="text-sm font-semibold text-gray-700">{signal.timeframe || '1hour'}</span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <Clock size={14} />
                    <span>{new Date(signal.createdAt || signal.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <Link
                  to={`/trading/${signal.pair}`}
                  className="mt-4 flex items-center justify-center space-x-2 w-full py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition shadow-md"
                >
                  <span>View Details</span>
                  <ArrowUpRight size={18} />
                </Link>
              </div>
            );
          })}
        </div>

        {filteredSignals.length === 0 && (
          <div className="text-center py-12 glass-card rounded-2xl">
            <Zap className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500 font-medium">No signals match your filter</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default MarketOverview;
