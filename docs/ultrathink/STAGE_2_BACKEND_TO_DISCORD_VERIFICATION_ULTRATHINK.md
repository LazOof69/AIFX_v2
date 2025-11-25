# STAGE 2: BACKEND → DISCORD TRANSMISSION VERIFICATION

## 🎯 Objective
Manually verify that Backend can successfully transmit trading signals to Discord Bot, and that Discord Bot receives the data correctly without corruption or loss.

---

## 📋 Prerequisites

### Stage 1 Completion
**Before proceeding, verify that Stage 1 tests have passed:**
- ✅ ML Engine is running and responding correctly
- ✅ Backend can call ML Engine successfully
- ✅ ML predictions are valid and reasonable
- ✅ Backend properly processes ML responses

If Stage 1 tests failed, fix those issues first before testing Stage 2.

---

### 1. Check Backend API Endpoint Availability

```bash
# Verify Backend trading signal endpoint is accessible
API_KEY="091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109"

curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=1h" \
  -H "x-api-key: $API_KEY" \
  -w "\nHTTP Status: %{http_code}\nResponse Time: %{time_total}s\n" | jq
```

**✅ PASS Criteria:**
- HTTP 200 OK
- Valid JSON response
- Response time < 3 seconds
- `success: true` in response

---

### 2. Check Discord Bot Configuration

```bash
# Verify Discord Bot has correct Backend URL
grep "BACKEND_API_URL" /root/AIFX_v2/discord_bot/.env

# Verify Discord Bot has correct API key
grep "DISCORD_BOT_API_KEY" /root/AIFX_v2/discord_bot/.env
```

**Expected Output:**
```
BACKEND_API_URL=http://localhost:3000
DISCORD_BOT_API_KEY=<REDACTED>
```

**❌ Common Issues:**
- `BACKEND_API_URL` missing or incorrect
- `DISCORD_BOT_API_KEY` doesn't match Backend's `API_KEY`
- Variables commented out or misconfigured

---

### 3. Check Discord Bot Status

```bash
# Check if Discord Bot process is running
ps aux | grep "node.*bot.js"

# If running, check logs
tail -20 /root/AIFX_v2/discord_bot/logs/combined.log
```

**✅ PASS Criteria:**
- Discord Bot process is running
- Bot shows "Ready" status in logs
- No critical errors in recent logs

**If Not Running:**
```bash
cd /root/AIFX_v2/discord_bot
npm start
```

---

## 🧪 TEST 1: Backend API Response Format Verification

This test verifies that Backend returns data in the format expected by Discord Bot.

### Test Command
```bash
API_KEY="091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109"

curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=4h&riskLevel=5" \
  -H "x-api-key: $API_KEY" > /tmp/backend_signal_response.json

# Pretty print the response
cat /tmp/backend_signal_response.json | jq
```

### Expected Response Structure
```json
{
  "success": true,
  "data": {
    "signal": {
      "id": "uuid",
      "pair": "EUR/USD",
      "timeframe": "4h",
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
          "sma": {"signal": "bullish", "value": 1.0840},
          "rsi": {"signal": "neutral", "value": 52.5}
        },
        "priceChange": {"percent": 0.15, "direction": "up"}
      },
      "status": "active",
      "expiresAt": "2025-11-24T11:30:00.000Z",
      "timestamp": "2025-11-24T10:30:00.000Z"
    }
  },
  "error": null,
  "timestamp": "2025-11-24T10:30:00.000Z"
}
```

### Validation Script
```bash
# Validate all required fields are present
cat /tmp/backend_signal_response.json | jq '
  {
    "has_success": (.success != null),
    "success_value": .success,
    "has_data": (.data != null),
    "has_signal": (.data.signal != null),
    "signal_fields": {
      "id": (.data.signal.id != null),
      "pair": (.data.signal.pair != null),
      "timeframe": (.data.signal.timeframe != null),
      "signal": (.data.signal.signal != null),
      "confidence": (.data.signal.confidence != null),
      "factors": (.data.signal.factors != null),
      "entryPrice": (.data.signal.entryPrice != null),
      "stopLoss": (.data.signal.stopLoss != null),
      "takeProfit": (.data.signal.takeProfit != null),
      "riskRewardRatio": (.data.signal.riskRewardRatio != null),
      "signalStrength": (.data.signal.signalStrength != null),
      "marketCondition": (.data.signal.marketCondition != null),
      "timestamp": (.data.signal.timestamp != null)
    },
    "signal_values": {
      "pair": .data.signal.pair,
      "signal": .data.signal.signal,
      "confidence": .data.signal.confidence,
      "signalStrength": .data.signal.signalStrength
    }
  }
'
```

### Required Fields Checklist

#### Top-Level Fields
- [ ] `success` (boolean)
- [ ] `data` (object)
- [ ] `error` (null when successful)
- [ ] `timestamp` (ISO 8601 string)

#### Signal Object Fields
- [ ] `id` (UUID string)
- [ ] `pair` (string, format: XXX/XXX)
- [ ] `timeframe` (string)
- [ ] `signal` (string: buy/sell/hold)
- [ ] `confidence` (number: 0.0-1.0)
- [ ] `factors` (object with technical/sentiment/pattern)
- [ ] `entryPrice` (number)
- [ ] `stopLoss` (number or null for hold)
- [ ] `takeProfit` (number or null for hold)
- [ ] `riskRewardRatio` (number or null)
- [ ] `positionSize` (number)
- [ ] `signalStrength` (string)
- [ ] `marketCondition` (string)
- [ ] `status` (string)
- [ ] `timestamp` (ISO 8601 string)

#### Discord Bot Specific Requirements
These fields are **critical** for Discord Bot to display signals correctly:

- [ ] **Signal Action**: Must be one of `["buy", "sell", "hold"]`
- [ ] **Pair Format**: Must match `/^[A-Z]{3}\/[A-Z]{3}$/`
- [ ] **Confidence Display**: Must be 0-100 when shown to users (backend sends 0-1)
- [ ] **Risk Management**: stopLoss and takeProfit must be valid numbers (can be null for hold)
- [ ] **Timestamps**: Must be parseable by JavaScript Date()

### Common Format Issues

| Issue | Impact on Discord Bot | Fix |
|-------|----------------------|-----|
| Missing `entryPrice` | Bot can't display entry price | Ensure Backend calculates current price |
| `confidence` > 1.0 | Bot shows invalid percentage | Backend must send 0-1 range, bot converts to 0-100 |
| Missing `factors` | Bot can't display technical analysis breakdown | Ensure ML prediction includes factors |
| Invalid `signal` value | Bot shows "Unknown signal" | Map ML output correctly (long→buy, short→sell) |
| Missing `timestamp` | Bot can't show signal age | Backend must include current timestamp |
| Null `stopLoss` for buy signal | Bot shows incomplete risk management | Calculate stop loss even for buy signals |

---

## 🧪 TEST 2: Simulate Discord Bot API Call

This test simulates exactly what the Discord Bot does when requesting a signal.

### Read Discord Bot Signal Command
```bash
# View the actual API call code in Discord Bot
grep -A 30 "const response = await axios.get" /root/AIFX_v2/discord_bot/commands/signal.js
```

### Extract Discord Bot's API Call Pattern
```bash
# This is what Discord Bot actually sends:
# - Headers: x-api-key, Content-Type, User-Agent
# - Query params: pair, timeframe, riskLevel (optional)
# - Method: GET
```

### Simulate Discord Bot Request
```bash
API_KEY="091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109"
BACKEND_URL="http://localhost:3000"

# Exact request pattern from Discord Bot
curl -s -X GET "${BACKEND_URL}/api/v1/trading/signal?pair=EUR/USD&timeframe=4h" \
  -H "x-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -H "User-Agent: AIFX-Discord-Bot/1.0" \
  -w "\n\n--- Request Metrics ---\nHTTP Status: %{http_code}\nTotal Time: %{time_total}s\nConnect Time: %{time_connect}s\nTime to First Byte: %{time_starttransfer}s\nSize: %{size_download} bytes\n" \
  > /tmp/discord_bot_simulation.json

cat /tmp/discord_bot_simulation.json | jq
```

### Performance Metrics

**Target Metrics:**
- Total request time: < 3 seconds
- Connect time: < 100ms
- Time to first byte: < 2 seconds
- Response size: < 10KB

**Why These Matter:**
- Discord requires interaction response within 3 seconds
- If Backend is too slow, Discord Bot will timeout
- Large responses slow down parsing and display

### Validation Checklist

- [ ] **HTTP 200 Response**: Request successful
- [ ] **Valid JSON**: Response is parseable
- [ ] **Complete Data**: All required fields present
- [ ] **Performance**: Response time < 3 seconds
- [ ] **Size**: Response size reasonable (< 10KB)

---

## 🧪 TEST 3: Multiple Currency Pairs

Test that Backend correctly handles different currency pairs that Discord Bot might request.

### Common Currency Pairs
```bash
API_KEY="091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109"

# Test EUR/USD
curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=1h" \
  -H "x-api-key: ${API_KEY}" | jq '{pair: .data.signal.pair, signal: .data.signal.signal, confidence: .data.signal.confidence}'

# Test GBP/USD
curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=GBP/USD&timeframe=1h" \
  -H "x-api-key: ${API_KEY}" | jq '{pair: .data.signal.pair, signal: .data.signal.signal, confidence: .data.signal.confidence}'

# Test USD/JPY
curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=USD/JPY&timeframe=1h" \
  -H "x-api-key: ${API_KEY}" | jq '{pair: .data.signal.pair, signal: .data.signal.signal, confidence: .data.signal.confidence}'

# Test AUD/USD
curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=AUD/USD&timeframe=1h" \
  -H "x-api-key: ${API_KEY}" | jq '{pair: .data.signal.pair, signal: .data.signal.signal, confidence: .data.signal.confidence}'
```

### Validation Checklist

For each pair:
- [ ] Request succeeds (HTTP 200)
- [ ] Pair in response matches request
- [ ] Signal is valid (buy/sell/hold)
- [ ] Confidence is reasonable (0.0-1.0)
- [ ] Entry price is reasonable for that pair
- [ ] Stop loss and take profit are calculated

### Expected Behavior

**Different pairs should have:**
- Different entry prices (reflecting actual market prices)
- Different signals (each pair has unique market conditions)
- Different confidence levels
- Different stop loss/take profit levels

**If all pairs return identical signals:**
- ⚠️ Warning: May indicate caching issue or mock data being used

---

## 🧪 TEST 4: Multiple Timeframes

Test that Backend correctly handles different timeframes that Discord Bot allows users to select.

### Supported Timeframes
```bash
API_KEY="091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109"

# Test 1 hour
curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=1h" \
  -H "x-api-key: ${API_KEY}" | jq '{timeframe: .data.signal.timeframe, signal: .data.signal.signal}'

# Test 4 hours
curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=4h" \
  -H "x-api-key: ${API_KEY}" | jq '{timeframe: .data.signal.timeframe, signal: .data.signal.signal}'

# Test 1 day
curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=1d" \
  -H "x-api-key: ${API_KEY}" | jq '{timeframe: .data.signal.timeframe, signal: .data.signal.signal}'

# Test 1 week
curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=1w" \
  -H "x-api-key: ${API_KEY}" | jq '{timeframe: .data.signal.timeframe, signal: .data.signal.signal}'
```

### Validation Checklist

For each timeframe:
- [ ] Request succeeds
- [ ] Timeframe in response matches request
- [ ] Signal is appropriate for timeframe (longer = more stable)
- [ ] ML model handles different timeframes correctly

### Expected Behavior

**Different timeframes should produce:**
- Potentially different signals (short-term vs long-term trends)
- Different confidence levels (longer timeframes generally more reliable)
- Different stop loss distances (wider for longer timeframes)

---

## 🧪 TEST 5: Error Response Format

Verify that Backend returns errors in a format that Discord Bot can handle gracefully.

### Test 5A: Invalid Pair Format
```bash
API_KEY="091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109"

curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=INVALID&timeframe=1h" \
  -H "x-api-key: ${API_KEY}" \
  -w "\nHTTP Status: %{http_code}\n" | jq
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

**Discord Bot Handling:**
- Bot should display error message to user
- Bot should NOT crash or show "Unknown error"
- Error message should be user-friendly

### Test 5B: Missing Pair Parameter
```bash
curl -s -X GET "http://localhost:3000/api/v1/trading/signal?timeframe=1h" \
  -H "x-api-key: ${API_KEY}" \
  -w "\nHTTP Status: %{http_code}\n" | jq
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

### Test 5C: Invalid Timeframe
```bash
curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=INVALID" \
  -H "x-api-key: ${API_KEY}" \
  -w "\nHTTP Status: %{http_code}\n" | jq
```

**Expected Behavior:**
- Backend should use default timeframe (1h)
- OR return validation error
- Should NOT crash

### Test 5D: Wrong API Key
```bash
curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=1h" \
  -H "x-api-key: WRONG_KEY" \
  -w "\nHTTP Status: %{http_code}\n" | jq
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
- Consistent error response format

### Error Response Checklist

All error responses must have:
- [ ] `success: false`
- [ ] `data: null`
- [ ] `error: <string>` (descriptive message)
- [ ] `timestamp: <ISO 8601>`
- [ ] Appropriate HTTP status code
- [ ] User-friendly error message (no stack traces)

---

## 🧪 TEST 6: Load Testing (Concurrent Requests)

Test how Backend handles multiple simultaneous requests from Discord Bot (when multiple users request signals at the same time).

### Concurrent Request Script
```bash
API_KEY="091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109"

# Make 5 concurrent requests
for i in {1..5}; do
  (
    START=$(date +%s%N)
    curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=1h" \
      -H "x-api-key: ${API_KEY}" \
      -o "/tmp/load_test_${i}.json"
    END=$(date +%s%N)
    DURATION=$((($END - $START) / 1000000))
    echo "Request $i completed in ${DURATION}ms"
  ) &
done

# Wait for all requests to complete
wait

# Check all responses
for i in {1..5}; do
  echo "=== Response $i ==="
  cat "/tmp/load_test_${i}.json" | jq '{success: .success, signal: .data.signal.signal, confidence: .data.signal.confidence}'
done
```

### Validation Checklist

- [ ] **All Requests Succeed**: All 5 requests return HTTP 200
- [ ] **Consistent Data**: All responses have valid structure
- [ ] **No Timeouts**: All requests complete within 5 seconds
- [ ] **No Errors**: No 500 errors or crashes
- [ ] **Performance**: Average response time < 3 seconds

### Expected Behavior

**Backend should:**
- Handle concurrent requests without crashing
- Return valid signals for all requests
- Maintain reasonable performance under load
- Use caching if appropriate (same pair/timeframe requests)

**⚠️ Warning Signs:**
- Response times degrade significantly (> 10 seconds)
- Some requests timeout or fail
- Backend logs show errors or warnings
- System resources (CPU/Memory) spike excessively

---

## 🧪 TEST 7: Response Caching Verification

Test if Backend implements caching to reduce ML Engine load and improve response times.

### Test Sequence
```bash
API_KEY="091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109"

# First request (cold cache)
echo "=== Request 1 (Cold Cache) ==="
time curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=1h" \
  -H "x-api-key: ${API_KEY}" | jq '{signal: .data.signal.signal, timestamp: .timestamp}'

# Wait 1 second
sleep 1

# Second request (should hit cache if implemented)
echo "=== Request 2 (Should Hit Cache) ==="
time curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=1h" \
  -H "x-api-key: ${API_KEY}" | jq '{signal: .data.signal.signal, timestamp: .timestamp}'

# Wait 1 second
sleep 1

# Third request (different pair, cold cache)
echo "=== Request 3 (Different Pair) ==="
time curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=GBP/USD&timeframe=1h" \
  -H "x-api-key: ${API_KEY}" | jq '{signal: .data.signal.signal, timestamp: .timestamp}'
```

### Expected Behavior

**If caching is implemented:**
- Request 1: Slower (calls ML Engine)
- Request 2: Faster (returns cached result)
- Request 3: Slower again (different pair, cache miss)

**Cache TTL:**
- Signals should be cached for 30-60 seconds
- After TTL expires, request should refresh from ML Engine

### Validation Checklist

- [ ] **Cache Hit Performance**: Request 2 faster than Request 1
- [ ] **Cache Key Uniqueness**: Different pairs don't share cache
- [ ] **Cache Expiry**: Old cached signals expire appropriately
- [ ] **Fresh Data**: Timestamps update appropriately

**Note:** If caching is NOT implemented, all requests will have similar response times.

---

## 🧪 TEST 8: Discord Bot Health Check (Pre-Integration)

Before testing actual Discord Bot integration, verify that Discord Bot is configured correctly and can start up.

### Check Discord Bot Configuration
```bash
# View Discord Bot environment variables
cat /root/AIFX_v2/discord_bot/.env | grep -E "BACKEND_API_URL|DISCORD_BOT_API_KEY|DISCORD_BOT_TOKEN"
```

**Required Variables:**
```
BACKEND_API_URL=http://localhost:3000
DISCORD_BOT_API_KEY=<REDACTED>
DISCORD_BOT_TOKEN=<REDACTED>
```

### Check Discord Bot Dependencies
```bash
cd /root/AIFX_v2/discord_bot

# Check if node_modules exist
ls node_modules/ | head -5

# If missing, install dependencies
# npm install
```

### Test Discord Bot Startup (Dry Run)
```bash
# Don't actually start the bot, just check for syntax errors
cd /root/AIFX_v2/discord_bot
node -c bot.js

echo "Exit code: $?"
```

**✅ PASS Criteria:**
- Exit code: 0 (no syntax errors)
- No error messages printed

**❌ FAIL Indicators:**
- Syntax errors
- Missing dependencies
- Configuration errors

---

## 📊 TEST RESULTS SUMMARY

### Test Execution Log

| Test | Status | HTTP Code | Response Time | Notes |
|------|--------|-----------|---------------|-------|
| Backend Response Format | ⬜ | - | - | |
| Discord Bot Simulation | ⬜ | - | - | |
| EUR/USD | ⬜ | - | - | |
| GBP/USD | ⬜ | - | - | |
| USD/JPY | ⬜ | - | - | |
| AUD/USD | ⬜ | - | - | |
| Timeframe: 1h | ⬜ | - | - | |
| Timeframe: 4h | ⬜ | - | - | |
| Timeframe: 1d | ⬜ | - | - | |
| Timeframe: 1w | ⬜ | - | - | |
| Error: Invalid Pair | ⬜ | - | - | |
| Error: Missing Pair | ⬜ | - | - | |
| Error: Invalid Timeframe | ⬜ | - | - | |
| Error: Wrong API Key | ⬜ | - | - | |
| Load Test (5 concurrent) | ⬜ | - | - | |
| Cache Performance | ⬜ | - | - | |
| Discord Bot Config | ⬜ | - | - | |

**Legend:**
- ⬜ Not tested
- ✅ Passed
- ❌ Failed
- ⚠️ Partial pass (with issues)

### Performance Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Average Response Time | < 3s | - | ⬜ |
| P95 Response Time | < 5s | - | ⬜ |
| Error Rate | < 1% | - | ⬜ |
| Cache Hit Rate | > 50% | - | ⬜ |
| Concurrent Request Success | 100% | - | ⬜ |

### Issues Found

_Document any issues discovered during testing:_

1. **Issue Title**: _Brief description_
   - **Severity**: Critical / High / Medium / Low
   - **Component**: Backend / API / Cache / Discord Bot Config
   - **Symptoms**: _What went wrong_
   - **Root Cause**: _Why it happened_
   - **Workaround**: _Temporary fix_
   - **Permanent Fix**: _Long-term solution_

### Overall Assessment

**Backend → Discord Transmission Status:**
- ⬜ **PASS**: All tests passed, API ready for Discord Bot integration
- ⬜ **PARTIAL**: Most tests passed, minor issues present
- ⬜ **FAIL**: Critical issues prevent Discord Bot integration

**Ready for Stage 3 Testing?**
- ⬜ Yes - Proceed to Discord Bot interaction verification
- ⬜ No - Fix issues first, then retest

---

## 🔍 Debugging Tips

### Monitor Backend Logs in Real-Time
```bash
# Watch Backend logs for API requests
tail -f /root/AIFX_v2/backend/logs/combined.log | grep -E "trading|signal|discord"
```

### Check Backend Request Processing
```bash
# Enable debug logging for trading routes
# Add this to backend/.env:
# LOG_LEVEL=debug

# Then restart backend and watch logs
cd /root/AIFX_v2/backend
npm restart
```

### Test API with Verbose Output
```bash
# Use curl with verbose flag to see full request/response
curl -v -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=1h" \
  -H "x-api-key: ${API_KEY}" 2>&1 | tee /tmp/curl_verbose.log
```

### Check Redis Cache (if enabled)
```bash
# Connect to Redis CLI
redis-cli

# Check cached keys
KEYS *signal*

# Get a specific cached signal
GET "signal:EUR/USD:1h"

# Check TTL (time to live)
TTL "signal:EUR/USD:1h"

# Exit Redis CLI
exit
```

### Monitor Network Traffic
```bash
# Monitor Backend API requests
sudo tcpdump -i lo -A 'tcp port 3000 and (tcp[((tcp[12] & 0xf0) >> 2)] = 0x47)' | grep -A 10 "GET /api/v1/trading/signal"
```

---

## 📝 Notes for Next Stage

**Stage 3 will test Discord Bot → User interaction.**

Before proceeding to Stage 3, ensure:
- ✅ Backend API returns valid, complete signal data
- ✅ Backend handles all supported currency pairs
- ✅ Backend handles all supported timeframes
- ✅ Backend error responses are Discord Bot-friendly
- ✅ Backend performance is acceptable (< 3s response time)
- ✅ Backend handles concurrent requests correctly
- ✅ Discord Bot configuration is correct (API URL, API key)

**Key Data Points to Carry Forward:**
- Average Backend response time: _____
- Supported currency pairs tested: _____
- Supported timeframes tested: _____
- Cache hit rate (if applicable): _____
- Concurrent request success rate: _____

**Signal Format Confirmed:**
- Signal values: buy/sell/hold ✅
- Confidence range: 0.0-1.0 ✅
- Entry price included: ✅
- Stop loss/take profit included: ✅
- Risk management data complete: ✅

---

**Document Version**: 1.0
**Created**: 2025-11-24
**Last Updated**: 2025-11-24
**Status**: DRAFT - Awaiting test execution
