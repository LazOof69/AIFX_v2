import { useState, useEffect } from 'react';
import { Header, Card, Table, StatusBadge, Loading } from '../components/common';
import { adminService } from '../services/adminService';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [pagination.page]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await adminService.getUsers({
        page: pagination.page,
        limit: pagination.limit,
        search,
      });
      setUsers(res.data?.users || []);
      setPagination((prev) => ({
        ...prev,
        total: res.data?.pagination?.total || 0,
      }));
    } catch (err) {
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchUsers();
  };

  const handleToggleStatus = async (user) => {
    if (!confirm(`確定要${user.isActive ? '停用' : '啟用'}用戶 ${user.email}?`)) {
      return;
    }

    try {
      await adminService.updateUser(user.id, { isActive: !user.isActive });
      fetchUsers();
    } catch (err) {
      alert('操作失敗: ' + err.message);
    }
  };

  const columns = [
    { key: 'id', title: 'ID' },
    {
      key: 'email',
      title: 'Email',
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          {row.username && <div className="text-sm text-gray-500">@{row.username}</div>}
        </div>
      ),
    },
    {
      key: 'subscriptionTier',
      title: '訂閱方案',
      render: (value) => (
        <span
          className={`px-2 py-1 rounded text-sm ${
            value === 'premium'
              ? 'bg-purple-100 text-purple-800'
              : value === 'pro'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {value || 'free'}
        </span>
      ),
    },
    {
      key: 'isActive',
      title: '狀態',
      render: (value) => <StatusBadge status={value ? 'active' : 'offline'} size="sm" />,
    },
    {
      key: 'discordId',
      title: 'Discord',
      render: (value) => (value ? <span className="text-green-600">已綁定</span> : <span className="text-gray-400">未綁定</span>),
    },
    {
      key: 'createdAt',
      title: '註冊時間',
      render: (value) => new Date(value).toLocaleDateString('zh-TW'),
    },
    {
      key: 'lastLogin',
      title: '最後登入',
      render: (value) => (value ? new Date(value).toLocaleString('zh-TW') : '-'),
    },
    {
      key: 'actions',
      title: '操作',
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedUser(row)}
            className="text-blue-600 hover:underline text-sm"
          >
            詳情
          </button>
          <button
            onClick={() => handleToggleStatus(row)}
            className={`text-sm ${row.isActive ? 'text-red-600' : 'text-green-600'} hover:underline`}
          >
            {row.isActive ? '停用' : '啟用'}
          </button>
        </div>
      ),
    },
  ];

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div>
      <Header title="用戶管理" />

      <div className="p-6 space-y-6">
        {/* 搜尋和統計 */}
        <div className="flex flex-wrap gap-4 justify-between">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋 email 或 username..."
              className="px-4 py-2 border border-gray-300 rounded-lg w-64 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              搜尋
            </button>
          </form>

          <div className="flex gap-4">
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border">
              <span className="text-gray-500 text-sm">總用戶: </span>
              <span className="font-bold">{pagination.total}</span>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border">
              <span className="text-gray-500 text-sm">活躍用戶: </span>
              <span className="font-bold text-green-600">
                {users.filter((u) => u.isActive).length}
              </span>
            </div>
          </div>
        </div>

        {/* 用戶列表 */}
        <Card>
          <Table columns={columns} data={users} loading={loading} emptyMessage="沒有找到用戶" />

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
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  上一頁
                </button>
                <button
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= totalPages}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  下一頁
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* 用戶詳情彈窗 */}
        {selectedUser && (
          <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
        )}
      </div>
    </div>
  );
};

// 用戶詳情彈窗
const UserDetailModal = ({ user, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-medium">用戶詳情</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500">ID</label>
              <p className="font-medium">{user.id}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">狀態</label>
              <p><StatusBadge status={user.isActive ? 'active' : 'offline'} size="sm" /></p>
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-500">Email</label>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Username</label>
              <p className="font-medium">{user.username || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">訂閱方案</label>
              <p className="font-medium">{user.subscriptionTier || 'free'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Discord ID</label>
              <p className="font-medium">{user.discordId || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Discord 用戶名</label>
              <p className="font-medium">{user.discordUsername || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">註冊時間</label>
              <p className="font-medium">{new Date(user.createdAt).toLocaleString('zh-TW')}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">最後登入</label>
              <p className="font-medium">
                {user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-TW') : '-'}
              </p>
            </div>
          </div>

          {user.preferences && (
            <div>
              <label className="text-sm text-gray-500">用戶偏好</label>
              <pre className="mt-1 p-3 bg-gray-50 rounded text-sm overflow-auto">
                {JSON.stringify(user.preferences, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <div className="flex justify-end p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
