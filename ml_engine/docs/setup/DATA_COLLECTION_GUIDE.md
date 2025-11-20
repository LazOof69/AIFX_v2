# Historical Data Collection Guide

## Current Status

❌ **Problem:** Insufficient training data
- Only 192 training samples per currency pair
- Using synthetic data (not real market data)
- Model accuracy: 43-47% (barely better than random)

✅ **Solution:** Collect real historical data from free APIs

---

## Recommended Data Requirements

### Minimum Requirements
- **Time period**: 5+ years
- **Training samples**: 5,000+ sequences
- **Currency pairs**: 3-7 pairs
- **Timeframe**: Daily or hourly

### Ideal Setup
- **Time period**: 10-20 years
- **Training samples**: 10,000+ sequences
- **Currency pairs**: 10+ major pairs
- **Timeframe**: Multiple (daily + hourly)

---

## Option 1: Alpha Vantage API (Recommended ⭐)

### Why Alpha Vantage?
- ✅ **Completely FREE** forever
- ✅ **20+ years** of historical data
- ✅ **No credit card** required
- ✅ **5 requests/min** (sufficient for our needs)
- ✅ **500 requests/day**

### Registration Steps

1. **Visit registration page:**
   ```
   https://www.alphavantage.co/support/#api-key
   ```

2. **Enter your email address** (no password required!)

3. **Receive API key immediately** via email

4. **Add to backend/.env:**
   ```env
   ALPHA_VANTAGE_KEY=YOUR_KEY_HERE
   ```

### API Limits
- **Rate limit**: 5 requests per minute
- **Daily limit**: 500 requests per day
- **What we can get**:
  - 3 currency pairs × 2 timeframes (daily + hourly) = 6 requests
  - Takes 2 minutes to collect all data

### Supported Currency Pairs
- EUR/USD, GBP/USD, USD/JPY
- USD/CHF, AUD/USD, NZD/USD
- USD/CAD, EUR/GBP, EUR/JPY
- And 100+ more pairs

---

## Option 2: Twelve Data API

### Features
- ✅ **Free tier**: 800 requests/day
- ✅ **Multiple timeframes**
- ✅ **More technical indicators**

### Registration
```
https://twelvedata.com/pricing
```

### Limits
- **Rate limit**: 8 requests/min (free)
- **Daily limit**: 800 requests/day

---

## Option 3: Yahoo Finance (yfinance)

### Features
- ✅ **Completely free**
- ✅ **No registration**
- ✅ **Unlimited requests**

### Limitations
- ❌ Limited forex pairs (mostly FX=X format)
- ❌ Less accurate forex data
- ❌ Better for stocks than forex

### Installation
```bash
pip install yfinance
```

### Usage Example
```python
import yfinance as yf

# Download EUR/USD data
data = yf.download('EURUSD=X', start='2010-01-01', end='2025-01-01', interval='1d')
```

---

## Our Collection Plan

### Phase 1: Get Alpha Vantage Key (5 minutes)
1. Register at https://www.alphavantage.co/support/#api-key
2. Copy API key from email
3. Update `/root/AIFX_v2/backend/.env`:
   ```env
   ALPHA_VANTAGE_KEY=YOUR_ACTUAL_KEY_HERE
   ```

### Phase 2: Collect Daily Data (2 minutes)
```bash
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
python scripts/prepare_training_data.py
```

**What we'll collect:**
- **EUR/USD**: 20 years daily (5,000+ data points)
- **GBP/USD**: 20 years daily (5,000+ data points)
- **USD/JPY**: 20 years daily (5,000+ data points)

**After processing:**
- Remove NaN values from indicators
- Create 60-step sequences
- **Result**: ~4,800 training samples per pair = 14,400 total

### Phase 3: Collect Hourly Data (Optional)
For intraday trading:
```python
# Modify script to use FX_INTRADAY
# Interval: 60min
# Period: Last 2 years
```

**Result**: ~17,000 hourly data points × 3 pairs = 51,000 training samples

---

## Data Quality Expectations

### With 5 Years Daily Data
```
Raw data points: ~1,825 per pair
After indicators: ~1,600 (need 200 for SMA_200)
After sequences: ~1,540 training sequences
× 3 pairs = ~4,620 total sequences
```

### With 10 Years Daily Data
```
Raw data points: ~3,650 per pair
After indicators: ~3,400
After sequences: ~3,340 training sequences
× 3 pairs = ~10,020 total sequences ✅ IDEAL
```

### With 20 Years Daily Data
```
Raw data points: ~7,300 per pair
After indicators: ~7,100
After sequences: ~7,040 training sequences
× 3 pairs = ~21,120 total sequences ✅✅ EXCELLENT
```

---

## Implementation Script

Already created: `/root/AIFX_v2/ml_engine/scripts/prepare_training_data.py`

**To run after getting API key:**
```bash
# 1. Add API key to .env
echo "ALPHA_VANTAGE_KEY=YOUR_KEY" >> /root/AIFX_v2/backend/.env

# 2. Run data collection
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
export ALPHA_VANTAGE_KEY=YOUR_KEY
python scripts/prepare_training_data.py
```

---

## Expected Results

### Before (Current)
- Training samples: 192 per pair
- Accuracy: 43-47%
- Data source: Synthetic

### After (With Real Data)
- Training samples: 7,000+ per pair
- Expected accuracy: 60-75%
- Data source: Real market (20 years)

---

## Cost Comparison

| Service | Cost | Data Quality | Limit |
|---------|------|-------------|-------|
| Alpha Vantage | **FREE** | Excellent | 500/day |
| Twelve Data | **FREE** | Excellent | 800/day |
| Yahoo Finance | **FREE** | Good | Unlimited |
| Premium Services | $50-200/mo | Excellent | High |

**Our choice: Alpha Vantage (FREE + Excellent quality)**

---

## Next Steps

**User Action Required:**
1. ✅ Register for Alpha Vantage API key (5 min)
2. ✅ Update backend/.env with real API key
3. ✅ Notify Claude to run data collection

**Claude Will:**
1. ⏳ Update .env with your API key
2. ⏳ Run prepare_training_data.py
3. ⏳ Collect 20 years of data (3 pairs × 2 timeframes)
4. ⏳ Process and prepare training data
5. ⏳ Retrain models with 10,000+ samples
6. ⏳ Evaluate improved accuracy

---

## Alternative: Use Demo Key for Testing

If you don't want to register yet, we can test with demo key:
```env
ALPHA_VANTAGE_KEY=demo
```

**Limitations:**
- Only EUR/USD
- Limited requests
- Good for testing, bad for production

---

## Questions?

**Q: Do I need to pay?**
A: No! Alpha Vantage is free forever.

**Q: Do I need a credit card?**
A: No! Just email address.

**Q: How long does registration take?**
A: 2 minutes. Instant API key.

**Q: Is the data quality good?**
A: Yes! Used by professional traders.

**Q: Can I upgrade later?**
A: Yes, paid plans offer more requests/min.
