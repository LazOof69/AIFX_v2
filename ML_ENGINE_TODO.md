# ML 引擎任務清單

**最後更新**: 2025-10-07 14:40
**當前狀態**: ✅ 階段 1 完成 - 3 個貨幣對技術指標模型已訓練完成

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

### 🔄 **階段 2: 基本面 + 事件整合 (規劃中)**
- [ ] 數據源整合
- [ ] 特徵工程升級
- [ ] 多模態模型訓練
- [ ] API 功能擴展

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

## 🚨 **下次對話開始時**

1. 查看此文件: `cat /root/AIFX_v2/ML_ENGINE_TODO.md`
2. 檢查服務狀態: `screen -ls`
3. 確認模型文件: `ls -lth /root/AIFX_v2/ml_engine/saved_models/`
4. **決定下一步方向** (選項 A/B/C)

---

**最後更新**: 2025-10-07 14:40
**當前狀態**: ✅ 階段 1 完成，準備進入階段 2
**已訓練模型**: 3 個 (EURUSD, GBPUSD, USDJPY)
**ML API**: 運行中 (port 8000)
