import { useState, useEffect } from 'react';
import { Header, Card, Table, Loading, StatusBadge } from '../components/common';
import { adminService } from '../services/adminService';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  useEffect(() => {
    fetchUsers();
  }, [pagination.page]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await adminService.getUsers({
        page: pagination.page,
        limit: pagination.limit,
      });
      setUsers(res.data?.users || []);
      setPagination((prev) => ({ ...prev, total: res.data?.total || 0 }));
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'id', title: 'ID' },
    { key: 'username', title: '用戶名' },
    { key: 'email', title: 'Email' },
    {
      key: 'isActive',
      title: '狀態',
      render: (val) => (
        <StatusBadge status={val ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'createdAt',
      title: '註冊時間',
      render: (val) => new Date(val).toLocaleDateString('zh-TW'),
    },
    {
      key: 'actions',
      title: '操作',
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleToggleStatus(row)}
            className={`px-3 py-1 text-xs rounded ${
              row.isActive
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {row.isActive ? '停用' : '啟用'}
          </button>
        </div>
      ),
    },
  ];

  const handleToggleStatus = async (user) => {
    try {
      await adminService.updateUser(user.id, { isActive: !user.isActive });
      fetchUsers();
    } catch (err) {
      console.error('Failed to update user:', err);
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div>
      <Header title="用戶管理" />
      <div className="p-6">
        <Card>
          <div className="mb-4 flex justify-between items-center">
            <span className="text-gray-600">共 {pagination.total} 位用戶</span>
          </div>

          <Table columns={columns} data={users} loading={loading} emptyMessage="暫無用戶" />

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

export default Users;
