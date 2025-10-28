import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import {
  Activity,
  Mail,
  Lock,
  User,
  LogIn,
  UserPlus,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Zap,
  Shield,
  Sparkles
} from 'lucide-react';

/**
 * Login component for user authentication - Ultra Modern Design
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
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4">
      {/* Animated Background Layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"></div>

      {/* Animated Circles */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-slow"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-slow" style={{animationDelay: '2s'}}></div>
      <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-slow" style={{animationDelay: '4s'}}></div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }}></div>

      {/* Floating Icons */}
      <div className="absolute top-20 left-20 text-primary-400 opacity-20 animate-pulse">
        <TrendingUp size={40} />
      </div>
      <div className="absolute top-40 right-32 text-pink-400 opacity-20 animate-pulse" style={{animationDelay: '1s'}}>
        <Zap size={32} />
      </div>
      <div className="absolute bottom-32 left-40 text-purple-400 opacity-20 animate-pulse" style={{animationDelay: '2s'}}>
        <Shield size={36} />
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-md w-full animate-fade-in">
        {/* Logo Section */}
        <div className="text-center mb-10">
          {/* Icon with Glow */}
          <div className="inline-flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-purple-600 rounded-3xl blur-2xl opacity-50 animate-glow"></div>
            <div className="relative p-5 bg-gradient-to-br from-primary-500 via-purple-600 to-pink-500 rounded-3xl shadow-2xl transform hover:scale-110 transition-transform duration-300">
              <Activity className="text-white" size={48} strokeWidth={2.5} />
            </div>
          </div>

          {/* Title with Ultra Gradient */}
          <h1 className="text-7xl font-black mb-4 relative">
            <span className="absolute inset-0 bg-gradient-to-r from-primary-400 via-purple-400 to-pink-400 bg-clip-text text-transparent blur-lg opacity-70">
              AIFX
            </span>
            <span className="relative bg-gradient-to-r from-primary-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
              AIFX
            </span>
          </h1>

          {/* Subtitle with Icons */}
          <div className="flex items-center justify-center space-x-2 text-gray-300">
            <Sparkles size={18} className="text-yellow-400 animate-pulse" />
            <p className="text-lg font-semibold tracking-wide">AI-Powered Forex Trading</p>
            <Sparkles size={18} className="text-yellow-400 animate-pulse" style={{animationDelay: '0.5s'}} />
          </div>

          {/* Feature Pills */}
          <div className="flex items-center justify-center space-x-3 mt-4">
            <div className="px-3 py-1 bg-green-500/20 border border-green-500/50 rounded-full text-green-300 text-xs font-bold flex items-center space-x-1">
              <CheckCircle size={12} />
              <span>Real-time</span>
            </div>
            <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/50 rounded-full text-blue-300 text-xs font-bold flex items-center space-x-1">
              <Zap size={12} />
              <span>AI-Powered</span>
            </div>
            <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-full text-purple-300 text-xs font-bold flex items-center space-x-1">
              <Shield size={12} />
              <span>Secure</span>
            </div>
          </div>
        </div>

        {/* Login/Register Form Card */}
        <div className="relative">
          {/* Card Glow Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-purple-500/20 rounded-3xl blur-xl"></div>

          {/* Main Card */}
          <div className="relative backdrop-blur-xl bg-white/10 border-2 border-white/20 rounded-3xl shadow-2xl p-8 hover:border-white/30 transition-all duration-300">
            {/* Tab Switcher */}
            <div className="mb-8">
              <div className="relative flex gap-2 p-1.5 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10">
                <button
                  onClick={() => {
                    setIsLogin(true);
                    setError('');
                  }}
                  className={`relative flex-1 py-3.5 rounded-xl font-bold transition-all duration-300 ${
                    isLogin
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/50 scale-105'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <LogIn size={20} />
                    <span className="text-lg">Login</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIsLogin(false);
                    setError('');
                  }}
                  className={`relative flex-1 py-3.5 rounded-xl font-bold transition-all duration-300 ${
                    !isLogin
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/50 scale-105'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <UserPlus size={20} />
                    <span className="text-lg">Register</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <div className="transform transition-all duration-300 animate-slide-down">
                  <label className="block text-sm font-bold text-gray-200 mb-3 flex items-center space-x-2">
                    <User size={16} className="text-primary-400" />
                    <span>Username</span>
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-purple-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity"></div>
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="text-gray-400 group-hover:text-primary-400 transition-colors" size={22} />
                    </div>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      required
                      className="relative w-full pl-13 pr-4 py-4 bg-slate-800/50 border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 outline-none transition-all duration-300 text-lg font-medium hover:border-white/20"
                      placeholder="Enter your username"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-200 mb-3 flex items-center space-x-2">
                  <Mail size={16} className="text-primary-400" />
                  <span>Email Address</span>
                </label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-purple-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="text-gray-400 group-hover:text-primary-400 transition-colors" size={22} />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="relative w-full pl-13 pr-4 py-4 bg-slate-800/50 border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 outline-none transition-all duration-300 text-lg font-medium hover:border-white/20"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-200 mb-3 flex items-center space-x-2">
                  <Lock size={16} className="text-primary-400" />
                  <span>Password</span>
                </label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-purple-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="text-gray-400 group-hover:text-primary-400 transition-colors" size={22} />
                  </div>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="relative w-full pl-13 pr-4 py-4 bg-slate-800/50 border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 outline-none transition-all duration-300 text-lg font-medium hover:border-white/20"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && (
                <div className={`flex items-start space-x-3 p-4 rounded-xl font-medium border-2 animate-slide-down ${
                  error.includes('successful')
                    ? 'bg-green-500/10 border-green-500/50 text-green-300'
                    : 'bg-red-500/10 border-red-500/50 text-red-300'
                }`}>
                  {error.includes('successful') ? (
                    <CheckCircle size={22} className="flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={22} className="flex-shrink-0 mt-0.5" />
                  )}
                  <span className="text-sm leading-relaxed">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="relative w-full group overflow-hidden"
              >
                {/* Button Glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-purple-600 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>

                {/* Button Content */}
                <div className={`relative flex items-center justify-center space-x-3 px-6 py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                  loading
                    ? 'bg-gradient-to-r from-gray-600 to-gray-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-primary-500 via-purple-600 to-pink-600 hover:shadow-2xl hover:shadow-primary-500/50 active:scale-95 hover:scale-105'
                }`}>
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-3 border-white border-t-transparent"></div>
                      <span className="text-white">Processing...</span>
                    </>
                  ) : (
                    <>
                      {isLogin ? <LogIn size={22} className="text-white" /> : <UserPlus size={22} className="text-white" />}
                      <span className="text-white tracking-wide">{isLogin ? 'Sign In to AIFX' : 'Create Account'}</span>
                      <Sparkles size={18} className="text-yellow-300 animate-pulse" />
                    </>
                  )}
                </div>
              </button>
            </form>

            {isLogin && (
              <div className="mt-6 text-center">
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary-300 hover:text-primary-200 font-medium hover:underline transition-colors inline-flex items-center space-x-1"
                >
                  <Lock size={14} />
                  <span>Forgot password?</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Risk Disclaimer */}
        <div className="mt-8 backdrop-blur-xl bg-yellow-500/5 border-2 border-yellow-500/30 rounded-2xl p-5 hover:border-yellow-500/50 transition-colors">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="text-yellow-400 flex-shrink-0 mt-1 animate-pulse" size={24} />
            <div>
              <p className="font-bold text-yellow-300 mb-2 text-sm">⚠️ Risk Disclaimer</p>
              <p className="text-gray-300 text-xs leading-relaxed">
                Trading forex involves substantial risk of loss and is not suitable for all investors.
                This system provides <strong>advisory signals only</strong>, not financial advice.
                Always do your own research.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Stats */}
        <div className="mt-6 flex items-center justify-center space-x-6 text-gray-400 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>All Systems Operational</span>
          </div>
          <div className="flex items-center space-x-1">
            <Shield size={12} className="text-primary-400" />
            <span>256-bit Encryption</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
