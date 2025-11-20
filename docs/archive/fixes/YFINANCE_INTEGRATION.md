# YFinance Integration Guide

## Overview

AIFX v2 now supports using **yfinance** (Yahoo Finance) as the market data source instead of Alpha Vantage/Twelve Data APIs. This eliminates the need for API keys and provides free, unlimited forex data.

## Implementation Status

✅ **Completed:**
- yfinance data fetcher service (`ml_engine/data_processing/yfinance_fetcher.py`)
- ML Engine API endpoint (`/market-data/{pair}`)
- Standalone Python script (`ml_engine/scripts/fetch_market_data.py`)

⚠️ **Pending:**
- Backend integration (requires Python 3.9+ for full yfinance compatibility)
- OR use standalone script approach

## Architecture

### Option 1: ML Engine API (Recommended for Production)

```
Backend → HTTP → ML Engine (/market-data/{pair}) → yfinance → Response
```

### Option 2: Direct Python Script (Simpler)

```
Backend → child_process → fetch_market_data.py → yfinance → JSON Response
```

## Setup Instructions

### Prerequisites

```bash
# Option 1: Install yfinance in ML Engine (requires Python 3.9+)
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
pip install yfinance

# Option 2: Use system Python (if has yfinance)
sudo apt install python3-yfinance  # If available
```

### Testing

#### Test ML Engine Endpoint

```bash
# Start ML Engine
tmux new-session -d -s aifx-ml "cd /root/AIFX_v2/ml_engine && source venv/bin/activate && uvicorn api.ml_server:app --host 0.0.0.0 --port 8000"

# Test endpoint
curl "http://localhost:8000/market-data/EUR%2FUSD?timeframe=1h&limit=10"
```

#### Test Standalone Script

```bash
# Using system Python (if yfinance is installed)
python3 /root/AIFX_v2/ml_engine/scripts/fetch_market_data.py "EUR/USD" "1h" 10

# Should output JSON like:
# {"success": true, "timeSeries": [...], "metadata": {...}}
```

## Backend Integration

### Method 1: Call ML Engine API (Preferred)

Update `backend/src/services/forexService.js`:

```javascript
const axios = require('axios');
const ML_ENGINE_URL = process.env.ML_API_URL || 'http://localhost:8000';

const getHistoricalDataFromYFinance = async (pair, timeframe, limit) => {
  try {
    const response = await axios.get(
      `${ML_ENGINE_URL}/market-data/${encodeURIComponent(pair)}`,
      { params: { timeframe, limit } }
    );

    if (response.data.success) {
      return {
        timeSeries: response.data.data.timeSeries,
        metadata: response.data.data.metadata,
        cached: false,
      };
    }
    throw new Error(response.data.error || 'Failed to fetch data');
  } catch (error) {
    throw new AppError(`YFinance data fetch failed: ${error.message}`, 500);
  }
};
```

### Method 2: Call Python Script Directly

```javascript
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const getHistoricalDataFromYFinance = async (pair, timeframe, limit) => {
  const scriptPath = '/root/AIFX_v2/ml_engine/scripts/fetch_market_data.py';
  const command = `python3 ${scriptPath} "${pair}" "${timeframe}" ${limit}`;

  try {
    const { stdout } = await execPromise(command);
    const result = JSON.parse(stdout);

    if (!result.success) {
      throw new Error(result.error);
    }

    return {
      timeSeries: result.timeSeries,
      metadata: result.metadata,
      cached: false,
    };
  } catch (error) {
    throw new AppError(`YFinance script failed: ${error.message}`, 500);
  }
};
```

### Update getHistoricalData Function

```javascript
const getHistoricalData = async (pair, timeframe = '1d', limit = 100) => {
  // ... existing validation ...

  // Check cache first
  const cacheKey = cache.generateForexKey('historical', pair, timeframe, limit.toString());
  const cachedData = await cache.get(cacheKey);
  if (cachedData) return { ...cachedData, cached: true };

  try {
    // Try yfinance first (free, unlimited)
    const data = await getHistoricalDataFromYFinance(pair, timeframe, limit);

    // Cache the result
    await cache.set(cacheKey, data, 300); // 5 min TTL

    return data;
  } catch (yfinanceError) {
    logger.warn(`YFinance failed, falling back to Alpha Vantage: ${yfinanceError.message}`);

    // Fallback to Alpha Vantage/Twelve Data
    const provider = await getBestProvider();
    // ... existing Alpha Vantage/Twelve Data logic ...
  }
};
```

## Environment Variables

Add to `backend/.env`:

```bash
# ML Engine API URL (if using Method 1)
ML_API_URL=http://localhost:8000

# Optional: Keep API keys for fallback
ALPHA_VANTAGE_KEY=your-key-here
TWELVE_DATA_KEY=your-key-here
```

## Supported Currency Pairs

yfinance supports these pairs (ticker format: `XXXYYY=X`):

- EUR/USD (EURUSD=X)
- GBP/USD (GBPUSD=X)
- USD/JPY (USDJPY=X)
- USD/CHF (USDCHF=X)
- AUD/USD (AUDUSD=X)
- USD/CAD (USDCAD=X)
- NZD/USD (NZDUSD=X)
- EUR/GBP (EURGBP=X)
- EUR/JPY (EURJPY=X)
- And more...

## Timeframe Support

- 1min, 5min, 15min, 30min
- 1h, 4h
- 1d (default)
- 1wk, 1mo

**Note:** Intraday data (< 1d) is limited to last 7-60 days depending on interval.

## Advantages over API Keys

✅ **Free** - No API key required
✅ **Unlimited** - No rate limits
✅ **Simple** - One dependency (`yfinance`)
✅ **Reliable** - Yahoo Finance is very stable

## Limitations

⚠️ Intraday data has limited history
⚠️ Requires Python 3.8+ with yfinance installed
⚠️ No official API (uses web scraping)

## Troubleshooting

### Python Import Error

```bash
# Install yfinance
pip install yfinance

# Or use system package
sudo apt install python3-yfinance  # If available
```

### ML Engine Won't Start

```bash
# Check logs
tmux attach -t aifx-ml

# Common issues:
# 1. yfinance not installed
# 2. Python version < 3.8
# 3. Missing dependencies (pandas, etc.)
```

### Script Returns Empty Data

```bash
# Test manually
python3 /root/AIFX_v2/ml_engine/scripts/fetch_market_data.py "EUR/USD" "1d" 10

# Check:
# 1. Internet connection
# 2. Pair format (use /, not -)
# 3. Timeframe is supported
```

## Migration Path

1. **Phase 1:** Test yfinance integration
2. **Phase 2:** Use yfinance as primary, API keys as fallback
3. **Phase 3:** Remove API key dependency (optional)

## Files Created

- `ml_engine/data_processing/yfinance_fetcher.py` - Main fetcher class
- `ml_engine/scripts/fetch_market_data.py` - Standalone script
- `ml_engine/api/ml_server.py` - Added `/market-data/{pair}` endpoint

## Next Steps

1. Test yfinance installation:
   ```bash
   python3 -c "import yfinance; print(yfinance.__version__)"
   ```

2. Choose integration method (API or script)

3. Update `backend/src/services/forexService.js`

4. Test end-to-end:
   ```bash
   curl "http://localhost:3000/api/v1/trading/signal/EUR%2FUSD?timeframe=1h"
   ```

5. Remove API keys from `.env` (optional)

---

**Status:** Ready for integration (code complete, awaiting backend implementation)
**Recommended:** Use Method 1 (ML Engine API) for cleaner architecture
