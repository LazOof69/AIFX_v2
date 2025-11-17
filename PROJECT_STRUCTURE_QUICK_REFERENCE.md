# AIFX_v2 Project Structure - Executive Summary

**Date**: November 11, 2025  
**Location**: `/root/AIFX_v2`  
**Project Type**: AI-Powered Forex Trading Advisory System

---

## Quick Navigation

- **Full Architecture**: See `PROJECT_ARCHITECTURE_ANALYSIS.md` (comprehensive)
- **Quick Start**: See `START_HERE.md` (Chinese guide)
- **Project Status**: See `PROJECT_STATUS.md` (development phases)
- **Discord Status**: See `DISCORD_SERVICE_STATUS.md`
- **ML Engine Status**: See `ML_INTEGRATION_STATUS_REPORT.md`

---

## 5-Minute Overview

### What is AIFX_v2?

A **multi-service trading signals system** that:

1. **Analyzes forex market data** → Fetches from Alpha Vantage, Twelve Data, Yahoo Finance
2. **Generates trading signals** → ML-powered price predictions (LSTM neural network)
3. **Delivers notifications** → Discord bot alerts to traders
4. **Tracks positions** → Monitors open trades, P&L, risk metrics
5. **Provides dashboard** → React web interface for signal analysis

### Technology Stack (One-line summary per service)

| Service | Port | Tech Stack | Purpose |
|---------|------|-----------|---------|
| **Backend API** | 3000 | Node.js + Express.js + PostgreSQL + Redis | RESTful API, business logic, socket.io |
| **Frontend** | 5173 | React 19 + Vite + Tailwind CSS | Web dashboard & charts |
| **ML Engine** | 8000 | Python + TensorFlow + FastAPI | LSTM price predictions |
| **Discord Bot** | - | Discord.js | Trading alerts & commands |
| **Database** | 5432 | PostgreSQL | User, signal, position storage |
| **Cache** | 6379 | Redis | Market data caching, pub/sub |

---

## Directory Structure (25 Lines Summary)

```
/root/AIFX_v2/
├── backend/                  # Node.js Express REST API (3000)
│   ├── src/
│   │   ├── server.js         ← Entry point
│   │   ├── controllers/      # Request handlers (auth, market, trading)
│   │   ├── services/         # Business logic (14 services)
│   │   ├── routes/           # API endpoints (/api/v1/*)
│   │   ├── models/           # Sequelize ORM (10 tables)
│   │   ├── middleware/       # Auth, error handling, validation
│   │   └── config/database.js # PostgreSQL connection
│   └── database/
│       ├── migrations/       # 14 database schema migrations
│       └── seeders/          # Demo test data
│
├── frontend/                 # React + Vite SPA (5173)
│   ├── src/
│   │   ├── main.jsx          ← Entry point
│   │   ├── components/       # 6 React components
│   │   ├── services/         # API client, socket.io
│   │   └── index.css         # Global styles
│   ├── vite.config.js        # Build configuration
│   └── tailwind.config.js    # CSS framework
│
├── ml_engine/                # Python ML Service (8000)
│   ├── api/
│   │   ├── ml_server.py      ← FastAPI entry point
│   │   ├── prediction_service.py  # Model inference
│   │   └── model_manager.py  # Load/save models
│   ├── models/
│   │   └── price_predictor.py     # LSTM architecture
│   ├── data_processing/      # 5 data pipeline modules
│   ├── saved_models/         # Trained model artifacts
│   ├── data/                 # Training datasets
│   └── config.yaml           # LSTM parameters
│
├── discord_bot/              # Discord Bot Service
│   ├── bot.js                ← Entry point
│   ├── commands/             # 5 slash commands
│   ├── services/             # Bot logic & notifications
│   └── models/               # Discord user tracking
│
├── .env.example              # Environment template
├── CLAUDE.md                 # Project rules & conventions
├── START_HERE.md             # Quick start guide
├── PROJECT_STATUS.md         # Development phase status
└── PROJECT_ARCHITECTURE_ANALYSIS.md  ← Full architecture (NEW)
```

---

## Key Files & Entry Points

### Backend
- **Entry**: `/backend/src/server.js` → Initializes Express, Socket.IO, graceful shutdown
- **App config**: `/backend/src/app.js` → Middleware setup (security, rate limit, CORS)
- **Main controllers**: authController, marketController, tradingController
- **Main services**: forexService, mlEngineService, tradingSignalService, discordNotificationService

### Frontend  
- **Entry**: `/frontend/src/main.jsx` → React root
- **Router**: `/frontend/src/App.jsx` → Navigation logic
- **API client**: `/frontend/src/services/api.js` → Axios instance
- **Main components**: Dashboard, MarketOverview, TradingView, CandlestickChart

### ML Engine
- **Entry**: `/ml_engine/api/ml_server.py` → FastAPI app
- **Model**: `/ml_engine/models/price_predictor.py` → LSTM neural network
- **Data pipeline**: `/ml_engine/data_processing/` → 5 data transformation modules
- **Config**: `/ml_engine/config.yaml` → Model hyperparameters

### Discord Bot
- **Entry**: `/discord_bot/bot.js` → Discord.js client initialization
- **Commands**: `/discord_bot/commands/` → signal.js, subscribe.js, preferences.js
- **Services**: notification & event handling

### Database
- **Connection**: `/backend/src/config/database.js` → Sequelize setup
- **Migrations**: `/backend/database/migrations/` → 14 schema change files
- **Models**: `/backend/src/models/` → 10 Sequelize ORM models

---

## API Endpoints (Quick Reference)

### Authentication
```
POST   /api/v1/auth/register      # Create account
POST   /api/v1/auth/login         # Get JWT token
POST   /api/v1/auth/refresh       # Renew expired token
```

### Market Data
```
GET    /api/v1/market/price/:pair           # Current price (cached)
GET    /api/v1/market/history/:pair         # OHLCV candles
GET    /api/v1/market/indicators/:pair      # Technical indicators
```

### Trading Signals
```
POST   /api/v1/trading/signals     # Generate signals
GET    /api/v1/trading/history     # Signal history
```

### Notifications
```
GET    /api/v1/notifications/      # List notifications
POST   /api/v1/notifications/discord/config  # Discord settings
```

### Positions
```
GET    /api/v1/positions/          # Open positions
GET    /api/v1/positions/monitor   # Monitor positions
```

---

## How to Start Services

### Start All Services (Recommended)

```bash
cd /root/AIFX_v2

# Development
npm run dev                    # Only works in backend/

# Or use tmux (if setup):
./start-all-services.sh        # Starts in background tmux sessions

# Check status:
./check-services.sh
```

### Start Individual Services

**Backend**:
```bash
cd backend
npm install
npm run dev                    # Nodemon watches for changes
# Port 3000
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev                    # Vite dev server
# Port 5173
```

**ML Engine**:
```bash
cd ml_engine
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python api/ml_server.py        # or: uvicorn api.ml_server:app --reload
# Port 8000
```

**Discord Bot**:
```bash
cd discord_bot
npm install
npm start                      # or: npm run dev
# Requires DISCORD_BOT_TOKEN in .env
```

---

## How Services Communicate

### Synchronous (HTTP Requests)

1. **Frontend → Backend**: 
   - Axios requests to `/api/v1/*` endpoints
   - Socket.IO real-time events

2. **Backend → ML Engine**: 
   - POST to `http://localhost:8000/predict/direction`
   - GET from `http://localhost:8000/health`

3. **Backend → External APIs**: 
   - Alpha Vantage (forex prices)
   - Twelve Data (market data)
   - Yahoo Finance (historical data)

### Asynchronous (Events)

1. **Redis Pub/Sub**: Services publish/subscribe to trading events
2. **Socket.IO**: Real-time updates to connected frontend clients
3. **Discord Events**: Bot listens for command interactions

### Data Persistence

1. **PostgreSQL**: Long-term storage (users, signals, positions, training logs)
2. **Redis**: Short-term cache (market data 60s, signals 1 day)

---

## Database Tables (Overview)

14 tables in PostgreSQL:

| Critical Tables | Purpose |
|-----------------|---------|
| **users** | User accounts & auth |
| **user_preferences** | Trading settings (frequency, risk level, pairs) |
| **trading_signals** | Generated signals with prediction & confidence |
| **market_data** | OHLCV candles for pairs |
| **position_monitoring** | Active trades & P&L |
| **user_discord_settings** | Discord notification config |

| Supporting Tables | Purpose |
|-------------------|---------|
| **user_trading_history** | Trade execution records |
| **notifications** | Alert history |
| **model_training_logs** | ML training metrics |
| **model_versions** | Trained model versions |
| **model_ab_tests** | A/B test results |

---

## Configuration Files

### Environment Variables (`.env`)

Required across all services:
- `NODE_ENV` (development/production)
- `DATABASE_URL` (PostgreSQL connection)
- `REDIS_URL` (Cache server)
- `JWT_SECRET` (Token signing)
- `ALPHA_VANTAGE_KEY` (Forex API)
- `DISCORD_BOT_TOKEN` (Discord auth)
- `ML_API_URL` (ML service endpoint)

See `.env.example` for all variables.

### ML Engine Config (`config.yaml`)

LSTM architecture:
```yaml
model:
  lstm:
    units: [128, 64, 32]      # Layer sizes
    dropout: 0.2              # Regularization
    epochs: 150               # Training iterations
    batch_size: 32
```

---

## Development Workflow

### Making Changes

1. **Backend**: Edit `backend/src/*` → Auto-reload with nodemon
2. **Frontend**: Edit `frontend/src/*` → Auto-reload with Vite
3. **ML Engine**: Edit `ml_engine/*` → Restart manually
4. **DB Schema**: Create new migration → `npm run migrate`

### Testing

- **Backend**: `npm run test` (Jest)
- **Frontend**: Manual testing via browser
- **ML**: Check API docs at `http://localhost:8000/docs`
- **Discord**: Use `/test-command` in Discord

### Committing

Follow Conventional Commits format:
```
<type>(<scope>): <description>

<detailed explanation>

Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Troubleshooting

### Service won't start?

1. Check port is available: `lsof -i :3000` (or 5173, 8000)
2. Check env vars: `echo $DATABASE_URL`
3. Check logs: `cat backend/logs/app.log`
4. Restart the service

### API returns errors?

- 10062: Discord interaction timeout (bot retry logic)
- 40060: Discord interaction already handled
- 401: Missing/invalid JWT token
- 429: Rate limit exceeded

### ML predictions failing?

- Check model loaded: `ls ml_engine/saved_models/`
- Check API health: `curl http://localhost:8000/health`
- Check data: `ls ml_engine/data/training_v3/`

---

## Key Technologies & Versions

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Backend runtime |
| Python | 3.8+ | ML runtime |
| PostgreSQL | 13+ | Database |
| Redis | 6+ | Cache |
| Express.js | 4.18 | Web framework |
| React | 19 | Frontend framework |
| TensorFlow | 2.10+ | Deep learning |
| Discord.js | 14.14 | Discord API |

---

## Project Status

**Phase**: 3 (Discord Integration & ML)  
**Status**: Active Development  
**Last Update**: Nov 11, 2025  

Key metrics:
- 4 services (Backend, Frontend, ML, Discord Bot)
- 14 database tables
- 35+ API endpoints
- 10+ trading signal providers
- Real-time WebSocket updates
- LSTM neural network for predictions

---

## Next Steps

1. **Read**: `PROJECT_ARCHITECTURE_ANALYSIS.md` (full details)
2. **Setup**: Follow `START_HERE.md` (Chinese) or `COMPLETE_SETUP_GUIDE.md`
3. **Configure**: Copy `.env.example` → `.env` with your credentials
4. **Start**: Run `./start-all-services.sh`
5. **Access**: Frontend at `http://localhost:5173`

---

## Document Structure

```
PROJECT_STRUCTURE_DOCS/
├── This file (QUICK OVERVIEW)
├── PROJECT_ARCHITECTURE_ANALYSIS.md (COMPLETE - 500+ lines)
│   ├── Full directory tree with explanations
│   ├── All service configurations
│   ├── Complete API endpoint list
│   ├── Data flow diagrams
│   ├── Technology stack details
│   └── Deployment instructions
│
├── START_HERE.md (QUICK START - Chinese)
├── PROJECT_STATUS.md (PROGRESS TRACKING)
├── DISCORD_SERVICE_STATUS.md (BOT STATUS)
├── ML_INTEGRATION_STATUS_REPORT.md (ML STATUS)
├── DATABASE_ARCHITECTURE.md (DB SCHEMA)
└── [30+ other documentation files]
```

---

**For detailed architecture information, see `PROJECT_ARCHITECTURE_ANALYSIS.md`**

