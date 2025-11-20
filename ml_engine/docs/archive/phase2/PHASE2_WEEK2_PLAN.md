# Phase 2 Week 2: Multi-Input LSTM v2.0 開發計劃

**Created**: 2025-10-08
**Status**: 🔄 Planning Complete - Ready for Implementation

---

## 📊 v1.0 架構分析（現有系統）

### 模型架構
```
Input: (60, 28) - 技術指標序列
  ↓
LSTM(64, return_sequences=True)
  ↓
LSTM(32, return_sequences=False)
  ↓
Dense(16, relu) → Dropout(0.2)
  ↓
Dense(8, relu) → Dropout(0.2)
  ↓
Dense(1, linear) - 價格預測
```

### 數據流程
1. **數據來源**: yfinance (20+ 年歷史數據)
2. **特徵**: 28 個技術指標
3. **序列長度**: 60 timesteps
4. **標準化**: sklearn StandardScaler
5. **訓練集**: 80% train, 20% test

### v1.0 性能
| 模型 | val_loss | 參數量 | 訓練樣本 |
|------|----------|--------|----------|
| EURUSD | 0.839 | 142,881 | 6,288 |
| GBPUSD | 0.816 | 142,881 | 4,335 |
| USDJPY | 0.826 | 142,881 | 5,141 |

---

## 🎯 v2.0 多輸入 LSTM 架構設計

### 設計目標
1. ✅ 整合技術指標 + 基本面 + 經濟事件
2. ✅ 提升方向準確率：55-60% → 65-70%
3. ✅ 降低 val_loss：0.82 → 0.65-0.70
4. ✅ 增強事件期間預測準確率

### 架構設計

```
┌─────────────────────────────────────────────────────────────┐
│                      Multi-Input LSTM v2.0                  │
└─────────────────────────────────────────────────────────────┘

Input 1: 技術指標序列 (60, 28)
  ↓
LSTM(64, return_sequences=True)
  ↓
LSTM(32, return_sequences=False)
  ↓
Dense(16, relu)
  ├─────────────────┐
                    │
Input 2: 基本面特徵 (7-10)
  ↓                 │
Dense(32, relu)     │
  ↓                 │
Dense(16, relu)     │
  ├─────────────────┤
                    │
Input 3: 事件特徵 (3-5)
  ↓                 │
Dense(16, relu)     │
  ↓                 │
Dense(8, relu)      │
  └─────────────────┤
                    ↓
            Concatenate (16+16+8 = 40)
                    ↓
            Dense(64, relu)
                    ↓
            Dropout(0.3)
                    ↓
            Dense(32, relu)
                    ↓
            Dropout(0.2)
                    ↓
            Dense(1, linear) - 價格預測
```

### 輸入特徵詳細規劃

#### Input 1: 技術指標 (60, 28)
- **來源**: 現有 v1.0 技術指標
- **序列長度**: 60 timesteps
- **特徵數**: 28 個技術指標
- **標準化**: StandardScaler（已訓練）

#### Input 2: 基本面特徵 (7-10)
**EURUSD 範例** (7 features):
1. `interest_rate_diff_us_eu` - 利率差異
2. `gdp_growth_us_yoy` - 美國 GDP 年增率
3. `gdp_growth_eu_yoy` - 歐盟 GDP 年增率
4. `inflation_diff_us_eu` - 通膨差異
5. `days_to_next_high_event` - 距下個高影響事件天數
6. `next_event_impact_score` - 事件影響分數
7. `high_events_next_7d` - 未來7天高影響事件數

**標準化**: MinMaxScaler (0-1 範圍)

#### Input 3: 事件特徵 (3-5)
**Event Window Features**:
1. `event_within_24h` - 24小時內有高影響事件 (0/1)
2. `event_within_48h` - 48小時內有高影響事件 (0/1)
3. `cumulative_event_score` - 累積事件影響分數
4. `days_since_last_event` - 距上個事件天數
5. `event_density_7d` - 7天事件密度

**標準化**: StandardScaler

---

## 📁 文件結構規劃

```
/root/AIFX_v2/ml_engine/
├── models/
│   ├── price_predictor.py              # v1.0 (保留)
│   └── multi_input_predictor.py        # v2.0 新增 ⭐
├── data_processing/
│   ├── preprocessor.py                 # v1.0 預處理器
│   └── fundamental_features.py         # ✅ 已完成
├── scripts/
│   ├── prepare_training_data.py        # v1.0 數據準備
│   └── prepare_v2_training_data.py     # v2.0 數據準備 ⭐
├── train_pair.py                       # v1.0 訓練腳本
├── train_v2_pair.py                    # v2.0 訓練腳本 ⭐
└── data/
    ├── training/                       # v1.0 訓練數據
    └── training_v2/                    # v2.0 訓練數據 ⭐
        ├── EURUSD_technical_X.npy      # 技術指標序列
        ├── EURUSD_fundamental_X.npy    # 基本面特徵
        ├── EURUSD_event_X.npy          # 事件特徵
        └── EURUSD_y.npy                # 目標值
```

---

## 🔄 數據準備流程

### Step 1: 技術指標準備
```python
# 使用現有 v1.0 數據
technical_data = load_v1_technical_data(pair, start_date, end_date)
# Shape: (n_samples, 60, 28)
```

### Step 2: 基本面特徵提取
```python
from data_processing.fundamental_features import FundamentalFeatureEngineer

engineer = FundamentalFeatureEngineer()
fundamental_features = engineer.get_all_features(
    pair='EURUSD',
    start_date=start_date,
    end_date=end_date
)
# Shape: (n_days, 7-10)
```

### Step 3: 時間對齊
```python
# 確保所有數據時間戳一致
aligned_data = align_all_features(
    technical=technical_data,
    fundamental=fundamental_features,
    dates=common_dates
)
```

### Step 4: 事件特徵工程
```python
event_features = create_event_features(
    economic_events=events_df,
    dates=common_dates
)
# Shape: (n_samples, 3-5)
```

### Step 5: 序列化和分割
```python
# 創建序列（技術指標需要序列，基本面/事件使用當前值）
X_technical = create_sequences(technical_data, sequence_length=60)
X_fundamental = fundamental_features[-len(X_technical):]
X_event = event_features[-len(X_technical):]
y = create_targets(price_data, sequence_length=60)

# 分割訓練/測試集 (80/20)
train_test_split(X_technical, X_fundamental, X_event, y)
```

---

## 📊 評估指標設計

### 1. 價格預測精度
- **MSE** (Mean Squared Error)
- **MAE** (Mean Absolute Error)
- **RMSE** (Root Mean Squared Error)

### 2. 方向準確率 ⭐ 最重要
```python
def directional_accuracy(y_true, y_pred):
    """
    計算價格變動方向預測準確率
    上漲預測正確 or 下跌預測正確
    """
    y_true_direction = np.diff(y_true) > 0
    y_pred_direction = np.diff(y_pred) > 0
    return np.mean(y_true_direction == y_pred_direction)
```

### 3. Sharpe Ratio
```python
def sharpe_ratio(returns, risk_free_rate=0.02):
    """
    計算策略 Sharpe Ratio
    基於預測信號的交易回報
    """
    excess_returns = returns - risk_free_rate / 252
    return np.sqrt(252) * np.mean(excess_returns) / np.std(excess_returns)
```

### 4. 事件期間性能
```python
def event_period_accuracy(y_true, y_pred, event_mask):
    """
    評估經濟事件期間（前後24h）的預測準確率
    """
    event_accuracy = directional_accuracy(
        y_true[event_mask],
        y_pred[event_mask]
    )
    return event_accuracy
```

### 5. 最大回撤
```python
def max_drawdown(equity_curve):
    """
    計算基於預測的最大回撤
    """
    cummax = np.maximum.accumulate(equity_curve)
    drawdown = (cummax - equity_curve) / cummax
    return np.max(drawdown)
```

---

## 🎓 訓練策略

### 超參數
```yaml
model:
  version: "2.0.0"

  # 技術指標 LSTM
  technical_lstm:
    units: [64, 32]
    dropout: 0.2
    recurrent_dropout: 0.1

  # 基本面 Dense
  fundamental_dense:
    units: [32, 16]
    activation: relu
    dropout: 0.2

  # 事件 Dense
  event_dense:
    units: [16, 8]
    activation: relu
    dropout: 0.2

  # Fusion
  fusion:
    units: [64, 32]
    dropout: [0.3, 0.2]

  training:
    epochs: 100
    batch_size: 32
    learning_rate: 0.001
    optimizer: adam
    loss: mse
    early_stopping_patience: 15
```

### Callbacks
1. **EarlyStopping**: patience=15, monitor='val_loss'
2. **ModelCheckpoint**: save_best_only=True
3. **ReduceLROnPlateau**: factor=0.5, patience=7
4. **TensorBoard**: log_dir='./logs/v2_runs'

### 數據增強（可選）
- Time warping
- Magnitude warping
- Window slicing

---

## 📈 成功標準

### Minimum Viable Performance (MVP)
- ✅ **v2.0 val_loss < 0.75** (v1.0: 0.82)
- ✅ **方向準確率 > 60%** (v1.0: 55-60%)
- ✅ **事件期間準確率 > 65%**
- ✅ **模型訓練穩定（不過擬合）**

### Target Performance (優秀)
- 🎯 **v2.0 val_loss < 0.70**
- 🎯 **方向準確率 > 65%**
- 🎯 **事件期間準確率 > 70%**
- 🎯 **Sharpe Ratio > 1.0**

---

## 🚀 實作順序

### Phase 1: 數據準備 (預計 1-2 天)
1. ✅ 建立 `prepare_v2_training_data.py`
2. ✅ 整合技術 + 基本面 + 事件特徵
3. ✅ 時間對齊和標準化
4. ✅ 測試 EURUSD 2024 數據

### Phase 2: 模型實現 (預計 1-2 天)
1. ✅ 建立 `MultiInputPricePredictor` 類
2. ✅ 實現多輸入架構
3. ✅ 實現評估指標
4. ✅ 測試模型編譯

### Phase 3: 訓練與評估 (預計 1-2 天)
1. ✅ 訓練 EURUSD v2.0
2. ✅ 評估性能指標
3. ✅ A/B 測試 v1.0 vs v2.0
4. ✅ 調優超參數

---

## 🔍 風險與挑戰

### 技術挑戰
1. **時間對齊複雜度**
   - 技術指標：分鐘級
   - 基本面：月度/季度
   - 事件：不定期
   - **解決**: 前向填充 + 序列最後值

2. **過擬合風險**
   - 特徵數增加 (28 → 38-43)
   - **解決**: 更高 dropout, early stopping, regularization

3. **訓練時間**
   - 多輸入模型更複雜
   - **解決**: GPU 加速, 批次訓練

### 數據挑戰
1. **基本面數據稀疏**
   - GDP 季度數據有限
   - **解決**: 前向填充 + 使用變化率

2. **事件數據不平衡**
   - 高影響事件較少
   - **解決**: 事件窗口特徵 + 加權

---

## 📝 驗證清單

### 數據準備階段
- [ ] 技術指標數據完整性驗證
- [ ] 基本面特徵無缺失值
- [ ] 事件特徵正確計算
- [ ] 時間戳完全對齊
- [ ] 標準化器正確保存

### 模型訓練階段
- [ ] 模型架構正確編譯
- [ ] 輸入形狀匹配
- [ ] 訓練過程穩定
- [ ] Validation loss 下降
- [ ] 無內存溢出

### 評估階段
- [ ] 所有評估指標實現
- [ ] v1.0 vs v2.0 對比
- [ ] 事件期間性能分析
- [ ] 可視化結果生成

---

## 📚 參考資料

### 相關文檔
- `ML_ENGINE_TODO.md` - 項目總體進度
- `FUNDAMENTAL_EVENT_DESIGN.md` - 基本面整合設計
- `DATA_COLLECTION_GUIDE.md` - 數據收集指南
- `fundamental_features.py` - 特徵工程實現

### 論文參考
- Multi-Input LSTM for Forex Prediction
- Event-Driven Trading with Deep Learning
- Fundamental Analysis meets Technical Analysis

---

**計劃狀態**: ✅ Ready for Implementation
**預計完成時間**: 3-5 天
**下一步**: 實現 `prepare_v2_training_data.py`
