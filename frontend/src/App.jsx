import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import TradingView from './components/TradingView';
import Settings from './components/Settings';
import MarketOverview from './components/MarketOverview';
import { initializeSocket, disconnectSocket } from './services/socket';

/**
 * Protected Route component
 */
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('accessToken');
  return token ? children : <Navigate to="/login" replace />;
};

/**
 * Main App component with routing
 */
function App() {
  useEffect(() => {
    // Initialize socket connection if user is authenticated
    const token = localStorage.getItem('accessToken');
    if (token) {
      initializeSocket();
    }

    // Cleanup on unmount
    return () => {
      disconnectSocket();
    };
  }, []);

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trading"
          element={
            <ProtectedRoute>
              <TradingView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trading/:pair"
          element={
            <ProtectedRoute>
              <TradingView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/market"
          element={
            <ProtectedRoute>
              <MarketOverview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Default Route */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;