# Claude Code Rules for AIFX_v2

## Project Overview
AIFX_v2 is an AI-powered forex trading advisory system that provides trading signals and market analysis to users through web interface and Discord notifications.

## Core Architecture
- Backend: Node.js with Express.js
- Database: PostgreSQL with Sequelize ORM
- Cache: Redis
- ML Engine: Python with TensorFlow/scikit-learn
- Frontend: React + Vite
- Notifications: Discord.js
- Real-time: Socket.io

## Development Principles

### 1. Code Style
- Use ES6+ syntax for all JavaScript code
- Use async/await over callbacks
- Implement proper error handling with try-catch blocks
- Add JSDoc comments for all functions
- Use meaningful variable names
- Follow RESTful API conventions

### 2. Project Structure
Always maintain this directory structure:
```
AIFX_v2/
├── backend/          # Node.js API server
├── ml_engine/        # Python ML services  
├── frontend/         # React application
├── discord_bot/      # Discord bot service
└── database/         # Migration and seed files
```

### 3. Security Requirements
- Never commit API keys or secrets
- Use environment variables for all configurations
- Implement JWT authentication with refresh tokens
- Add rate limiting to all API endpoints
- Validate all user inputs
- Use parameterized queries to prevent SQL injection
- Hash passwords with bcrypt (min 10 rounds)

### 4. API Design Rules
- All endpoints must follow pattern: `/api/{version}/{resource}/{action}`
- Return consistent JSON response format:
```javascript
{
  success: boolean,
  data: object | array | null,
  error: string | null,
  timestamp: ISO8601
}
```
- Implement pagination for list endpoints
- Use appropriate HTTP status codes
- Add request validation middleware

### 5. Database Guidelines
- All tables must have: id, created_at, updated_at
- Use migrations for schema changes
- Create indexes for frequently queried columns
- Implement soft delete where appropriate
- Use transactions for multi-table operations

### 6. Trading Logic Rules
- Never provide guaranteed profit claims
- Always include risk warnings in responses
- Implement stop-loss recommendations
- Log all trading signals for audit
- Cache market data aggressively (min 1 minute)
- Handle API rate limits gracefully

### 7. ML Integration
- Separate ML API from main backend
- Version all models
- Log prediction confidence scores
- Implement fallback to technical indicators if ML fails
- Store training metrics for monitoring

### 8. Testing Requirements
- Write unit tests for all services
- Include integration tests for API endpoints
- Test error scenarios
- Mock external API calls
- Maintain >70% code coverage

### 9. Performance Optimization
- Implement caching strategy for market data
- Use connection pooling for database
- Optimize database queries with indexes
- Implement lazy loading where appropriate
- Use CDN for static assets

### 10. Error Handling
```javascript
// Always use this error format
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code; // e.g., 'INVALID_PAIR', 'API_LIMIT'
  }
}
```

## Specific Implementation Guidelines

### Forex Data Service
- Primary: Alpha Vantage API (5 req/min limit)
- Fallback: Twelve Data API (800 req/day)
- Cache all responses in Redis (TTL: 60 seconds for real-time, 1 day for historical)
- Implement exponential backoff for retries

### User Preferences Schema
```javascript
{
  tradingFrequency: 'scalping' | 'daytrading' | 'swing' | 'position',
  riskLevel: 1-10,
  preferredPairs: string[],
  tradingStyle: 'trend' | 'counter-trend' | 'mixed',
  indicators: {
    sma: { enabled: boolean, period: number },
    rsi: { enabled: boolean, period: number }
  }
}
```

### Technical Indicators
- Keep calculations simple and efficient
- Use ta-lib or technicalindicators library
- Always validate input data
- Return null for insufficient data

### Discord Notifications
- Rate limit: Max 1 notification per user per minute
- Format messages with embeds for better UX
- Include timestamp and source in all alerts
- Allow users to customize notification types

### ML Model Integration
```python
# Standard prediction response format
{
  "prediction": "buy" | "sell" | "hold",
  "confidence": 0.0-1.0,
  "factors": {
    "technical": 0.0-1.0,
    "sentiment": 0.0-1.0,
    "pattern": 0.0-1.0
  },
  "timestamp": ISO8601
}
```

## Environment Variables
Always require these environment variables:
```env
NODE_ENV=development|production
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
ALPHA_VANTAGE_KEY=...
TWELVE_DATA_KEY=...
DISCORD_BOT_TOKEN=...
ML_API_URL=http://localhost:8000
```

## Git Workflow
- Branch naming: feature/*, bugfix/*, hotfix/*
- Commit message format: "type(scope): description"
- Types: feat, fix, docs, style, refactor, test, chore
- Always create PR for main branch
- Include tests with new features

## Deployment Checklist
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Redis cache cleared
- [ ] ML models deployed
- [ ] Discord bot online
- [ ] SSL certificates valid
- [ ] Monitoring configured
- [ ] Backup strategy in place

## Common Pitfalls to Avoid
1. Don't store sensitive data in JWT
2. Don't trust client-side calculations
3. Don't make synchronous API calls
4. Don't ignore rate limits
5. Don't cache user-specific data globally
6. Don't expose internal error details to users
7. Don't use floating point for monetary calculations

## Performance Metrics to Monitor
- API response time < 200ms (p95)
- Database query time < 50ms (p95)
- ML prediction time < 1000ms
- WebSocket latency < 100ms
- Cache hit rate > 80%
- Error rate < 1%

## Dependencies to Use
### Backend (Node.js)
- express: ^4.18.0
- sequelize: ^6.0.0
- jsonwebtoken: ^9.0.0
- bcrypt: ^5.0.0
- axios: ^1.0.0
- socket.io: ^4.0.0
- redis: ^4.0.0
- winston: ^3.0.0 (logging)
- joi: ^17.0.0 (validation)
- helmet: ^7.0.0 (security)
- cors: ^2.8.0
- dotenv: ^16.0.0

### ML Engine (Python)
- tensorflow>=2.10.0
- scikit-learn>=1.0.0
- pandas>=1.5.0
- numpy>=1.23.0
- fastapi>=0.100.0
- uvicorn>=0.23.0
- redis>=4.0.0

### Frontend (React)
- react: ^18.2.0
- vite: ^4.0.0
- axios: ^1.0.0
- react-router-dom: ^6.0.0
- tailwindcss: ^3.0.0
- chart.js: ^4.0.0
- socket.io-client: ^4.0.0

## Response Examples

### Success Response
```javascript
res.status(200).json({
  success: true,
  data: {
    signal: 'buy',
    confidence: 0.75,
    indicators: { sma: 1.1234, rsi: 45 }
  },
  error: null,
  timestamp: new Date().toISOString()
});
```

### Error Response
```javascript
res.status(400).json({
  success: false,
  data: null,
  error: 'Invalid currency pair format',
  timestamp: new Date().toISOString()
});
```

## Final Notes
- Always prioritize user data security
- Implement gradual rollout for new features
- Maintain comprehensive documentation
- Follow the principle of least privilege
- Regular security audits are mandatory
- Keep dependencies updated
- Monitor and log everything