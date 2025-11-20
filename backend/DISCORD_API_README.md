# Discord Bot API Documentation

**Phase 2**: Backend APIs for Discord Bot Service

**Created**: 2025-11-20
**Status**: ✅ Implemented
**Architecture**: Microservices (following CLAUDE.md principles)

---

## 📋 Overview

This document describes the Discord Bot APIs implemented in Phase 2 of the microservices architecture refactoring.

These APIs allow the Discord Bot to access user data, trading signals, and trading history **without direct database access**, following the principle that **only the Backend service can access PostgreSQL directly**.

---

## 🔑 Authentication

All Discord API endpoints require API Key authentication.

### Headers

```http
Authorization: Bearer <DISCORD_BOT_API_KEY>
X-Service-Name: discord-bot
Content-Type: application/json
```

### API Key Configuration

Set the API key in `.env`:

```env
DISCORD_BOT_API_KEY=your_secure_api_key_here
```

For development, a default key is provided:
```
dev_discord_bot_key_replace_in_production
```

**⚠️ IMPORTANT**: Change this key in production!

---

## 📡 API Endpoints

### Base URL

```
http://localhost:3000/api/v1/discord
```

### Health Check

```http
GET /api/v1/discord/health
```

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "discord-api",
    "timestamp": "2025-11-20T10:30:00Z"
  }
}
```

---

## 👤 User Management APIs

### Get User by Discord ID

```http
GET /api/v1/discord/users/:discordId
```

**Parameters**:
- `discordId` (path) - Discord user ID (snowflake)

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "username": "trader123",
    "email": "trader@example.com",
    "discordId": "123456789012345678",
    "discordUsername": "trader123#1234",
    "discordSettings": {
      "notificationsEnabled": true,
      "enabledTimeframes": ["1h", "4h"],
      "preferredPairs": ["EUR/USD", "GBP/USD"],
      "minConfidence": 0.6,
      "onlyMlEnhanced": true,
      "maxNotificationsPerDay": 20,
      "notificationCooldownMinutes": 240
    },
    "preferences": { ... }
  }
}
```

### Create or Update User

```http
POST /api/v1/discord/users
```

**Request Body**:
```json
{
  "discordId": "123456789012345678",
  "discordUsername": "trader123#1234",
  "username": "trader123",
  "email": "trader@example.com",
  "notificationsEnabled": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "uuid-here",
    "discordId": "123456789012345678",
    "username": "trader123",
    "created": true,
    "message": "User created successfully"
  }
}
```

### Update Discord Settings

```http
PUT /api/v1/discord/users/:discordId/settings
```

**Request Body**:
```json
{
  "notificationsEnabled": true,
  "enabledTimeframes": ["1h", "4h", "1d"],
  "preferredPairs": ["EUR/USD", "GBP/USD", "USD/JPY"],
  "minConfidence": 0.7,
  "onlyMlEnhanced": true,
  "maxNotificationsPerDay": 10,
  "notificationCooldownMinutes": 180
}
```

---

## 📊 Trading Signals APIs

### Get Pending Signals

```http
GET /api/v1/discord/signals
```

**Query Parameters**:
- `status` (optional) - Signal status (default: "active")
- `limit` (optional) - Maximum number of signals (default: 50, max: 100)
- `offset` (optional) - Pagination offset (default: 0)

**Response**:
```json
{
  "success": true,
  "data": {
    "signals": [
      {
        "id": "signal-uuid",
        "pair": "EUR/USD",
        "timeframe": "1h",
        "signal": "buy",
        "confidence": 0.85,
        "entryPrice": 1.1234,
        "stopLoss": 1.1200,
        "takeProfit": 1.1300,
        "createdAt": "2025-11-20T10:00:00Z",
        "eligibleUsers": [
          {
            "userId": "user-uuid",
            "discordId": "123456789012345678",
            "discordUsername": "trader123#1234",
            "notified": false
          }
        ]
      }
    ],
    "pagination": {
      "total": 5,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### Get Signal by ID

```http
GET /api/v1/discord/signals/:signalId
```

### Mark Signal as Delivered

```http
POST /api/v1/discord/signals/:signalId/delivered
```

**Request Body**:
```json
{
  "userId": "user-uuid",
  "discordId": "123456789012345678",
  "deliveredAt": "2025-11-20T10:30:00Z"
}
```

---

## 💼 Trading History APIs

### Get Trading History

```http
GET /api/v1/discord/trades
```

**Query Parameters**:
- `userId` (optional) - User ID
- `discordId` (optional) - Discord ID (required if userId not provided)
- `limit` (optional) - Maximum number of trades (default: 20, max: 100)
- `offset` (optional) - Pagination offset (default: 0)
- `pair` (optional) - Filter by currency pair

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "trades": [
      {
        "id": "trade-uuid",
        "pair": "EUR/USD",
        "action": "buy",
        "amount": 1000,
        "entryPrice": 1.1234,
        "exitPrice": 1.1250,
        "profitLoss": 16.00,
        "profitLossPercent": 0.14,
        "status": "closed_profit",
        "createdAt": "2025-11-20T09:00:00Z"
      }
    ],
    "pagination": {
      "total": 10,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### Record a Trade

```http
POST /api/v1/discord/trades
```

**Request Body**:
```json
{
  "discordId": "123456789012345678",
  "pair": "EUR/USD",
  "action": "buy",
  "amount": 1000,
  "entryPrice": 1.1234,
  "stopLoss": 1.1200,
  "takeProfit": 1.1300,
  "signalId": "signal-uuid"
}
```

### Update a Trade

```http
PUT /api/v1/discord/trades/:tradeId
```

**Request Body**:
```json
{
  "exitPrice": 1.1250,
  "status": "closed_profit"
}
```

---

## 🧪 Testing

### Run API Tests

```bash
# Make sure Backend is running
cd backend
npm start

# In another terminal, run tests
node src/tests/api/test-discord-api.js
```

### Manual Testing with cURL

```bash
# Set API key
export API_KEY="dev_discord_bot_key_replace_in_production"

# Test health check
curl -H "Authorization: Bearer $API_KEY" \
     http://localhost:3000/api/v1/discord/health

# Create user
curl -X POST \
     -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"discordId":"123456789","username":"test_user"}' \
     http://localhost:3000/api/v1/discord/users

# Get user
curl -H "Authorization: Bearer $API_KEY" \
     http://localhost:3000/api/v1/discord/users/123456789

# Get signals
curl -H "Authorization: Bearer $API_KEY" \
     http://localhost:3000/api/v1/discord/signals?limit=5
```

---

## 🚨 Error Responses

All errors follow this format:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User with Discord ID 123456789 not found"
  },
  "metadata": {
    "timestamp": "2025-11-20T10:30:00Z",
    "version": "v1",
    "requestId": "req-uuid"
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing Authorization header |
| `INVALID_API_KEY` | 403 | Invalid API key |
| `USER_NOT_FOUND` | 404 | User not found |
| `SIGNAL_NOT_FOUND` | 404 | Signal not found |
| `TRADE_NOT_FOUND` | 404 | Trade not found |
| `MISSING_DISCORD_ID` | 400 | Discord ID is required |
| `INVALID_ACTION` | 400 | Invalid trade action |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

---

## 📊 Rate Limits

- **Discord Bot**: 500 requests per minute
- **ML Engine**: 1000 requests per minute (future)

Rate limiting is enforced per service (not per IP).

---

## 🔒 Security Considerations

1. **API Keys**: Store in environment variables, never commit to git
2. **HTTPS**: Use HTTPS in production
3. **Rate Limiting**: Enforced automatically
4. **Input Validation**: All inputs are validated
5. **Error Messages**: Production errors don't expose internal details

---

## 📁 File Structure

```
backend/src/
├── middleware/api/
│   └── apiKeyAuth.js          # API Key authentication
├── controllers/api/discord/
│   ├── usersController.js     # User management
│   ├── signalsController.js   # Signal management
│   └── tradesController.js    # Trade management
├── routes/api/v1/discord/
│   ├── index.js               # Main router
│   ├── users.js               # User routes
│   ├── signals.js             # Signal routes
│   └── trades.js              # Trade routes
└── tests/api/
    └── test-discord-api.js    # API tests
```

---

## 🔄 Next Steps (Phase 3 & 4)

1. **Phase 3**: Implement ML Engine APIs
2. **Phase 4**: Refactor Discord Bot to use these APIs
   - Remove `discord_bot/models/` (database access)
   - Implement `BackendApiClient` in Discord Bot
   - Update all Discord commands to use API

---

## 📚 References

- **Architecture Plan**: `/root/AIFX_v2/MICROSERVICES_REFACTOR_PLAN.md`
- **API Spec**: `/root/AIFX_v2/docs/api/backend-api-spec.yaml`
- **Service Boundaries**: `/root/AIFX_v2/docs/api/service-boundaries.md`
- **Principles**: `/root/AIFX_v2/CLAUDE.md` (Microservices Architecture Principles)

---

**Last Updated**: 2025-11-20
**Phase**: 2 (Backend APIs for Discord Bot) ✅ Complete
