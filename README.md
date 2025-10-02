# AIFX v2 - AI-Powered Forex Trading Advisory System

<div align="center">

**Intelligent Trading Signals | Real-time Analysis | Personalized Recommendations**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)
[![Coverage](https://img.shields.io/badge/Coverage-70%25-brightgreen.svg)](https://github.com/yourusername/AIFX_v2)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)
- [License](#license)

---

## 🎯 Overview

AIFX v2 is an AI-powered forex trading advisory system that provides intelligent trading signals, real-time market analysis, and personalized recommendations. The system combines technical analysis, sentiment analysis, and machine learning to deliver high-confidence trading signals across multiple currency pairs.

### Key Objectives

- ⚡ **Accuracy**: Provide trading signals with >70% confidence
- 🔄 **Real-time**: Deliver signals via WebSocket instantly
- 🎯 **Personalization**: Tailor recommendations to user risk tolerance
- 📊 **Transparency**: Explain signals with technical factors
- 🌐 **Accessibility**: Web and Discord interfaces

---

## ✨ Features

### 🔐 Authentication & Security
- JWT-based authentication with refresh tokens
- Bcrypt password hashing (10 rounds)
- Rate limiting (100 req/15 min)
- Helmet.js security headers
- Input validation with Joi

### 📊 Trading Signals
- AI-generated signals for 12+ currency pairs
- Multi-factor analysis (Technical, Sentiment, ML)
- Risk management with stop-loss/take-profit
- Confidence scores (0.0-1.0)
- Multiple timeframes (1min to daily)

### 📈 Market Data
- Real-time price feeds
- Historical data with configurable timeframes
- Technical indicators (SMA, RSI, MACD, BB)
- Market overview dashboard

### ⚙️ Personalization
- Trading frequency (scalping, day, swing, position)
- Risk level (1-10 scale)
- Preferred currency pairs
- Trading style (trend, counter-trend, mixed)
- Custom indicator configurations

### 🔔 Notifications
- Multi-channel (Email, Discord, Browser)
- Signal type filtering (Buy, Sell, Hold)
- Confidence threshold settings
- Priority levels (Low, Medium, High, Urgent)

### 📱 Real-time Updates
- WebSocket for instant updates
- Price streaming
- Signal notifications
- Market updates

### 📉 Analytics
- Win rate tracking
- Performance metrics (7d, 30d, 90d, 1y)
- Trade history with P&L
- Best/worst trade analysis

---

## 🏗️ Architecture

```
┌─────────────────┐
│   React Web     │
│   Application   │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐      ┌──────────────┐      ┌──────────────┐
│  Express API    │◄────►│  PostgreSQL  │      │    Redis     │
│    Server       │      │   Database   │      │    Cache     │
└────────┬────────┘      └──────────────┘      └──────────────┘
         │ WebSocket
         ▼
┌─────────────────┐      ┌──────────────┐
│   Socket.io     │      │   Python     │
│   Real-time     │      │  ML Engine   │
└─────────────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Discord Bot    │      │  Forex APIs  │
│   (optional)    │      │ (Alpha/12D)  │
└─────────────────┘      └──────────────┘
```

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.18
- **Database**: PostgreSQL 14+ (Sequelize ORM)
- **Cache**: Redis 4.0
- **Real-time**: Socket.io 4.0
- **Auth**: JWT (jsonwebtoken)
- **Validation**: Joi
- **Security**: Helmet, bcrypt, rate-limit
- **Testing**: Jest, Supertest
- **Logging**: Winston

### Frontend
- **Framework**: React 18.2
- **Build**: Vite 4.0
- **Routing**: React Router 6
- **Styling**: TailwindCSS 3.0
- **Charts**: Chart.js 4.0
- **HTTP**: Axios
- **Real-time**: Socket.io-client

### ML Engine
- **Language**: Python 3.10+
- **ML**: TensorFlow / scikit-learn
- **API**: FastAPI
- **Data**: Pandas, NumPy

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0+
- PostgreSQL 14+
- Redis 4.0+
- Python 3.10+ (optional, for ML)

### Quick Start

1. **Clone Repository**
   ```bash
   git clone https://github.com/yourusername/AIFX_v2.git
   cd AIFX_v2
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Create Database**
   ```bash
   # PostgreSQL
   sudo -u postgres psql -c "CREATE DATABASE aifx_v2_dev;"

   # Run migrations
   npm run migrate

   # Seed demo data (optional)
   npm run seed
   ```

4. **Setup Frontend**
   ```bash
   cd ../frontend
   npm install
   cp .env.example .env
   ```

5. **Start Services**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev

   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

6. **Access Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - API Docs: `backend/docs/API.md`

### Demo Accounts

```
Email: john@example.com
Password: password123

Email: sarah@example.com
Password: trader2023
```

---

## 📚 API Documentation

Full documentation: [`backend/docs/API.md`](backend/docs/API.md)

**Base URL**: `http://localhost:3000/api/v1`

**Authentication**: JWT Bearer token in header

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login and get tokens |
| GET | `/trading/signal/:pair` | Get trading signal |
| GET | `/trading/signals` | List all signals |
| GET | `/market/price/:pair` | Get real-time price |
| GET | `/market/overview` | Market overview |
| GET | `/preferences` | Get user preferences |
| GET | `/notifications` | Get notifications |

### WebSocket Events

```javascript
socket.on('trading:signal', callback);
socket.on('price:EUR/USD', callback);
socket.on('market:update', callback);
socket.on('notification', callback);
```

---

## 🔐 Environment Variables

### Backend

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/aifx_v2_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
ALPHA_VANTAGE_KEY=your-api-key
TWELVE_DATA_KEY=your-api-key
ML_API_URL=http://localhost:8000
```

### Frontend

```bash
VITE_API_URL=http://localhost:3000/api/v1
VITE_SOCKET_URL=http://localhost:3000
```

---

## 🧪 Testing

### Run Tests

```bash
cd backend

# All tests
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Specific test
npm test -- auth.test.js
```

### Test Files

```
tests/
├── unit/
│   ├── auth.test.js              # Authentication tests
│   ├── forexService.test.js      # Forex service tests
│   └── tradingSignals.test.js    # Signal generation tests
└── integration/
    └── api.test.js               # API endpoint tests
```

### Coverage Requirements

- Branches: >70%
- Functions: >70%
- Lines: >70%
- Statements: >70%

---

## 🚢 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure strong JWT secrets
- [ ] Setup SSL certificates
- [ ] Configure CORS for your domain
- [ ] Run database migrations
- [ ] Configure Redis persistence
- [ ] Setup monitoring
- [ ] Configure backups
- [ ] Run `npm audit`

### Docker Deployment

```bash
docker-compose build
docker-compose up -d
```

### Recommended Hosting

- **Backend**: Heroku, DigitalOcean, AWS
- **Database**: AWS RDS, DigitalOcean Managed DB
- **Redis**: Redis Cloud, AWS ElastiCache
- **Frontend**: Vercel, Netlify, Cloudflare Pages

---

## 📁 Project Structure

```
AIFX_v2/
├── backend/                    # Node.js API
│   ├── src/
│   │   ├── config/            # Configuration
│   │   ├── controllers/       # Route controllers
│   │   ├── middleware/        # Express middleware
│   │   ├── models/            # Sequelize models
│   │   ├── routes/            # API routes
│   │   ├── services/          # Business logic
│   │   └── utils/             # Utilities
│   ├── database/
│   │   ├── migrations/        # DB migrations
│   │   ├── seeders/           # Seed data
│   │   └── config/            # DB config
│   ├── tests/                 # Jest tests
│   ├── docs/                  # Documentation
│   └── package.json
├── frontend/                   # React app
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── services/          # API client
│   │   └── App.jsx
│   └── package.json
├── ml_engine/                  # Python ML
├── discord_bot/                # Discord bot
└── README.md
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## ⚠️ Disclaimer

**IMPORTANT**: This system provides advisory signals only, not financial advice. Trading forex involves substantial risk. Always conduct your own research and never risk more than you can afford to lose.

---

## 🙏 Acknowledgments

- [Alpha Vantage](https://www.alphavantage.co/) - Forex data
- [Twelve Data](https://twelvedata.com/) - Market data
- Open source community

---

<div align="center">

**Made with ❤️ by the AIFX Team**

[API Docs](backend/docs/API.md) • [Report Issue](https://github.com/yourusername/AIFX_v2/issues)

</div>