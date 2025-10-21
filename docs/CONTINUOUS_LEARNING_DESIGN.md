# AIFX v2 持續學習系統設計 (Continuous Learning System Design)

**創建時間**: 2025-10-21
**狀態**: 設計階段 → 待實現
**優先級**: 🔥 **極高**

---

## 📋 目錄

1. [核心問題分析](#核心問題分析)
2. [當前系統架構](#當前系統架構)
3. [持續學習策略對比](#持續學習策略對比)
4. [推薦方案：混合式持續訓練](#推薦方案混合式持續訓練)
5. [數據流架構](#數據流架構)
6. [實現計劃](#實現計劃)
7. [技術細節](#技術細節)
8. [風險管理](#風險管理)

---

## 🎯 核心問題分析

### 你的洞察：「我們的這個專案不應該是時時更新訓練嗎」

**你完全正確！** 這是一個 Production-level ML 系統應該具備的核心能力。

### 當前系統的問題

```
❌ 問題 1: 靜態模型 (Static Model)
   - v3.2 模型訓練於 2025-10-14
   - 數據截止於訓練時間
   - 無法適應新的市場條件

❌ 問題 2: 模型漂移 (Model Drift)
   - 金融市場不斷變化
   - 模型預測準確度會隨時間下降
   - 目前 v3.2 對所有市場條件都預測 "hold" (99.6%)

❌ 問題 3: 缺少反饋循環 (No Feedback Loop)
   - 系統每天產生新的市場數據
   - 預測結果沒有被用於重新訓練
   - 用戶的實際交易結果沒有回饋到模型

❌ 問題 4: 手動訓練流程
   - 需要手動運行訓練腳本
   - 需要手動部署新模型
   - 沒有自動化的 MLOps pipeline
```

---

## 🏗️ 當前系統架構

### 數據流 (Current Data Flow)

```
┌─────────────────────────────────────────────────────────────┐
│                    當前系統 (Current)                        │
└─────────────────────────────────────────────────────────────┘

1️⃣  數據收集 (Data Collection)
    ┌──────────────────┐
    │ yfinance API     │ → CSV 檔案 (一次性)
    │ EUR/USD, USD/JPY │   /ml_engine/data/intraday/
    └──────────────────┘
              ↓
2️⃣  手動訓練 (Manual Training - 一次性)
    ┌───────────────────────────────────┐
    │ python train_reversal_mode1.py    │ → 模型 v3.2
    │ - 使用 CSV 歷史數據              │   (2025-10-14 訓練)
    │ - 訓練一次後就固定               │
    └───────────────────────────────────┘
              ↓
3️⃣  生產預測 (Production Prediction - 持續)
    ┌────────────────────────────────────┐
    │ Backend Signal Monitoring Service  │
    │ - 每 15 分鐘檢查一次              │
    │ - 呼叫 ML API 取得預測            │
    │ - 保存到 PostgreSQL               │
    └────────────────────────────────────┘
              ↓
    ┌────────────────────────────────────┐
    │ PostgreSQL Database                │
    │ - market_data: 市場數據            │
    │ - trading_signals: 預測信號        │
    │ - user_trading_history: 實際結果   │
    └────────────────────────────────────┘
              ↓
    ⚠️  數據累積但從未用於重新訓練！
```

### 模型版本管理 (Model Versioning)

```python
# ml_engine/api/model_manager.py

class ModelManager:
    versions = {
        'v3.0': 原始擺動點檢測模型
        'v3.1': 盈利邏輯模型 (79% recall)
        'v3.2': 真實 yfinance 數據模型 (38 features) ← 目前使用
    }

    active_version = 'v3.2'  # 固定不變！
```

**問題**: 沒有自動生成新版本 (v3.3, v3.4...) 的機制。

---

## 🔄 持續學習策略對比

### 選項 1: 實時學習 (Online Learning)

```
概念: 每次收到新數據就立即更新模型

優點:
✅ 即時適應市場變化
✅ 不需要重新訓練整個模型

缺點:
❌ 容易過擬合最近數據
❌ 難以應用於深度學習模型 (LSTM)
❌ 計算資源需求高
❌ 穩定性風險高
```

**結論**: ❌ 不適合 AIFX v2 (使用 LSTM 深度學習)

---

### 選項 2: 定期批次重訓練 (Scheduled Batch Retraining)

```
概念: 每隔固定時間 (如每週) 使用累積的新數據重新訓練模型

優點:
✅ 適合深度學習模型
✅ 可以充分利用歷史數據
✅ 穩定性高
✅ 可以進行 A/B testing

缺點:
⚠️  需要自動化 pipeline
⚠️  訓練時間較長
⚠️  需要模型版本管理
```

**結論**: ✅ **推薦** - 適合 AIFX v2

---

### 選項 3: 增量學習 (Incremental Learning)

```
概念: 基於舊模型，只用新數據進行微調 (Fine-tuning)

優點:
✅ 訓練時間較短
✅ 保留舊模型知識
✅ 適合 transfer learning

缺點:
⚠️  需要 TensorFlow 增量訓練支持
⚠️  可能累積誤差
```

**結論**: ⚠️ 可作為輔助策略

---

### 選項 4: **混合式持續訓練** (Hybrid Continuous Training) ← **推薦**

```
結合選項 2 + 選項 3

策略:
1. 每日增量微調 (Fast adaptation)
   - 使用最近 24 小時數據
   - Fine-tune 現有模型
   - 快速適應短期市場變化

2. 每週完整重訓練 (Deep learning)
   - 使用過去 3 個月數據
   - 從頭訓練新模型
   - 創建新版本 (v3.3, v3.4...)

3. 每月模型評估和選擇 (Model selection)
   - 比較所有模型版本性能
   - 選擇最佳模型作為 active
   - 淘汰表現差的模型
```

---

## 🏗️ 推薦方案：混合式持續訓練

### 完整數據流架構 (Proposed Data Flow)

```
┌───────────────────────────────────────────────────────────────────┐
│             持續學習系統 (Continuous Learning System)              │
└───────────────────────────────────────────────────────────────────┘

🔄 循環 1: 數據收集 (持續運行)
┌─────────────────────────────────────────────────────────────┐
│ Backend: Market Data Collection Service                     │
│ ⏰ 每 15 分鐘執行一次                                        │
│                                                              │
│ 1. 從 yfinance 抓取最新數據                                  │
│ 2. 計算技術指標 (38 features)                               │
│ 3. 保存到 PostgreSQL: market_data 表                        │
│ 4. 發佈事件到 Redis: "new_market_data"                      │
└─────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend: Signal Monitoring Service                          │
│ ⏰ 每 15 分鐘執行一次                                        │
│                                                              │
│ 1. 呼叫 ML API 進行預測                                     │
│ 2. 保存到 PostgreSQL: trading_signals 表                    │
│ 3. 發送 Discord 通知 (如果有信號)                           │
│ 4. 發佈事件到 Redis: "new_prediction"                       │
└─────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend: Position Monitoring Service                        │
│ ⏰ 每 60 秒執行一次                                          │
│                                                              │
│ 1. 監控用戶持倉狀態                                         │
│ 2. 檢查 stop loss / take profit                             │
│ 3. 更新 trading_signals.actualOutcome                       │
│ 4. 計算 actualPnL, actualPnLPercent                         │
│ 5. 發佈事件到 Redis: "signal_outcome"  ← 🔥 重要！         │
└─────────────────────────────────────────────────────────────┘


🔄 循環 2: 每日微調 (Daily Fine-tuning)
┌─────────────────────────────────────────────────────────────┐
│ ML Engine: Daily Incremental Trainer                        │
│ ⏰ 每天 02:00 UTC 執行 (低峰期)                             │
│                                                              │
│ 1. 從 PostgreSQL 取得過去 24 小時數據                       │
│    SELECT * FROM market_data                                 │
│    WHERE timestamp > NOW() - INTERVAL '24 hours'             │
│                                                              │
│ 2. 從 PostgreSQL 取得預測結果反饋                           │
│    SELECT * FROM trading_signals                             │
│    WHERE actual_outcome IS NOT NULL                          │
│    AND updated_at > NOW() - INTERVAL '24 hours'              │
│                                                              │
│ 3. 準備訓練數據 (包含實際結果標籤)                          │
│                                                              │
│ 4. Fine-tune 當前 active 模型                               │
│    - 使用較小 learning rate (0.0001)                        │
│    - 只訓練 10 epochs                                        │
│                                                              │
│ 5. 保存為臨時版本: v3.2-daily-20251021                      │
│                                                              │
│ 6. 驗證性能 (使用過去 7 天數據)                             │
│    - 如果性能 ≥ 當前模型: 自動部署                          │
│    - 如果性能 < 當前模型: 保留但不部署                      │
│                                                              │
│ 7. 記錄到 model_training_log 表                             │
└─────────────────────────────────────────────────────────────┘


🔄 循環 3: 每週完整訓練 (Weekly Full Retraining)
┌─────────────────────────────────────────────────────────────┐
│ ML Engine: Weekly Full Trainer                              │
│ ⏰ 每週日 01:00 UTC 執行                                    │
│                                                              │
│ 1. 從 PostgreSQL 導出過去 3 個月數據                        │
│    - market_data: OHLCV + 技術指標                          │
│    - trading_signals: 預測結果 + 實際結果                   │
│                                                              │
│ 2. 準備完整訓練集                                           │
│    - Train: 70% (過去 63 天)                                │
│    - Validation: 15% (過去 14 天)                           │
│    - Test: 15% (過去 13 天)                                 │
│                                                              │
│ 3. 從頭訓練新模型 (完整訓練)                                │
│    - 使用最新架構 (可能調整超參數)                          │
│    - 訓練 100 epochs                                        │
│    - 使用 class weights 平衡數據                            │
│                                                              │
│ 4. 創建新版本: v3.3 (自動版本號遞增)                        │
│                                                              │
│ 5. 全面評估 (Comprehensive Evaluation)                      │
│    - Precision, Recall, F1-Score                            │
│    - Confusion Matrix                                       │
│    - Backtesting 過去 30 天                                 │
│    - 計算 Sharpe Ratio, Max Drawdown                        │
│                                                              │
│ 6. A/B Testing                                              │
│    - 50% 流量使用 v3.2                                      │
│    - 50% 流量使用 v3.3                                      │
│    - 持續 7 天                                              │
│                                                              │
│ 7. 記錄到 model_versions 表                                 │
└─────────────────────────────────────────────────────────────┘


🔄 循環 4: 每月模型評估 (Monthly Model Evaluation)
┌─────────────────────────────────────────────────────────────┐
│ ML Engine: Model Evaluation & Selection                     │
│ ⏰ 每月 1 日 00:00 UTC 執行                                 │
│                                                              │
│ 1. 取得過去 30 天所有模型版本的性能                         │
│    - v3.2, v3.2-daily-*, v3.3, v3.4...                      │
│                                                              │
│ 2. 計算關鍵指標                                             │
│    - Win Rate                                               │
│    - Average PnL                                            │
│    - Sharpe Ratio                                           │
│    - Maximum Drawdown                                       │
│    - Signal Frequency (避免過度交易)                        │
│                                                              │
│ 3. 選擇最佳模型                                             │
│    ranking_score = (                                        │
│        win_rate * 0.3 +                                     │
│        sharpe_ratio * 0.3 +                                 │
│        avg_pnl * 0.2 +                                      │
│        (1 - max_drawdown) * 0.2                             │
│    )                                                        │
│                                                              │
│ 4. 設置為 active 模型                                       │
│    ModelManager.switch_version('v3.4')                      │
│                                                              │
│ 5. 淘汰老舊模型                                             │
│    - 刪除 3 個月前的 daily 版本                             │
│    - 保留所有 weekly 主版本                                 │
│                                                              │
│ 6. 生成月度報告                                             │
│    - 發送到 Discord #ml-reports 頻道                        │
│    - 保存到 /ml_engine/reports/monthly/                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 數據流架構

### PostgreSQL Schema 擴展

```sql
-- 新增表 1: 模型訓練日誌
CREATE TABLE model_training_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_version VARCHAR(50) NOT NULL,
    training_type ENUM('full', 'incremental') NOT NULL,
    data_start_date TIMESTAMP NOT NULL,
    data_end_date TIMESTAMP NOT NULL,
    num_samples INTEGER NOT NULL,
    training_duration_seconds INTEGER,

    -- 訓練數據統計
    train_samples INTEGER,
    val_samples INTEGER,
    test_samples INTEGER,

    -- 訓練參數
    hyperparameters JSONB,

    -- 性能指標
    train_loss DECIMAL(10, 6),
    val_loss DECIMAL(10, 6),
    test_loss DECIMAL(10, 6),
    train_accuracy DECIMAL(5, 4),
    val_accuracy DECIMAL(5, 4),
    test_accuracy DECIMAL(5, 4),

    -- 分類指標
    precision DECIMAL(5, 4),
    recall DECIMAL(5, 4),
    f1_score DECIMAL(5, 4),

    -- 交易回測指標
    backtest_win_rate DECIMAL(5, 4),
    backtest_sharpe_ratio DECIMAL(6, 4),
    backtest_max_drawdown DECIMAL(6, 4),
    backtest_total_pnl DECIMAL(12, 2),

    -- 狀態
    status ENUM('training', 'completed', 'failed', 'deployed') DEFAULT 'training',
    error_message TEXT,

    -- 模型檔案路徑
    model_path VARCHAR(255),
    scaler_path VARCHAR(255),
    metadata_path VARCHAR(255),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 新增表 2: 模型版本比較
CREATE TABLE model_ab_test (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name VARCHAR(100) NOT NULL,
    model_a_version VARCHAR(50) NOT NULL,
    model_b_version VARCHAR(50) NOT NULL,

    -- A/B 測試配置
    traffic_split DECIMAL(3, 2) DEFAULT 0.5, -- 0.5 = 50/50
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,

    -- 性能比較
    model_a_predictions INTEGER DEFAULT 0,
    model_b_predictions INTEGER DEFAULT 0,
    model_a_win_rate DECIMAL(5, 4),
    model_b_win_rate DECIMAL(5, 4),
    model_a_avg_pnl DECIMAL(10, 2),
    model_b_avg_pnl DECIMAL(10, 2),

    -- 統計顯著性
    p_value DECIMAL(6, 5),
    is_significant BOOLEAN DEFAULT FALSE,

    -- 結果
    winner VARCHAR(50), -- 'model_a', 'model_b', or 'tie'
    status ENUM('running', 'completed', 'stopped') DEFAULT 'running',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 新增表 3: 模型版本元數據
CREATE TABLE model_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- 模型類型
    model_type ENUM('full', 'incremental') NOT NULL,
    parent_version VARCHAR(50), -- For incremental models

    -- 訓練信息
    trained_at TIMESTAMP NOT NULL,
    training_log_id UUID REFERENCES model_training_log(id),

    -- 部署狀態
    is_active BOOLEAN DEFAULT FALSE,
    deployed_at TIMESTAMP,

    -- 性能指標 (持續更新)
    production_predictions INTEGER DEFAULT 0,
    production_win_rate DECIMAL(5, 4),
    production_avg_pnl DECIMAL(10, 2),
    production_sharpe_ratio DECIMAL(6, 4),

    -- 檔案路徑
    stage1_model_path VARCHAR(255),
    stage2_model_path VARCHAR(255),
    scaler_path VARCHAR(255),
    features_path VARCHAR(255),
    metadata_path VARCHAR(255),

    -- 版本管理
    deprecated_at TIMESTAMP,
    deprecated_reason TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 創建索引
CREATE INDEX idx_training_log_version ON model_training_log(model_version);
CREATE INDEX idx_training_log_created ON model_training_log(created_at DESC);
CREATE INDEX idx_ab_test_status ON model_ab_test(status);
CREATE INDEX idx_model_versions_active ON model_versions(is_active);
CREATE INDEX idx_model_versions_created ON model_versions(created_at DESC);
```

### 修改 trading_signals 表

```sql
-- 新增欄位以支持 A/B testing
ALTER TABLE trading_signals
ADD COLUMN model_version VARCHAR(50),
ADD COLUMN ab_test_id UUID REFERENCES model_ab_test(id);

CREATE INDEX idx_signals_model_version ON trading_signals(model_version);
```

---

## 🛠️ 實現計劃

### Phase 1: 基礎設施準備 (1-2 天)

```bash
任務清單:

1. 創建新的 PostgreSQL 表
   ✅ model_training_log
   ✅ model_ab_test
   ✅ model_versions

2. 創建 Sequelize Models
   📄 backend/src/models/ModelTrainingLog.js
   📄 backend/src/models/ModelABTest.js
   📄 backend/src/models/ModelVersion.js

3. 創建數據導出服務
   📄 backend/src/services/trainingDataExportService.js
   功能:
   - 從 market_data 導出訓練數據
   - 從 trading_signals 導出標籤數據
   - 生成 CSV 檔案供 ML Engine 使用

4. 設置 Redis 事件通道
   - new_market_data
   - new_prediction
   - signal_outcome
   - training_completed
```

### Phase 2: 每日微調系統 (2-3 天)

```bash
1. 創建每日訓練腳本
   📄 ml_engine/scripts/daily_incremental_training.py

   功能:
   - 從 PostgreSQL 取得過去 24 小時數據
   - 載入當前 active 模型
   - Fine-tune (10 epochs, lr=0.0001)
   - 驗證性能
   - 保存新版本 (v3.2-daily-20251021)
   - 更新 model_training_log

2. 創建自動部署邏輯
   📄 ml_engine/api/auto_deployment_service.py

   功能:
   - 比較新舊模型性能
   - 自動切換 active 模型
   - 通知 Backend 模型已更新
   - 發送 Discord 通知

3. 設置 Cron Job
   - 每天 02:00 UTC 執行
   - 記錄到系統日誌
```

### Phase 3: 每週完整訓練 (3-4 天)

```bash
1. 創建數據準備流程
   📄 ml_engine/scripts/prepare_continuous_training_data.py

   功能:
   - 從 PostgreSQL 導出過去 3 個月數據
   - 自動標註 (使用實際交易結果)
   - 分割 train/val/test
   - 計算 class weights
   - 保存到 /ml_engine/data/continuous/

2. 創建完整訓練腳本
   📄 ml_engine/scripts/weekly_full_training.py

   功能:
   - 從頭訓練新模型
   - 自動版本號遞增 (v3.2 → v3.3)
   - 全面評估 (precision, recall, f1)
   - Backtesting
   - 保存訓練報告
   - 更新 model_training_log

3. 設置 Cron Job
   - 每週日 01:00 UTC 執行
```

### Phase 4: A/B Testing 系統 (2-3 天)

```bash
1. 修改 Backend 預測路由
   📄 backend/src/services/mlPredictionService.js

   新增功能:
   - 檢查是否有 active A/B test
   - 根據 traffic_split 分配流量
   - 記錄使用的模型版本到 trading_signals.model_version

2. 創建 A/B Test 管理 API
   📄 backend/src/controllers/mlModelController.js

   端點:
   POST /api/v1/ml/ab-test/start
   GET  /api/v1/ml/ab-test/:id/status
   POST /api/v1/ml/ab-test/:id/stop
   GET  /api/v1/ml/ab-test/:id/report

3. 創建性能追蹤服務
   📄 backend/src/services/modelPerformanceTrackingService.js

   功能:
   - 即時計算各模型的 win rate
   - 計算統計顯著性 (p-value)
   - 自動決定 A/B test 勝者
```

### Phase 5: 每月評估系統 (1-2 天)

```bash
1. 創建模型評估腳本
   📄 ml_engine/scripts/monthly_model_evaluation.py

   功能:
   - 比較所有模型版本
   - 計算 ranking_score
   - 選擇最佳模型
   - 淘汰老舊模型
   - 生成月度報告

2. 創建報告生成器
   📄 ml_engine/reports/report_generator.py

   功能:
   - 生成 Markdown 報告
   - 生成性能圖表 (matplotlib)
   - 發送到 Discord

3. 設置 Cron Job
   - 每月 1 日 00:00 UTC 執行
```

### Phase 6: 監控和告警 (1 天)

```bash
1. 創建監控儀表板
   - 訓練狀態監控
   - 模型性能監控
   - 數據品質監控

2. 設置告警
   - 訓練失敗告警
   - 性能下降告警
   - 數據異常告警
```

---

## 🔧 技術細節

### 1. 增量訓練 (Fine-tuning) 實現

```python
# ml_engine/scripts/daily_incremental_training.py

import tensorflow as tf
from tensorflow import keras
import pickle
import pandas as pd
from datetime import datetime, timedelta

class DailyIncrementalTrainer:
    def __init__(self, active_version='v3.2'):
        self.active_version = active_version
        self.models_dir = Path('models/trained')

    def load_active_model(self):
        """載入當前 active 模型"""
        stage1_path = self.models_dir / f'{self.active_version}_stage1.h5'
        scaler_path = self.models_dir / f'{self.active_version}_scaler.pkl'

        self.model = keras.models.load_model(stage1_path)
        with open(scaler_path, 'rb') as f:
            self.scaler = pickle.load(f)

    def fetch_daily_data(self):
        """從 PostgreSQL 取得過去 24 小時數據"""
        from backend_db_connector import get_connection

        conn = get_connection()
        query = """
            SELECT
                md.*,
                ts.signal as actual_signal,
                ts.actual_outcome,
                ts.confidence
            FROM market_data md
            LEFT JOIN trading_signals ts
                ON md.pair = ts.pair
                AND md.timeframe = ts.timeframe
                AND md.timestamp = ts.created_at
            WHERE md.timestamp > NOW() - INTERVAL '24 hours'
            ORDER BY md.timestamp
        """

        df = pd.read_sql(query, conn)
        return df

    def prepare_training_data(self, df):
        """準備訓練數據"""
        # 只使用有實際結果的數據進行訓練
        df_labeled = df[df['actual_outcome'].notna()]

        # 提取特徵
        features = df_labeled[self.feature_columns]
        X = self.scaler.transform(features)

        # 創建序列
        X_seq, y = self.create_sequences(X, df_labeled['actual_signal'])

        return X_seq, y

    def fine_tune(self, X, y):
        """微調模型"""
        # 設置較小的 learning rate
        optimizer = keras.optimizers.Adam(learning_rate=0.0001)
        self.model.compile(
            optimizer=optimizer,
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )

        # 只訓練少量 epochs
        history = self.model.fit(
            X, y,
            epochs=10,
            batch_size=32,
            validation_split=0.2,
            verbose=1
        )

        return history

    def validate_performance(self):
        """驗證新模型性能"""
        # 使用過去 7 天數據進行驗證
        val_data = self.fetch_validation_data()
        X_val, y_val = self.prepare_training_data(val_data)

        # 評估
        loss, accuracy = self.model.evaluate(X_val, y_val)

        return {
            'val_loss': loss,
            'val_accuracy': accuracy
        }

    def save_new_version(self, metrics):
        """保存新版本"""
        today = datetime.now().strftime('%Y%m%d')
        new_version = f"{self.active_version}-daily-{today}"

        # 保存模型
        save_path = self.models_dir / f'{new_version}_stage1.h5'
        self.model.save(save_path)

        # 保存元數據
        metadata = {
            'version': new_version,
            'parent_version': self.active_version,
            'training_type': 'incremental',
            'trained_at': datetime.now().isoformat(),
            'metrics': metrics
        }

        with open(self.models_dir / f'{new_version}_metadata.json', 'w') as f:
            json.dump(metadata, f, indent=2)

        return new_version

    def run(self):
        """執行每日訓練流程"""
        logger.info("="*80)
        logger.info("Daily Incremental Training")
        logger.info("="*80)

        # 1. 載入 active 模型
        logger.info(f"Loading active model: {self.active_version}")
        self.load_active_model()

        # 2. 取得過去 24 小時數據
        logger.info("Fetching past 24 hours data...")
        df = self.fetch_daily_data()
        logger.info(f"Fetched {len(df)} records")

        # 3. 準備訓練數據
        logger.info("Preparing training data...")
        X, y = self.prepare_training_data(df)

        if len(X) < 100:
            logger.warning(f"Insufficient labeled data ({len(X)} samples). Skipping training.")
            return None

        logger.info(f"Training samples: {len(X)}")

        # 4. 微調模型
        logger.info("Fine-tuning model...")
        history = self.fine_tune(X, y)

        # 5. 驗證性能
        logger.info("Validating performance...")
        metrics = self.validate_performance()
        logger.info(f"Validation metrics: {metrics}")

        # 6. 保存新版本
        new_version = self.save_new_version(metrics)
        logger.info(f"✅ New version saved: {new_version}")

        # 7. 記錄到數據庫
        self.log_to_database(new_version, metrics)

        # 8. 檢查是否應該部署
        if self.should_deploy(metrics):
            logger.info("✅ Performance improved! Auto-deploying...")
            self.deploy_model(new_version)
        else:
            logger.info("⚠️  Performance not improved. Keeping current model.")

        return new_version

if __name__ == '__main__':
    trainer = DailyIncrementalTrainer(active_version='v3.2')
    trainer.run()
```

### 2. 完整重訓練實現

```python
# ml_engine/scripts/weekly_full_training.py

class WeeklyFullTrainer:
    def __init__(self):
        self.models_dir = Path('models/trained')
        self.data_dir = Path('data/continuous')

    def export_training_data(self):
        """從 PostgreSQL 導出過去 3 個月數據"""
        from backend_db_connector import get_connection

        conn = get_connection()
        query = """
            SELECT
                md.*,
                ts.signal as label_signal,
                ts.actual_outcome,
                ts.confidence
            FROM market_data md
            LEFT JOIN trading_signals ts
                ON md.pair = ts.pair
                AND md.timeframe = ts.timeframe
                AND ABS(EXTRACT(EPOCH FROM (md.timestamp - ts.created_at))) < 300
            WHERE md.timestamp > NOW() - INTERVAL '3 months'
            ORDER BY md.timestamp
        """

        df = pd.read_sql(query, conn)

        # 保存到 CSV
        output_path = self.data_dir / f'training_data_{datetime.now():%Y%m%d}.csv'
        df.to_csv(output_path, index=False)

        return df

    def prepare_dataset(self, df):
        """準備完整訓練集"""
        # 標註邏輯
        df_labeled = self.label_reversals(df)

        # 特徵工程
        X = self.extract_features(df_labeled)
        y_signal, y_confidence = self.extract_labels(df_labeled)

        # 分割數據集
        split1 = int(len(X) * 0.7)
        split2 = int(len(X) * 0.85)

        return {
            'X_train': X[:split1],
            'y_train': (y_signal[:split1], y_confidence[:split1]),
            'X_val': X[split1:split2],
            'y_val': (y_signal[split1:split2], y_confidence[split1:split2]),
            'X_test': X[split2:],
            'y_test': (y_signal[split2:], y_confidence[split2:])
        }

    def train_new_model(self, data):
        """從頭訓練新模型"""
        from models.dual_mode_reversal_predictor import ReversalDetectionModel

        # 創建新模型
        model_builder = ReversalDetectionModel(
            sequence_length=20,
            num_features=38,
            mode='mode1'
        )

        model = model_builder.build()

        # 訓練
        history = model.fit(
            data['X_train'],
            data['y_train'],
            validation_data=(data['X_val'], data['y_val']),
            epochs=100,
            batch_size=32,
            callbacks=get_training_callbacks()
        )

        return model, history

    def backtest(self, model, data):
        """回測過去 30 天"""
        # 使用測試集進行回測
        predictions = model.predict(data['X_test'])

        # 計算交易指標
        trades = self.simulate_trades(predictions, data)

        metrics = {
            'total_trades': len(trades),
            'winning_trades': sum(t['outcome'] == 'win' for t in trades),
            'win_rate': sum(t['outcome'] == 'win' for t in trades) / len(trades),
            'total_pnl': sum(t['pnl'] for t in trades),
            'avg_pnl': np.mean([t['pnl'] for t in trades]),
            'sharpe_ratio': self.calculate_sharpe_ratio(trades),
            'max_drawdown': self.calculate_max_drawdown(trades)
        }

        return metrics

    def get_next_version(self):
        """自動生成下一個版本號"""
        # 取得所有現有版本
        existing_versions = self.get_all_versions()

        # 找到最高版本號
        # v3.2 → v3.3, v3.3 → v3.4
        latest = max(existing_versions, key=lambda v: float(v.replace('v', '')))
        major, minor = latest.replace('v', '').split('.')

        new_version = f"v{major}.{int(minor) + 1}"
        return new_version

    def run(self):
        """執行每週訓練流程"""
        logger.info("="*80)
        logger.info("Weekly Full Retraining")
        logger.info("="*80)

        # 1. 導出訓練數據
        logger.info("Exporting training data from PostgreSQL...")
        df = self.export_training_data()
        logger.info(f"Exported {len(df)} records")

        # 2. 準備數據集
        logger.info("Preparing dataset...")
        data = self.prepare_dataset(df)

        # 3. 訓練新模型
        logger.info("Training new model...")
        model, history = self.train_new_model(data)

        # 4. 回測
        logger.info("Backtesting...")
        backtest_metrics = self.backtest(model, data)
        logger.info(f"Backtest results: {backtest_metrics}")

        # 5. 生成新版本號
        new_version = self.get_next_version()
        logger.info(f"New version: {new_version}")

        # 6. 保存模型
        self.save_model(model, new_version, backtest_metrics)

        # 7. 啟動 A/B test
        logger.info("Starting A/B test...")
        self.start_ab_test(new_version)

        # 8. 發送報告
        self.send_discord_report(new_version, backtest_metrics)

        return new_version

if __name__ == '__main__':
    trainer = WeeklyFullTrainer()
    trainer.run()
```

### 3. A/B Testing 實現

```javascript
// backend/src/services/mlPredictionService.js

class MLPredictionService {
  async getPrediction(pair, timeframe, marketData) {
    // 檢查是否有 active A/B test
    const abTest = await ModelABTest.findOne({
      where: { status: 'running' },
      order: [['created_at', 'DESC']]
    });

    let modelVersion;

    if (abTest) {
      // A/B testing 進行中，隨機分配模型
      const random = Math.random();
      modelVersion = random < abTest.trafficSplit
        ? abTest.modelAVersion
        : abTest.modelBVersion;

      // 記錄預測次數
      if (modelVersion === abTest.modelAVersion) {
        await abTest.increment('modelAPredictions');
      } else {
        await abTest.increment('modelBPredictions');
      }
    } else {
      // 使用 active 模型
      const activeModel = await ModelVersion.findOne({
        where: { isActive: true }
      });
      modelVersion = activeModel.version;
    }

    // 呼叫 ML API 並指定版本
    const prediction = await this.callMLAPI(marketData, modelVersion);

    // 保存預測結果，包含模型版本
    await TradingSignal.create({
      pair,
      timeframe,
      signal: prediction.signal,
      confidence: prediction.confidence,
      modelVersion,
      abTestId: abTest?.id,
      // ... other fields
    });

    return prediction;
  }

  async callMLAPI(marketData, version) {
    const response = await axios.post(
      `${process.env.ML_API_URL}/predict`,
      {
        market_data: marketData,
        version: version
      }
    );

    return response.data;
  }
}
```

---

## ⚠️ 風險管理

### 1. 過擬合風險 (Overfitting)

```
問題: 模型過度適應最近數據，失去泛化能力

緩解措施:
✅ 使用 early stopping
✅ 使用 dropout layers
✅ 定期驗證 (使用未見過的數據)
✅ 監控 train/val loss gap
✅ 每週完整重訓練 (避免累積誤差)
```

### 2. 數據漂移 (Data Drift)

```
問題: 市場條件突然改變，歷史數據不再有效

緩解措施:
✅ 監控特徵分佈變化
✅ 檢測異常市場條件
✅ 實施 concept drift detection
✅ 在極端市場條件下暫停自動訓練
```

### 3. 模型退化 (Model Degradation)

```
問題: 新模型性能反而下降

緩解措施:
✅ 自動性能驗證 (必須 ≥ 舊模型才部署)
✅ A/B testing (7 天驗證期)
✅ 保留舊模型版本 (可隨時回滾)
✅ 監控生產環境性能
```

### 4. 訓練失敗風險

```
問題: 訓練過程中斷或失敗

緩解措施:
✅ 保存訓練檢查點
✅ 錯誤重試機制
✅ 失敗告警通知
✅ 保持舊模型繼續服務
```

### 5. 資源消耗

```
問題: 訓練消耗大量 CPU/GPU/Memory

緩解措施:
✅ 在低峰期執行 (凌晨 1-3 點)
✅ 限制訓練資源使用
✅ 使用增量訓練減少計算量
✅ 監控系統資源
```

---

## 📈 預期效果

### 短期效果 (1 個月內)

```
✅ 模型開始適應最新市場數據
✅ 預測準確度提升 5-10%
✅ 信號頻率增加 (不再都是 hold)
✅ 自動化減少人工干預
```

### 中期效果 (3 個月內)

```
✅ 建立完整的 MLOps pipeline
✅ 累積多個模型版本進行比較
✅ A/B testing 找出最佳模型
✅ Win rate 提升至 60%+
```

### 長期效果 (6 個月以上)

```
✅ 模型持續自我優化
✅ 穩定的盈利能力
✅ 適應各種市場條件
✅ 完整的性能追蹤和報告
```

---

## 🎯 下一步行動

### 立即討論 (Now)

1. **確認策略**: 是否採用「混合式持續訓練」方案？
2. **確認頻率**:
   - 每日微調 (Daily fine-tuning) - 是否需要？
   - 每週完整訓練 (Weekly full retraining) - 頻率是否合適？
3. **確認優先級**:
   - Phase 1-6 的實現順序是否合理？
   - 哪些功能最優先？

### 本週可以開始 (This Week)

```
如果你同意這個方案，我可以立即開始實現 Phase 1:

Day 1-2:
✅ 創建 PostgreSQL 新表
✅ 創建 Sequelize Models
✅ 創建數據導出服務

Day 3-4:
✅ 實現每日微調腳本
✅ 設置 Cron Job
✅ 測試端到端流程

Day 5-7:
✅ 實現每週完整訓練
✅ 測試模型版本管理
```

---

## 💬 討論問題

**我想聽聽你的想法：**

1. **關於訓練頻率**:
   - 每日微調會不會太頻繁？
   - 每週完整訓練是否足夠？
   - 是否需要即時回應特殊市場事件？

2. **關於 A/B Testing**:
   - 7 天測試期是否合適？
   - 50/50 流量分配是否合理？
   - 是否需要多版本同時測試 (A/B/C)?

3. **關於數據品質**:
   - 如何確保用戶交易結果數據準確？
   - 如何處理沒有實際交易的信號？
   - 是否需要人工標註部分數據？

4. **關於資源分配**:
   - 這個系統值得投入多少開發時間？
   - 是否需要 GPU 加速訓練？
   - 雲端訓練 vs 本地訓練？

**請告訴我你的想法！** 🚀
