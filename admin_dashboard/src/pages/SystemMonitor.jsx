import { useState, useEffect } from 'react';
import { Header, Card, StatusBadge, Loading } from '../components/common';
import { adminService } from '../services/adminService';

const SystemMonitor = () => {
  const [health, setHealth] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchData();
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchData, 10000); // 10秒刷新
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchData = async () => {
    try {
      const healthRes = await adminService.getSystemHealth();
      setHealth(healthRes.data);
      // 模擬日誌資料（實際應從 API 取得）
      setLogs(generateMockLogs());
    } catch (err) {
      console.error('System monitor error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div>
      <Header title="系統監控" />

      <div className="p-6 space-y-6">
        {/* 控制列 */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-600">自動刷新 (10秒)</span>
            </label>
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            手動刷新
          </button>
        </div>

        {/* 服務狀態詳情 */}
        <Card title="服務狀態詳情">
          <div className="space-y-4">
            <ServiceDetail
              name="Backend API"
              status={health?.services?.backend || 'unknown'}
              details={{
                port: 3000,
                uptime: health?.uptime,
                version: health?.version,
              }}
            />
            <ServiceDetail
              name="PostgreSQL"
              status={health?.services?.postgres || 'unknown'}
              details={{
                host: 'localhost',
                port: 5432,
                database: 'aifx',
              }}
            />
            <ServiceDetail
              name="Redis"
              status={health?.services?.redis || 'unknown'}
              details={{
                host: 'localhost',
                port: 6379,
              }}
            />
            <ServiceDetail
              name="ML Engine"
              status={health?.services?.mlEngine || 'unknown'}
              details={{
                host: 'localhost',
                port: 8000,
              }}
            />
          </div>
        </Card>

        {/* 系統資源 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="記憶體使用">
            <MemoryChart memory={health?.memory} />
          </Card>
          <Card title="CPU 使用">
            <CPUChart cpu={health?.cpu} />
          </Card>
        </div>

        {/* 系統日誌 */}
        <Card title="最近日誌">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log, index) => (
              <LogEntry key={index} log={log} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

// 服務詳情組件
const ServiceDetail = ({ name, status, details }) => {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-4">
        <StatusBadge status={status} />
        <div>
          <h4 className="font-medium">{name}</h4>
          <div className="text-sm text-gray-500">
            {Object.entries(details).map(([key, value]) => (
              <span key={key} className="mr-4">
                {key}: {formatValue(value)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// 記憶體圖表組件
const MemoryChart = ({ memory }) => {
  const used = memory?.heapUsed || 0;
  const total = memory?.heapTotal || 1;
  const percentage = Math.round((used / total) * 100);

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm">
        <span>已使用: {formatBytes(used)}</span>
        <span>總計: {formatBytes(total)}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4">
        <div
          className={`h-4 rounded-full transition-all ${
            percentage > 80 ? 'bg-red-500' : percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <div className="text-center text-2xl font-bold">{percentage}%</div>
    </div>
  );
};

// CPU 圖表組件
const CPUChart = ({ cpu }) => {
  const usage = cpu?.usage || 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm">
        <span>CPU 核心: {cpu?.cores || 'N/A'}</span>
        <span>負載: {cpu?.loadAvg?.join(', ') || 'N/A'}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4">
        <div
          className={`h-4 rounded-full transition-all ${
            usage > 80 ? 'bg-red-500' : usage > 60 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${usage}%` }}
        ></div>
      </div>
      <div className="text-center text-2xl font-bold">{usage}%</div>
    </div>
  );
};

// 日誌條目組件
const LogEntry = ({ log }) => {
  const levelColors = {
    error: 'bg-red-100 text-red-800',
    warn: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800',
    debug: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded">
      <span className={`px-2 py-0.5 text-xs rounded ${levelColors[log.level] || levelColors.info}`}>
        {log.level.toUpperCase()}
      </span>
      <span className="text-xs text-gray-400 whitespace-nowrap">{log.timestamp}</span>
      <span className="text-sm text-gray-700 flex-1">{log.message}</span>
    </div>
  );
};

// 輔助函數
const formatValue = (value) => {
  if (typeof value === 'number' && value > 1000) {
    return formatUptime(value);
  }
  return value ?? 'N/A';
};

const formatUptime = (seconds) => {
  if (!seconds) return 'N/A';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
};

// 模擬日誌生成
const generateMockLogs = () => {
  const levels = ['info', 'info', 'info', 'warn', 'error'];
  const messages = [
    '系統健康檢查完成',
    '新用戶註冊: user@example.com',
    '訊號產生: EUR/USD BUY',
    'Redis 連接重建',
    'API 請求超時',
    'ML 預測完成: confidence 0.85',
    '資料庫查詢: 15ms',
  ];

  return Array.from({ length: 10 }, (_, i) => ({
    level: levels[Math.floor(Math.random() * levels.length)],
    timestamp: new Date(Date.now() - i * 60000).toLocaleTimeString('zh-TW'),
    message: messages[Math.floor(Math.random() * messages.length)],
  }));
};

export default SystemMonitor;
