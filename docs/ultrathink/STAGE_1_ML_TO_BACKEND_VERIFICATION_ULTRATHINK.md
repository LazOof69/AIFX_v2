# STAGE 1: ML ENGINE → BACKEND VERIFICATION

## 🎯 Objective
Manually verify that ML Engine is functioning correctly and Backend can successfully communicate with it to retrieve trading signals.

---

## 📋 Prerequisites

### 1. Check ML Engine Status
```bash
# Verify ML Engine is running on port 8000
curl -s http://localhost:8000/health | jq
```

**Expected Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_version": "v3.2_profitable_s2_v6_classweight",
  "timestamp": "2025-11-24T...",
  "environment": "development"
}
```

**✅ PASS Criteria:**
- `status` == "healthy"
- `model_loaded` == true
- Response time < 500ms

**❌ FAIL Indicators:**
- Connection refused (ML Engine not running)
- `model_loaded` == false (no trained model)
- Error response

**If Failed:**
```bash
# Start ML Engine
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
python api/ml_server.py
```

---

### 2. Check Backend Status
```bash
# Verify Backend is running on port 3000
curl -s http://localhost:3000/api/v1/health | jq
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "backend",
  "version": "1.0.0",
  "uptime": 3600,
  "dependencies": {
    "postgres": "connected",
    "redis": "connected"
  }
}
```

**✅ PASS Criteria:**
- Backend responds
- All dependencies connected

**If Failed:**
```bash
# Start Backend
cd /root/AIFX_v2/backend
npm start
```

---

### 3. Verify Environment Variables

#### Backend .env Check
```bash
# Check ML_API_URL and ML_API_ENABLED
grep -E "ML_API_URL|ML_API_ENABLED" /root/AIFX_v2/backend/.env
```

**Expected Output:**
```
ML_API_URL=http://localhost:8000
ML_API_ENABLED=true
```

**❌ Common Issues:**
- `ML_API_ENABLED=false` → Set to `true`
- `ML_API_URL` points to wrong host/port
- Variable missing entirely

---

## 🧪 TEST 1: ML Engine Direct Prediction (Legacy API)

### Test Command
```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "pair": "EUR/USD",
    "timeframe": "1h",
    "data": [
      {"timestamp": "2025-11-24T10:00:00Z", "open": 1.0850, "high": 1.0865, "low": 1.0840, "close": 1.0855, "volume": 1000},
      {"timestamp": "2025-11-24T09:00:00Z", "open": 1.0845, "high": 1.0860, "low": 1.0835, "close": 1.0850, "volume": 1100},
      {"timestamp": "2025-11-24T08:00:00Z", "open": 1.0840, "high": 1.0855, "low": 1.0830, "close": 1.0845, "volume": 1200}
    ],
    "add_indicators": true
  }' | jq
```

**⚠️ Note:** This requires at least 60 data points. The above is a minimal example and will likely fail validation. For real testing, use the market data endpoint first.

### Get Real Market Data
```bash
# Fetch real market data from ML Engine
curl -s "http://localhost:8000/market-data/EUR/USD?timeframe=1h&limit=100" > /tmp/market_data.json

# View the data
cat /tmp/market_data.json | jq '.data.timeSeries | length'
```

### Use Real Data for Prediction
```bash
# Extract timeSeries and send to prediction endpoint
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d "{
    \"pair\": \"EUR/USD\",
    \"timeframe\": \"1h\",
    \"data\": $(cat /tmp/market_data.json | jq '.data.timeSeries'),
    \"add_indicators\": true
  }" | jq
```

### Expected Response Format
```json
{
  "success": true,
  "data": {
    "prediction": "buy",
    "confidence": 0.75,
    "predicted_price": 1.08543,
    "factors": {
      "technical": 0.75,
      "sentiment": 0.5,
      "pattern": 0.5
    },
    "pair": "EUR/USD",
    "timeframe": "1h",
    "timestamp": "2025-11-24T10:30:00+08:00"
  },
  "error": null,
  "timestamp": "2025-11-24T10:30:00+08:00"
}
```

### Validation Checklist

- [ ] **Response Status**: `success: true`
- [ ] **Prediction Field**: One of `["buy", "sell", "hold"]`
- [ ] **Confidence Range**: `0.0 <= confidence <= 1.0`
- [ ] **Factors Present**: All three factors exist
- [ ] **Predicted Price**: Reasonable number (close to current market)
- [ ] **Timestamp Format**: ISO 8601 format
- [ ] **Response Time**: < 2 seconds

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Model not trained or loaded` | No model file exists | Train model or check model path |
| `Insufficient data points` | Less than 60 candles | Increase `limit` parameter |
| `Invalid currency pair format` | Wrong pair format | Use `XXX/XXX` format |
| `Connection refused` | ML Engine not running | Start ML Engine server |

---

## 🧪 TEST 2: ML Engine Reversal Prediction (New API)

### Test Command
```bash
# Fetch market data first
curl -s "http://localhost:8000/market-data/EUR/USD?timeframe=1h&limit=100" > /tmp/market_data.json

# Call reversal prediction endpoint
curl -X POST http://localhost:8000/predict/reversal \
  -H "Content-Type: application/json" \
  -d "{
    \"pair\": \"EUR/USD\",
    \"timeframe\": \"1h\",
    \"data\": $(cat /tmp/market_data.json | jq '.data.timeSeries')
  }" | jq
```

### Expected Response Format
```json
{
  "success": true,
  "data": {
    "signal": "hold",
    "confidence": 0.94,
    "stage1_prob": 0.15,
    "stage2_prob": 0.88,
    "reversal_detected": false,
    "direction": "sideways",
    "entry_price": 1.0855,
    "factors": {
      "technical": 0.15,
      "pattern": 0.88,
      "sentiment": 0.5
    },
    "model_version": "v3.2_profitable_s2_v6_classweight",
    "timestamp": "2025-11-24T10:30:00+08:00"
  },
  "error": null,
  "timestamp": "2025-11-24T10:30:00+08:00"
}
```

### Validation Checklist

- [ ] **Response Status**: `success: true`
- [ ] **Signal Field**: One of `["hold", "long", "short"]`
- [ ] **Confidence Range**: `0.0 <= confidence <= 1.0`
- [ ] **Stage 1 Probability**: Reversal detection score
- [ ] **Stage 2 Probability**: Direction classification score
- [ ] **Reversal Detected**: Boolean flag
- [ ] **Direction Field**: One of `["up", "down", "sideways"]`
- [ ] **Model Version**: Non-empty string
- [ ] **Entry Price**: Reasonable number
- [ ] **Response Time**: < 2 seconds

### Signal Mapping

| ML Engine Output | Backend Interpretation |
|-----------------|----------------------|
| `long` | Buy signal |
| `short` | Sell signal |
| `hold` | No action / Hold position |

---

## 🧪 TEST 3: Backend Signal Generation (Full Integration)

This tests the complete flow: Backend → ML Engine → Backend response processing.

### Test Command
```bash
# Use service API key for authentication
API_KEY="091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109"

curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=1h&riskLevel=5" \
  -H "x-api-key: $API_KEY" | jq
```

### Expected Response Format
```json
{
  "success": true,
  "data": {
    "signal": {
      "id": "uuid-here",
      "userId": "service-discord-bot",
      "pair": "EUR/USD",
      "timeframe": "1h",
      "signal": "hold",
      "confidence": 0.94,
      "factors": {
        "technical": 0.15,
        "sentiment": 0.5,
        "pattern": 0.88
      },
      "mlEnhanced": true,
      "entryPrice": 1.0855,
      "stopLoss": 1.0800,
      "takeProfit": 1.0965,
      "riskRewardRatio": 2.0,
      "positionSize": 25,
      "source": "ml_enhanced",
      "signalStrength": "very_strong",
      "marketCondition": "trending",
      "technicalData": {
        "indicators": {
          "sma": { "signal": "bullish", "value": 1.0840 },
          "rsi": { "signal": "neutral", "value": 52.5 }
        },
        "priceChange": { "percent": 0.15, "direction": "up" }
      },
      "status": "active",
      "expiresAt": "2025-11-24T11:30:00.000Z",
      "timestamp": "2025-11-24T10:30:00.000Z",
      "riskWarning": "Trading forex carries significant risk. Never trade with money you cannot afford to lose."
    },
    "disclaimer": "This is not financial advice. Trading involves significant risk of loss. Always do your own research and consult with a licensed financial advisor.",
    "riskWarning": "Trading forex carries significant risk. Never trade with money you cannot afford to lose."
  },
  "error": null,
  "timestamp": "2025-11-24T10:30:00.000Z"
}
```

### Validation Checklist

#### Response Structure
- [ ] **Success Status**: `success: true`
- [ ] **Data Object**: Contains `signal`, `disclaimer`, `riskWarning`
- [ ] **Error Field**: `null` when successful
- [ ] **Timestamp**: ISO 8601 format

#### Signal Object
- [ ] **ID**: Valid UUID v4
- [ ] **User ID**: Set to service account
- [ ] **Pair**: Matches request parameter
- [ ] **Timeframe**: Matches request parameter
- [ ] **Signal Value**: One of `["buy", "sell", "hold"]`
- [ ] **Confidence**: `0.0 <= confidence <= 1.0`
- [ ] **ML Enhanced Flag**: `true` when ML prediction used
- [ ] **Entry Price**: Reasonable number (close to market price)
- [ ] **Risk Management**: stopLoss, takeProfit, riskRewardRatio present
- [ ] **Signal Strength**: One of `["weak", "moderate", "strong", "very_strong"]`
- [ ] **Market Condition**: Descriptive string
- [ ] **Status**: "active"
- [ ] **Expires At**: Future timestamp

#### Factors
- [ ] **Technical Factor**: Present and in range [0.0, 1.0]
- [ ] **Sentiment Factor**: Present (may be placeholder 0.5)
- [ ] **Pattern Factor**: Present and in range [0.0, 1.0]

#### Technical Data
- [ ] **Indicators Object**: Contains at least SMA and RSI
- [ ] **Price Change**: Percent and direction present

### Signal Strength Mapping

| Confidence Range | Signal Strength |
|-----------------|----------------|
| >= 0.85 | very_strong |
| >= 0.75 | strong |
| >= 0.60 | moderate |
| < 0.60 | weak |

### Common Issues

| Issue | Symptom | Cause | Solution |
|-------|---------|-------|----------|
| ML not used | `mlEnhanced: false` | ML_API_ENABLED=false | Set to true in backend/.env |
| ML call fails | `mlEnhanced: false`, fallback to technical | ML Engine down or error | Check ML Engine logs |
| Low confidence | `confidence < 0.6` | Uncertain market conditions | Normal behavior, not an error |
| 401 Error | `Authorization required` | Missing/wrong API key | Check API_KEY in .env files |
| 404 Error | `Not Found` | Wrong endpoint URL | Verify endpoint path |
| Timeout | Request hangs | ML Engine slow/stuck | Check ML Engine performance |

---

## 🧪 TEST 4: Data Consistency Verification

Verify that data flows correctly through the system without transformation errors.

### Step 1: Capture ML Engine Response
```bash
# Save ML Engine direct response
curl -s "http://localhost:8000/market-data/EUR/USD?timeframe=1h&limit=100" > /tmp/market_data.json

curl -X POST http://localhost:8000/predict/reversal \
  -H "Content-Type: application/json" \
  -d "{
    \"pair\": \"EUR/USD\",
    \"timeframe\": \"1h\",
    \"data\": $(cat /tmp/market_data.json | jq '.data.timeSeries')
  }" > /tmp/ml_response.json

cat /tmp/ml_response.json | jq
```

### Step 2: Capture Backend Response
```bash
API_KEY="091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109"

curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=1h" \
  -H "x-api-key: $API_KEY" > /tmp/backend_response.json

cat /tmp/backend_response.json | jq
```

### Step 3: Compare Key Values

```bash
# Compare signal values
ML_SIGNAL=$(cat /tmp/ml_response.json | jq -r '.data.signal')
BACKEND_SIGNAL=$(cat /tmp/backend_response.json | jq -r '.data.signal.signal')

echo "ML Signal: $ML_SIGNAL"
echo "Backend Signal: $BACKEND_SIGNAL"

# Compare confidence values
ML_CONFIDENCE=$(cat /tmp/ml_response.json | jq -r '.data.confidence')
BACKEND_CONFIDENCE=$(cat /tmp/backend_response.json | jq -r '.data.signal.confidence')

echo "ML Confidence: $ML_CONFIDENCE"
echo "Backend Confidence: $BACKEND_CONFIDENCE"

# Compare factors
echo "ML Factors:"
cat /tmp/ml_response.json | jq '.data.factors'

echo "Backend Factors:"
cat /tmp/backend_response.json | jq '.data.signal.factors'
```

### Validation Checklist

- [ ] **Signal Mapping Correct**:
  - ML `long` → Backend `buy`
  - ML `short` → Backend `sell`
  - ML `hold` → Backend `hold`

- [ ] **Confidence Values**:
  - Backend confidence is blend: `ML_confidence * 0.7 + technical_confidence * 0.3`
  - Reasonable blending (Backend confidence near ML confidence)

- [ ] **Factors Propagated**:
  - `technical` factor from ML present in Backend
  - `pattern` factor from ML present in Backend
  - `sentiment` factor present (may be placeholder)

- [ ] **Model Version Tracked**:
  - Backend logs show ML model version
  - Backend indicates ML-enhanced signal

### Expected Behavior

**When ML Prediction Succeeds:**
- Backend uses ML signal as primary signal
- Backend blends ML confidence with technical confidence (70/30 split)
- Backend sets `mlEnhanced: true`
- Backend sets `source: "ml_enhanced"`
- Backend includes ML factors in response

**When ML Prediction Fails:**
- Backend falls back to technical analysis only
- Backend uses technical indicators for signal
- Backend sets `mlEnhanced: false`
- Backend sets `source: "technical_analysis"`
- Backend logs ML prediction error

---

## 🧪 TEST 5: Error Handling Verification

Test how the system handles various error conditions.

### Test 5A: ML Engine Down
```bash
# Stop ML Engine (if running)
# pkill -f ml_server.py

# Try Backend signal generation
API_KEY="091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109"

curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=1h" \
  -H "x-api-key: $API_KEY" | jq
```

**Expected Behavior:**
- Backend should NOT crash
- Backend should return a signal (using technical analysis fallback)
- Response should have `mlEnhanced: false`
- Backend logs should show ML prediction error
- Signal still has valid confidence, factors, etc.

**✅ PASS Criteria:**
- Request completes successfully (200 OK)
- Signal generated with technical analysis
- No cascading failures

**❌ FAIL Indicators:**
- Backend crashes or returns 500 error
- No signal returned
- Missing required fields in response

### Test 5B: Invalid Currency Pair
```bash
API_KEY="091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109"

curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=INVALID&timeframe=1h" \
  -H "x-api-key: $API_KEY" | jq
```

**Expected Response:**
```json
{
  "success": false,
  "data": null,
  "error": "Currency pair must be in format XXX/XXX (e.g., EUR/USD)",
  "timestamp": "2025-11-24T10:30:00.000Z"
}
```

**✅ PASS Criteria:**
- HTTP 400 Bad Request
- Clear error message
- Proper error response format

### Test 5C: Missing Required Parameters
```bash
API_KEY="091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109"

curl -s -X GET "http://localhost:3000/api/v1/trading/signal?timeframe=1h" \
  -H "x-api-key: $API_KEY" | jq
```

**Expected Response:**
```json
{
  "success": false,
  "data": null,
  "error": "Currency pair is required (e.g., ?pair=EUR/USD)",
  "timestamp": "2025-11-24T10:30:00.000Z"
}
```

### Test 5D: Invalid API Key
```bash
curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=1h" \
  -H "x-api-key: INVALID_KEY" | jq
```

**Expected Response:**
```json
{
  "success": false,
  "data": null,
  "error": "Invalid API key",
  "timestamp": "2025-11-24T10:30:00.000Z"
}
```

**✅ PASS Criteria:**
- HTTP 401 Unauthorized
- Clear error message
- Request rejected before processing

---

## 📊 TEST RESULTS SUMMARY

### Test Execution Log

| Test | Status | Confidence | Response Time | Notes |
|------|--------|------------|---------------|-------|
| ML Health Check | ⬜ | - | - | |
| Backend Health Check | ⬜ | - | - | |
| ML Direct Prediction (Legacy) | ⬜ | - | - | |
| ML Reversal Prediction (New) | ⬜ | - | - | |
| Backend Signal Generation | ⬜ | - | - | |
| Data Consistency Check | ⬜ | - | - | |
| Error: ML Engine Down | ⬜ | - | - | |
| Error: Invalid Pair | ⬜ | - | - | |
| Error: Missing Parameters | ⬜ | - | - | |
| Error: Invalid API Key | ⬜ | - | - | |

**Legend:**
- ⬜ Not tested
- ✅ Passed
- ❌ Failed
- ⚠️ Partial pass (with issues)

### Issues Found

_Document any issues discovered during testing:_

1. **Issue Title**: _Brief description_
   - **Severity**: Critical / High / Medium / Low
   - **Component**: ML Engine / Backend / Integration
   - **Symptoms**: _What went wrong_
   - **Root Cause**: _Why it happened_
   - **Workaround**: _Temporary fix_
   - **Permanent Fix**: _Long-term solution_

### Overall Assessment

**ML Engine → Backend Integration Status:**
- ⬜ **PASS**: All tests passed, integration working correctly
- ⬜ **PARTIAL**: Most tests passed, minor issues present
- ⬜ **FAIL**: Critical issues prevent proper integration

**Ready for Stage 2 Testing?**
- ⬜ Yes - Proceed to Backend → Discord verification
- ⬜ No - Fix issues first, then retest

---

## 🔍 Debugging Tips

### Check ML Engine Logs
```bash
# If running in terminal, logs appear in console
# If running as service, check logs:
tail -f /var/log/ml_engine.log

# Or check systemd logs:
journalctl -u ml_engine -f
```

### Check Backend Logs
```bash
# Backend logs appear in console when running with npm start
# Or check logs:
tail -f /root/AIFX_v2/backend/logs/combined.log

# For specific ML-related logs:
grep "ML" /root/AIFX_v2/backend/logs/combined.log | tail -20
```

### Enable Debug Logging
```bash
# Backend: Set LOG_LEVEL in .env
echo "LOG_LEVEL=debug" >> /root/AIFX_v2/backend/.env

# Restart backend
cd /root/AIFX_v2/backend
npm restart
```

### Test ML Engine API Directly
```bash
# Get API documentation
curl http://localhost:8000/docs

# Or open in browser:
# http://localhost:8000/docs
```

### Monitor Network Traffic
```bash
# Monitor Backend → ML Engine requests
sudo tcpdump -i lo -A 'tcp port 8000' | grep -A 20 'POST'
```

---

## 📝 Notes for Next Stage

**Stage 2 will test Backend → Discord transmission.**

Before proceeding to Stage 2, ensure:
- ✅ ML Engine is generating valid predictions
- ✅ Backend is successfully calling ML Engine
- ✅ Backend is properly blending ML and technical signals
- ✅ Error handling works correctly
- ✅ Response format matches expected structure
- ✅ All data transformations are correct

**Key Metrics to Carry Forward:**
- Average ML prediction confidence: _____
- Average Backend signal confidence: _____
- ML Engine response time (p95): _____
- Backend signal generation time (p95): _____
- ML prediction success rate: _____

---

**Document Version**: 1.0
**Created**: 2025-11-24
**Last Updated**: 2025-11-24
**Status**: DRAFT - Awaiting test execution

