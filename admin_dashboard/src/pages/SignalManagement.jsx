import { useState, useEffect } from 'react';
import { Header, Card, Table, Loading } from '../components/common';
import { adminService } from '../services/adminService';

const SignalManagement = () => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({ pair: '', direction: '', dateFrom: '', dateTo: '' });

  useEffect(() => {
    fetchSignals();
  }, [pagination.page, filters]);

  const fetchSignals = async () => {
    setLoading(true);
    try {
      const res = await adminService.getSignals({
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      });
      setSignals(res.data?.signals || []);
      setPagination((prev) => ({
        ...prev,
        total: res.data?.pagination?.total || 0,
      }));
    } catch (err) {
      console.error('Fetch signals error:', err);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'id', title: 'ID' },
    { key: 'pair', title: '貨幣對' },
    {
      key: 'direction',
      title: '方向',
      render: (value) => (
        <span
          className={`px-2 py-1 rounded text-sm ${
            value === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {value === 'buy' ? '買入' : '賣出'}
        </span>
      ),
    },
    {
      key: 'confidence',
      title: '信心度',
      render: (value) => (
        <div className="flex items-center gap-2">
          <div className="w-20 bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 rounded-full h-2"
              style={{ width: `${value * 100}%` }}
            ></div>
          </div>
          <span>{(value * 100).toFixed(0)}%</span>
        </div>
      ),
    },
    { key: 'entryPrice', title: '入場價格' },
    { key: 'stopLoss', title: '止損' },
    { key: 'takeProfit', title: '止盈' },
    {
      key: 'createdAt',
      title: '建立時間',
      render: (value) => new Date(value).toLocaleString('zh-TW'),
    },
    {
      key: 'actions',
      title: '操作',
      render: (_, row) => (
        <button
          onClick={() => handleViewDetail(row)}
          className="text-blue-600 hover:underline text-sm"
        >
          詳情
        </button>
      ),
    },
  ];

  const handleViewDetail = (signal) => {
    alert(`訊號詳情:\n${JSON.stringify(signal, null, 2)}`);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div>
      <Header title="訊號管理" />

      <div className="p-6 space-y-6">
        {/* 篩選器 */}
        <Card>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">貨幣對</label>
              <select
                value={filters.pair}
                onChange={(e) => handleFilterChange('pair', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">全部</option>
                <option value="EUR/USD">EUR/USD</option>
                <option value="GBP/USD">GBP/USD</option>
                <option value="USD/JPY">USD/JPY</option>
                <option value="AUD/USD">AUD/USD</option>
                <option value="USD/CHF">USD/CHF</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">方向</label>
              <select
                value={filters.direction}
                onChange={(e) => handleFilterChange('direction', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">全部</option>
                <option value="buy">買入</option>
                <option value="sell">賣出</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">開始日期</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">結束日期</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ pair: '', direction: '', dateFrom: '', dateTo: '' });
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                清除篩選
              </button>
            </div>
          </div>
        </Card>

        {/* 統計資訊 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <p className="text-gray-500 text-sm">總訊號數</p>
            <p className="text-2xl font-bold">{pagination.total}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <p className="text-gray-500 text-sm">買入訊號</p>
            <p className="text-2xl font-bold text-green-600">
              {signals.filter((s) => s.direction === 'buy').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <p className="text-gray-500 text-sm">賣出訊號</p>
            <p className="text-2xl font-bold text-red-600">
              {signals.filter((s) => s.direction === 'sell').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <p className="text-gray-500 text-sm">平均信心度</p>
            <p className="text-2xl font-bold">
              {signals.length > 0
                ? (signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length * 100).toFixed(0)
                : 0}%
            </p>
          </div>
        </div>

        {/* 訊號列表 */}
        <Card title="訊號列表">
          <Table columns={columns} data={signals} loading={loading} emptyMessage="沒有符合條件的訊號" />

          {/* 分頁 */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <span className="text-sm text-gray-500">
                共 {pagination.total} 筆，第 {pagination.page} / {totalPages} 頁
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一頁
                </button>
                <button
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= totalPages}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一頁
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SignalManagement;
