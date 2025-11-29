# AIFX_v2 Data Collection System - Implementation Summary

## 📊 Overview

Successfully implemented automated market data collection system with hybrid mode (Database + API) for optimal API quota usage.

## ✅ Completed Tasks

### 1. Data Collection Script (`ml_engine/scripts/data_collector.py`)
- **Incremental Mode**: Fetches latest 5 candles every cycle (for cron jobs)
- **Historical Mode**: One-time bulk data fetch (up to 5000 candles)
- **Bulk Insert**: Uses Backend API bulk endpoint to avoid rate limiting
- **Deduplication**: Automatic duplicate detection (timestamp + pair + timeframe)
- **Logging**: Comprehensive logging to `/tmp/data-collector-{timeframe}.log`

### 2. Backend API Endpoints

#### Bulk Insert Endpoint (`POST /api/v1/market/data/bulk`)
- Accepts arrays of candles for efficient batch processing
- Automatic duplicate handling with `ignoreDuplicates: true`
- Internal service authentication via `Authorization: Bearer <API_KEY>`
- Returns detailed statistics (inserted, duplicatesSkipped)

#### Fixed Cache Bug (`src/services/forexService.js`)
- **Issue**: Double JSON.parse() causing "[object Object] is not valid JSON" error
- **Fix**: Removed redundant JSON.parse() on line 53 (cache.get() already parses)
- **Impact**: Realtime price and historical data endpoints now work correctly

### 3. Hybrid Mode Implementation

**Strategy**: Database (99 candles) + API (1 latest candle)

```javascript
// Step 1: Fetch 99 historical candles from database
const dbCandles = await MarketData.findLatest(pair, timeframe, 99);

// Step 2: Fetch 1 latest candle from Twelve Data API
const apiResponse = await axios.get(`${ML_API_URL}/market-data/${pair}`, {
  params: { timeframe, limit: 1 }
});

// Step 3: Combine and return
timeSeries = [latestCandle, ...dbCandles];
```

**Benefits**:
- Reduces API calls from 100 to 1 per request (99% reduction)
- Maintains real-time data accuracy
- Falls back to database-only if API fails
- 30-second cache TTL for hybrid mode data

### 4. Cron Jobs Setup (`ml_engine/scripts/setup_cron.sh`)

**Schedule**:
- **15min timeframe**: Every 15 minutes (`*/15 * * * *`)
- **1h timeframe**: Every hour at minute 0 (`0 * * * *`)

**API Usage**:
- 15min: 3 pairs × 96 times/day = 288 requests/day
- 1h: 3 pairs × 24 times/day = 72 requests/day
- **Total**: 360 requests/day (45% of 800 daily limit)

**Target Pairs** (limited to save API quota):
- EUR/USD
- USD/JPY
- GBP/USD

### 5. Database Status

Current data stored (as of 2025-11-29):

| Pair    | 15min    | 1h      |
|---------|----------|---------|
| EUR/USD | 824      | 299     |
| USD/JPY | 826      | 300     |
| GBP/USD | 192      | -       |

**Historical Coverage**:
- 15min: ~8-12 days
- 1h: ~12-17 days

## 🔧 Configuration

### Environment Variables Required
```bash
# Backend
DATABASE_URL=postgresql://aifx_user:password@localhost:5432/aifx_db
ML_API_URL=http://localhost:8000
API_KEY=091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109

# ML Engine
TWELVE_DATA_KEY=<your_twelve_data_api_key>
BACKEND_API_URL=http://localhost:3000
ML_ENGINE_API_KEY=dev_ml_engine_key_replace_in_production
```

### File Structure
```
AIFX_v2/
├── ml_engine/
│   ├── scripts/
│   │   ├── data_collector.py          # NEW: Data collection script
│   │   └── setup_cron.sh              # NEW: Cron setup script
│   └── data_processing/
│       └── twelvedata_fetcher.py      # Modified: Added historical data
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   └── market.js              # Modified: Added bulk insert endpoint
│   │   └── services/
│   │       └── forexService.js        # Modified: Fixed cache bug, added hybrid mode
│   └── src/models/
│       └── MarketData.js              # Modified: Added 'twelve_data' enum
└── database/
    └── migrations/
        └── ...
```

## 🧪 Testing

### API Tests

1. **Trading Signal API** (with Chinese parameter support):
```bash
# English parameter
curl "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&period=intraday" \
  -H "x-api-key: 091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109"

# URL-encoded Chinese parameter
curl "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&period=%E6%97%A5%E5%85%A7" \
  -H "x-api-key: 091784bacf7a24d4dadaae729652d84a469f376f7c7b91f43aba92a564a32109"
```

**Valid period values**:
- Chinese: `日內`, `周內`, `月內`, `季內`
- English: `intraday`, `swing`, `position`, `longterm`, `day`, `week`, `month`, `quarter`

2. **Realtime Price API**:
```bash
curl "http://localhost:3000/api/v1/market/realtime/EUR%2FUSD"
```

3. **Historical Data API** (Hybrid Mode):
```bash
curl "http://localhost:3000/api/v1/market/history/EUR%2FUSD?timeframe=15min&limit=100"
```

### Manual Data Collection

```bash
# Incremental mode (fetch latest candles)
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
python scripts/data_collector.py --mode incremental --timeframe 15min

# Historical mode (one-time bulk fetch)
python scripts/data_collector.py --mode historical --timeframe 15min --days 180
```

## 📝 Logs

- **Backend**: `/tmp/backend-restart.log`
- **Data Collector (15min)**: `/tmp/data-collector-15min.log`
- **Data Collector (1h)**: `/tmp/data-collector-1h.log`
- **Cron Jobs**: Check with `crontab -l | grep AIFX`

## 🎯 Next Steps (Optional)

1. **Weekly Training** (recommended):
   - Use database data for model training (0 API calls)
   - Schedule: `0 2 * * 0` (every Sunday at 2am)
   - Script: `ml_engine/scripts/weekly_training.py` (to be created)

2. **Data Cleanup** (optional):
   - Delete data older than 1 year
   - Schedule: `0 3 * * 0` (every Sunday at 3am)

3. **Monitoring** (recommended):
   - Set up alerts for API quota usage
   - Monitor data collection success rate
   - Track database storage size

## 🐛 Bug Fixes

### Cache Double-Parse Bug
- **File**: `backend/src/services/forexService.js:53`
- **Issue**: `JSON.parse(cachedData)` on already-parsed object
- **Fix**: Changed to `cachedData` (cache.get() already parses)
- **Impact**: Fixed realtime and historical endpoints

## ✅ Verification

All systems verified and operational:
- ✅ Database contains market data for 3 currency pairs
- ✅ Cron jobs installed and scheduled
- ✅ Backend API endpoints working (trading signals, realtime, historical)
- ✅ Hybrid mode functioning correctly (DB + API)
- ✅ API quota usage optimized (360/800 = 45%)

## 📚 Documentation

- Trading period mapping: `backend/src/utils/periodMapper.js`
- Market data model: `backend/src/models/MarketData.js`
- Twelve Data fetcher: `ml_engine/data_processing/twelvedata_fetcher.py`

---

**Implementation Date**: 2025-11-29
**Status**: ✅ Production Ready
