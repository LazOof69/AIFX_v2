import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Activity, Mail, Lock, User, LogIn, UserPlus, AlertTriangle, CheckCircle } from 'lucide-react';

/**
 * Login component for user authentication
 */
const Login = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Handle input change
   */
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const response = await authAPI.login(formData.email, formData.password);
        if (response.success) {
          navigate('/dashboard');
        }
      } else {
        const response = await authAPI.register(formData);
        if (response.success) {
          setIsLogin(true);
          setError('Registration successful! Please login.');
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full animate-fade-in">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center space-x-3 mb-4">
            <div className="p-4 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl shadow-neon-blue">
              <Activity className="text-white" size={40} />
            </div>
          </div>
          <h1 className="text-5xl font-black bg-gradient-to-r from-primary-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
            AIFX
          </h1>
          <p className="text-white text-lg font-medium drop-shadow-lg">AI-Powered Forex Trading Advisory</p>
        </div>

        {/* Login/Register Form */}
        <div className="glass-card rounded-2xl shadow-2xl p-8 border border-white/30">
          <div className="mb-6">
            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => {
                  setIsLogin(true);
                  setError('');
                }}
                className={`flex-1 py-3 rounded-lg font-bold transition-all duration-300 ${
                  isLogin
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <LogIn size={18} />
                  <span>Login</span>
                </div>
              </button>
              <button
                onClick={() => {
                  setIsLogin(false);
                  setError('');
                }}
                className={`flex-1 py-3 rounded-lg font-bold transition-all duration-300 ${
                  !isLogin
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <UserPlus size={18} />
                  <span>Register</span>
                </div>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="text-gray-400" size={20} />
                  </div>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-white/50"
                    placeholder="Enter your username"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="text-gray-400" size={20} />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-white/50"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="text-gray-400" size={20} />
                </div>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-white/50"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {error && (
              <div className={`flex items-start space-x-3 p-4 rounded-xl text-sm font-medium ${
                error.includes('successful')
                  ? 'bg-green-50 text-green-700 border-2 border-green-200'
                  : 'bg-red-50 text-red-700 border-2 border-red-200'
              }`}>
                {error.includes('successful') ? (
                  <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
                )}
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold py-3.5 rounded-xl transition-all duration-300 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
                  <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                </div>
              )}
            </button>
          </form>

          {isLogin && (
            <div className="mt-6 text-center">
              <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 font-medium hover:underline">
                Forgot password?
              </Link>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="mt-8 glass-card rounded-xl p-4 border border-white/30">
          <div className="flex items-start space-x-3 text-sm">
            <AlertTriangle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-gray-700">
              <p className="font-bold text-gray-900 mb-1">Risk Disclaimer</p>
              <p>Trading forex involves substantial risk of loss. This system provides advisory signals only, not financial advice.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;