# 🌐 基本面 + 事件整合設計方案

**創建時間**: 2025-10-07 14:35  
**目標**: 將基本面分析和重大事件整合到價格預測系統

---

## 🎯 核心理念

### 當前系統 (純技術指標)
```
歷史價格 → 技術指標 (28個) → LSTM → 價格預測
```
**限制**：
- 只考慮歷史價格走勢
- 無法預測突發事件影響
- 忽略經濟基本面

### 升級後系統 (多模態融合)
```
技術指標 (LSTM) ────┐
                    │
基本面數據 (Dense) ──┼─→ Fusion Layer → 增強預測
                    │
事件影響 (Embed) ────┘
```

---

## 📊 數據源設計

### 1️⃣ **基本面數據**

#### **利率數據** (最重要！)
- **數據源**: FRED API, Trading Economics
- **指標**:
  - 美國聯準會利率 (Fed Funds Rate)
  - 歐洲央行利率 (ECB Rate)
  - 英國央行利率 (BoE Rate)
  - 日本央行利率 (BoJ Rate)
  - **利率差異** (如 USD-EUR, GBP-USD)

#### **經濟指標**
| 指標 | 更新頻率 | 重要性 | 數據源 |
|------|---------|-------|--------|
| GDP | 季度 | ⭐⭐⭐⭐⭐ | World Bank, FRED |
| CPI (通膨) | 月度 | ⭐⭐⭐⭐⭐ | FRED, Trading Economics |
| 失業率 | 月度 | ⭐⭐⭐⭐ | BLS, FRED |
| PMI 指數 | 月度 | ⭐⭐⭐⭐ | IHS Markit |
| 貿易餘額 | 月度 | ⭐⭐⭐ | Census Bureau |
| 零售銷售 | 月度 | ⭐⭐⭐ | FRED |

#### **特徵工程範例**
```python
# 利率差異特徵
interest_rate_diff_usd_eur = fed_rate - ecb_rate  # 影響 EURUSD

# 經濟指標同比變化
gdp_yoy = (gdp_current - gdp_year_ago) / gdp_year_ago * 100

# 通膨差異
inflation_diff = us_cpi_yoy - eu_cpi_yoy
```

---

### 2️⃣ **事件數據**

#### **經濟日曆事件**
- **數據源**: 
  - Forex Factory API
  - Investing.com 經濟日曆
  - Trading Economics Events

- **事件分類**:
  | 影響級別 | 範例事件 | 預期波動 |
  |---------|---------|---------|
  | 🔴 高 | 非農就業、央行決議、GDP | 50-200 pips |
  | 🟡 中 | CPI、零售銷售、PMI | 20-50 pips |
  | 🟢 低 | 企業財報、演講 | 5-20 pips |

- **事件特徵**:
  ```python
  event_features = {
      'days_until_event': 2,           # 距離事件天數
      'event_impact': 'high',          # 事件影響級別
      'event_category': 'interest_rate', # 事件類別
      'previous_value': 5.25,          # 前次數據
      'forecast_value': 5.50,          # 預測值
      'actual_value': 5.75,            # 實際值（事後）
      'surprise_index': 0.5            # 意外指數
  }
  ```

#### **地緣政治事件**
- 戰爭/衝突
- 選舉
- 貿易協議
- 制裁措施

**數據源**: NewsAPI, GDELT Project

---

### 3️⃣ **新聞情緒分析** (進階)

```python
# 新聞標題範例
news = "Fed signals more rate hikes amid inflation concerns"

# 情緒分析
sentiment_score = analyze_sentiment(news)  # -1.0 to 1.0
# 結果: -0.3 (偏負面 → 可能利空美元)

# 關鍵詞提取
keywords = ["Fed", "rate hikes", "inflation"]
```

**數據源**:
- NewsAPI (新聞標題)
- Twitter API (市場情緒)
- Bloomberg/Reuters (專業新聞)

---

## 🏗️ 模型架構升級

### **方案 1: 多輸入 LSTM** (推薦)

```python
# 輸入 1: 技術指標序列 (60 timesteps, 28 features)
technical_input = Input(shape=(60, 28))
technical_lstm = LSTM(64)(technical_input)

# 輸入 2: 基本面數據 (靜態特徵)
fundamental_input = Input(shape=(10,))  # 10 個基本面指標
fundamental_dense = Dense(32, activation='relu')(fundamental_input)

# 輸入 3: 事件特徵
event_input = Input(shape=(5,))  # 5 個事件特徵
event_dense = Dense(16, activation='relu')(event_input)

# 融合層
merged = Concatenate()([technical_lstm, fundamental_dense, event_dense])
fusion = Dense(64, activation='relu')(merged)
fusion = Dropout(0.3)(fusion)

# 輸出
output = Dense(1, activation='linear')(fusion)  # 價格預測

model = Model(
    inputs=[technical_input, fundamental_input, event_input],
    outputs=output
)
```

**優勢**:
- 同時考慮技術、基本面、事件
- 各模組獨立訓練
- 可解釋性強

---

### **方案 2: 事件感知 Attention 機制**

```python
# 在預測時，根據事件重要性調整權重
class EventAwareAttention(Layer):
    def call(self, inputs, event_weight):
        # inputs: LSTM 輸出
        # event_weight: 事件重要性 (0-1)
        
        # 重大事件前 → 降低技術指標權重
        if event_weight > 0.8:
            technical_weight = 0.3
            fundamental_weight = 0.7
        else:
            technical_weight = 0.7
            fundamental_weight = 0.3
        
        return technical_weight * technical_pred + \
               fundamental_weight * fundamental_pred
```

**應用場景**:
- 央行決議前 1 天 → 提高基本面權重
- 平時 → 技術指標為主

---

### **方案 3: 集成學習 (Ensemble)**

```python
# 3 個獨立模型
model_technical = LSTM_Model()      # 技術指標模型
model_fundamental = Dense_Model()   # 基本面模型
model_event = Event_Model()         # 事件影響模型

# 加權平均
def ensemble_predict(data):
    pred_tech = model_technical.predict(data['technical'])
    pred_fund = model_fundamental.predict(data['fundamental'])
    pred_event = model_event.predict(data['event'])
    
    # 動態權重
    if has_major_event(data):
        weights = [0.2, 0.5, 0.3]  # 事件期間
    else:
        weights = [0.6, 0.3, 0.1]  # 平時
    
    final_pred = (
        weights[0] * pred_tech +
        weights[1] * pred_fund +
        weights[2] * pred_event
    )
    
    return final_pred
```

---

## 🔧 實現路徑

### **階段 1: 數據收集與整合** (1-2 週)

#### 任務清單
- [ ] 註冊 API Keys
  - [ ] FRED API (免費)
  - [ ] Trading Economics (付費/免費層)
  - [ ] Forex Factory (爬蟲或付費 API)
  - [ ] NewsAPI (免費層)

- [ ] 建立數據收集腳本
  - [ ] `collect_fundamental_data.py` - 收集基本面數據
  - [ ] `collect_economic_calendar.py` - 收集經濟日曆
  - [ ] `collect_news_sentiment.py` - 新聞情緒分析

- [ ] 數據庫設計
  ```sql
  -- 基本面數據表
  CREATE TABLE fundamental_data (
      id SERIAL PRIMARY KEY,
      date DATE,
      country VARCHAR(10),
      indicator VARCHAR(50),
      value DECIMAL(10,4),
      created_at TIMESTAMP
  );
  
  -- 經濟事件表
  CREATE TABLE economic_events (
      id SERIAL PRIMARY KEY,
      event_date DATETIME,
      currency VARCHAR(10),
      event_name VARCHAR(200),
      impact_level ENUM('high', 'medium', 'low'),
      forecast_value DECIMAL(10,4),
      actual_value DECIMAL(10,4),
      previous_value DECIMAL(10,4)
  );
  ```

---

### **階段 2: 特徵工程** (1 週)

- [ ] 基本面特徵
  ```python
  features_fundamental = [
      'interest_rate_diff',    # 利率差異
      'gdp_growth_yoy',        # GDP 同比增長
      'inflation_diff',        # 通膨差異
      'unemployment_rate',     # 失業率
      'pmi_manufacturing',     # 製造業 PMI
      'trade_balance',         # 貿易餘額
  ]
  ```

- [ ] 事件特徵
  ```python
  features_event = [
      'days_to_next_event',    # 距下個重大事件天數
      'event_impact_score',    # 事件影響分數 (0-1)
      'surprise_index',        # 數據意外指數
      'event_frequency',       # 近期事件頻率
  ]
  ```

- [ ] 時間對齊
  - 確保技術指標、基本面、事件數據時間戳一致
  - 處理缺失值（前向填充、插值）

---

### **階段 3: 模型訓練** (2 週)

#### 訓練策略
1. **基準模型** (已完成)
   - 純技術指標 LSTM
   - val_loss: 0.82

2. **基本面增強模型**
   - 技術指標 + 基本面
   - 預期 val_loss: 0.70-0.75

3. **完整融合模型**
   - 技術 + 基本面 + 事件
   - 預期 val_loss: 0.65-0.70

#### 評估指標
```python
metrics = {
    'mae': 平均絕對誤差,
    'rmse': 均方根誤差,
    'directional_accuracy': 方向準確率,  # 重要！
    'profit_factor': 盈利因子,
    'sharpe_ratio': 夏普比率
}
```

---

### **階段 4: API 升級** (1 週)

#### 新增 API 端點

```python
# 1. 增強預測 API
@app.post("/predict/enhanced")
async def predict_enhanced(request: PredictRequest):
    """
    整合技術、基本面、事件的預測
    """
    # 獲取技術指標
    technical_data = get_technical_indicators(request.pair)
    
    # 獲取基本面數據
    fundamental_data = get_fundamental_data(request.pair)
    
    # 獲取近期事件
    upcoming_events = get_upcoming_events(request.pair)
    
    # 融合預測
    prediction = ensemble_model.predict({
        'technical': technical_data,
        'fundamental': fundamental_data,
        'events': upcoming_events
    })
    
    return {
        'prediction': prediction,
        'technical_signal': technical_pred,
        'fundamental_bias': fundamental_pred,
        'event_risk': event_risk_score,
        'confidence': confidence,
        'upcoming_events': upcoming_events[:3]
    }

# 2. 經濟日曆 API
@app.get("/calendar/{currency}")
async def get_economic_calendar(currency: str, days: int = 7):
    """
    獲取未來 N 天的經濟事件
    """
    events = db.query(EconomicEvents).filter(
        event_date >= today,
        event_date <= today + timedelta(days=days),
        currency == currency
    ).all()
    
    return {'events': events}

# 3. 風險評估 API
@app.get("/risk-assessment/{pair}")
async def assess_risk(pair: str):
    """
    評估當前市場風險
    """
    # 檢查未來 7 天重大事件
    high_impact_events = count_high_impact_events(pair, days=7)
    
    # 波動率分析
    volatility = calculate_volatility(pair)
    
    # 風險評級
    risk_level = calculate_risk_level(high_impact_events, volatility)
    
    return {
        'risk_level': risk_level,  # 'low', 'medium', 'high'
        'volatility': volatility,
        'upcoming_events': high_impact_events,
        'recommendation': 'Reduce position size' if risk_level == 'high' else 'Normal'
    }
```

---

## 📈 預期效果

### **準確率提升**
```
純技術指標模型:
- 方向準確率: 55-60%
- RMSE: 0.90

技術 + 基本面:
- 方向準確率: 60-65% (+5%)
- RMSE: 0.75 (-17%)

技術 + 基本面 + 事件:
- 方向準確率: 65-70% (+10%)
- RMSE: 0.65 (-28%)
- 事件前後預測準確率: 70-75%
```

### **實際應用案例**

#### 案例 1: 央行升息決議
```
情境: Fed 宣布升息 0.5% (超出市場預期 0.25%)

傳統技術指標模型:
- 預測: EURUSD 下跌 20 pips
- 實際: EURUSD 下跌 120 pips
- ❌ 嚴重低估

融合模型:
- 事件檢測: Fed 決議 (高影響)
- 意外指數: 0.75 (超出預期)
- 預測: EURUSD 下跌 100-150 pips
- 實際: EURUSD 下跌 120 pips
- ✅ 準確預測
```

#### 案例 2: 非農就業數據
```
情境: 美國非農就業大幅優於預期

技術模型: 無法預測突變
融合模型: 
- 提前 24 小時警告高風險
- 建議減少倉位
- 預測波動範圍 80-150 pips
- ✅ 有效風險管理
```

---

## 🚀 快速開始建議

### **MVP (最小可行產品) - 2 週**

優先整合：
1. ✅ **利率數據** (FRED API)
   - 最容易獲取
   - 影響最直接
   - 更新頻率適中

2. ✅ **經濟日曆** (Forex Factory)
   - 識別高風險時段
   - 調整預測信心度
   - 風險警告

3. ✅ **方向準確率評估**
   - 比價格預測更重要
   - 交易決策更實用

**暫時跳過**:
- ⏸️ 新聞情緒分析 (技術複雜)
- ⏸️ 地緣政治事件 (難以量化)
- ⏸️ 複雜 Attention 機制

---

## 💰 成本估算

### 免費方案
- FRED API: ✅ 免費
- World Bank API: ✅ 免費
- NewsAPI: ✅ 免費 (100 req/day)
- Forex Factory: ⚠️ 需爬蟲

**總成本**: $0/月

### 付費方案 (推薦)
- Trading Economics API: $300/月
- Alpha Vantage Premium: $50/月
- Finnhub API: $60/月

**總成本**: $410/月

---

## 📋 下一步行動

1. **決定實現範圍**: MVP vs 完整版
2. **註冊 API Keys**: 從免費的開始
3. **數據探索**: 下載樣本數據測試
4. **原型開發**: 先用 1 個貨幣對測試
5. **效果評估**: 對比純技術指標模型

---

**文檔版本**: 1.0  
**最後更新**: 2025-10-07 14:35
