import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { tradingAPI, authAPI, analyticsAPI } from '../services/api';
import { subscribeToSignals, subscribeToNotifications } from '../services/socket';

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-gray-900">AIFX</h1>
              <nav className="hidden md:flex space-x-6">
                <Link to="/dashboard" className="text-blue-600 font-medium">
                  Dashboard
                </Link>
                <Link to="/trading" className="text-gray-600 hover:text-gray-900">
                  Trading
                </Link>
                <Link to="/market" className="text-gray-600 hover:text-gray-900">
                  Market
                </Link>
                <Link to="/settings" className="text-gray-600 hover:text-gray-900">
                  Settings
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.username}</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Performance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Win Rate</h3>
            <p className="text-3xl font-bold text-gray-900">
              {performance?.winRate ? `${Math.round(performance.winRate * 100)}%` : 'N/A'}
            </p>
            <p className="text-sm text-gray-600 mt-1">Last 30 days</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Signals</h3>
            <p className="text-3xl font-bold text-gray-900">
              {performance?.totalSignals || 0}
            </p>
            <p className="text-sm text-gray-600 mt-1">Last 30 days</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Accuracy</h3>
            <p className="text-3xl font-bold text-gray-900">
              {performance?.accuracy ? `${Math.round(performance.accuracy * 100)}%` : 'N/A'}
            </p>
            <p className="text-sm text-gray-600 mt-1">Overall performance</p>
          </div>
        </div>

        {/* Recent Signals */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Trading Signals</h2>
          </div>
          <div className="p-6">
            {signals.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No signals available yet</p>
            ) : (
              <div className="space-y-3">
                {signals.map((signal, index) => (
                  <div
                    key={signal.id || index}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="font-semibold text-gray-900">{signal.pair}</div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getSignalColor(signal.action)}`}>
                        {signal.action.toUpperCase()}
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-sm text-gray-600">
                        Confidence: <span className="font-medium">{Math.round(signal.confidence * 100)}%</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(signal.timestamp).toLocaleTimeString()}
                      </div>
                      <Link
                        to={`/trading/${signal.pair}`}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/trading"
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition text-center"
          >
            <div className="text-3xl mb-2">📊</div>
            <h3 className="font-semibold text-gray-900">Trading View</h3>
            <p className="text-sm text-gray-600 mt-1">View detailed charts</p>
          </Link>

          <Link
            to="/market"
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition text-center"
          >
            <div className="text-3xl mb-2">🌍</div>
            <h3 className="font-semibold text-gray-900">Market Overview</h3>
            <p className="text-sm text-gray-600 mt-1">Global market data</p>
          </Link>

          <Link
            to="/settings"
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition text-center"
          >
            <div className="text-3xl mb-2">⚙️</div>
            <h3 className="font-semibold text-gray-900">Settings</h3>
            <p className="text-sm text-gray-600 mt-1">Configure preferences</p>
          </Link>

          <Link
            to="/analytics"
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition text-center"
          >
            <div className="text-3xl mb-2">📈</div>
            <h3 className="font-semibold text-gray-900">Analytics</h3>
            <p className="text-sm text-gray-600 mt-1">Performance metrics</p>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;