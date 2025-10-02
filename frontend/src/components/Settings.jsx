import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { preferencesAPI } from '../services/api';

/**
 * Settings component for user preferences
 */
const Settings = () => {
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState({
    tradingFrequency: 'daytrading',
    riskLevel: 5,
    preferredPairs: [],
    tradingStyle: 'mixed',
    indicators: {
      sma: { enabled: true, period: 20 },
      rsi: { enabled: true, period: 14 },
      macd: { enabled: true },
      bb: { enabled: false, period: 20 },
    },
  });

  const [notifications, setNotifications] = useState({
    email: true,
    discord: false,
    browser: true,
    signalTypes: {
      buy: true,
      sell: true,
      hold: false,
    },
    minConfidence: 70,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const allPairs = [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF',
    'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/GBP',
    'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY'
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  /**
   * Load user settings
   */
  const loadSettings = async () => {
    try {
      const [prefsRes, notifsRes] = await Promise.all([
        preferencesAPI.get(),
        preferencesAPI.getNotifications(),
      ]);

      if (prefsRes.success) {
        setPreferences(prefsRes.data);
      }
      if (notifsRes.success) {
        setNotifications(notifsRes.data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      showMessage('error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save preferences
   */
  const savePreferences = async () => {
    setSaving(true);
    try {
      await preferencesAPI.update(preferences);
      showMessage('success', 'Preferences saved successfully');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      showMessage('error', 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Save notification settings
   */
  const saveNotifications = async () => {
    setSaving(true);
    try {
      await preferencesAPI.updateNotifications(notifications);
      showMessage('success', 'Notification settings saved successfully');
    } catch (error) {
      console.error('Failed to save notifications:', error);
      showMessage('error', 'Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Show message
   */
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  /**
   * Toggle preferred pair
   */
  const togglePair = (pair) => {
    setPreferences((prev) => ({
      ...prev,
      preferredPairs: prev.preferredPairs.includes(pair)
        ? prev.preferredPairs.filter((p) => p !== pair)
        : [...prev.preferredPairs, pair],
    }));
  };

  /**
   * Update indicator setting
   */
  const updateIndicator = (indicator, field, value) => {
    setPreferences((prev) => ({
      ...prev,
      indicators: {
        ...prev.indicators,
        [indicator]: {
          ...prev.indicators[indicator],
          [field]: value,
        },
      },
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <div className="w-32"></div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Trading Preferences */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Trading Preferences</h2>
          </div>
          <div className="p-6 space-y-6">
            {/* Trading Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trading Frequency
              </label>
              <select
                value={preferences.tradingFrequency}
                onChange={(e) => setPreferences({ ...preferences, tradingFrequency: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="scalping">Scalping (Minutes)</option>
                <option value="daytrading">Day Trading (Hours)</option>
                <option value="swing">Swing Trading (Days)</option>
                <option value="position">Position Trading (Weeks)</option>
              </select>
            </div>

            {/* Risk Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Risk Level: {preferences.riskLevel}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={preferences.riskLevel}
                onChange={(e) => setPreferences({ ...preferences, riskLevel: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Conservative</span>
                <span>Aggressive</span>
              </div>
            </div>

            {/* Trading Style */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trading Style
              </label>
              <div className="flex space-x-4">
                {['trend', 'counter-trend', 'mixed'].map((style) => (
                  <button
                    key={style}
                    onClick={() => setPreferences({ ...preferences, tradingStyle: style })}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      preferences.tradingStyle === style
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Preferred Pairs */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Currency Pairs
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {allPairs.map((pair) => (
                  <button
                    key={pair}
                    onClick={() => togglePair(pair)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      preferences.preferredPairs.includes(pair)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {pair}
                  </button>
                ))}
              </div>
            </div>

            {/* Technical Indicators */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Technical Indicators
              </label>
              <div className="space-y-3">
                {Object.entries(preferences.indicators).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={value.enabled}
                        onChange={(e) => updateIndicator(key, 'enabled', e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-900">{key.toUpperCase()}</span>
                    </div>
                    {value.period !== undefined && value.enabled && (
                      <input
                        type="number"
                        value={value.period}
                        onChange={(e) => updateIndicator(key, 'period', parseInt(e.target.value))}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Period"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={savePreferences}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Notification Settings</h2>
          </div>
          <div className="p-6 space-y-6">
            {/* Notification Channels */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Notification Channels
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={notifications.email}
                    onChange={(e) => setNotifications({ ...notifications, email: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Email Notifications</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={notifications.discord}
                    onChange={(e) => setNotifications({ ...notifications, discord: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Discord Notifications</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={notifications.browser}
                    onChange={(e) => setNotifications({ ...notifications, browser: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Browser Notifications</span>
                </label>
              </div>
            </div>

            {/* Signal Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Signal Types to Receive
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={notifications.signalTypes.buy}
                    onChange={(e) => setNotifications({
                      ...notifications,
                      signalTypes: { ...notifications.signalTypes, buy: e.target.checked }
                    })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Buy Signals</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={notifications.signalTypes.sell}
                    onChange={(e) => setNotifications({
                      ...notifications,
                      signalTypes: { ...notifications.signalTypes, sell: e.target.checked }
                    })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Sell Signals</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={notifications.signalTypes.hold}
                    onChange={(e) => setNotifications({
                      ...notifications,
                      signalTypes: { ...notifications.signalTypes, hold: e.target.checked }
                    })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Hold Signals</span>
                </label>
              </div>
            </div>

            {/* Minimum Confidence */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Confidence: {notifications.minConfidence}%
              </label>
              <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={notifications.minConfidence}
                onChange={(e) => setNotifications({ ...notifications, minConfidence: parseInt(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Only receive signals with confidence above this threshold
              </p>
            </div>

            <button
              onClick={saveNotifications}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : 'Save Notification Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;