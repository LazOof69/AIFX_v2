import { useState, useEffect } from 'react';
import { Header, Card, StatusBadge, Loading } from '../components/common';
import { adminService } from '../services/adminService';

const MLModels = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trainingStatus, setTrainingStatus] = useState(null);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await adminService.getMLModels();
      setModels(res.data?.models || []);
    } catch (err) {
      console.error('Fetch models error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerTraining = async (modelType) => {
    if (!confirm(`確定要開始訓練 ${modelType} 模型嗎？這可能需要一些時間。`)) {
      return;
    }

    try {
      setTrainingStatus({ modelType, status: 'starting' });
      await adminService.triggerTraining(modelType);
      setTrainingStatus({ modelType, status: 'training' });
      // 模擬訓練進度
      setTimeout(() => {
        setTrainingStatus(null);
        fetchModels();
      }, 5000);
    } catch (err) {
      alert('訓練啟動失敗: ' + err.message);
      setTrainingStatus(null);
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
      <Header title="ML 模型管理" />

      <div className="p-6 space-y-6">
        {/* 訓練狀態提示 */}
        {trainingStatus && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-blue-700">
              正在訓練 {trainingStatus.modelType} 模型...
            </span>
          </div>
        )}

        {/* 模型列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {models.length > 0 ? (
            models.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                onTrain={() => handleTriggerTraining(model.type)}
                isTraining={trainingStatus?.modelType === model.type}
              />
            ))
          ) : (
            <Card className="col-span-2">
              <div className="text-center py-8 text-gray-500">
                暫無模型資料。請確認 ML Engine 是否正常運行。
              </div>
            </Card>
          )}
        </div>

        {/* ML Engine 狀態 */}
        <Card title="ML Engine 狀態">
          <MLEngineStatus />
        </Card>

        {/* 訓練歷史 */}
        <Card title="訓練歷史">
          <TrainingHistory />
        </Card>
      </div>
    </div>
  );
};

// 模型卡片組件
const ModelCard = ({ model, onTrain, isTraining }) => {
  return (
    <Card>
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-medium">{model.name || model.type}</h3>
            <p className="text-sm text-gray-500">{model.description || '機器學習模型'}</p>
          </div>
          <StatusBadge status={model.status || 'active'} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">版本</span>
            <p className="font-medium">{model.version || 'v1.0'}</p>
          </div>
          <div>
            <span className="text-gray-500">準確率</span>
            <p className="font-medium">{model.accuracy ? `${(model.accuracy * 100).toFixed(1)}%` : 'N/A'}</p>
          </div>
          <div>
            <span className="text-gray-500">最後訓練</span>
            <p className="font-medium">
              {model.lastTrained ? new Date(model.lastTrained).toLocaleDateString('zh-TW') : 'N/A'}
            </p>
          </div>
          <div>
            <span className="text-gray-500">訓練樣本數</span>
            <p className="font-medium">{model.trainingSamples?.toLocaleString() || 'N/A'}</p>
          </div>
        </div>

        {/* 效能指標 */}
        {model.metrics && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">效能指標</h4>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 block">Precision</span>
                <span className="font-medium">{(model.metrics.precision * 100).toFixed(1)}%</span>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 block">Recall</span>
                <span className="font-medium">{(model.metrics.recall * 100).toFixed(1)}%</span>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 block">F1 Score</span>
                <span className="font-medium">{(model.metrics.f1 * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onTrain}
            disabled={isTraining}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTraining ? '訓練中...' : '重新訓練'}
          </button>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            查看詳情
          </button>
        </div>
      </div>
    </Card>
  );
};

// ML Engine 狀態組件
const MLEngineStatus = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await adminService.getMLEngineStatus();
        setStatus(res.data);
      } catch (err) {
        setStatus({ status: 'offline' });
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, []);

  if (loading) return <Loading size="sm" />;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-3 bg-gray-50 rounded-lg">
        <span className="text-sm text-gray-500 block">狀態</span>
        <StatusBadge status={status?.status || 'offline'} size="sm" />
      </div>
      <div className="p-3 bg-gray-50 rounded-lg">
        <span className="text-sm text-gray-500 block">運行時間</span>
        <span className="font-medium">{formatUptime(status?.uptime)}</span>
      </div>
      <div className="p-3 bg-gray-50 rounded-lg">
        <span className="text-sm text-gray-500 block">預測次數</span>
        <span className="font-medium">{status?.predictionCount?.toLocaleString() || 0}</span>
      </div>
      <div className="p-3 bg-gray-50 rounded-lg">
        <span className="text-sm text-gray-500 block">平均延遲</span>
        <span className="font-medium">{status?.avgLatency ? `${status.avgLatency}ms` : 'N/A'}</span>
      </div>
    </div>
  );
};

// 訓練歷史組件
const TrainingHistory = () => {
  // 模擬訓練歷史資料
  const history = [
    { id: 1, model: 'LSTM', status: 'completed', accuracy: 0.82, duration: '15m', date: '2024-12-01' },
    { id: 2, model: 'Random Forest', status: 'completed', accuracy: 0.78, duration: '8m', date: '2024-11-28' },
    { id: 3, model: 'Sentiment', status: 'completed', accuracy: 0.75, duration: '5m', date: '2024-11-25' },
  ];

  return (
    <div className="space-y-3">
      {history.map((item) => (
        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <StatusBadge status={item.status === 'completed' ? 'healthy' : 'pending'} size="sm" />
            <div>
              <span className="font-medium">{item.model}</span>
              <span className="text-sm text-gray-500 ml-2">準確率: {(item.accuracy * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div>{item.date}</div>
            <div>耗時: {item.duration}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const formatUptime = (seconds) => {
  if (!seconds) return 'N/A';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

export default MLModels;
