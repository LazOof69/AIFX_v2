# AIFX_v2 Forex Data Collection Service

Comprehensive forex data collection system with dual API integration, intelligent caching, and automatic fallback mechanisms.

## Features

- ✅ **Dual API Integration** (Alpha Vantage + Twelve Data)
- ✅ **Intelligent Rate Limiting** with automatic provider switching
- ✅ **Redis Caching** (60s for real-time, 1 day for historical)
- ✅ **30+ Currency Pairs** supported
- ✅ **Multiple Timeframes** (1min to 1M)
- ✅ **Real-time & Historical Data**
- ✅ **Basic Analytics** (volatility, change, volume)
- ✅ **Error Handling & Retry Logic**
- ✅ **Rate Limiting Protection**
- ✅ **Database Integration** for persistence

## API Endpoints

### Public Endpoints

#### GET `/api/v1/market/realtime/:pair`
Get real-time exchange rate for a currency pair.

**Parameters:**
- `pair` - Currency pair (e.g., EUR/USD)

**Example:**
```bash
curl http://localhost:3000/api/v1/market/realtime/EUR/USD
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pair": "EUR/USD",
    "provider": "alpha_vantage",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "data": {
      "price": 1.0850,
      "bid": 1.0849,
      "ask": 1.0851,
      "timestamp": "2024-01-01T12:00:00"
    },
    "cached": false,
    "userContext": {
      "isPreferred": true,
      "riskLevel": 5
    },
    "requestTimestamp": "2024-01-01T12:00:00.000Z"
  },
  "error": null,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET `/api/v1/market/history/:pair`
Get historical data for a currency pair.

**Parameters:**
- `pair` - Currency pair (e.g., EUR/USD)

**Query Parameters:**
- `timeframe` - Data timeframe (1min, 5min, 15min, 30min, 1h, 4h, 1d, 1w, 1M)
- `limit` - Number of data points (1-1000, default: 100)
- `startDate` - Start date (ISO format, optional)
- `endDate` - End date (ISO format, optional)

**Example:**
```bash
curl "http://localhost:3000/api/v1/market/history/EUR/USD?timeframe=1h&limit=24"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pair": "EUR/USD",
    "provider": "twelve_data",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "data": [
      {
        "timestamp": "2024-01-01T11:00:00",
        "open": 1.0840,
        "high": 1.0860,
        "low": 1.0835,
        "close": 1.0850,
        "volume": 1500000
      }
    ],
    "metadata": {
      "pair": "EUR/USD",
      "timeframe": "1h",
      "requestedLimit": 24,
      "actualCount": 24,
      "dateRange": {
        "startDate": null,
        "endDate": null
      }
    },
    "cached": true
  },
  "error": null,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET `/api/v1/market/pairs`
Get list of supported currency pairs.

**Query Parameters:**
- `category` - Filter by category (major, minor, all)
- `search` - Search pairs by name

**Example:**
```bash
curl "http://localhost:3000/api/v1/market/pairs?category=major"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pairs": [
      {
        "pair": "EUR/USD",
        "base": "EUR",
        "quote": "USD",
        "displayName": "EUR/USD",
        "description": "EUR to USD",
        "isPreferred": true
      }
    ],
    "total": 7,
    "filters": {
      "category": "major",
      "search": null
    },
    "categories": {
      "major": {
        "count": 7,
        "description": "Major currency pairs (most liquid)"
      },
      "minor": {
        "count": 23,
        "description": "Minor currency pairs (cross pairs)"
      }
    }
  },
  "error": null,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET `/api/v1/market/analytics/:pair`
Get basic analytics for a currency pair.

**Parameters:**
- `pair` - Currency pair

**Example:**
```bash
curl http://localhost:3000/api/v1/market/analytics/EUR/USD
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pair": "EUR/USD",
    "period": "30 days",
    "dataPoints": 30,
    "analytics": {
      "current": 1.0850,
      "previous": 1.0820,
      "change": 0.0030,
      "changePercent": 0.28,
      "high": 1.0890,
      "low": 1.0800,
      "average": 1.0845,
      "volatility": 1.45,
      "range": 0.0090,
      "rangePercent": 0.83,
      "totalVolume": 45000000,
      "averageVolume": 1500000
    }
  },
  "error": null,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET `/api/v1/market/status`
Get market status and API health information.

**Example:**
```bash
curl http://localhost:3000/api/v1/market/status
```

### Protected Endpoints

#### POST `/api/v1/market/cache/clear`
Clear market data cache (requires authentication).

**Headers:**
- `Authorization: Bearer <access_token>`

**Body:**
```json
{
  "pattern": "forex:*"
}
```

## Supported Currency Pairs

### Major Pairs (7)
- EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD

### Minor Pairs (Cross Pairs) (23)
- EUR/GBP, EUR/JPY, EUR/CHF, EUR/AUD, EUR/CAD, EUR/NZD
- GBP/JPY, GBP/CHF, GBP/AUD, GBP/CAD, GBP/NZD
- AUD/JPY, AUD/CHF, AUD/CAD, AUD/NZD
- CAD/JPY, CAD/CHF, CHF/JPY, NZD/JPY, NZD/CHF, NZD/CAD
- And more...

## Timeframes Supported

| Timeframe | Description | Alpha Vantage | Twelve Data |
|-----------|-------------|---------------|-------------|
| 1min | 1 minute | ✅ | ✅ |
| 5min | 5 minutes | ✅ | ✅ |
| 15min | 15 minutes | ✅ | ✅ |
| 30min | 30 minutes | ✅ | ✅ |
| 1h | 1 hour | ✅ | ✅ |
| 4h | 4 hours | ❌ | ✅ |
| 1d | 1 day | ✅ | ✅ |
| 1w | 1 week | ✅ | ✅ |
| 1M | 1 month | ✅ | ✅ |

## API Providers & Rate Limits

### Alpha Vantage (Primary)
- **Rate Limit**: 5 requests/minute, 500 requests/day
- **Strengths**: Reliable, good for intraday data
- **Functions**: Currency exchange rate, FX intraday, FX daily/weekly/monthly

### Twelve Data (Fallback)
- **Rate Limit**: 8 requests/minute, 800 requests/day
- **Strengths**: More timeframes, higher limits
- **Functions**: Real-time price, time series data

### Automatic Switching
The system automatically switches between providers based on:
1. Rate limit availability
2. API response quality
3. Data freshness requirements

## Caching Strategy

### Cache Keys
```
forex:realtime:{pair}                    # Real-time rates
forex:historical:{pair}:{timeframe}:{limit} # Historical data
forex:intraday:{pair}:{timeframe}        # Intraday data
api:limit:{provider}:{type}:{date}       # Rate limit tracking
```

### Cache TTL
- **Real-time data**: 60 seconds
- **Historical data**: 1 day (86400 seconds)
- **API rate limits**: 5 minutes / 24 hours
- **Supported pairs**: 1 hour

### Cache Statistics
```bash
# Get cache statistics
curl http://localhost:3000/api/v1/market/status
```

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNSUPPORTED_PAIR` | 400 | Currency pair not supported |
| `UNSUPPORTED_TIMEFRAME` | 400 | Timeframe not supported |
| `API_RATE_LIMIT_EXCEEDED` | 429 | All providers rate limited |
| `API_KEY_MISSING` | 500 | API key not configured |
| `REALTIME_DATA_ERROR` | 500 | Failed to fetch real-time data |
| `HISTORICAL_DATA_ERROR` | 500 | Failed to fetch historical data |
| `DATA_STANDARDIZATION_ERROR` | 500 | Failed to standardize data |

### Retry Logic
- **Max retries**: 3 attempts
- **Backoff**: Exponential (1s, 2s, 4s)
- **Timeout**: 10 seconds per request

## Rate Limiting

### Market Data Endpoints
- **Limit**: 30 requests per minute
- **Window**: 1 minute rolling window
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Error Response
```json
{
  "success": false,
  "data": null,
  "error": "Too many market data requests, please try again later",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Setup & Configuration

### Environment Variables
```env
# API Keys (required)
ALPHA_VANTAGE_KEY=your_alpha_vantage_api_key
TWELVE_DATA_KEY=your_twelve_data_api_key

# Redis (optional, defaults to localhost)
REDIS_URL=redis://localhost:6379

# Database (required)
DATABASE_URL=postgresql://user:pass@localhost:5432/aifx_v2
```

### Redis Setup
```bash
# Start Redis with custom config
redis-server redis.conf

# Or use Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### API Keys Setup

#### Alpha Vantage
1. Sign up at [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
2. Get free API key (500 requests/day)
3. Add to `.env`: `ALPHA_VANTAGE_KEY=your_key`

#### Twelve Data
1. Sign up at [Twelve Data](https://twelvedata.com/pricing)
2. Get free API key (800 requests/day)
3. Add to `.env`: `TWELVE_DATA_KEY=your_key`

## Testing

### Run Tests
```bash
# Full test suite
node test-forex.js

# Quick tests only
node test-forex.js --quick

# Check market status only
node test-forex.js status
```

### Test Coverage
- ✅ Real-time rate fetching
- ✅ Historical data retrieval
- ✅ Cache effectiveness
- ✅ Rate limit handling
- ✅ Error handling
- ✅ Authentication integration
- ✅ API provider switching

## Performance Optimization

### Caching Best Practices
1. **Cache hit ratio > 80%** for optimal performance
2. **Real-time data** cached for 60 seconds
3. **Historical data** cached for 24 hours
4. **Failed requests** not cached

### Database Optimization
1. **Indexes** on pair, timeframe, timestamp
2. **Partitioning** by date for large datasets
3. **Cleanup** of old real-time data

### API Optimization
1. **Batch requests** when possible
2. **Respect rate limits** with tracking
3. **Exponential backoff** for retries
4. **Connection pooling** for HTTP requests

## Monitoring & Alerts

### Key Metrics
- API response times (< 200ms target)
- Cache hit rates (> 80% target)
- API rate limit usage
- Error rates (< 1% target)
- Data freshness

### Health Checks
```bash
# System health
curl http://localhost:3000/api/v1/health

# Market status
curl http://localhost:3000/api/v1/market/status
```

## Production Considerations

### Security
1. **API keys** stored securely
2. **Rate limiting** to prevent abuse
3. **Input validation** for all parameters
4. **HTTPS** for all communications

### Scalability
1. **Redis clustering** for high availability
2. **Load balancing** across multiple instances
3. **Database read replicas** for queries
4. **CDN** for static responses

### Monitoring
1. **API usage tracking** per provider
2. **Cache performance** monitoring
3. **Error rate** alerting
4. **Data quality** checks

## Troubleshooting

### Common Issues

#### Rate Limits Exceeded
```bash
# Check API usage
curl http://localhost:3000/api/v1/market/status
```

#### Cache Not Working
```bash
# Check Redis connection
redis-cli ping

# Clear cache if needed
curl -X POST http://localhost:3000/api/v1/market/cache/clear \
  -H "Authorization: Bearer <token>"
```

#### Missing Data
```bash
# Check supported pairs
curl http://localhost:3000/api/v1/market/pairs

# Check specific pair
curl http://localhost:3000/api/v1/market/realtime/EUR/USD
```

### Logs
- **Service logs**: Check console output
- **API errors**: Captured in error responses
- **Cache metrics**: Available in status endpoint
- **Database queries**: Enable Sequelize logging

## Usage Examples

### Frontend Integration
```javascript
class ForexDataService {
  constructor(baseUrl, token = null) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async getRealTimeRate(pair) {
    const headers = {};
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}/market/realtime/${pair}`, {
      headers,
    });

    return response.json();
  }

  async getHistoricalData(pair, timeframe = '1d', limit = 100) {
    const params = new URLSearchParams({
      timeframe,
      limit: limit.toString(),
    });

    const response = await fetch(
      `${this.baseUrl}/market/history/${pair}?${params}`
    );

    return response.json();
  }
}

// Usage
const forexService = new ForexDataService('http://localhost:3000/api/v1');
const eurUsdRate = await forexService.getRealTimeRate('EUR/USD');
```

### WebSocket Integration
```javascript
// Real-time updates via Socket.IO
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  // Subscribe to real-time updates for specific pairs
  socket.emit('subscribe_to_pair', 'EUR/USD');
});

socket.on('forex_update', (data) => {
  console.log('Real-time update:', data);
});
```

## API Response Times

| Endpoint | Target | Typical |
|----------|---------|---------|
| Real-time (cached) | < 50ms | 20-30ms |
| Real-time (fresh) | < 2000ms | 800-1500ms |
| Historical (cached) | < 100ms | 40-80ms |
| Historical (fresh) | < 3000ms | 1200-2500ms |
| Pairs list | < 20ms | 5-15ms |
| Status | < 50ms | 20-40ms |