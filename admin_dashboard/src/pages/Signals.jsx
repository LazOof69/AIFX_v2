import { useState, useEffect } from 'react';
import { Header, Card, Table, StatusBadge } from '../components/common';
import { adminService } from '../services/adminService';

const Signals = () => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ pair: '', direction: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  useEffect(() => {
    fetchSignals();
  }, [pagination.page, filter]);

  const fetchSignals = async () => {
    setLoading(true);
    try {
      const res = await adminService.getSignals({
        page: pagination.page,
        limit: pagination.limit,
        ...filter,
      });
      setSignals(res.data?.signals || []);
      setPagination((prev) => ({ ...prev, total: res.data?.total || 0 }));
    } catch (err) {
      console.error('Failed to fetch signals:', err);
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
      render: (val) => (
        <span
          className={`px-2 py-1 text-xs rounded font-medium ${
            val === 'buy'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {val === 'buy' ? '買入' : '賣出'}
        </span>
      ),
    },
    {
      key: 'confidence',
      title: '信心度',
      render: (val) => `${(val * 100).toFixed(1)}%`,
    },
    { key: 'entryPrice', title: '入場價' },
    { key: 'stopLoss', title: '止損' },
    { key: 'takeProfit', title: '止盈' },
    {
      key: 'status',
      title: '狀態',
      render: (val) => <StatusBadge status={val || 'active'} />,
    },
    {
      key: 'createdAt',
      title: '建立時間',
      render: (val) => new Date(val).toLocaleString('zh-TW'),
    },
  ];

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div>
      <Header title="訊號管理" />
      <div className="p-6">
        {/* 篩選器 */}
        <Card className="mb-6">
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm text-gray-600 mb-1">貨幣對</label>
              <select
                value={filter.pair}
                onChange={(e) => setFilter((f) => ({ ...f, pair: e.target.value }))}
                className="border rounded px-3 py-2"
              >
                <option value="">全部</option>
                <option value="EUR/USD">EUR/USD</option>
                <option value="GBP/USD">GBP/USD</option>
                <option value="USD/JPY">USD/JPY</option>
                <option value="AUD/USD">AUD/USD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">方向</label>
              <select
                value={filter.direction}
                onChange={(e) => setFilter((f) => ({ ...f, direction: e.target.value }))}
                className="border rounded px-3 py-2"
              >
                <option value="">全部</option>
                <option value="buy">買入</option>
                <option value="sell">賣出</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilter({ pair: '', direction: '' })}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                重置
              </button>
            </div>
          </div>
        </Card>

        {/* 訊號列表 */}
        <Card>
          <div className="mb-4">
            <span className="text-gray-600">共 {pagination.total} 個訊號</span>
          </div>

          <Table columns={columns} data={signals} loading={loading} emptyMessage="暫無訊號" />

          {/* 分頁 */}
          {totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                上一頁
              </button>
              <span className="px-3 py-1">
                {pagination.page} / {totalPages}
              </span>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                下一頁
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Signals;
