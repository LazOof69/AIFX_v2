# AIFX_v2 - AI-Powered Forex Trading Advisory System

An advanced AI-powered forex trading advisory system that provides intelligent trading signals and comprehensive market analysis through web interface and Discord notifications.

## Project Architecture

### Core Components

```
AIFX_v2/
├── backend/          # Node.js API Server (Express.js)
├── frontend/         # React Web Application (Vite)
├── ml_engine/        # Python ML Services (TensorFlow/scikit-learn)
├── discord_bot/      # Discord Bot Service (Discord.js)
├── database/         # Database Migrations and Seeds
├── docker-compose.yml # Infrastructure setup
└── CLAUDE.md         # Development guidelines
```

### Technology Stack

#### Backend (Node.js)
- **Framework**: Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Cache**: Redis
- **Authentication**: JWT with refresh tokens
- **Real-time**: Socket.io
- **Security**: Helmet, CORS, Rate limiting
- **Validation**: Joi
- **Logging**: Winston

#### Frontend (React)
- **Framework**: React 18+ with Vite
- **Routing**: React Router DOM
- **Styling**: Tailwind CSS
- **Charts**: Chart.js
- **Real-time**: Socket.io client
- **HTTP Client**: Axios

#### ML Engine (Python)
- **Framework**: FastAPI
- **ML Libraries**: TensorFlow, scikit-learn
- **Data Processing**: Pandas, NumPy
- **Cache**: Redis integration

#### Discord Bot
- **Framework**: Discord.js
- **Features**: Trading signals, market alerts
- **Rate limiting**: 1 notification per user per minute

### Key Features

#### Trading Intelligence
- AI-powered signal generation
- Multiple timeframe analysis
- Risk assessment and management
- Technical indicator integration
- Pattern recognition

#### User Experience
- Real-time market data
- Customizable notifications
- Trading performance tracking
- Risk preference settings
- Multi-format data export

#### Security & Performance
- JWT authentication with refresh tokens
- Rate limiting and input validation
- Encrypted password storage (bcrypt)
- Redis caching for optimal performance
- Comprehensive error handling

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AIFX_v2
   ```

2. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start infrastructure services**
   ```bash
   docker-compose up -d postgres redis
   ```

4. **Setup backend**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

5. **Setup frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

6. **Setup ML engine**
   ```bash
   cd ml_engine
   pip install -r requirements.txt
   python main.py
   ```

7. **Setup Discord bot**
   ```bash
   cd discord_bot
   npm install
   npm start
   ```

### Environment Configuration

Required environment variables (see `.env.example`):

#### Core Settings
- `NODE_ENV`: Application environment
- `PORT`: Backend server port
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string

#### Authentication
- `JWT_SECRET`: JWT signing secret
- `JWT_REFRESH_SECRET`: Refresh token secret

#### External APIs
- `ALPHA_VANTAGE_KEY`: Primary forex data source
- `TWELVE_DATA_KEY`: Fallback forex data source
- `DISCORD_BOT_TOKEN`: Discord bot authentication

#### ML Integration
- `ML_API_URL`: ML engine endpoint

## API Architecture

### Core Endpoints
```
GET  /api/v1/auth/login          # User authentication
POST /api/v1/auth/register       # User registration
GET  /api/v1/signals             # Trading signals
GET  /api/v1/market/:pair        # Market data
POST /api/v1/preferences         # User preferences
GET  /api/v1/analytics           # Performance analytics
```

### Response Format
```javascript
{
  success: boolean,
  data: object | array | null,
  error: string | null,
  timestamp: ISO8601
}
```

## Database Schema

### Core Tables
- `users`: User accounts and authentication
- `user_preferences`: Trading preferences and settings
- `trading_signals`: Generated trading signals
- `market_data`: Cached forex data
- `notifications`: Discord notification logs
- `analytics`: Performance tracking

## Performance Targets

- API response time: < 200ms (p95)
- Database query time: < 50ms (p95)
- ML prediction time: < 1000ms
- WebSocket latency: < 100ms
- Cache hit rate: > 80%
- Error rate: < 1%

## Security Features

- JWT authentication with refresh tokens
- Password hashing (bcrypt, 12 rounds)
- Rate limiting (100 requests per 15 minutes)
- Input validation (Joi schemas)
- SQL injection prevention (parameterized queries)
- CORS configuration
- Helmet security headers

## Development Workflow

### Branch Strategy
- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `hotfix/*`: Critical fixes

### Commit Convention
```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
Example: feat(signals): add ML confidence scoring
```

### Testing
- Unit tests: Jest (Backend), Vitest (Frontend)
- Integration tests: Supertest
- Coverage target: > 70%

## Deployment

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Redis cache configured
- [ ] ML models deployed
- [ ] Discord bot online
- [ ] SSL certificates valid
- [ ] Monitoring configured
- [ ] Backup strategy implemented

### Infrastructure
- Docker containerization
- PostgreSQL for persistence
- Redis for caching
- Load balancing ready
- Horizontal scaling support

## Monitoring & Logging

### Metrics
- Application performance (response times)
- Database performance (query times)
- Cache hit rates
- Error rates and types
- User activity patterns

### Logging
- Structured logging (Winston)
- Log levels: error, warn, info, debug
- Centralized log collection
- Real-time error alerting

## Contributing

1. Follow the development guidelines in `CLAUDE.md`
2. Ensure all tests pass
3. Maintain code coverage above 70%
4. Update documentation for new features
5. Follow the commit message convention

## Support

For questions and support:
- Check the documentation in `CLAUDE.md`
- Review the API documentation
- Contact the development team

## License

MIT License - see LICENSE file for details.