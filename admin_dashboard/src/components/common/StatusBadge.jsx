const StatusBadge = ({ status, size = 'md' }) => {
  const statusConfig = {
    healthy: { bg: 'bg-green-100', text: 'text-green-800', label: '正常' },
    online: { bg: 'bg-green-100', text: 'text-green-800', label: '在線' },
    active: { bg: 'bg-green-100', text: 'text-green-800', label: '活躍' },
    connected: { bg: 'bg-green-100', text: 'text-green-800', label: '已連接' },

    warning: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '警告' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '待處理' },

    error: { bg: 'bg-red-100', text: 'text-red-800', label: '錯誤' },
    offline: { bg: 'bg-red-100', text: 'text-red-800', label: '離線' },
    disconnected: { bg: 'bg-red-100', text: 'text-red-800', label: '已斷開' },

    unknown: { bg: 'bg-gray-100', text: 'text-gray-800', label: '未知' },
  };

  const config = statusConfig[status] || statusConfig.unknown;
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.text} ${sizeClass}`}>
      <span className={`w-2 h-2 rounded-full mr-2 ${config.text.replace('text', 'bg')}`}></span>
      {config.label}
    </span>
  );
};

export default StatusBadge;
