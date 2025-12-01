import { useState, useEffect } from 'react';
import { Header, Card, StatCard, StatusBadge, Loading } from '../components/common';
import { adminService } from '../services/adminService';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const Dashboard = () => {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentSignals, setRecentSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    // 每 30 秒自動刷新
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [healthRes, statsRes, signalsRes] = await Promise.all([
        adminService.getSystemHealth(),
        adminService.getStats(),
        adminService.getSignals({ limit: 5 }),
      ]);

      setHealth(healthRes.data);
      setStats(statsRes.data);
      setRecentSignals(signalsRes.data?.signals || []);
      setError(null);
    } catch (err) {
      setError('無法載入資料，請稍後再試');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" text="載入中..." />
      </div>
    );
  }

  // Mock chart data (實際應從 API 取得)
  const signalChartData = [
    { date: '12/01', count: 5 },
    { date: '12/02', count: 8 },
    { date: '12/03', count: 6 },
    { date: '12/04', count: 12 },
    { date: '12/05', count: 9 },
    { date: '12/06', count: 15 },
    { date: '12/07', count: 11 },
  ];

  return (
    <div>
      <Header title="系統總覽" />

      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* 系統狀態卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="系統狀態"
            value={health?.status === 'healthy' ? '正常' : '異常'}
            icon={health?.status === 'healthy' ? '✅' : '❌'}
          />
          <StatCard
            title="總用戶數"
            value={stats?.users?.total || 0}
            icon="👥"
            trend={stats?.users?.newToday ? `+${stats.users.newToday} 今日` : null}
            trendUp={true}
          />
          <StatCard
            title="今日訊號"
            value={stats?.signals?.today || 0}
            icon="📈"
          />
          <StatCard
            title="ML 模型"
            value={stats?.models?.active || 0}
            icon="🤖"
          />
        </div>

        {/* 服務狀態 */}
        <Card title="服務狀態">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ServiceStatus
              name="Backend API"
              status={health?.services?.backend || 'unknown'}
            />
            <ServiceStatus
              name="PostgreSQL"
              status={health?.services?.postgres || 'unknown'}
            />
            <ServiceStatus
              name="Redis"
              status={health?.services?.redis || 'unknown'}
            />
            <ServiceStatus
              name="ML Engine"
              status={health?.services?.mlEngine || 'unknown'}
            />
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 訊號趨勢圖 */}
          <Card title="訊號趨勢 (近7天)">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={signalChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3B82F6"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 最近訊號 */}
          <Card title="最近訊號">
            {recentSignals.length === 0 ? (
              <p className="text-gray-500 text-center py-4">暫無訊號</p>
            ) : (
              <div className="space-y-3">
                {recentSignals.map((signal) => (
                  <div
                    key={signal.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <span className="font-medium">{signal.pair}</span>
                      <span
                        className={`ml-2 px-2 py-0.5 text-xs rounded ${
                          signal.direction === 'buy'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {signal.direction === 'buy' ? '買入' : '賣出'}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">
                        信心度: {(signal.confidence * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(signal.createdAt).toLocaleString('zh-TW')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* 系統資訊 */}
        <Card title="系統資訊">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">運行時間</span>
              <p className="font-medium">{formatUptime(health?.uptime)}</p>
            </div>
            <div>
              <span className="text-gray-500">記憶體使用</span>
              <p className="font-medium">{formatMemory(health?.memory)}</p>
            </div>
            <div>
              <span className="text-gray-500">版本</span>
              <p className="font-medium">{health?.version || 'N/A'}</p>
            </div>
            <div>
              <span className="text-gray-500">環境</span>
              <p className="font-medium">{health?.environment || 'N/A'}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// 服務狀態組件
const ServiceStatus = ({ name, status }) => {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <span className="text-sm text-gray-600">{name}</span>
      <StatusBadge status={status} size="sm" />
    </div>
  );
};

// 格式化運行時間
const formatUptime = (seconds) => {
  if (!seconds) return 'N/A';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}天 ${hours}小時`;
  if (hours > 0) return `${hours}小時 ${minutes}分`;
  return `${minutes}分鐘`;
};

// 格式化記憶體
const formatMemory = (bytes) => {
  if (!bytes) return 'N/A';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
};

export default Dashboard;
