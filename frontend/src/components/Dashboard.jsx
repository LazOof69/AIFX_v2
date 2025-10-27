import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { tradingAPI, authAPI, analyticsAPI } from '../services/api';
import { subscribeToSignals, subscribeToNotifications } from '../services/socket';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  BarChart3,
  Globe,
  Settings,
  LogOut,
  Bell,
  Zap,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock
} from 'lucide-react';

/**
 * Dashboard component - main hub for user
 */
const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [signals, setSignals] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();

    // Subscribe to real-time updates
    const unsubscribeSignals = subscribeToSignals((signal) => {
      setSignals((prev) => [signal, ...prev.slice(0, 9)]);
      // Show notification
      if (Notification.permission === 'granted') {
        new Notification('New Trading Signal', {
          body: `${signal.pair}: ${signal.action.toUpperCase()} - Confidence: ${Math.round(signal.confidence * 100)}%`,
        });
      }
    });

    const unsubscribeNotifications = subscribeToNotifications((notification) => {
      setNotifications((prev) => [notification, ...prev]);
    });

    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      unsubscribeSignals();
      unsubscribeNotifications();
    };
  }, []);

  /**
   * Load dashboard data
   */
  const loadDashboardData = async () => {
    try {
      const [userRes, signalsRes, performanceRes] = await Promise.all([
        authAPI.getProfile(),
        tradingAPI.getSignals({ limit: 10 }),
        analyticsAPI.getPerformance('30d'),
      ]);

      setUser(userRes.data);
      setSignals(signalsRes.data);
      setPerformance(performanceRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    try {
      await authAPI.logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  /**
   * Get signal color based on action
   */
  const getSignalColor = (action) => {
    switch (action.toLowerCase()) {
      case 'buy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'sell':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center glass-card rounded-2xl p-8 animate-fade-in">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 border-t-primary-600 mx-auto mb-4"></div>
            <Zap className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary-600" size={24} />
          </div>
          <p className="text-gray-700 font-medium">Loading your trading dashboard...</p>
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
                <Link
                  to="/dashboard"
                  className="px-4 py-2 rounded-lg bg-primary-500 text-white font-medium shadow-md"
                >
                  Dashboard
                </Link>
                <Link
                  to="/trading"
                  className="px-4 py-2 rounded-lg text-gray-700 hover:bg-white/50 font-medium transition"
                >
                  Trading
                </Link>
                <Link
                  to="/market"
                  className="px-4 py-2 rounded-lg text-gray-700 hover:bg-white/50 font-medium transition"
                >
                  Market
                </Link>
                <Link
                  to="/settings"
                  className="px-4 py-2 rounded-lg text-gray-700 hover:bg-white/50 font-medium transition"
                >
                  Settings
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-3">
              <button className="p-2 rounded-lg hover:bg-white/50 transition relative">
                <Bell size={20} className="text-gray-700" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
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
        {/* Performance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-slide-up">
          {/* Win Rate Card */}
          <div className="glass-card rounded-2xl p-6 hover:shadow-card-hover transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-success rounded-xl shadow-neon-green group-hover:scale-110 transition-transform">
                <Target className="text-white" size={24} />
              </div>
              <span className="text-xs font-medium text-gray-500 bg-white/50 px-3 py-1 rounded-full">
                30 days
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">Win Rate</h3>
            <p className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              {performance?.winRate ? `${Math.round(performance.winRate * 100)}%` : 'N/A'}
            </p>
            <div className="flex items-center mt-3 text-green-600 text-sm font-medium">
              <ArrowUpRight size={16} />
              <span>+5.2% from last month</span>
            </div>
          </div>

          {/* Total Signals Card */}
          <div className="glass-card rounded-2xl p-6 hover:shadow-card-hover transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-primary-600 rounded-xl shadow-neon-blue group-hover:scale-110 transition-transform">
                <Zap className="text-white" size={24} />
              </div>
              <span className="text-xs font-medium text-gray-500 bg-white/50 px-3 py-1 rounded-full">
                30 days
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Signals</h3>
            <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-primary-600 bg-clip-text text-transparent">
              {performance?.totalSignals || 0}
            </p>
            <div className="flex items-center mt-3 text-blue-600 text-sm font-medium">
              <Activity size={16} className="mr-1" />
              <span>High activity</span>
            </div>
          </div>

          {/* Accuracy Card */}
          <div className="glass-card rounded-2xl p-6 hover:shadow-card-hover transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <BarChart3 className="text-white" size={24} />
              </div>
              <span className="text-xs font-medium text-gray-500 bg-white/50 px-3 py-1 rounded-full">
                Overall
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">Accuracy</h3>
            <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {performance?.accuracy ? `${Math.round(performance.accuracy * 100)}%` : 'N/A'}
            </p>
            <div className="flex items-center mt-3 text-purple-600 text-sm font-medium">
              <TrendingUp size={16} className="mr-1" />
              <span>Excellent performance</span>
            </div>
          </div>
        </div>

        {/* Recent Signals */}
        <div className="glass-card rounded-2xl mb-8 overflow-hidden animate-slide-up">
          <div className="px-6 py-5 border-b border-white/30 bg-gradient-to-r from-primary-50 to-purple-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-500 rounded-lg">
                  <Activity className="text-white" size={20} />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Recent Trading Signals</h2>
              </div>
              <span className="text-xs font-medium text-primary-600 bg-primary-100 px-3 py-1 rounded-full">
                Live
              </span>
            </div>
          </div>
          <div className="p-6">
            {signals.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <Activity className="text-gray-400" size={32} />
                </div>
                <p className="text-gray-500 font-medium">No signals available yet</p>
                <p className="text-sm text-gray-400 mt-1">Signals will appear here when detected</p>
              </div>
            ) : (
              <div className="space-y-3">
                {signals.map((signal, index) => (
                  <div
                    key={signal.id || index}
                    className="flex items-center justify-between p-5 border border-gray-200 rounded-xl hover:shadow-md hover:border-primary-300 transition-all duration-200 bg-white/50 group"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${signal.action.toLowerCase() === 'buy' ? 'bg-green-100' : 'bg-red-100'}`}>
                          {signal.action.toLowerCase() === 'buy' ? (
                            <TrendingUp className="text-green-600" size={20} />
                          ) : (
                            <TrendingDown className="text-red-600" size={20} />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 text-lg">{signal.pair}</div>
                          <div className="flex items-center space-x-2 mt-1">
                            <Clock size={12} className="text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {new Date(signal.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className={`px-4 py-2 rounded-full text-sm font-bold ${signal.action.toLowerCase() === 'buy' ? 'bg-gradient-success text-white' : 'bg-gradient-danger text-white'} shadow-md`}>
                        {signal.action.toUpperCase()}
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <div className="text-xs text-gray-500 font-medium">Confidence</div>
                        <div className="text-lg font-bold text-gray-900">
                          {Math.round(signal.confidence * 100)}%
                        </div>
                      </div>
                      <Link
                        to={`/trading/${signal.pair}`}
                        className="flex items-center space-x-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-all shadow-md group-hover:shadow-lg"
                      >
                        <span>Details</span>
                        <ArrowUpRight size={16} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up">
          <Link
            to="/trading"
            className="glass-card rounded-2xl p-6 hover:shadow-card-hover hover:scale-105 transition-all duration-300 text-center group"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-primary-600 rounded-2xl mb-4 group-hover:shadow-neon-blue group-hover:rotate-6 transition-all">
              <BarChart3 className="text-white" size={28} />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Trading View</h3>
            <p className="text-sm text-gray-600">View detailed charts and analysis</p>
          </Link>

          <Link
            to="/market"
            className="glass-card rounded-2xl p-6 hover:shadow-card-hover hover:scale-105 transition-all duration-300 text-center group"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mb-4 group-hover:shadow-neon-green group-hover:rotate-6 transition-all">
              <Globe className="text-white" size={28} />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Market Overview</h3>
            <p className="text-sm text-gray-600">Global market insights</p>
          </Link>

          <Link
            to="/settings"
            className="glass-card rounded-2xl p-6 hover:shadow-card-hover hover:scale-105 transition-all duration-300 text-center group"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl mb-4 group-hover:shadow-lg group-hover:rotate-6 transition-all">
              <Settings className="text-white" size={28} />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Settings</h3>
            <p className="text-sm text-gray-600">Configure your preferences</p>
          </Link>

          <Link
            to="/analytics"
            className="glass-card rounded-2xl p-6 hover:shadow-card-hover hover:scale-105 transition-all duration-300 text-center group"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl mb-4 group-hover:shadow-lg group-hover:rotate-6 transition-all">
              <DollarSign className="text-white" size={28} />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Analytics</h3>
            <p className="text-sm text-gray-600">Performance metrics</p>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;