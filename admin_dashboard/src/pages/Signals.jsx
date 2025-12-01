import { useState, useEffect } from 'react';
import { Header, Card, StatusBadge, Loading } from '../components/common';
import { adminService } from '../services/adminService';

const Signals = () => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ pair: '', direction: '', timeframe: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0 });
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'

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

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  // Format direction display
  const getDirectionInfo = (direction) => {
    if (direction === 'buy') {
      return { text: '買入', cn: 'BUY', color: 'bg-green-500', textColor: 'text-green-600', bgLight: 'bg-green-50' };
    } else if (direction === 'sell') {
      return { text: '賣出', cn: 'SELL', color: 'bg-red-500', textColor: 'text-red-600', bgLight: 'bg-red-50' };
    } else {
      return { text: '觀望', cn: 'HOLD', color: 'bg-gray-500', textColor: 'text-gray-600', bgLight: 'bg-gray-50' };
    }
  };

  // Format timeframe display
  const getTimeframeDisplay = (tf) => {
    const map = {
      '15min': '15分鐘',
      '30min': '30分鐘',
      '1h': '1小時',
      '4h': '4小時',
      '1d': '日線',
      '1hour': '1小時',
    };
    return map[tf] || tf;
  };

  return (
    <div>
      <Header title="訊號管理" />
      <div className="p-6">
        {/* 篩選器 */}
        <Card className="mb-6">
          <div className="flex gap-4 flex-wrap items-end">
            <div>
              <label className="block text-sm text-gray-600 mb-1">貨幣對</label>
              <select
                value={filter.pair}
                onChange={(e) => setFilter((f) => ({ ...f, pair: e.target.value }))}
                className="border rounded px-3 py-2 bg-white"
              >
                <option value="">全部</option>
                <option value="EUR/USD">EUR/USD</option>
                <option value="GBP/USD">GBP/USD</option>
                <option value="USD/JPY">USD/JPY</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">方向</label>
              <select
                value={filter.direction}
                onChange={(e) => setFilter((f) => ({ ...f, direction: e.target.value }))}
                className="border rounded px-3 py-2 bg-white"
              >
                <option value="">全部</option>
                <option value="buy">買入</option>
                <option value="sell">賣出</option>
                <option value="hold">觀望</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">時間週期</label>
              <select
                value={filter.timeframe}
                onChange={(e) => setFilter((f) => ({ ...f, timeframe: e.target.value }))}
                className="border rounded px-3 py-2 bg-white"
              >
                <option value="">全部</option>
                <option value="15min">15分鐘</option>
                <option value="1h">1小時</option>
                <option value="4h">4小時</option>
                <option value="1d">日線</option>
              </select>
            </div>
            <button
              onClick={() => setFilter({ pair: '', direction: '', timeframe: '' })}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 border rounded"
            >
              重置篩選
            </button>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setViewMode('card')}
                className={`px-3 py-2 rounded ${viewMode === 'card' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                卡片檢視
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 rounded ${viewMode === 'table' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                表格檢視
              </button>
            </div>
          </div>
        </Card>

        {/* 統計摘要 */}
        <div className="mb-6 text-gray-600">
          共 <span className="font-semibold text-gray-800">{pagination.total}</span> 個訊號
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loading size="lg" text="載入中..." />
          </div>
        ) : signals.length === 0 ? (
          <Card>
            <div className="text-center py-12 text-gray-500">
              暫無訊號資料
            </div>
          </Card>
        ) : viewMode === 'card' ? (
          /* 卡片檢視 */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {signals.map((signal) => {
              const dirInfo = getDirectionInfo(signal.direction);
              return (
                <div
                  key={signal.id}
                  className={`rounded-lg border shadow-sm overflow-hidden ${dirInfo.bgLight}`}
                >
                  {/* 頂部標題欄 */}
                  <div className={`${dirInfo.color} text-white px-4 py-3 flex justify-between items-center`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{signal.pair}</span>
                      <span className="text-sm opacity-90">({getTimeframeDisplay(signal.timeframe)})</span>
                    </div>
                    <span className="text-xl font-bold">{dirInfo.cn}</span>
                  </div>

                  {/* 主要資訊區 */}
                  <div className="p-4 bg-white">
                    {/* 信心度區塊 */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-500">信心度</span>
                        <span className={`text-lg font-bold ${dirInfo.textColor}`}>
                          {(signal.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`${dirInfo.color} h-2 rounded-full transition-all`}
                          style={{ width: `${signal.confidence * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* 價格資訊 */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-xs text-gray-500 mb-1">入場價</div>
                        <div className="font-semibold text-sm">
                          {signal.entryPrice ? parseFloat(signal.entryPrice).toFixed(5) : '-'}
                        </div>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded">
                        <div className="text-xs text-gray-500 mb-1">止損</div>
                        <div className="font-semibold text-sm text-red-600">
                          {signal.stopLoss ? parseFloat(signal.stopLoss).toFixed(5) : '-'}
                        </div>
                      </div>
                      <div className="text-center p-2 bg-green-50 rounded">
                        <div className="text-xs text-gray-500 mb-1">止盈</div>
                        <div className="font-semibold text-sm text-green-600">
                          {signal.takeProfit ? parseFloat(signal.takeProfit).toFixed(5) : '-'}
                        </div>
                      </div>
                    </div>

                    {/* 其他資訊 */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">信號強度：</span>
                        <span className="font-medium">{signal.signalStrength || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">市場狀態：</span>
                        <span className="font-medium">{signal.marketCondition || '-'}</span>
                      </div>
                    </div>

                    {/* 底部時間和狀態 */}
                    <div className="mt-4 pt-3 border-t flex justify-between items-center text-xs">
                      <span className="text-gray-400">
                        {new Date(signal.createdAt).toLocaleString('zh-TW')}
                      </span>
                      <StatusBadge status={signal.status || 'active'} size="sm" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 表格檢視 */
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">貨幣對</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">週期</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">方向</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">信心度</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">入場價</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">止損</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">止盈</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">建立時間</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {signals.map((signal) => {
                    const dirInfo = getDirectionInfo(signal.direction);
                    return (
                      <tr key={signal.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap font-medium">{signal.pair}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {getTimeframeDisplay(signal.timeframe)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded font-medium ${dirInfo.color} text-white`}>
                            {dirInfo.cn}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{(signal.confidence * 100).toFixed(0)}%</span>
                            <div className="w-16 bg-gray-200 rounded-full h-1.5">
                              <div className={`${dirInfo.color} h-1.5 rounded-full`} style={{ width: `${signal.confidence * 100}%` }}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {signal.entryPrice ? parseFloat(signal.entryPrice).toFixed(5) : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600">
                          {signal.stopLoss ? parseFloat(signal.stopLoss).toFixed(5) : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600">
                          {signal.takeProfit ? parseFloat(signal.takeProfit).toFixed(5) : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={signal.status || 'active'} size="sm" />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {new Date(signal.createdAt).toLocaleString('zh-TW')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* 分頁 */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => setPagination((p) => ({ ...p, page: 1 }))}
              disabled={pagination.page === 1}
              className="px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              首頁
            </button>
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              上一頁
            </button>
            <span className="px-4 py-2 bg-blue-50 text-blue-700 rounded font-medium">
              {pagination.page} / {totalPages}
            </span>
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page >= totalPages}
              className="px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              下一頁
            </button>
            <button
              onClick={() => setPagination((p) => ({ ...p, page: totalPages }))}
              disabled={pagination.page >= totalPages}
              className="px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              末頁
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Signals;
