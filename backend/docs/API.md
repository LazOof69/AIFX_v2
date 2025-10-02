# AIFX API Documentation

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication
Most endpoints require JWT authentication. Include the access token in the Authorization header:
```
Authorization: Bearer <access_token>
```

---

## Authentication Endpoints

### Register User
Register a new user account.

**Endpoint:** `POST /auth/register`

**Request Body:**
```json
{
  "username": "string (required, 3-50 chars)",
  "email": "string (required, valid email)",
  "password": "string (required, min 8 chars)"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "john_trader",
      "email": "john@example.com",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  },
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Validation error
- `409 Conflict` - Email or username already exists

---

### Login
Authenticate user and receive access and refresh tokens.

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "john_trader",
      "email": "john@example.com"
    },
    "accessToken": "jwt_token",
    "refreshToken": "jwt_refresh_token"
  },
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Missing credentials
- `401 Unauthorized` - Invalid credentials

---

### Refresh Token
Get a new access token using refresh token.

**Endpoint:** `POST /auth/refresh`

**Request Body:**
```json
{
  "refreshToken": "string (required)"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_token"
  },
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired refresh token

---

### Logout
Invalidate refresh token.

**Endpoint:** `POST /auth/logout`

**Authentication:** Required

**Response:** `200 OK`
```json
{
  "success": true,
  "data": null,
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### Get Profile
Get current user profile.

**Endpoint:** `GET /auth/profile`

**Authentication:** Required

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "john_trader",
    "email": "john@example.com",
    "isActive": true,
    "lastLogin": "2025-01-01T00:00:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z"
  },
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

## Trading Signal Endpoints

### Get Signal for Pair
Get trading signal for specific currency pair.

**Endpoint:** `GET /trading/signal/:pair`

**Authentication:** Required

**Parameters:**
- `pair` (path) - Currency pair (e.g., EUR/USD)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "pair": "EUR/USD",
    "action": "buy",
    "confidence": 0.75,
    "entryPrice": 1.0850,
    "stopLoss": 1.0800,
    "takeProfit": 1.0950,
    "riskReward": 2.0,
    "timeframe": "1hour",
    "technicalFactors": {
      "sma": true,
      "rsi": 45,
      "macd": "bullish"
    },
    "sentimentFactors": {
      "marketSentiment": "bullish",
      "newsImpact": "medium"
    },
    "mlPrediction": {
      "modelConfidence": 0.80,
      "prediction": "buy"
    },
    "status": "active",
    "createdAt": "2025-01-01T00:00:00.000Z"
  },
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid pair format
- `404 Not Found` - No signal available for pair

---

### Get All Signals
Get list of trading signals with pagination.

**Endpoint:** `GET /trading/signals`

**Authentication:** Required

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 10, max: 50)
- `pair` (optional) - Filter by currency pair
- `action` (optional) - Filter by action (buy, sell, hold)
- `status` (optional) - Filter by status (active, closed, expired)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "signals": [
      {
        "id": "uuid",
        "pair": "EUR/USD",
        "action": "buy",
        "confidence": 0.75,
        "entryPrice": 1.0850,
        "status": "active",
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10
    }
  },
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### Get Personalized Recommendation
Get trading recommendation based on user preferences.

**Endpoint:** `GET /trading/recommendation`

**Authentication:** Required

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "signal": {
      "pair": "EUR/USD",
      "action": "buy",
      "confidence": 0.85,
      "reason": "Strong bullish trend matching your preferred trading style"
    },
    "alternativeSignals": [
      {
        "pair": "GBP/USD",
        "action": "buy",
        "confidence": 0.70
      }
    ]
  },
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### Get Trading History
Get user's trading history.

**Endpoint:** `GET /trading/history`

**Authentication:** Required

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 10)
- `status` (optional) - Filter by status (open, closed, cancelled)
- `startDate` (optional) - Start date (ISO 8601)
- `endDate` (optional) - End date (ISO 8601)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "uuid",
        "pair": "EUR/USD",
        "action": "buy",
        "entryPrice": 1.0850,
        "exitPrice": 1.0950,
        "profitLoss": 100.00,
        "profitLossPercentage": 0.92,
        "status": "closed",
        "result": "win",
        "openedAt": "2025-01-01T00:00:00.000Z",
        "closedAt": "2025-01-01T02:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "pages": 5
    },
    "statistics": {
      "totalTrades": 50,
      "winRate": 0.65,
      "totalProfitLoss": 5000.00
    }
  },
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

## Market Data Endpoints

### Get Current Price
Get real-time price for currency pair.

**Endpoint:** `GET /market/price/:pair`

**Authentication:** Required

**Parameters:**
- `pair` (path) - Currency pair (e.g., EUR/USD)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "pair": "EUR/USD",
    "price": 1.0850,
    "bid": 1.0849,
    "ask": 1.0851,
    "spread": 0.0002,
    "change": 0.0010,
    "changePercent": 0.092,
    "timestamp": "2025-01-01T00:00:00.000Z"
  },
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### Get Historical Data
Get historical price data for currency pair.

**Endpoint:** `GET /market/history/:pair`

**Authentication:** Required

**Parameters:**
- `pair` (path) - Currency pair

**Query Parameters:**
- `timeframe` (optional) - Timeframe (1min, 5min, 15min, 1hour, 4hour, daily) (default: 1hour)
- `limit` (optional) - Number of data points (default: 100, max: 500)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-01-01T00:00:00.000Z",
      "open": 1.0850,
      "high": 1.0860,
      "low": 1.0840,
      "close": 1.0855,
      "volume": 1000
    }
  ],
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### Get Market Overview
Get overview of all major currency pairs.

**Endpoint:** `GET /market/overview`

**Authentication:** Required

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "pair": "EUR/USD",
      "price": 1.0850,
      "change": 0.0010,
      "changePercent": 0.092,
      "volume": 50000,
      "trend": "up"
    },
    {
      "pair": "GBP/USD",
      "price": 1.2650,
      "change": -0.0020,
      "changePercent": -0.158,
      "volume": 30000,
      "trend": "down"
    }
  ],
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### Get Technical Indicators
Get technical indicators for currency pair.

**Endpoint:** `GET /market/indicators/:pair`

**Authentication:** Required

**Parameters:**
- `pair` (path) - Currency pair

**Query Parameters:**
- `indicators` (optional) - Comma-separated list (sma,rsi,macd,bb) (default: all)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "pair": "EUR/USD",
    "sma": 1.0845,
    "rsi": 55.5,
    "macd": {
      "value": 0.0015,
      "signal": 0.0010,
      "histogram": 0.0005
    },
    "bb": {
      "upper": 1.0900,
      "middle": 1.0850,
      "lower": 1.0800
    },
    "timestamp": "2025-01-01T00:00:00.000Z"
  },
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

## User Preferences Endpoints

### Get Preferences
Get user preferences.

**Endpoint:** `GET /preferences`

**Authentication:** Required

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "tradingFrequency": "daytrading",
    "riskLevel": 5,
    "preferredPairs": ["EUR/USD", "GBP/USD"],
    "tradingStyle": "trend",
    "indicators": {
      "sma": { "enabled": true, "period": 20 },
      "rsi": { "enabled": true, "period": 14 }
    }
  },
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### Update Preferences
Update user preferences.

**Endpoint:** `PUT /preferences`

**Authentication:** Required

**Request Body:**
```json
{
  "tradingFrequency": "daytrading",
  "riskLevel": 7,
  "preferredPairs": ["EUR/USD", "GBP/USD", "USD/JPY"],
  "tradingStyle": "mixed",
  "indicators": {
    "sma": { "enabled": true, "period": 20 },
    "rsi": { "enabled": true, "period": 14 }
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "tradingFrequency": "daytrading",
    "riskLevel": 7,
    "preferredPairs": ["EUR/USD", "GBP/USD", "USD/JPY"],
    "tradingStyle": "mixed"
  },
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### Get Notification Settings
Get notification preferences.

**Endpoint:** `GET /preferences/notifications`

**Authentication:** Required

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "email": true,
    "discord": false,
    "browser": true,
    "signalTypes": {
      "buy": true,
      "sell": true,
      "hold": false
    },
    "minConfidence": 70
  },
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### Update Notification Settings
Update notification preferences.

**Endpoint:** `PUT /preferences/notifications`

**Authentication:** Required

**Request Body:**
```json
{
  "email": true,
  "discord": true,
  "browser": true,
  "signalTypes": {
    "buy": true,
    "sell": true,
    "hold": false
  },
  "minConfidence": 75
}
```

**Response:** `200 OK`

---

## Notification Endpoints

### Get Notifications
Get user notifications.

**Endpoint:** `GET /notifications`

**Authentication:** Required

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 20)
- `type` (optional) - Filter by type (signal, alert, system, news)
- `isRead` (optional) - Filter by read status (true, false)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "signal",
        "title": "New Trading Signal",
        "message": "EUR/USD: BUY signal with 75% confidence",
        "data": {
          "pair": "EUR/USD",
          "action": "buy",
          "confidence": 0.75
        },
        "isRead": false,
        "priority": "high",
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    },
    "unreadCount": 10
  },
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### Mark Notification as Read
Mark a notification as read.

**Endpoint:** `PATCH /notifications/:id/read`

**Authentication:** Required

**Parameters:**
- `id` (path) - Notification ID

**Response:** `200 OK`

---

### Mark All as Read
Mark all notifications as read.

**Endpoint:** `PATCH /notifications/read-all`

**Authentication:** Required

**Response:** `200 OK`

---

### Delete Notification
Delete a notification.

**Endpoint:** `DELETE /notifications/:id`

**Authentication:** Required

**Parameters:**
- `id` (path) - Notification ID

**Response:** `200 OK`

---

## Analytics Endpoints

### Get Performance Metrics
Get trading performance metrics.

**Endpoint:** `GET /analytics/performance`

**Authentication:** Required

**Query Parameters:**
- `period` (optional) - Time period (7d, 30d, 90d, 1y) (default: 30d)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "winRate": 0.65,
    "totalSignals": 100,
    "accuracy": 0.70,
    "totalProfitLoss": 5000.00,
    "averageProfitLoss": 50.00,
    "bestTrade": {
      "pair": "EUR/USD",
      "profitLoss": 500.00
    },
    "worstTrade": {
      "pair": "GBP/USD",
      "profitLoss": -200.00
    }
  },
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### Get Win Rate
Get detailed win rate statistics.

**Endpoint:** `GET /analytics/win-rate`

**Authentication:** Required

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "overall": 0.65,
    "byPair": {
      "EUR/USD": 0.70,
      "GBP/USD": 0.60,
      "USD/JPY": 0.68
    },
    "byAction": {
      "buy": 0.68,
      "sell": 0.62
    },
    "byTimeframe": {
      "1hour": 0.65,
      "4hour": 0.70,
      "daily": 0.75
    }
  },
  "error": null,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

## WebSocket Events

### Connection
Connect to WebSocket server:
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});
```

### Events

#### trading:signal
New trading signal generated.
```javascript
socket.on('trading:signal', (data) => {
  // data: { pair, action, confidence, ... }
});
```

#### price:update
Real-time price update (subscribe to specific pair).
```javascript
socket.emit('subscribe:price', { pair: 'EUR/USD' });
socket.on('price:EUR/USD', (data) => {
  // data: { price, bid, ask, timestamp }
});
```

#### market:update
Market overview update.
```javascript
socket.on('market:update', (data) => {
  // data: [{ pair, price, change, ... }]
});
```

#### notification
New notification for user.
```javascript
socket.on('notification', (data) => {
  // data: { type, title, message, ... }
});
```

---

## Error Responses

All error responses follow this format:
```json
{
  "success": false,
  "data": null,
  "error": "Error message",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### Common Error Codes
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## Rate Limiting
- Default: 100 requests per 15 minutes per IP
- Authenticated users: 500 requests per 15 minutes
- Headers included:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

---

## Pagination
All list endpoints support pagination with these query parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 50)

Response includes pagination metadata:
```json
{
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```