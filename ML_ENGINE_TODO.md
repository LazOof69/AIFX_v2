# ML 引擎任務清單

**最後更新**: 2025-10-08 13:10
**當前狀態**: ✅ 階段 2 MVP Week 1-2 完成 - 經濟日曆 + 特徵工程完成

---

## 🎯 **當前進度總覽**

### ✅ **階段 1: 技術指標模型 (已完成)**
- [x] Python 環境設置 (venv)
- [x] 依賴安裝 (TensorFlow, FastAPI, scikit-learn)
- [x] 數據收集 (yfinance - 20+ 年真實數據)
- [x] 特徵工程 (28 個技術指標)
- [x] Scaler 保存/載入功能
- [x] **EURUSD 模型訓練完成** (val_loss: 0.839)
- [x] **GBPUSD 模型訓練完成** (val_loss: 0.816) ⭐ 最佳
- [x] **USDJPY 模型訓練完成** (val_loss: 0.826)
- [x] 模型驗證測試通過
- [x] ML API 部署運行中

### 🔄 **階段 2: 基本面 + 事件整合 (進行中 - Week 1-2 完成 87.5%)**

#### ✅ **Week 1: 數據基礎建設 (已完成)**
- [x] **註冊 FRED API key** (e22a48414359e978361612cab3f0e4fd)
- [x] **設計 PostgreSQL 數據庫 Schema**
  - [x] fundamental_data 表 (經濟指標)
  - [x] economic_events 表 (經濟事件日曆)
  - [x] interest_rates 表 (優化利率表)
- [x] **創建數據庫 Migration 文件**
  - [x] JavaScript 版本 (Sequelize)
  - [x] SQL 版本 (直接執行)
  - [x] 修復 DECIMAL 精度問題 (15,6 → 20,6)
- [x] **建立 FRED API 數據收集器** (`collect_fundamental_data.py` - 450 行)
  - [x] 支持 US, EU, GB, JP 四個國家/地區
  - [x] 收集 7 種指標 (interest_rate, GDP, CPI, unemployment, inflation, PMI, trade_balance)
  - [x] 實現 upsert 邏輯防止重複
  - [x] Rate limiting (0.6s/請求)
  - [x] 測試模式 (--test)
- [x] **執行完整數據收集**
  - [x] **10,409 條基本面數據** (2005-2025, 20年歷史)
    - US: 1,294 條記錄
    - EU: 7,826 條記錄 (含每日利率)
    - GB: 544 條記錄
    - JP: 745 條記錄
  - [x] **7,301 個日期同步到 interest_rates 表**
- [x] **Git 提交推送** (commit: 1c55275)

**當前數據狀態** (2025-10-08):
```
最新利率 (2025-09-01):
- Fed Rate: 4.22%
- ECB Rate: 2.00%
- BoJ Rate: 0.48%

數據覆蓋範圍:
- Interest Rates: 2005-2025 (ECB 每日, 其他月度)
- GDP: 季度數據 (79 observations/country)
- CPI: 月度數據 (189-239 observations)
- Unemployment: 月度數據 (208-239 observations)
```

#### ✅ **Week 1-2: 完成** (2025-10-08)
- [x] **建立經濟日曆爬蟲** (`collect_economic_calendar.py`) ⭐
  - [x] 使用 investpy 從 Investing.com 獲取數據
  - [x] 解析高/中/低影響事件
  - [x] 提取 forecast/actual/previous 值
  - [x] 保存到 economic_events 表（21,179 條記錄）
  - [x] 設置定時任務 (每日 01:00 AM 自動更新)
  - [x] 日誌輪轉和健康監控腳本
- [x] **建立基本面特徵工程模組** (`fundamental_features.py`) ⭐
  - [x] 計算利率差異 (interest_rate_diff)
  - [x] GDP 同比增長率
  - [x] 通膨差異
  - [x] 距下個重大事件天數
  - [x] 事件影響分數 (0-1)
  - [x] 時間對齊邏輯 (前向填充)
  - [x] 支持 EURUSD, GBPUSD, USDJPY
  - [x] 測試驗證通過

#### ⏸️ **Week 2: 模型開發 (待執行)**
- [ ] **建立多輸入 LSTM 模型 v2.0** (`multi_input_predictor.py`)
  - [ ] Input 1: 技術指標 (60, 28) → LSTM(64) → LSTM(32)
  - [ ] Input 2: 基本面特徵 (10) → Dense(32) → Dense(16)
  - [ ] Input 3: 事件特徵 (5) → Dense(16) → Dense(8)
  - [ ] Fusion Layer: Concatenate → Dense(64) → Output
  - [ ] 實現模型保存/載入
- [ ] **準備 EURUSD v2.0 訓練數據**
  - [ ] 整合技術指標 + 基本面 + 事件數據
  - [ ] 時間對齊 (確保所有特徵日期一致)
  - [ ] 數據標準化 (scaler)
  - [ ] 訓練/驗證/測試集切分
- [ ] **訓練 EURUSD v2.0 模型**
  - [ ] 使用融合數據訓練
  - [ ] 記錄訓練日誌
  - [ ] 保存最佳模型
  - [ ] 目標: val_loss < 0.70, 方向準確率 > 60%

#### ⏸️ **Week 3: API 升級與測試 (待執行)**
- [ ] **升級 ML API** (`ml_server.py`)
  - [ ] 新增 `POST /predict/enhanced` 端點
    - [ ] 載入 v2.0 多輸入模型
    - [ ] 整合基本面數據查詢
    - [ ] 整合事件風險評估
    - [ ] 返回增強預測結果
  - [ ] 新增 `GET /calendar/{currency}` 端點
    - [ ] 查詢未來 7 天經濟事件
    - [ ] 按影響級別篩選
    - [ ] 返回 JSON 格式
  - [ ] 新增 `GET /risk-assessment/{pair}` 端點
    - [ ] 計算當前風險等級
    - [ ] 檢查未來重大事件
    - [ ] 返回風險建議
  - [ ] 新增 `GET /fundamental/{pair}` 端點
    - [ ] 返回最新基本面數據
    - [ ] 計算利率差異
- [ ] **A/B 測試 v1.0 vs v2.0**
  - [ ] 對比價格預測 RMSE/MAE
  - [ ] 對比方向準確率 ⭐ 最重要
  - [ ] 事件期間準確率比較
  - [ ] 生成對比報告
- [ ] **端到端整合測試**
  - [ ] 測試 Backend → ML API 調用
  - [ ] 測試 Frontend 顯示
  - [ ] 負載測試 (100 concurrent requests)

#### 📊 **階段 2 目標**
- ✅ 收集 20 年基本面數據 (已達成)
- 🎯 方向準確率: 55-60% → **65-70%**
- 🎯 val_loss: 0.82 → **0.65-0.70**
- 🎯 事件前後預測準確率: **70-75%**

---

## 📊 **已訓練模型狀態**

| 貨幣對 | 訓練樣本 | Epochs | val_loss | 文件大小 | 狀態 |
|--------|----------|--------|----------|----------|------|
| **EURUSD** | 6,288 | 30 | 0.8390 | 1.70 MB | ✅ 已驗證 |
| **GBPUSD** | 4,335 | 32 | 0.8161 | 1.70 MB | ✅ 已驗證 |
| **USDJPY** | 5,141 | 12 | 0.8259 | 1.70 MB | ✅ 已驗證 |

**模型架構**:
- LSTM 層: 64 → 32 units
- Dense 層: 16 → 8 units
- 總參數: 142,881
- 輸入: (60 timesteps, 28 features)
- 輸出: 價格預測 (回歸)

**保存位置**:
```
/root/AIFX_v2/ml_engine/saved_models/
├── price_predictor_v1.0.0_20251007_053914.h5         # EURUSD
├── price_predictor_v1.0.0_20251007_053914_scaler.pkl
├── price_predictor_v1.0.0_20251007_140833.h5         # GBPUSD ⭐
├── price_predictor_v1.0.0_20251007_140833_scaler.pkl
├── price_predictor_v1.0.0_20251007_142222.h5         # USDJPY
└── price_predictor_v1.0.0_20251007_142222_scaler.pkl
```

---

## 🚀 **下一步：訓練與優化方向**

### **選項 1: 擴展貨幣對覆蓋** ⏱️ 1-2 天
訓練更多主流貨幣對：
- [ ] USDCAD (美元/加元)
- [ ] AUDUSD (澳元/美元)
- [ ] NZDUSD (紐元/美元)
- [ ] USDCHF (美元/瑞郎)

**優勢**:
- 使用現有架構
- 快速擴展服務範圍
- 無需修改代碼

**執行方式**:
```bash
cd /root/AIFX_v2/ml_engine
source venv/bin/activate

# 收集數據
python scripts/collect_yfinance_data.py --pair USDCAD
python scripts/prepare_training_data.py --pair USDCAD

# 訓練模型
screen -dmS usdcad_training python train_pair.py USDCAD
```

---

### **選項 2: 模型優化與調參** ⏱️ 3-5 天
提升現有模型準確率：

#### 2.1 超參數調優
- [ ] 調整 LSTM units (32/64/128)
- [ ] 調整 sequence length (30/60/90 timesteps)
- [ ] 調整 dropout rate (0.1/0.2/0.3)
- [ ] 嘗試雙向 LSTM (Bidirectional)

#### 2.2 架構實驗
- [ ] 添加 Attention 機制
- [ ] 嘗試 GRU 替代 LSTM
- [ ] 多任務學習 (價格 + 方向)
- [ ] 殘差連接 (ResNet-style)

#### 2.3 訓練策略
- [ ] 學習率調度 (CosineAnnealing)
- [ ] 數據增強 (噪聲注入、時間扭曲)
- [ ] K-fold 交叉驗證
- [ ] 集成學習 (Ensemble 5 個模型)

**預期提升**: val_loss 從 0.82 → 0.70-0.75

---

### **選項 3: 基本面 + 事件整合** ⭐ 推薦 ⏱️ 2-4 週

**詳細設計**: 請參考 `/root/AIFX_v2/ml_engine/FUNDAMENTAL_EVENT_DESIGN.md`

#### **階段 2.1: 數據收集** (1-2 週)

##### 基本面數據
- [ ] **註冊 FRED API** (免費)
  - 美國利率 (FEDFUNDS)
  - 歐洲利率 (ECBDFR)
  - 英國利率 (GBPONTD156N)
  - 日本利率 (JPNIR)
  - CPI 通膨數據
  - GDP 數據

- [ ] **建立數據收集腳本**
  ```bash
  /root/AIFX_v2/ml_engine/scripts/
  ├── collect_fundamental_data.py    # 收集利率、GDP、CPI
  ├── collect_economic_calendar.py   # 經濟日曆爬蟲
  └── align_data_timestamps.py       # 時間對齊
  ```

- [ ] **數據庫擴展**
  ```sql
  -- 新增表
  CREATE TABLE fundamental_data (...)
  CREATE TABLE economic_events (...)
  CREATE TABLE interest_rates (...)
  ```

##### 經濟日曆事件
- [ ] **Forex Factory 爬蟲**
  - 高影響事件 (央行決議、非農)
  - 中影響事件 (CPI、零售銷售)
  - 事件時間、預期值、實際值

- [ ] **事件特徵工程**
  - 距下個重大事件天數
  - 事件影響分數 (0-1)
  - 歷史波動率

---

#### **階段 2.2: 特徵工程** (1 週)

- [ ] **基本面特徵**
  ```python
  features_fundamental = [
      'interest_rate_diff_usd_eur',  # 利率差異 (影響 EURUSD)
      'interest_rate_diff_usd_gbp',  # 利率差異 (影響 GBPUSD)
      'gdp_growth_us_yoy',           # 美國 GDP 同比
      'gdp_growth_eu_yoy',           # 歐盟 GDP 同比
      'inflation_diff_us_eu',        # 通膨差異
      'unemployment_rate_us',        # 失業率
  ]
  ```

- [ ] **事件特徵**
  ```python
  features_event = [
      'days_to_fed_decision',        # 距 Fed 決議天數
      'days_to_nfp',                 # 距非農數據天數
      'event_impact_score',          # 事件影響分數
      'recent_volatility',           # 近期波動率
  ]
  ```

- [ ] **時間對齊邏輯**
  - 技術指標: 每日
  - 基本面: 月度/季度 → 前向填充
  - 事件: 不定期 → 距離特徵

---

#### **階段 2.3: 多模態模型** (1 週)

- [ ] **架構設計**
  ```python
  # 模型 v2.0: Multi-Input LSTM

  Input 1: 技術指標 (60, 28) → LSTM(64) → Dense(32)
  Input 2: 基本面 (10,)       → Dense(32) → Dense(16)
  Input 3: 事件 (5,)          → Dense(16) → Dense(8)

  Concatenate → Dense(64) → Dropout(0.3) → Dense(1)
  ```

- [ ] **訓練流程**
  1. 訓練純技術模型 (baseline) ✅ 已完成
  2. 訓練技術 + 基本面模型
  3. 訓練完整融合模型
  4. A/B 測試對比

- [ ] **評估指標**
  - RMSE (價格誤差)
  - **方向準確率** (比價格更重要！)
  - Sharpe Ratio (風險調整回報)
  - 事件期間準確率

---

#### **階段 2.4: API 升級** (1 週)

- [ ] **新增 API 端點**
  - `POST /predict/enhanced` - 融合預測
  - `GET /calendar/{currency}` - 經濟日曆
  - `GET /risk-assessment/{pair}` - 風險評估
  - `GET /fundamental/{pair}` - 基本面數據

- [ ] **預測結果格式升級**
  ```json
  {
    "prediction": {
      "price": 1.0850,
      "direction": "buy",
      "confidence": 0.75
    },
    "analysis": {
      "technical_signal": "bullish",
      "fundamental_bias": "neutral",
      "event_risk": "high"
    },
    "upcoming_events": [
      {
        "date": "2025-10-10",
        "event": "Fed Interest Rate Decision",
        "impact": "high",
        "forecast": "5.50%"
      }
    ],
    "risk_warning": "Major event in 3 days - reduce position size"
  }
  ```

---

## 📈 **預期效果對比**

| 模型版本 | 技術指標 | 基本面 | 事件 | 預期 val_loss | 方向準確率 |
|---------|---------|--------|------|--------------|-----------|
| **v1.0 (當前)** | ✅ | ❌ | ❌ | 0.82 | 55-60% |
| **v2.0 MVP** | ✅ | ✅ (利率) | ✅ (日曆) | 0.70-0.75 | 60-65% |
| **v2.0 完整** | ✅ | ✅ (全面) | ✅ (進階) | 0.65-0.70 | 65-70% |

---

## 🛠️ **快速命令參考**

### 訓練新貨幣對
```bash
cd /root/AIFX_v2/ml_engine
source venv/bin/activate

# 準備數據
python scripts/collect_yfinance_data.py --pair USDCAD
python scripts/prepare_training_data.py --pair USDCAD

# 後台訓練
screen -dmS usdcad_training bash -c "
  source venv/bin/activate && \
  python train_pair.py USDCAD 2>&1 | \
  tee logs/usdcad_training_\$(date +%Y%m%d_%H%M%S).log
"

# 檢查進度
screen -r usdcad_training
```

### 檢查現有模型
```bash
cd /root/AIFX_v2/ml_engine

# 列出所有模型
ls -lth saved_models/*.h5 | head -5

# 驗證模型
source venv/bin/activate
python -c "
import tensorflow as tf
model = tf.keras.models.load_model('saved_models/price_predictor_v1.0.0_20251007_140833.h5')
print(f'參數量: {model.count_params()}')
print(f'輸入: {model.input_shape}')
"
```

### 測試 ML API
```bash
cd /root/AIFX_v2/ml_engine
./test_ml_api.sh
```

### 重啟 ML API
```bash
cd /root/AIFX_v2/ml_engine
screen -X -S ml_api quit
screen -dmS ml_api bash -c "source venv/bin/activate && uvicorn api.ml_server:app --host 0.0.0.0 --port 8000"
```

---

## 📚 **重要文檔**

### 技術文檔
- **部署指南**: `DEPLOYMENT_GUIDE.md`
- **數據收集指南**: `DATA_COLLECTION_GUIDE.md`
- **基本面整合設計**: `FUNDAMENTAL_EVENT_DESIGN.md` ⭐ 新增

### 代碼結構
```
/root/AIFX_v2/ml_engine/
├── api/
│   └── ml_server.py              # FastAPI 服務
├── models/
│   └── price_predictor.py        # LSTM 模型
├── data_processing/
│   └── preprocessor.py           # 特徵工程
├── scripts/
│   ├── collect_yfinance_data.py  # 數據收集
│   └── prepare_training_data.py  # 數據準備
├── saved_models/                 # 已訓練模型
├── data/
│   ├── raw/                      # 原始數據
│   ├── processed/                # 處理後數據
│   └── training/                 # 訓練用 .npy 文件
└── logs/                         # 訓練日誌
```

---

## 🎯 **建議的開發路徑**

### **立即執行** (本週)
1. ✅ **驗證現有 3 個模型** - 已完成
2. 🔄 **選擇下一步方向**:
   - 選項 A: 訓練更多貨幣對 (快速擴展)
   - 選項 B: 模型優化調參 (提升準確率)
   - 選項 C: 基本面整合 (質的提升) ⭐ 推薦

### **短期目標** (1-2 週)
- 如果選擇選項 C:
  1. 註冊 FRED API key
  2. 收集基本面數據 (利率、GDP、CPI)
  3. 開發數據對齊腳本
  4. 建立 PostgreSQL 表結構

### **中期目標** (1 個月)
- 訓練 v2.0 融合模型 (技術 + 基本面)
- 部署增強 API
- A/B 測試對比 v1.0 vs v2.0

### **長期目標** (2-3 個月)
- 整合新聞情緒分析
- 多時間框架預測 (1H, 4H, 1D)
- 自動交易信號生成
- 回測系統

---

## 📊 **成功指標**

### 技術指標
- val_loss < 0.70 (當前 0.82)
- 方向準確率 > 60% (當前 55-60%)
- API 響應時間 < 500ms
- 模型載入時間 < 5s

### 業務指標
- 支持 10+ 貨幣對
- 每日預測準確率 > 65%
- 月度 Sharpe Ratio > 1.5
- 用戶反饋評分 > 4.0/5.0

---

## 💡 **關鍵決策點**

### 現在需要決定：

**問題 1**: 優先選擇哪個方向？
- [ ] 選項 A: 擴展貨幣對 (保守，快速)
- [ ] 選項 B: 模型優化 (技術提升)
- [ ] 選項 C: 基本面整合 (創新，高價值) ⭐

**問題 2**: 基本面整合範圍？
- [ ] MVP: 只整合利率數據 + 經濟日曆 (2 週)
- [ ] 標準: 利率 + GDP + CPI + 事件 (3 週)
- [ ] 完整: 包含新聞情緒分析 (4+ 週)

**問題 3**: 是否需要付費數據源？
- [ ] 免費方案: FRED + 爬蟲 ($0/月)
- [ ] 基礎付費: Trading Economics ($300/月)
- [ ] 完整方案: 多數據源 ($400+/月)

---

## 🚨 **下次對話開始時 - 立即執行**

### **步驟 1: 查看當前狀態**
```bash
# 查看 TODO 文件
cat /root/AIFX_v2/ML_ENGINE_TODO.md

# 檢查服務狀態
screen -ls

# 確認模型文件
ls -lth /root/AIFX_v2/ml_engine/saved_models/

# 檢查基本面數據
cd /root/AIFX_v2
PGPASSWORD=postgres psql -h localhost -U postgres -d aifx_v2_dev -c "
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns,
       pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('fundamental_data', 'economic_events', 'interest_rates')
ORDER BY table_name;
"
```

### **步驟 2: 繼續 Week 1-2 剩餘任務**

**優先任務 1**: 建立經濟日曆爬蟲
```bash
cd /root/AIFX_v2/ml_engine
source venv/bin/activate

# 安裝依賴 (如果需要)
pip install beautifulsoup4 lxml

# 創建並測試爬蟲
python scripts/collect_economic_calendar.py --test

# 執行完整收集
python scripts/collect_economic_calendar.py
```

**優先任務 2**: 建立基本面特徵工程模組
```bash
cd /root/AIFX_v2/ml_engine

# 創建特徵工程模組
# 文件位置: data_processing/fundamental_features.py

# 測試特徵計算
python -c "
from data_processing.fundamental_features import FundamentalFeatureEngineer
from datetime import datetime

engineer = FundamentalFeatureEngineer({
    'host': 'localhost',
    'database': 'aifx_v2_dev',
    'user': 'postgres',
    'password': 'postgres'
})

# 測試 EURUSD 基本面特徵
features = engineer.get_fundamental_features('EURUSD', datetime.now())
print(features.tail())

# 測試事件特徵
event_features = engineer.get_event_features('EURUSD', datetime.now())
print(event_features)
"
```

### **步驟 3: Week 2 模型開發**

**任務 1**: 建立多輸入 LSTM 模型
```bash
# 文件位置: models/multi_input_predictor.py
# 參考設計: PHASE2_MVP_PLAN.md

# 測試模型架構
python -c "
from models.multi_input_predictor import MultiInputPricePredictor

config = {...}  # 載入配置
model = MultiInputPricePredictor(config)

# 建立模型
model.build_model(
    technical_shape=(60, 28),
    fundamental_shape=10,
    event_shape=5
)

print('模型架構創建成功')
model.model.summary()
"
```

**任務 2**: 訓練 EURUSD v2.0
```bash
cd /root/AIFX_v2/ml_engine
source venv/bin/activate

# 準備訓練數據
python scripts/prepare_v2_training_data.py --pair EURUSD

# 開始訓練 (後台)
screen -dmS eurusd_v2_training bash -c "
  source venv/bin/activate && \
  python train_v2_pair.py EURUSD 2>&1 | \
  tee logs/eurusd_v2_training_\$(date +%Y%m%d_%H%M%S).log
"

# 監控訓練進度
screen -r eurusd_v2_training
```

### **關鍵檢查點**

✅ **已完成** (2025-10-08):
- FRED API key 註冊
- 3 個數據庫表創建
- 10,409 條基本面數據收集
- 7,301 個利率日期同步
- Git commit 推送 (1c55275)

🔄 **進行中**:
- [ ] 經濟日曆爬蟲 (Forex Factory)
- [ ] 基本面特徵工程模組

⏸️ **待開始**:
- [ ] 多輸入 LSTM v2.0 模型
- [ ] EURUSD v2.0 訓練
- [ ] v1.0 vs v2.0 對比測試
- [ ] ML API 升級 (3 個新端點)

### **預期時程**
- Week 1-2 剩餘: 2-3 天 (爬蟲 + 特徵工程)
- Week 2: 3-4 天 (模型開發 + 訓練)
- Week 3: 3-4 天 (API 升級 + 測試)
- **總計**: 2-3 週完成 Phase 2 MVP

### **成功標準**
- ✅ 基本面數據覆蓋 2005-2025 (已達成)
- 🎯 方向準確率從 55-60% 提升到 65-70%
- 🎯 val_loss 從 0.82 降至 0.65-0.70
- 🎯 事件前後預測準確率達 70-75%

---

**最後更新**: 2025-10-08 04:15
**當前狀態**: 🔄 Phase 2 MVP Week 1 完成 (43.75%)
**已訓練模型**: 3 個 v1.0 (EURUSD, GBPUSD, USDJPY)
**基本面數據**: 10,409 條 (US, EU, GB, JP)
**ML API**: 運行中 (port 8000)
**下一步**: 建立經濟日曆爬蟲 + 基本面特徵工程
