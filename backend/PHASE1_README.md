# Phase 1: Continuous Learning Infrastructure

## Overview

Phase 1 實現了持續學習系統的基礎設施，包括：

1. **數據庫基礎設施** - PostgreSQL 表和模型
2. **訓練數據導出服務** - 導出市場數據和標註的交易信號
3. **Redis 事件系統** - 實時事件發布/訂閱機制

---

## ✅ 已完成的組件

### 1. 數據庫遷移 (Migrations)

創建了 4 個新的數據庫表：

- **model_training_log** - 記錄所有訓練會話
- **model_versions** - 管理模型版本
- **model_ab_test** - A/B 測試管理
- **trading_signals 擴展** - 新增 `model_version` 和 `ab_test_id` 欄位

#### 運行遷移

```bash
cd /root/AIFX_v2/backend
npm run migrate
```

### 2. Sequelize 模型

創建了 3 個新模型：

- `src/models/ModelTrainingLog.js` - 訓練日誌模型
- `src/models/ModelVersion.js` - 模型版本模型
- `src/models/ModelABTest.js` - A/B 測試模型

### 3. 訓練數據導出服務

**文件**: `src/services/trainingDataExportService.js`

#### 功能

- ✅ 從 PostgreSQL 導出 OHLC 市場數據
- ✅ 導出帶標註的交易信號
- ✅ 自動標註（使用市場走勢）
- ✅ 生成 CSV 供 ML Engine 使用
- ✅ 支持時間範圍過濾

#### 使用示例

```javascript
const trainingDataExportService = require('./src/services/trainingDataExportService');

// 導出完整數據集
const result = await trainingDataExportService.exportCompleteDataset({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-21'),
  pairs: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
  timeframes: ['1h', '4h', '1d'],
  autoLabel: true,
  outputPath: '/tmp/training_data'
});

// 僅導出市場數據
const marketDataResult = await trainingDataExportService.exportMarketData({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-21'),
  pairs: ['EUR/USD'],
  timeframes: ['1h'],
  outputPath: '/tmp/market_data'
});

// 僅導出交易信號（帶自動標註）
const signalsResult = await trainingDataExportService.exportTradingSignals({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-21'),
  autoLabel: true,
  outputPath: '/tmp/signals'
});

// 獲取導出統計
const stats = await trainingDataExportService.getExportStatistics(
  new Date('2025-01-01'),
  new Date('2025-01-21')
);
```

#### 自動標註邏輯

服務使用以下邏輯自動標註未標註的信號：

- **BUY 信號**: 檢查價格是否上漲（close > entry）
- **SELL 信號**: 檢查價格是否下跌（close < entry）
- **HOLD 信號**: 檢查價格是否保持在 ±0.5% 範圍內

標註時間窗口根據 timeframe 自動調整：
- `1min` → 5 分鐘
- `5min` → 15 分鐘
- `15min` → 30 分鐘
- `30min` → 1 小時
- `1h` → 4 小時
- `4h` → 24 小時
- `1d` → 7 天
- `1w` → 30 天
- `1M` → 90 天

### 4. Redis 事件服務

**文件**: `src/services/redisEventService.js`

#### 支持的事件

- `ml:new_market_data` - 新市場數據
- `ml:new_prediction` - 新預測生成
- `ml:signal_outcome` - 信號結果確認
- `ml:training_started` - 訓練開始
- `ml:training_completed` - 訓練完成
- `ml:model_deployed` - 模型部署
- `ml:ab_test_created` - A/B 測試創建
- `ml:ab_test_completed` - A/B 測試完成

#### 使用示例

```javascript
const redisEventService = require('./src/services/redisEventService');

// 初始化
await redisEventService.initialize();

// 發布事件
await redisEventService.publishNewMarketData({
  pair: 'EUR/USD',
  timeframe: '1h',
  timestamp: new Date(),
  close: 1.0850,
  volume: 100000
});

await redisEventService.publishTrainingCompleted({
  id: 'training-123',
  status: 'completed',
  metrics: { accuracy: 0.92, loss: 0.08 },
  modelVersion: 'v1.0.1',
  trainingDuration: 120
});

// 訂閱事件
await redisEventService.subscribe(
  redisEventService.CHANNELS.NEW_MARKET_DATA,
  (event) => {
    console.log('New market data:', event.data);
  }
);

// 訂閱所有 ML 事件
await redisEventService.subscribeToAllMLEvents({
  onNewMarketData: (event) => {
    console.log('Market data:', event.data);
  },
  onSignalOutcome: (event) => {
    console.log('Signal outcome:', event.data);
  },
  onModelDeployed: (event) => {
    console.log('Model deployed:', event.data);
  }
});

// 獲取統計
const stats = redisEventService.getStatistics();

// 清理
await redisEventService.close();
```

---

## 🧪 測試

### 運行測試腳本

```bash
cd /root/AIFX_v2/backend

# 確保 Redis 和 PostgreSQL 正在運行
# 然後運行測試
node test-phase1-services.js
```

測試腳本將：
1. 測試訓練數據導出功能
2. 測試 Redis 事件發布/訂閱
3. 生成測試報告

---

## 📋 環境要求

### 必需的服務

- **PostgreSQL** (用於數據存儲)
- **Redis** (用於事件系統)

### 環境變量

在 `.env` 文件中配置：

```env
# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/aifx_v2

# Redis
REDIS_URL=redis://localhost:6379

# Node Environment
NODE_ENV=development
```

---

## 🔄 集成到現有系統

### 在市場數據收集時發布事件

```javascript
// src/services/marketDataCollectionService.js
const redisEventService = require('./redisEventService');

async function collectMarketData(pair, timeframe) {
  // ... 收集市場數據 ...

  // 發布事件
  await redisEventService.publishNewMarketData({
    pair,
    timeframe,
    timestamp: marketData.timestamp,
    close: marketData.close,
    volume: marketData.volume
  });
}
```

### 在生成預測時發布事件

```javascript
// src/services/tradingSignalService.js
const redisEventService = require('./redisEventService');

async function generateSignal(prediction) {
  const signal = await TradingSignal.create(prediction);

  // 發布事件
  await redisEventService.publishNewPrediction({
    id: signal.id,
    pair: signal.pair,
    timeframe: signal.timeframe,
    signal: signal.signal,
    confidence: signal.confidence,
    modelVersion: signal.modelVersion
  });

  return signal;
}
```

### 在確認信號結果時發布事件

```javascript
// src/services/signalMonitoringService.js
const redisEventService = require('./redisEventService');

async function confirmSignalOutcome(signalId, outcome, pnlPercent) {
  const signal = await TradingSignal.findByPk(signalId);
  await signal.updateOutcome(outcome, null, pnlPercent);

  // 發布事件
  await redisEventService.publishSignalOutcome({
    id: signal.id,
    pair: signal.pair,
    timeframe: signal.timeframe,
    signal: signal.signal,
    actualOutcome: outcome,
    actualPnLPercent: pnlPercent,
    confidence: signal.confidence
  });
}
```

---

## 📦 導出的數據格式

### 市場數據 CSV

```csv
timestamp,pair,timeframe,open,high,low,close,volume,technical_indicators,source,market_state
2025-01-21T10:00:00.000Z,EUR/USD,1h,1.0845,1.0860,1.0840,1.0850,125000,"{\"sma_20\":1.0848}",alpha_vantage,open
```

### 交易信號 CSV

```csv
timestamp,pair,timeframe,signal,confidence,entry_price,stop_loss,take_profit,technical_factor,sentiment_factor,pattern_factor,actual_outcome,actual_pnl_percent,auto_labeled,source,signal_strength,market_condition
2025-01-21T10:05:00.000Z,EUR/USD,1h,buy,0.85,1.0850,1.0830,1.0880,0.75,0.60,0.82,win,2.50,true,ml_engine,strong,trending
```

---

## 🚀 下一步（Phase 2）

Phase 1 完成後，下一步將實現：

1. **每日增量訓練腳本** (`ml_engine/scripts/daily_training.py`)
2. **Cron 作業設置** (每日 UTC 01:00)
3. **訓練日誌記錄**
4. **模型版本管理**

---

## 📝 注意事項

1. **自動標註的準確性**: 自動標註基於簡單的價格移動邏輯，可能不如實際交易結果準確。建議在有實際交易數據時優先使用實際結果。

2. **時間窗口調整**: 可以根據實際需求調整 `calculateTimeWindow()` 中的時間窗口大小。

3. **Redis 連接管理**: 在生產環境中，建議在應用啟動時初始化 Redis 事件服務，並在關閉時正確清理連接。

4. **導出性能**: 大量數據導出可能需要較長時間，建議在低峰時段執行或使用後台任務。

---

## 📞 問題反饋

如有問題，請查看日誌或聯繫開發團隊。

**日誌位置**: `logs/combined.log`

**關鍵日誌標籤**:
- `[TrainingDataExport]`
- `[RedisEvent]`
- `[ModelTraining]`
