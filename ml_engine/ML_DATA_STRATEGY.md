# AIFX v2 Multi-Modal ML Data Strategy

## 問題分析

### 目前狀況（不足）
- ✅ **技術分析**: OHLC + 28個技術指標
- ❌ **基本面分析**: 經濟數據、利率、GDP、通膨等 - **完全缺失**
- ❌ **情緒分析**: 新聞情緒、社交媒體、市場恐慌指數 - **完全缺失**
- ❌ **事件驅動**: 央行會議、經濟數據公布、地緣政治 - **完全缺失**

### 為什麼這很重要？

外匯市場是**全球最複雜的金融市場**，影響因素包括：

1. **技術面**（20%權重）- 價格走勢、技術指標
2. **基本面**（40%權重）- 經濟數據、利率政策、國際收支
3. **情緒面**（25%權重）- 新聞情緒、市場恐慌、風險偏好
4. **事件面**（15%權重）- 央行決策、政治事件、突發新聞

## 完整資料架構設計

```
┌─────────────────────────────────────────────────────────────┐
│                    Multi-Modal Input Layer                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Technical   │  │ Fundamental  │  │  Sentiment   │      │
│  │  Features    │  │  Features    │  │  Features    │      │
│  │              │  │              │  │              │      │
│  │ • OHLC       │  │ • Interest   │  │ • News       │      │
│  │ • SMA/EMA    │  │   Rates      │  │   Sentiment  │      │
│  │ • RSI        │  │ • GDP        │  │ • Social     │      │
│  │ • MACD       │  │ • CPI        │  │   Media      │      │
│  │ • Bollinger  │  │ • PMI        │  │ • VIX        │      │
│  │ • ATR        │  │ • Trade      │  │ • Fear Index │      │
│  │ • Stochastic │  │   Balance    │  │ • COT Data   │      │
│  │ • ADX        │  │ • Employment │  │              │      │
│  │              │  │ • Retail     │  │              │      │
│  │              │  │   Sales      │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│                    ┌──────────────┐                          │
│                    │   Events     │                          │
│                    │   Features   │                          │
│                    │              │                          │
│                    │ • Central    │                          │
│                    │   Bank Meets │                          │
│                    │ • Econ Data  │                          │
│                    │   Releases   │                          │
│                    │ • Political  │                          │
│                    │   Events     │                          │
│                    └──────────────┘                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      ML Model Layer                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    LSTM      │  │  Transformer │  │   Attention  │      │
│  │   (Price)    │  │   (News)     │  │   Mechanism  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│           ↓                ↓                 ↓               │
│           └────────────────┴─────────────────┘               │
│                            ↓                                 │
│                   ┌──────────────┐                           │
│                   │   Ensemble   │                           │
│                   │    Model     │                           │
│                   └──────────────┘                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       Output Layer                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  {                                                            │
│    "prediction": "buy" | "sell" | "hold",                    │
│    "confidence": 0.85,                                        │
│    "factors": {                                               │
│      "technical": 0.72,   ← 技術面分數                        │
│      "sentiment": 0.91,   ← 情緒面分數                        │
│      "pattern": 0.68      ← 模式識別分數                      │
│    },                                                         │
│    "reasoning": {                                             │
│      "technical": "Strong uptrend, RSI not overbought",      │
│      "fundamental": "Fed rate cut expected, USD weakening",  │
│      "sentiment": "Positive news flow on EUR economy",       │
│      "events": "ECB meeting in 2 days, hawkish expected"     │
│    }                                                          │
│  }                                                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 資料來源規劃

### 1. 技術數據（已實作 ✓）

**來源**: Alpha Vantage, Twelve Data
**數據**: OHLC, Volume
**指標**: 28 個技術指標

---

### 2. 基本面數據（待實作 ⚠️）

#### A. 利率數據
**來源**:
- FRED API (Federal Reserve Economic Data) - **免費**
- Trading Economics API - 付費
- Alpha Vantage (FEDERAL_FUNDS_RATE) - **免費**

**數據點**:
```python
{
  "USD": {
    "interest_rate": 5.25,          # 聯準會基準利率
    "rate_change": 0.25,             # 最近變化
    "expected_change": -0.25,        # 市場預期
    "next_meeting": "2025-10-15"     # 下次會議
  },
  "EUR": {
    "interest_rate": 3.75,
    "ecb_rate": 3.75
  }
}
```

**API 範例**:
```bash
# FRED API (免費，需註冊)
https://api.stlouisfed.org/fred/series/observations?series_id=FEDFUNDS&api_key=YOUR_KEY

# Alpha Vantage
https://www.alphavantage.co/query?function=FEDERAL_FUNDS_RATE&apikey=demo
```

#### B. 經濟指標
**來源**:
- FRED API - **免費**
- Trading Economics - 付費
- World Bank API - **免費**

**關鍵指標**:
```python
economic_indicators = {
  "US": {
    "gdp_growth": 2.1,              # GDP 成長率
    "cpi": 3.2,                     # 消費者物價指數（通膨）
    "unemployment": 3.8,            # 失業率
    "pmi_manufacturing": 48.5,      # 製造業 PMI
    "retail_sales_change": 0.6,     # 零售銷售變化
    "trade_balance": -65.5,         # 貿易餘額（十億美元）
    "consumer_confidence": 102.3    # 消費者信心指數
  },
  "EU": {
    "gdp_growth": 0.5,
    "cpi": 2.4,
    "unemployment": 6.5
  }
}
```

**實作位置**: `ml_engine/data_collectors/economic_collector.py`

---

### 3. 情緒分析（待實作 ⚠️）

#### A. 新聞情緒
**來源**:
- **NewsAPI.org** - 免費（每天 100 請求）
- **Finnhub** - 免費層級
- **AlphaVantage NEWS_SENTIMENT** - 免費

**處理流程**:
```
新聞文章 → FinBERT 模型 → 情緒分數 (-1 到 +1)
          ↓
關鍵詞提取: "rate hike", "recession", "hawkish", "dovish"
          ↓
聚合: 每日情緒分數
```

**FinBERT 使用**:
```python
from transformers import BertTokenizer, BertForSequenceClassification
import torch

# 載入預訓練模型
tokenizer = BertTokenizer.from_pretrained('ProsusAI/finbert')
model = BertForSequenceClassification.from_pretrained('ProsusAI/finbert')

def analyze_sentiment(text):
    inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True)
    outputs = model(**inputs)
    probs = torch.nn.functional.softmax(outputs.logits, dim=-1)

    # FinBERT 輸出: [positive, negative, neutral]
    sentiment_score = probs[0][0].item() - probs[0][1].item()  # -1 到 +1
    return sentiment_score

# 範例
news = "Fed signals potential rate cuts as inflation cools"
sentiment = analyze_sentiment(news)  # 正面 = 0.75
```

**實作位置**: `ml_engine/data_collectors/news_collector.py`

#### B. 社交媒體情緒
**來源**:
- Twitter API (X API) - 付費
- Reddit API - **免費**
- StockTwits API - **免費**

**範例**:
```python
# Reddit r/Forex sentiment
import praw

reddit = praw.Reddit(client_id='...', client_secret='...')
subreddit = reddit.subreddit('Forex')

posts = subreddit.hot(limit=100)
for post in posts:
    if 'EUR/USD' in post.title:
        sentiment = analyze_sentiment(post.title + post.selftext)
        # 聚合情緒
```

#### C. 市場情緒指標
**來源**:
- VIX (恐慌指數) - Yahoo Finance API
- COT Report (大戶持倉) - CFTC API - **免費**

---

### 4. 事件日曆（待實作 ⚠️）

#### 經濟日曆 API
**來源**:
- **Forex Factory** - 免費（需爬蟲）
- **Investing.com** - 免費（需爬蟲）
- **Trading Economics Calendar API** - 付費

**事件類型**:
```python
calendar_events = {
  "2025-10-15": {
    "event": "FOMC Interest Rate Decision",
    "currency": "USD",
    "impact": "high",           # high/medium/low
    "forecast": 5.00,
    "previous": 5.25,
    "time": "14:00 EST"
  },
  "2025-10-16": {
    "event": "US CPI Release",
    "currency": "USD",
    "impact": "high",
    "forecast": 3.1,
    "previous": 3.2
  }
}
```

**事件特徵工程**:
```python
# 計算「距離重大事件的時間」特徵
days_until_fed_meeting = 2
hours_until_cpi = 18

# 事件前後價格行為學習
event_impact_score = model.predict_event_impact(
    event_type='FOMC',
    forecast_vs_previous=0.25,  # 預期降息 0.25%
    market_positioning='long_usd'
)
```

---

## 資料整合架構

### 資料流程
```
┌──────────────────┐
│  Data Collectors │
│                  │
│ 1. price_collector.py      (技術數據)
│ 2. news_collector.py       (新聞)
│ 3. economic_collector.py   (經濟數據)
│ 4. calendar_collector.py   (事件日曆)
│ 5. sentiment_analyzer.py   (情緒分析)
└────────┬─────────┘
         ↓
┌──────────────────┐
│  Feature Engine  │
│                  │
│ 1. technical_features.py
│ 2. fundamental_features.py
│ 3. sentiment_features.py
│ 4. event_features.py
└────────┬─────────┘
         ↓
┌──────────────────┐
│  Data Warehouse  │
│                  │
│ PostgreSQL Tables:
│ - market_prices
│ - economic_indicators
│ - news_sentiment
│ - event_calendar
│ - aggregated_features
└────────┬─────────┘
         ↓
┌──────────────────┐
│  Training Data   │
│  Generator       │
│                  │
│ Merge all sources by timestamp
│ Create feature matrix
│ Generate labels
└────────┬─────────┘
         ↓
┌──────────────────┐
│   ML Model       │
│                  │
│ Multi-input LSTM + Transformer
└──────────────────┘
```

---

## 資料庫 Schema 設計

### 1. market_prices (已有)
```sql
CREATE TABLE market_prices (
  id UUID PRIMARY KEY,
  pair VARCHAR(10),
  timestamp TIMESTAMPTZ,
  open NUMERIC,
  high NUMERIC,
  low NUMERIC,
  close NUMERIC,
  volume BIGINT,
  -- 技術指標
  sma_20 NUMERIC,
  rsi_14 NUMERIC,
  macd NUMERIC,
  ...
);
```

### 2. economic_indicators (新增)
```sql
CREATE TABLE economic_indicators (
  id UUID PRIMARY KEY,
  country VARCHAR(3),          -- 'US', 'EU', 'GB', 'JP'
  indicator_type VARCHAR(50),  -- 'GDP', 'CPI', 'INTEREST_RATE'
  value NUMERIC,
  previous_value NUMERIC,
  forecast NUMERIC,
  release_date TIMESTAMPTZ,
  impact VARCHAR(10),          -- 'high', 'medium', 'low'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_econ_country_date ON economic_indicators(country, release_date);
```

### 3. news_sentiment (新增)
```sql
CREATE TABLE news_sentiment (
  id UUID PRIMARY KEY,
  source VARCHAR(50),          -- 'NewsAPI', 'Reddit', 'Twitter'
  title TEXT,
  content TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  currency_mentioned VARCHAR(10)[],  -- ['USD', 'EUR']
  sentiment_score NUMERIC,     -- -1.0 to 1.0
  confidence NUMERIC,          -- 0.0 to 1.0
  keywords TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_news_published ON news_sentiment(published_at);
CREATE INDEX idx_news_currency ON news_sentiment USING GIN(currency_mentioned);
```

### 4. event_calendar (新增)
```sql
CREATE TABLE event_calendar (
  id UUID PRIMARY KEY,
  event_name VARCHAR(200),
  event_type VARCHAR(50),      -- 'CENTRAL_BANK', 'ECONOMIC_DATA', 'POLITICAL'
  currency VARCHAR(10),
  impact VARCHAR(10),          -- 'high', 'medium', 'low'
  event_time TIMESTAMPTZ,
  forecast NUMERIC,
  previous NUMERIC,
  actual NUMERIC,              -- 公布後填入
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_event_time ON event_calendar(event_time);
CREATE INDEX idx_event_currency ON event_calendar(currency);
```

### 5. aggregated_features (新增)
```sql
CREATE TABLE aggregated_features (
  id UUID PRIMARY KEY,
  pair VARCHAR(10),
  timestamp TIMESTAMPTZ,

  -- 技術特徵 (28 columns)
  technical_features JSONB,

  -- 基本面特徵
  base_interest_rate NUMERIC,
  quote_interest_rate NUMERIC,
  base_gdp_growth NUMERIC,
  quote_gdp_growth NUMERIC,
  base_cpi NUMERIC,
  quote_cpi NUMERIC,

  -- 情緒特徵
  news_sentiment_1h NUMERIC,   -- 過去1小時新聞情緒
  news_sentiment_24h NUMERIC,  -- 過去24小時新聞情緒
  news_sentiment_7d NUMERIC,   -- 過去7天新聞情緒
  social_sentiment NUMERIC,

  -- 事件特徵
  hours_until_next_event NUMERIC,
  next_event_impact VARCHAR(10),
  days_since_last_major_event NUMERIC,

  -- 標籤
  label INTEGER,               -- 0=sell, 1=hold, 2=buy

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agg_pair_time ON aggregated_features(pair, timestamp);
```

---

## 實作階段規劃

### Phase 1: 基本面數據集成（優先度：高）
**時程**: 2-3 天
**任務**:
- [ ] 註冊 FRED API key
- [ ] 實作 `economic_collector.py`
- [ ] 抓取利率、GDP、CPI、失業率數據
- [ ] 建立 `economic_indicators` 資料表
- [ ] 實作資料同步腳本（每日更新）

**程式碼架構**:
```python
# ml_engine/data_collectors/economic_collector.py
class EconomicDataCollector:
    def __init__(self):
        self.fred_api_key = os.getenv('FRED_API_KEY')

    def fetch_interest_rate(self, country='US'):
        # 抓取利率
        pass

    def fetch_gdp(self, country='US'):
        # 抓取 GDP
        pass

    def fetch_cpi(self, country='US'):
        # 抓取 CPI
        pass

    def sync_all_indicators(self):
        # 同步所有指標到資料庫
        pass
```

---

### Phase 2: 情緒分析集成（優先度：高）
**時程**: 3-4 天
**任務**:
- [ ] 註冊 NewsAPI key
- [ ] 安裝 FinBERT 模型
- [ ] 實作 `news_collector.py`
- [ ] 實作 `sentiment_analyzer.py`
- [ ] 建立 `news_sentiment` 資料表
- [ ] 實作每小時新聞抓取排程

**程式碼架構**:
```python
# ml_engine/data_collectors/news_collector.py
class NewsCollector:
    def __init__(self):
        self.news_api_key = os.getenv('NEWS_API_KEY')

    def fetch_forex_news(self, currency_pair='EUR/USD', hours=24):
        # 抓取相關新聞
        pass

# ml_engine/data_collectors/sentiment_analyzer.py
from transformers import BertTokenizer, BertForSequenceClassification

class SentimentAnalyzer:
    def __init__(self):
        self.tokenizer = BertTokenizer.from_pretrained('ProsusAI/finbert')
        self.model = BertForSequenceClassification.from_pretrained('ProsusAI/finbert')

    def analyze(self, text):
        # FinBERT 情緒分析
        pass

    def batch_analyze(self, texts):
        # 批次處理
        pass
```

---

### Phase 3: 事件日曆集成（優先度：中）
**時程**: 2-3 天
**任務**:
- [ ] 實作 Forex Factory 爬蟲
- [ ] 建立 `event_calendar` 資料表
- [ ] 實作事件特徵工程
- [ ] 計算「距離事件時間」特徵

---

### Phase 4: 多模態模型訓練（優先度：高）
**時程**: 5-7 天
**任務**:
- [ ] 設計多輸入 LSTM + Transformer 架構
- [ ] 實作注意力機制（Attention）
- [ ] 訓練 ensemble 模型
- [ ] 調整各因子權重

**模型架構**:
```python
# ml_engine/models/multi_modal_model.py
class MultiModalForexModel:
    def __init__(self):
        # Technical LSTM
        self.technical_lstm = LSTM(input_dim=28, hidden_dim=128)

        # Fundamental Dense Network
        self.fundamental_net = Dense(input_dim=10, hidden_dim=64)

        # Sentiment Transformer
        self.sentiment_transformer = Transformer(input_dim=5, heads=4)

        # Attention Layer
        self.attention = MultiHeadAttention(heads=3)

        # Output Layer
        self.output_layer = Dense(hidden_dim=32, output_dim=3)  # buy/hold/sell

    def forward(self, technical, fundamental, sentiment):
        # 三個輸入流
        tech_out = self.technical_lstm(technical)
        fund_out = self.fundamental_net(fundamental)
        sent_out = self.sentiment_transformer(sentiment)

        # 注意力聚合
        combined = self.attention([tech_out, fund_out, sent_out])

        # 輸出
        prediction = self.output_layer(combined)

        return {
            'prediction': prediction.argmax(),
            'confidence': prediction.max(),
            'factors': {
                'technical': tech_out.mean(),
                'sentiment': sent_out.mean(),
                'pattern': combined.mean()
            }
        }
```

---

## 免費 API 資源清單

### 推薦使用（免費層級）
1. **FRED API** - 經濟數據 ✅ 免費
   - https://fred.stlouisfed.org/docs/api/
   - 無限請求，需註冊

2. **NewsAPI.org** - 新聞 ✅ 免費（100 req/day）
   - https://newsapi.org/
   - 開發層級免費

3. **Alpha Vantage** - 價格 + 經濟數據 ✅ 免費
   - 已有 API key
   - 5 req/min 限制

4. **FinBERT** - 情緒分析 ✅ 開源
   - Hugging Face 模型
   - 本地運行，無限制

5. **Reddit API** - 社交情緒 ✅ 免費
   - https://www.reddit.com/dev/api/
   - 60 req/min

6. **CFTC COT Report** - 大戶持倉 ✅ 免費
   - https://publicreporting.cftc.gov/
   - 每週更新

---

## 下一步行動

**立即開始**:
1. ✅ 承認目前架構不足
2. ⚠️ 設計完整的多模態資料架構
3. ⚠️ 優先實作情緒分析（最容易實現，影響大）
4. ⚠️ 實作基本面數據收集
5. ⚠️ 重新設計 ML 模型（多輸入）

**需要用戶決策**:
- 是否要我立即開始實作情緒分析？
- 還是先完善目前的 LSTM 模型，之後再擴展？
- 預算考量：是否使用付費 API？

---

## 估計成本

### 免費方案（推薦）
- FRED API: $0
- NewsAPI (100/day): $0
- Alpha Vantage: $0
- FinBERT (本地): $0
- Reddit API: $0
**總成本**: $0/月

### 付費方案（可選）
- NewsAPI (無限制): $449/月
- Trading Economics: $200/月
- Twitter API: $100/月
**總成本**: ~$750/月

**建議**: 先使用免費方案，證明價值後再升級
