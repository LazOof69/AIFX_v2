# 情緒分析整合設定指南

## 📋 概述

AIFX_v2 ML Engine 現已整合多源情緒分析功能，結合新聞和央行政策情緒來增強交易信號預測。

## 🔑 步驟 1: 獲取 NewsAPI Key

### 1.1 註冊免費 API Key

1. 訪問 [https://newsapi.org/](https://newsapi.org/)
2. 點擊 "Get API Key"
3. 填寫註冊表單
4. 確認郵箱後獲得 API Key

**免費版限制**:
- 每天 100 次請求
- 只能獲取過去 30 天的新聞
- 足夠測試和小規模使用

### 1.2 配置 API Key

編輯 `/root/AIFX_v2/ml_engine/.env`:

```bash
# 將 your_newsapi_key_here 替換為你的實際 API Key
NEWS_API_KEY=abc123your_actual_key_here
```

## 🧪 步驟 2: 測試情緒分析

### 2.1 單獨測試情緒分析模組

```bash
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
python services/sentiment_analyzer.py
```

**預期輸出**:
```json
{
  "sentiment_score": 0.6234,
  "confidence": 0.72,
  "sources": {
    "news": 0.65,
    "central_bank": 0.70
  },
  "signal": "bullish",
  "details": {
    "news_articles_analyzed": 15,
    "gov_articles_analyzed": 8
  },
  "timestamp": "2025-11-27T10:30:00Z"
}
```

### 2.2 測試整合的預測服務

```bash
# 使用 curl 測試 ML Engine API
curl -X POST "http://localhost:8000/reversal/predict_raw" \
  -H "Content-Type: application/json" \
  -d '{
    "pair": "EUR/USD",
    "timeframe": "1h",
    "data": [/* 市場數據 */]
  }'
```

**預期返回**:
```json
{
  "success": true,
  "data": {
    "signal": "long",
    "confidence": 0.85,
    "stage1_prob": 0.65,
    "stage2_prob": 0.82,
    "sentiment_score": 0.72,          // ✨ 新增
    "sentiment_signal": "bullish",    // ✨ 新增
    "factors": {                      // ✨ 新增
      "technical": 0.65,
      "sentiment": 0.72,
      "pattern": 0.82
    },
    "model_version": "v3.2",
    "timestamp": "2025-11-27T10:30:00Z"
  }
}
```

## 📊 步驟 3: 驗證 Backend 整合

### 3.1 測試 Backend API

```bash
curl -s "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&period=周內" \
  -H "x-api-key: YOUR_BACKEND_API_KEY"
```

### 3.2 檢查返回數據

Backend 應該自動接收到 `factors.sentiment` 數據:

```json
{
  "success": true,
  "data": {
    "signal": {
      "signal": "long",
      "confidence": 0.85,
      "factors": {
        "technical": 0.65,
        "sentiment": 0.72,    // ✨ 從 ML Engine 獲取
        "pattern": 0.82
      }
    }
  }
}
```

## ⚙️ 配置選項

### 情緒分析緩存

情緒分析結果會被緩存 1 小時，減少 API 調用次數。

清除緩存:
```python
from services.sentiment_analyzer import SentimentAnalyzer

analyzer = SentimentAnalyzer()
analyzer.clear_cache()
```

### 禁用情緒分析

如果沒有 NewsAPI key，情緒分析會自動返回中性值 (0.5)，不會影響系統運行。

## 🔍 故障排除

### 問題 1: "NEWS_API_KEY not configured"

**原因**: `.env` 文件中沒有配置 API Key

**解決**:
```bash
cd /root/AIFX_v2/ml_engine
echo "NEWS_API_KEY=your_key_here" >> .env
```

### 問題 2: "FinBERT model not loaded"

**原因**: transformers 套件未安裝或版本過舊

**解決**:
```bash
source venv/bin/activate
pip install transformers>=4.30.0 torch>=2.0.0
```

### 問題 3: NewsAPI 返回錯誤

**檢查 API Key**:
```bash
curl "https://newsapi.org/v2/everything?q=EUR&apiKey=YOUR_KEY"
```

**常見錯誤**:
- `401 Unauthorized`: API Key 無效
- `429 Too Many Requests`: 超過免費配額（100次/天）
- `426 Upgrade Required`: 需要付費計劃

## 📈 數據流程圖

```
Discord Bot / Frontend
        │
        ├─► Backend API (Node.js)
                │
                ├─► ML Engine API
                      │
                      ├─► Stage 1: 技術反轉檢測
                      ├─► Stage 2: 方向預測
                      └─► ✨ Sentiment Analyzer
                            │
                            ├─► NewsAPI (新聞)
                            └─► NewsAPI (央行政策)

返回 factors: {
  technical: 0.65,
  sentiment: 0.72,   // ✨ 新增
  pattern: 0.82
}
```

## 💡 最佳實踐

1. **API 配額管理**: 免費版每天 100 次請求，使用緩存節省配額
2. **錯誤處理**: 情緒分析失敗時自動降級為中性值 (0.5)
3. **監控**: 定期檢查 ML Engine 日誌中的情緒分析狀態
4. **更新**: 可升級 NewsAPI 付費計劃獲得更多配額和實時數據

## 📚 相關文件

- `services/sentiment_analyzer.py` - 情緒分析服務
- `api/prediction_service.py` - 預測服務（已整合情緒）
- `requirements.txt` - Python 依賴（已添加 transformers, torch）

## 🎯 下一步

完成設定後，系統會自動在每次預測時：
1. 分析新聞情緒
2. 分析央行政策情緒
3. 將情緒分數整合到預測結果
4. 返回完整的 `factors` 數據給 Backend
5. Backend 混合 ML 預測和技術分析生成最終信號

**恭喜！情緒分析已成功整合到 AIFX_v2 系統！** 🎉
