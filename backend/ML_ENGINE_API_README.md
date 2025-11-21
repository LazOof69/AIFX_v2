# ML Engine Backend APIs - Phase 3

## 📋 Overview

This document describes the Backend APIs created for ML Engine in Phase 3 of the microservices refactoring.

**Architecture Principle**: Following AIFX_v2 microservices architecture (CLAUDE.md), ML Engine MUST use these APIs instead of direct database access.

## 🔐 Authentication

All ML Engine APIs require API Key authentication.

**Headers Required**:
```
Authorization: Bearer <ML_ENGINE_API_KEY>
X-Service-Name: ml-engine
```

**API Key** (Development):
```
dev_ml_engine_key_replace_in_production
```

**Rate Limit**: 1000 requests/minute

## 📡 API Endpoints

### Base URL
```
http://localhost:3000/api/v1/ml
```

---

## 1️⃣ Training Data APIs

### GET /training-data/market/:pair
Get market data for training ML models.

**Parameters**:
- `pair` (path) - Currency pair (e.g., EUR/USD)
- `timeframe` (query) - Timeframe: 1min, 5min, 15min, 30min, 1h, 4h, 1d
- `startDate` (query) - Start date (YYYY-MM-DD)
- `endDate` (query) - End date (YYYY-MM-DD)
- `limit` (query) - Max records (default: 1000, max: 10000)
- `offset` (query) - Offset for pagination (default: 0)

**Example**:
```bash
curl -H "Authorization: Bearer dev_ml_engine_key_replace_in_production" \
  "http://localhost:3000/api/v1/ml/training-data/market/EUR/USD?timeframe=1h&limit=1000"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "pair": "EUR/USD",
    "timeframe": "1h",
    "marketData": [ /* array of OHLCV data */ ],
    "pagination": {
      "total": 5000,
      "limit": 1000,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

### GET /training-data/signals
Get historical trading signals with outcomes.

**Parameters**:
- `pair` (query) - Filter by currency pair
- `outcome` (query) - Filter by outcome: win, loss, breakeven, pending
- `minConfidence` (query) - Minimum confidence level (0.0-1.0)
- `startDate` (query) - Start date
- `endDate` (query) - End date
- `limit` (query) - Max records (default: 1000, max: 10000)

**Example**:
```bash
curl -H "Authorization: Bearer dev_ml_engine_key_replace_in_production" \
  "http://localhost:3000/api/v1/ml/training-data/signals?outcome=win&minConfidence=0.7"
```

---

### GET /training-data/trades
Get user trading history for learning from real trades.

**Parameters**:
- `pair` (query) - Filter by currency pair
- `status` (query) - Filter by status
- `startDate` (query) - Start date
- `endDate` (query) - End date
- `limit` (query) - Max records

---

### GET /training-data/stats
Get training data statistics.

**Parameters**:
- `pair` (query) - Currency pair (optional)

**Response**:
```json
{
  "success": true,
  "data": {
    "pair": "EUR/USD",
    "marketData": {
      "count": 757,
      "oldestRecord": "2024-01-01T00:00:00Z",
      "latestRecord": "2024-11-20T00:00:00Z"
    },
    "signals": {
      "count": 156
    },
    "trades": {
      "count": 89
    }
  }
}
```

---

## 2️⃣ Model Management APIs

### POST /models/version
Register a new ML model version.

**Body**:
```json
{
  "modelName": "signal_predictor_v2",
  "version": "2.0.0",
  "algorithm": "LSTM",
  "hyperparameters": {
    "layers": 3,
    "units": 128,
    "dropout": 0.2
  },
  "trainingMetrics": {
    "accuracy": 0.85,
    "precision": 0.83,
    "recall": 0.87,
    "f1Score": 0.85
  },
  "trainingDataInfo": {
    "startDate": "2024-01-01",
    "endDate": "2024-10-31",
    "totalSamples": 100000
  },
  "description": "LSTM model for signal prediction"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "modelId": "uuid-here",
    "modelName": "signal_predictor_v2",
    "version": "2.0.0",
    "status": "trained",
    "message": "Model version registered successfully"
  }
}
```

---

### PUT /models/:modelId/status
Update model version status.

**Body**:
```json
{
  "status": "deployed",
  "isActive": true
}
```

**Valid Statuses**: `trained`, `testing`, `deployed`, `retired`

---

### GET /models
Get list of model versions.

**Parameters**:
- `modelName` (query) - Filter by model name
- `status` (query) - Filter by status
- `isActive` (query) - Filter by active status (true/false)
- `limit` (query) - Max records (default: 20, max: 100)

---

### GET /models/:modelId
Get specific model version details.

---

### POST /models/:modelId/training-logs
Log a training session for a model.

**Body**:
```json
{
  "trainingMetrics": {
    "accuracy": 0.86,
    "loss": 0.21,
    "epochs": 50
  },
  "validationMetrics": {
    "accuracy": 0.84,
    "loss": 0.24
  },
  "hyperparameters": {
    "batchSize": 32,
    "learningRate": 0.001
  },
  "duration": 3600,
  "notes": "Training session with augmented data"
}
```

---

### POST /models/ab-test
Create A/B test for comparing two models.

**Body**:
```json
{
  "name": "LSTM vs Transformer",
  "modelAId": "uuid-model-a",
  "modelBId": "uuid-model-b",
  "trafficSplit": 50,
  "targetMetric": "accuracy",
  "description": "Compare LSTM vs Transformer performance"
}
```

---

### GET /models/ab-tests
Get list of A/B tests.

**Parameters**:
- `status` (query) - Filter by status: running, paused, completed

---

## 3️⃣ Predictions APIs

### POST /predictions
Submit a new prediction (creates a trading signal).

**Body**:
```json
{
  "pair": "EUR/USD",
  "timeframe": "1h",
  "signal": "buy",
  "confidence": 0.85,
  "factors": {
    "technical": 0.82,
    "sentiment": 0.88,
    "pattern": 0.85
  },
  "entryPrice": 1.0950,
  "stopLoss": 1.0900,
  "takeProfit": 1.1050,
  "riskRewardRatio": 2.0,
  "positionSize": 2.5,
  "signalStrength": "strong",
  "marketCondition": "trending",
  "technicalData": {
    "sma20": 1.0920,
    "rsi": 62,
    "macd": 0.0015
  },
  "modelVersionId": "uuid-here"
}
```

**Signal Types**: `buy`, `sell`, `hold`
**Signal Strength**: `weak`, `moderate`, `strong`

**Response**:
```json
{
  "success": true,
  "data": {
    "predictionId": "uuid-here",
    "pair": "EUR/USD",
    "signal": "buy",
    "confidence": 0.85,
    "entryPrice": 1.0950,
    "message": "Prediction submitted successfully"
  }
}
```

---

### PUT /predictions/:predictionId/outcome
Update prediction outcome after trade closes.

**Body**:
```json
{
  "outcome": "win",
  "actualPnL": 125.50,
  "actualPnLPercent": 2.5
}
```

**Outcomes**: `win`, `loss`, `breakeven`

---

### GET /predictions
Get recent predictions.

**Parameters**:
- `pair` (query) - Filter by currency pair
- `status` (query) - Filter by status: active, triggered, closed
- `outcome` (query) - Filter by outcome
- `minConfidence` (query) - Minimum confidence
- `limit` (query) - Max records

---

### GET /predictions/accuracy
Get prediction accuracy statistics.

**Parameters**:
- `modelVersionId` (query) - Filter by model
- `pair` (query) - Filter by currency pair
- `startDate` (query) - Start date
- `endDate` (query) - End date
- `minConfidence` (query) - Minimum confidence

**Response**:
```json
{
  "success": true,
  "data": {
    "filters": {
      "pair": "EUR/USD",
      "startDate": "2024-01-01",
      "endDate": "2024-11-20"
    },
    "overall": {
      "totalPredictions": 156,
      "winRate": 68.5,
      "averagePnL": 45.30,
      "totalPnL": 7066.80
    },
    "outcomeDistribution": {
      "wins": 107,
      "losses": 42,
      "breakeven": 7
    },
    "accuracyByConfidence": [
      {
        "confidenceRange": "0.7-0.85",
        "totalPredictions": 85,
        "accuracy": "65.88"
      },
      {
        "confidenceRange": "0.85-1.0",
        "totalPredictions": 71,
        "accuracy": "71.83"
      }
    ]
  }
}
```

---

## 4️⃣ Health Check

### GET /health
Check ML API health status.

**Example**:
```bash
curl -H "Authorization: Bearer dev_ml_engine_key_replace_in_production" \
  http://localhost:3000/api/v1/ml/health
```

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "ml-api",
    "timestamp": "2025-11-21T03:40:40.711Z"
  }
}
```

---

## 🔄 Response Format

All API responses follow this standard format:

```json
{
  "success": true | false,
  "data": { /* response data */ } | null,
  "error": "error message" | null,
  "metadata": {
    "timestamp": "ISO 8601 timestamp",
    "version": "v1",
    "service": "ml-engine"
  }
}
```

---

## ❌ Error Codes

| Code | Status | Description |
|------|--------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid Authorization header |
| INVALID_API_KEY | 403 | Invalid API key |
| MISSING_FIELDS | 400 | Required fields missing |
| INVALID_PAIR | 400 | Invalid currency pair format |
| INVALID_SIGNAL | 400 | Invalid signal type |
| INVALID_CONFIDENCE | 400 | Confidence must be 0-1 |
| MODEL_NOT_FOUND | 404 | Model version not found |
| PREDICTION_NOT_FOUND | 404 | Prediction not found |
| VERSION_EXISTS | 409 | Model version already exists |

---

## 📊 Usage Example (Python)

```python
import requests

# Configuration
BASE_URL = "http://localhost:3000/api/v1/ml"
API_KEY = "dev_ml_engine_key_replace_in_production"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "X-Service-Name": "ml-engine"
}

# 1. Get training data
response = requests.get(
    f"{BASE_URL}/training-data/market/EUR/USD",
    params={"timeframe": "1h", "limit": 1000},
    headers=headers
)
market_data = response.json()["data"]["marketData"]

# 2. Train model (your ML code here)
# ...

# 3. Register model version
model_data = {
    "modelName": "my_predictor",
    "version": "1.0.0",
    "algorithm": "RandomForest",
    "trainingMetrics": {
        "accuracy": 0.85,
        "precision": 0.83
    }
}
response = requests.post(
    f"{BASE_URL}/models/version",
    json=model_data,
    headers=headers
)
model_id = response.json()["data"]["modelId"]

# 4. Submit prediction
prediction = {
    "pair": "EUR/USD",
    "timeframe": "1h",
    "signal": "buy",
    "confidence": 0.85,
    "factors": {
        "technical": 0.82,
        "sentiment": 0.88,
        "pattern": 0.85
    },
    "entryPrice": 1.0950,
    "stopLoss": 1.0900,
    "takeProfit": 1.1050,
    "modelVersionId": model_id
}
response = requests.post(
    f"{BASE_URL}/predictions",
    json=prediction,
    headers=headers
)
prediction_id = response.json()["data"]["predictionId"]

# 5. Update outcome later
outcome = {
    "outcome": "win",
    "actualPnL": 125.50,
    "actualPnLPercent": 2.5
}
requests.put(
    f"{BASE_URL}/predictions/{prediction_id}/outcome",
    json=outcome,
    headers=headers
)

# 6. Get accuracy stats
response = requests.get(
    f"{BASE_URL}/predictions/accuracy",
    params={"modelVersionId": model_id},
    headers=headers
)
stats = response.json()["data"]
print(f"Win rate: {stats['overall']['winRate']}%")
```

---

## 🧪 Testing

Run the comprehensive test suite:

```bash
cd backend
node src/tests/api/test-ml-api.js
```

**Test Coverage**:
- ✅ Health Check
- ✅ Model Version Registration
- ✅ Model Status Updates
- ✅ Training Log Creation
- ✅ Prediction Submission
- ✅ Prediction Outcome Updates
- ✅ Accuracy Statistics
- ✅ Training Data Fetching
- ✅ API Key Validation

---

## 📝 Notes

1. **Pagination**: Use `limit` and `offset` for large datasets
2. **Date Format**: Always use ISO 8601 (YYYY-MM-DD or full timestamp)
3. **Confidence**: Must be decimal 0.0-1.0 (not percentage)
4. **Currency Pairs**: Must follow format XXX/YYY (e.g., EUR/USD)
5. **Field Mapping**: Some database columns use snake_case, API uses camelCase

---

## 🔗 Related Documentation

- [Microservices Refactoring Plan](../MICROSERVICES_REFACTOR_PLAN.md)
- [Architecture Principles](../CLAUDE.md)
- [Discord Bot APIs](./DISCORD_API_README.md)
- [System Overview](../SYSTEM_OVERVIEW.md)

---

**Phase 3 Status**: ✅ APIs Implemented | ⚠️ Schema Fixes Needed | 📝 Testing In Progress
