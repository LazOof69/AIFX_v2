# AIFX v2 - ML Engine 說明
# 價格預測與情緒分析

本文件說明 AIFX v2 的機器學習引擎架構與功能。

---

## 概述

ML Engine 是 AIFX v2 的核心預測引擎，整合價格預測和情緒分析：

| 功能 | 技術 | 說明 |
|------|------|------|
| 價格預測 | LSTM | 深度學習預測價格走勢 |
| 情緒分析 | FinBERT + VADER | 新聞情緒 + 央行政策分析 |
| API 服務 | FastAPI | 高性能 REST API |

**服務端口**: 8000

---

## 架構

```
                    Backend API
                        │
                        ▼
              ┌─────────────────────┐
              │    ML Engine        │
              │    (Port 8000)      │
              ├─────────────────────┤
              │                     │
              │  ┌───────────────┐  │
              │  │ 價格預測服務  │  │
              │  │ (LSTM Model)  │  │
              │  └───────┬───────┘  │
              │          │          │
              │  ┌───────▼───────┐  │
              │  │ 情緒分析服務  │  │
              │  │ (FinBERT)     │  │
              │  └───────┬───────┘  │
              │          │          │
              │  ┌───────▼───────┐  │
              │  │ 訊號融合      │  │
              │  │ (加權決策)    │  │
              │  └───────────────┘  │
              │                     │
              └─────────────────────┘
```

---

## 目錄結構

```
ml_engine/
├── api/                    # API 服務
│   ├── ml_server.py        # FastAPI 主程式
│   ├── prediction_service.py  # 預測服務
│   ├── reversal_api.py     # 反轉預測 API
│   └── model_manager.py    # 模型管理
├── services/               # 核心服務
│   ├── sentiment_analyzer.py  # 情緒分析服務
│   └── backend_api_client.py  # Backend API 客戶端
├── models/                 # 訓練好的模型
├── saved_models/           # 儲存的模型權重
├── data_processing/        # 數據處理
│   ├── twelvedata_fetcher.py  # Twelve Data API (主要)
│   ├── yfinance_fetcher.py    # yfinance (備用)
│   └── data_preprocessor.py   # 數據預處理
├── backtest/               # 回測系統
├── training/               # 模型訓練
├── scripts/                # 執行腳本
├── config.yaml             # 配置檔
└── requirements.txt        # Python 依賴
```

---

## 價格預測

### LSTM 模型架構

```
輸入層 (60 時間步 × 12 特徵)
         │
         ▼
┌─────────────────────────┐
│  LSTM Layer 1           │
│  (128 units)            │
│  return_sequences=True  │
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  LSTM Layer 2           │
│  (64 units)             │
│  return_sequences=False │
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  Dropout (0.2)          │
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  Dense (32, ReLU)       │
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  Dense (3, Softmax)     │
│  [Long, Short, Standby] │
└─────────────────────────┘
```

### 輸入特徵 (12 維)

| # | 特徵 | 說明 |
|---|------|------|
| 1 | Open | 開盤價 |
| 2 | High | 最高價 |
| 3 | Low | 最低價 |
| 4 | Close | 收盤價 |
| 5 | Volume | 成交量 |
| 6 | SMA_5 | 5 期簡單移動平均 |
| 7 | SMA_20 | 20 期簡單移動平均 |
| 8 | EMA_12 | 12 期指數移動平均 |
| 9 | RSI_14 | 14 期相對強弱指標 |
| 10 | MACD | MACD 線 |
| 11 | BB_Upper | 布林通道上軌 |
| 12 | BB_Lower | 布林通道下軌 |

### 輸出類別

| 類別 | 說明 | 觸發條件 |
|------|------|----------|
| **Long** | 買入訊號 | 預測上漲 > 0.1% |
| **Short** | 賣出訊號 | 預測下跌 > 0.1% |
| **Standby** | 觀望 | 無明顯方向 |

### 訓練參數

```python
optimizer = Adam(learning_rate=0.001)
loss = 'categorical_crossentropy'
batch_size = 32
epochs = 100
early_stopping = EarlyStopping(patience=10)
```

---

## 情緒分析

### 新聞數據混合來源

本系統採用雙新聞來源確保高可用性：

| 數據來源 | 優點 | 限制 | 用途 |
|----------|------|------|------|
| NewsAPI | 功能完整、多語言支援 | 免費版 100 req/day | 主要來源 |
| Google News RSS | 完全免費、無限制 | 僅標題、英文為主 | 備用來源 |

```
新聞獲取策略:
┌───────────────────────────────────────┐
│  NewsAPI (主要)                       │
│  └─→ 若失敗/配額用盡 → Google News RSS │
└───────────────────────────────────────┘
```

### 分析模型

| 來源 | 方法 | 說明 |
|------|------|------|
| 新聞情緒 | FinBERT | 金融專用 BERT 模型 |
| 央行政策 | VADER + 關鍵字 | 貨幣政策情緒分析 |

### FinBERT 模型

```python
# 使用 ProsusAI/finbert 模型
from transformers import AutoModelForSequenceClassification, AutoTokenizer

model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")
tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")

# 輸出：positive, negative, neutral 機率
```

### 央行政策分析

分析各國央行的貨幣政策立場：

| 貨幣 | 央行 | 分析重點 |
|------|------|----------|
| USD | Fed | 利率決議、FOMC 聲明 |
| EUR | ECB | 利率決議、新聞發布 |
| JPY | BOJ | 貨幣政策、殖利率曲線控制 |
| GBP | BOE | 利率決議、通膨報告 |

### 情緒分數計算

```python
# 新聞情緒分數 (-1 到 +1)
news_sentiment = (positive - negative) / total_articles

# 央行情緒分數 (-1 到 +1)
central_bank_sentiment = analyze_policy_stance(policy_text)

# 綜合情緒分數
combined_sentiment = 0.7 * news_sentiment + 0.3 * central_bank_sentiment
```

---

## 訊號融合

### 權重機制

技術分析與情緒分析的權重根據時間框架調整：

| 時間框架 | 技術權重 | 情緒權重 | 說明 |
|----------|----------|----------|------|
| 15min | 95% | 5% | 短線以技術為主 |
| 1h | 85% | 15% | 波段交易平衡 |
| 4h | 70% | 30% | 中期考量情緒 |
| 1d | 55% | 45% | 日線重視基本面 |
| 1w | 40% | 60% | 長線情緒主導 |

### 融合公式

```python
# 技術分數 (LSTM 輸出)
technical_score = lstm_prediction['confidence']

# 情緒分數
sentiment_score = sentiment_analyzer.analyze(pair)

# 取得權重
tech_weight, sent_weight = get_weights(timeframe)

# 最終信心度
final_confidence = (technical_score * tech_weight) + (sentiment_score * sent_weight)

# 訊號強度判定
if final_confidence > 0.75:
    strength = 'very_strong'
elif final_confidence > 0.65:
    strength = 'strong'
elif final_confidence > 0.55:
    strength = 'moderate'
else:
    strength = 'weak'
```

---

## API 端點

### 健康檢查
```http
GET /health

Response:
{
  "status": "healthy",
  "models_loaded": true,
  "sentiment_service": "active"
}
```

### 價格預測
```http
POST /api/v1/predict
Content-Type: application/json

{
  "pair": "EUR/USD",
  "timeframe": "1h",
  "data": [...OHLCV array...]
}

Response:
{
  "prediction": "long",
  "confidence": 0.75,
  "probabilities": {
    "long": 0.75,
    "short": 0.15,
    "standby": 0.10
  }
}
```

### 情緒分析
```http
POST /sentiment/analyze
Content-Type: application/json

{
  "pair": "EUR/USD",
  "timeframe": "1h"
}

Response:
{
  "pair": "EUR/USD",
  "sentiment_score": 0.65,
  "signal": "bullish",
  "news_count": 15,
  "central_bank": {
    "fed": "hawkish",
    "ecb": "neutral"
  },
  "timestamp": "2025-12-02T10:30:00Z"
}
```

### 反轉預測 (含情緒)
```http
POST /reversal/predict_raw
Content-Type: application/json

{
  "pair": "EUR/USD",
  "timeframe": "1h",
  "data": [...OHLCV array...]
}

Response:
{
  "pair": "EUR/USD",
  "action": "long",
  "confidence": 0.75,
  "signal_strength": "strong",
  "market_condition": "trending",
  "sentiment_score": 0.65,
  "sentiment_signal": "bullish",
  "factors": {
    "technical": 0.80,
    "sentiment": 0.65,
    "pattern": 0.70
  }
}
```

---

## 數據收集

### 市場數據混合模式

本系統採用混合數據來源確保高可用性：

| 數據來源 | 優點 | 限制 | 用途 |
|----------|------|------|------|
| Twelve Data API | 數據品質高、即時性好 | 免費版 800 req/day | 主要來源 |
| yfinance | 完全免費、無限制 | 延遲較高、資料格式不一 | 備用來源 |

### Twelve Data API (主要)

```python
# 即時數據
GET /time_series?symbol=EUR/USD&interval=1h&outputsize=100

# 混合模式：資料庫 99 根 + API 1 根最新
# 節省 99% API 配額
```

### yfinance (備用)

```python
import yfinance as yf

# 當 Twelve Data 失敗時自動切換
data = yf.download("EURUSD=X", period="1d", interval="1h")
# 完全免費，無 API 限制
```

### Cron 排程

| 時間框架 | 排程 | 每日呼叫 |
|----------|------|----------|
| 15min | `*/15 * * * *` | 288 次 |
| 1h | `0 * * * *` | 72 次 |
| **總計** | | **360 次** (限額 800) |

---

## 回測系統

### 執行回測

```bash
cd ml_engine
python backtest/run_historical_backtest.py --pair EUR/USD --period swing
```

### 績效指標

| 指標 | 說明 |
|------|------|
| 勝率 | 獲利交易數 / 總交易數 |
| 盈虧比 | 總獲利 / 總虧損 |
| 最大回撤 | 權益曲線最大跌幅 |
| 夏普比率 | 風險調整後報酬 |

---

## 模型訓練

### 完整訓練

```bash
cd ml_engine
python scripts/weekly_full_training.py --pair EUR/USD
```

### 增量訓練

```bash
python scripts/daily_incremental_training.py --pair EUR/USD
```

### 訓練排程建議

| 類型 | 頻率 | 說明 |
|------|------|------|
| 完整訓練 | 每週 | 使用全部歷史數據 |
| 增量訓練 | 每日 | 使用最新數據微調 |

---

## 環境變數

```env
# ML Engine
ML_ENGINE_PORT=8000

# Twelve Data API
TWELVE_DATA_KEY=your-api-key

# Backend API (用於數據存取)
BACKEND_API_URL=http://localhost:3000
ML_ENGINE_API_KEY=your-api-key

# 模型配置
MODEL_PATH=./saved_models
SENTIMENT_MODEL=ProsusAI/finbert
```

---

## 啟動方式

```bash
# 開發環境
cd ml_engine
source venv/bin/activate
python api/ml_server.py

# 或使用啟動腳本
./start_ml_engine.sh

# 正式環境 (使用 systemd 或 supervisor)
```

---

## 常見問題

### Q1: 模型載入失敗？
確認 `saved_models/` 目錄下有訓練好的模型檔案。

### Q2: 情緒分析回應慢？
首次載入 FinBERT 模型需要下載，約 400MB。

### Q3: API 配額不足？
啟用混合模式，從資料庫讀取歷史數據。

---

**最後更新**: 2025-12-02
