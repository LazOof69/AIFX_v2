# AIFX_v2 - Comprehensive Project Structure & Architecture

**Project Location**: `/root/AIFX_v2`  
**Last Updated**: 2025-11-11  
**Status**: Active Development (Phase 3 - Discord & ML Integration)

---

## 1. PROJECT OVERVIEW

AIFX_v2 is an AI-powered **Forex Trading Advisory System** that provides:
- Real-time trading signals for forex pairs (EUR/USD, GBP/USD, USD/JPY, etc.)
- Machine learning-based price predictions
- Discord bot notifications for traders
- Web dashboard for signal analysis
- User preference management & portfolio tracking
- Position monitoring and risk management

### Technology Stack

**Backend**: Node.js + Express.js + Socket.IO  
**Frontend**: React + Vite + Tailwind CSS  
**ML Engine**: Python + TensorFlow + FastAPI  
**Database**: PostgreSQL + Sequelize ORM  
**Cache**: Redis  
**Real-time**: Socket.IO for live updates  
**Notifications**: Discord.js bot  
**APIs**: Alpha Vantage, Twelve Data, Yahoo Finance

---

## 2. COMPLETE DIRECTORY STRUCTURE

### 2.1 Backend (`/backend`)

**Port**: 3000  
**Entry Point**: `src/server.js`  
**Framework**: Express.js

#### Architecture Layers:

```
backend/src/
├── server.js              # Initializes Express, Socket.IO, graceful shutdown
├── app.js                 # Middleware setup (CORS, helmet, compression, rate limiting)
├── config/
│   └── database.js        # Sequelize PostgreSQL configuration (3 environments)
├── controllers/           # Request handlers
│   ├── authController.js          # JWT login, register, token refresh
│   ├── marketController.js        # Forex price data, historical charts
│   ├── tradingController.js       # Trading signal generation
│   ├── notificationController.js  # Notification CRUD operations
│   ├── positionController.js      # Active position tracking
│   └── preferencesController.js   # User trading preferences
├── routes/               # API endpoint definitions
│   ├── auth.js          # POST /api/v1/auth/login, /register, /refresh
│   ├── market.js        # GET /api/v1/market/price, /history, /indicators
│   ├── trading.js       # POST /api/v1/trading/signals
│   ├── notifications.js # GET/POST /api/v1/notifications/*
│   └── positions.js     # GET /api/v1/positions, /monitor
├── services/            # Core business logic
│   ├── authService.js                    # JWT generation, bcrypt hashing
│   ├── forexService.js                   # Alpha Vantage & Twelve Data APIs
│   ├── mlEngineService.js                # HTTP client → ML engine (port 8000)
│   ├── tradingSignalService.js           # Signal generation logic
│   ├── technicalAnalysis.js              # SMA, RSI, MACD, Bollinger Bands
│   ├── discordNotificationService.js     # Send to Discord API
│   ├── monitoringService.js              # Position & P&L tracking
│   ├── marketDataCollector.js            # Collects OHLCV every 15 min
│   ├── signalMonitoringService.js        # Monitors signals for Discord
│   ├── notificationService.js            # Email/push notifications
│   ├── redisEventService.js              # Redis pub/sub & caching
│   └── trainingDataExportService.js      # Export signals → ML training
├── models/              # Sequelize ORM models
│   ├── User.js                      # Users with auth info
│   ├── UserPreferences.js           # Trading frequency, risk level, pairs
│   ├── TradingSignal.js             # Generated signals with confidence
│   ├── UserTradingHistory.js        # Trade execution records
│   ├── MarketData.js                # OHLCV candle storage
│   ├── PositionMonitoring.js        # Open positions tracking
│   ├── UserDiscordSettings.js       # Discord notification config
│   ├── ModelTrainingLog.js          # ML training records
│   ├── ModelVersion.js              # Model versioning
│   ├── ModelABTest.js               # A/B testing results
│   └── index.js                     # Model registry & associations
├── middleware/          # Express middleware
│   ├── auth.js             # JWT token verification
│   ├── errorHandler.js     # Global error handling with AppError
│   └── validation.js       # Request validation (Joi)
└── utils/
    └── AppError.js         # Custom error class with statusCode
```

#### Database Migrations:

```
backend/database/migrations/
├── 20250101000001-create-users.js
├── 20250101000002-create-user-preferences.js
├── 20250101000003-create-trading-signals.js
├── 20250101000004-create-notifications.js
├── 20250101000005-create-user-trading-history.js
├── 20251008000001-add-fundamental-tables.js
├── 20251012000001-create-position-monitoring.js
├── 20251012000002-extend-notification-settings.js
├── 20251016000001-create-market-data.js
├── 20251016000002-create-discord-automation-tables.js
├── 20251021000001-create-model-training-log.js
├── 20251021000002-create-model-versions.js
├── 20251021000003-create-model-ab-test.js
└── 20251021000004-add-model-tracking-to-signals.js
```

#### Key Dependencies:

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.18.0 | Web framework |
| sequelize | ^6.0.0 | ORM for PostgreSQL |
| pg | ^8.11.0 | PostgreSQL driver |
| redis | ^4.0.0 | In-memory cache |
| discord.js | ^14.23.2 | Discord bot library |
| jsonwebtoken | ^9.0.0 | JWT token generation |
| bcrypt | ^5.0.0 | Password hashing (10+ rounds) |
| axios | ^1.0.0 | HTTP client |
| socket.io | ^4.0.0 | Real-time WebSocket |
| helmet | ^7.0.0 | Security headers |
| express-rate-limit | ^6.0.0 | API rate limiting |
| joi | ^17.0.0 | Request validation |
| winston | ^3.0.0 | Logging |
| technicalindicators | ^3.1.0 | TA calculations |

#### Scripts in package.json:

```bash
npm start              # Start production server
npm run dev            # Development with nodemon
npm test               # Run jest tests
npm run migrate        # Run database migrations
npm run seed           # Seed demo data
npm run db:reset       # Reset database completely
npm run test:discord   # Test Discord notifications
npm run test:signal    # Test signal generation
```

---

### 2.2 Frontend (`/frontend`)

**Port**: 5173 (Vite dev server) / 80 (production via Apache)  
**Entry Point**: `src/main.jsx`  
**Framework**: React 19 + Vite

#### Component Structure:

```
frontend/src/
├── main.jsx                 # React app entry point
├── App.jsx                  # Main router & layout
├── index.css               # Global styles
├── components/
│   ├── Login.jsx           # Authentication form
│   ├── Dashboard.jsx       # Main trading dashboard
│   ├── MarketOverview.jsx  # Forex pair grid with prices
│   ├── TradingView.jsx     # Trading signals list & details
│   ├── CandlestickChart.jsx # Chart.js candlestick charts
│   ├── Settings.jsx        # User preferences configuration
│   ├── MarketOverview_Old.jsx # (deprecated)
│   └── TradingView_Old.jsx    # (deprecated)
└── services/
    ├── api.js              # Axios instance to backend API
    └── socket.js           # Socket.IO real-time listener
```

#### Key Dependencies:

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^19.1.1 | UI framework |
| react-dom | ^19.1.1 | React DOM renderer |
| vite | ^7.1.7 | Build tool & dev server |
| axios | ^1.12.2 | HTTP client |
| socket.io-client | ^4.8.1 | Real-time updates |
| chart.js | ^4.5.0 | Charting library |
| react-chartjs-2 | ^5.3.0 | React Chart.js wrapper |
| react-router-dom | ^7.9.3 | Client-side routing |
| tailwindcss | ^4.1.13 | Utility CSS framework |
| framer-motion | ^12.23.24 | Animation library |
| lucide-react | ^0.548.0 | Icon library |

#### Configuration Files:

- `vite.config.js` - Vite bundler configuration
- `tailwind.config.js` - Tailwind CSS customization
- `.env` - Frontend environment (API_URL)
- `postcss.config.js` - PostCSS for Tailwind

---

### 2.3 ML Engine (`/ml_engine`)

**Port**: 8000  
**Entry Point**: `api/ml_server.py`  
**Framework**: FastAPI + TensorFlow

#### Python Architecture:

```
ml_engine/
├── api/
│   ├── ml_server.py              # FastAPI main app
│   │   - /predict/price          # POST price predictions
│   │   - /predict/direction      # POST buy/sell/hold signals
│   │   - /train                  # POST start training job
│   │   - /evaluate               # GET model performance metrics
│   │   - /health                 # GET API health check
│   ├── prediction_service.py     # Model.predict() wrapper
│   ├── model_manager.py          # Load/save/version models
│   ├── test_deployment.py        # Integration tests
│   └── ab_testing.py             # A/B test framework
├── models/
│   ├── price_predictor.py        # LSTM model class
│   │   - 3 LSTM layers (128, 64, 32 units)
│   │   - Dropout 0.2, recurrent dropout 0.1
│   │   - Dense layers (16, 8 units)
│   │   - Output: 1 unit linear activation (price prediction)
│   └── multi_input_predictor.py  # Multi-feature model
├── data_processing/
│   ├── preprocessor.py           # Data normalization & scaling
│   ├── yfinance_fetcher.py       # Yahoo Finance API client
│   ├── fundamental_features.py   # Economic calendar data
│   ├── v3_labeling_utils.py      # Label generation
│   └── v3_reversal_labeler.py    # Reversal pattern labels
├── saved_models/                 # Model artifacts storage
│   ├── price_predictor_v1.0.0_*.h5    # Keras model
│   └── *_scaler.pkl                   # MinMaxScaler for features
├── data/
│   ├── raw/                      # Raw OHLCV data
│   ├── processed/                # Preprocessed data
│   ├── training_v3/              # Training datasets
│   ├── training_v3_profitable/   # Profitable trade labels
│   ├── training_v3_reversal/     # Reversal patterns
│   └── intraday/                 # Intraday data
├── utils/
│   ├── indicators.py             # Technical indicators
│   └── data_processing.py        # Data utilities
├── logs/                         # TensorFlow training logs
├── checkpoints/                  # Model checkpoints
├── config.yaml                   # LSTM & training config
├── requirements.txt              # Python dependencies
└── venv/                         # Python 3.8 virtual environment
```

#### Python Dependencies:

```
fastapi>=0.100.0
uvicorn>=0.23.0
tensorflow>=2.10.0
scikit-learn>=1.0.0
pandas>=1.5.0
numpy>=1.23.0
redis>=4.0.0
pydantic
pyyaml
yfinance
```

#### Key Models:

1. **LSTM Price Predictor** (`price_predictor.py`)
   - Input: 30-day OHLCV history + technical indicators
   - Output: Next-day price prediction
   - Architecture: LSTM → Dense → Linear

2. **Multi-Input Predictor** (`multi_input_predictor.py`)
   - Inputs: Price + Fundamental + Sentiment features
   - Outputs: Direction (buy/sell/hold)

#### Data Pipeline:

```
Raw Data (Yahoo Finance)
    ↓
Fetch OHLCV (yfinance_fetcher.py)
    ↓
Calculate Indicators (fundamental_features.py)
    ↓
Generate Labels (v3_labeling_utils.py)
    ↓
Normalize & Scale (preprocessor.py)
    ↓
Save Training Data (data/training_v3/)
    ↓
Train LSTM Model (api/ml_server.py)
    ↓
Save Model + Scaler (saved_models/)
    ↓
Make Predictions (prediction_service.py)
```

---

### 2.4 Discord Bot (`/discord_bot`)

**Entry Point**: `bot.js`  
**Framework**: Discord.js v14

#### Bot Structure:

```
discord_bot/
├── bot.js                    # Main bot initialization & event handlers
│   - Slash command handling
│   - Interaction deferral with retry logic
│   - Error handling (10062, 40060 codes)
├── commands/                 # Slash command implementations
│   ├── signal.js            # /signal - View current trading signals
│   ├── subscribe.js         # /subscribe PAIR - Subscribe to notifications
│   ├── unsubscribe.js       # /unsubscribe PAIR
│   ├── preferences.js       # /preferences - Config settings
│   └── position.js          # /position - View open positions
├── services/
│   ├── botService.js        # Bot event listeners & handlers
│   └── notificationService.js # Send signals to Discord channels
├── models/
│   └── UserNotification.js   # Track Discord users
├── utils/
│   ├── logger.js            # Winston logging
│   └── helpers.js           # Utility functions
├── deploy-commands.js        # Deploy commands to Discord API
├── .env                      # DISCORD_BOT_TOKEN, GUILD_ID, etc.
└── package.json
```

#### Discord Features:

1. **Slash Commands**:
   - `/signal` - Get current trading signals
   - `/subscribe EUR/USD` - Subscribe to pair updates
   - `/unsubscribe EUR/USD` - Unsubscribe
   - `/preferences` - Manage notification settings
   - `/position` - View open positions

2. **Notifications**:
   - Real-time trading signal alerts
   - Position monitoring updates
   - Custom embeds with signal details
   - Rate limiting (1 notification per user per minute)

3. **Error Handling**:
   - Retry logic for interaction deferral
   - Handles Discord's eventual consistency
   - Fallback to immediate reply if defer fails

---

### 2.5 Database (`/backend/database`)

**Type**: PostgreSQL  
**Port**: 5432  
**ORM**: Sequelize

#### Database Schema (14 tables):

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| users | User accounts | id, email, username, password_hash |
| user_preferences | Trading settings | userId, tradingFrequency, riskLevel |
| trading_signals | Generated signals | id, pair, prediction, confidence, timestamp |
| user_trading_history | Trade records | userId, pair, signal_id, entry, exit |
| market_data | OHLCV candles | pair, timestamp, open, high, low, close, volume |
| position_monitoring | Active positions | userId, pair, entry_price, quantity, stop_loss |
| user_discord_settings | Discord config | userId, discordId, channels, subscribed_pairs |
| notifications | Alert records | id, userId, type, content, read_at |
| model_training_logs | Training metrics | id, modelVersion, accuracy, loss, timestamp |
| model_versions | Model artifacts | version, path, score, created_at |
| model_ab_tests | A/B test results | id, modelA_id, modelB_id, winner, metrics |

#### Connection Configuration:

```javascript
// Development: Uses DATABASE_URL or individual params
const sequelize = new Sequelize(
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  {
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'postgres',
    pool: { max: 10, min: 0, idle: 10000 }
  }
);
```

---

## 3. SYSTEM ARCHITECTURE & DATA FLOW

### 3.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)                   │
│              http://localhost:5173 or Port 80                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Login → Dashboard → Market Overview → Trading View        │   │
│  │        ↓ Socket.IO (Real-time) ↓ Axios (HTTP)            │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    CORS + Socket.IO
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    ▼                    ▼                    ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Backend API │  │  Socket.IO   │  │   WebSocket  │
│ (Port 3000)  │  │   Server     │  │  Connection  │
└──────────────┘  └──────────────┘  └──────────────┘
    │
    │ Routes: /api/v1/*
    │
    ├── /auth/*           → authController → authService
    ├── /market/*         → marketController → forexService → Alpha Vantage/Twelve Data
    ├── /trading/signals  → tradingController → tradingSignalService → ML Engine
    ├── /notifications/*  → notificationController → discordNotificationService
    └── /positions/*      → positionController → monitoringService
    
    │ Cache Layer
    ▼
┌──────────────────────────────────────┐
│  Redis (Port 6379)                   │
│  - Market data cache (60s TTL)       │
│  - Signal cache (1day TTL)           │
│  - User sessions                     │
│  - Pub/Sub for notifications         │
└──────────────────────────────────────┘
    │
    │ Persists to
    ▼
┌──────────────────────────────────────┐
│  PostgreSQL (Port 5432)              │
│  - Users & preferences               │
│  - Trading signals history           │
│  - Position tracking                 │
│  - Model training logs               │
│  - Discord settings                  │
└──────────────────────────────────────┘

Parallel Service: ML Engine
    │
    ├── Fetches market data (yfinance)
    ├── Preprocesses data (normalization)
    ├── Trains LSTM models
    ├── Makes predictions (POST /predict)
    └── Stores models in saved_models/

Notification Service: Discord Bot
    │
    ├── Listens for trading signals
    ├── Sends embeds to Discord
    ├── Handles slash commands
    └── Updates user subscriptions
```

### 3.2 Request/Response Flow

**Example**: User requests trading signals

```
1. Frontend (React)
   POST /api/v1/trading/signals?pair=EUR/USD
   Headers: { Authorization: "Bearer JWT_TOKEN" }

2. Backend (Express)
   → authMiddleware (verify JWT)
   → tradingController.getSignals()
   
3. Business Logic (Services)
   → tradingSignalService.getSignal(pair)
   → Check Redis cache (1 day TTL)
   
   If cache miss:
   → forexService.getPriceData(pair)
   → Call Alpha Vantage / Twelve Data API
   → technicalAnalysis.calculateIndicators()
   → Call ML Engine: POST http://localhost:8000/predict/direction
   
4. ML Engine (Python FastAPI)
   ← Load model from saved_models/
   ← Preprocess input (normalize features)
   ← LSTM inference
   → Return { prediction: "buy", confidence: 0.85 }

5. Backend (Services continue)
   → tradingSignalService.createSignal()
   → Save to PostgreSQL (trading_signals table)
   → Cache result in Redis
   → Emit Socket.IO event: "signal:new"

6. Frontend (React)
   ← Response: { success: true, data: { signal, confidence } }
   ← Socket.IO event: Update TradingView component in real-time

7. Discord Bot
   ← Listen for signal:new event
   → Send embed to Discord channel
   → Mention subscribed users
```

### 3.3 Component Communication

#### Backend → ML Engine:

```javascript
// mlEngineService.js
const predictSignal = async (pair, data) => {
  const response = await axios.post(
    'http://localhost:8000/predict/direction',
    { pair, ohlcv: data, indicators: {...} },
    { timeout: 30000 }
  );
  return response.data; // { prediction, confidence, factors }
};
```

#### Backend → Database:

```javascript
// tradingController.js
const signal = await TradingSignal.create({
  userId,
  pair,
  prediction,
  confidence,
  indicators: {...},
  createdAt: new Date()
});
```

#### Backend → Redis:

```javascript
// redisEventService.js
await redis.set(
  `signal:${pair}`,
  JSON.stringify(signal),
  'EX', 86400  // 1 day expiry
);
```

#### Backend → Discord:

```javascript
// discordNotificationService.js
const embed = new MessageEmbed()
  .setTitle(`Trading Signal: ${pair}`)
  .addField('Signal', signal, true)
  .addField('Confidence', `${confidence}%`, true);

await channel.send({ embeds: [embed] });
```

#### Frontend ↔ Backend:

```javascript
// api.js
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1',
  headers: { 'Authorization': `Bearer ${token}` }
});

// socket.js
const socket = io('http://localhost:3000', {
  auth: { token: localStorage.getItem('token') }
});

socket.on('signal:new', (data) => {
  // Update TradingView component
});
```

---

## 4. CONFIGURATION & ENVIRONMENT VARIABLES

### 4.1 Root Environment (`.env.example`)

```env
# Application
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/aifx_v2
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aifx_v2
DB_USER=aifx_user
DB_PASSWORD=aifx_password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=30d

# External APIs
ALPHA_VANTAGE_KEY=xxx
TWELVE_DATA_KEY=xxx

# Discord
DISCORD_BOT_TOKEN=xxx
DISCORD_GUILD_ID=xxx
DISCORD_CHANNEL_ID=xxx

# ML Engine
ML_API_URL=http://localhost:8000
ML_API_TIMEOUT=30000

# Security
BCRYPT_ROUNDS=12
CORS_ORIGIN=http://localhost:5173

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

### 4.2 ML Engine Configuration (`config.yaml`)

```yaml
server:
  host: 0.0.0.0
  port: 8000

model:
  lstm:
    units: [128, 64, 32]
    dropout: 0.2
    epochs: 150
    batch_size: 32
    learning_rate: 0.001
  version: "1.0.0"
  model_dir: "./saved_models"

api:
  cors_origins: ["http://localhost:3000", "http://localhost:5173"]
  version: "1.0.0"
```

---

## 5. MAIN ENTRY POINTS

### Backend Start:

```bash
# Development
cd backend
npm install
npm run dev          # nodemon watches for changes

# Production
npm start            # node src/server.js

# Output:
# ✅ AIFX_v2 Backend Server started successfully!
# 🌐 Server running on port 3000
# 🔗 Health check: http://localhost:3000/api/v1/health
```

### Frontend Start:

```bash
# Development
cd frontend
npm install
npm run dev          # Vite dev server on port 5173

# Build
npm run build        # Creates dist/ folder

# Output:
# VITE v7.1.7 ready in 234 ms
# ➜  Local:   http://localhost:5173/
```

### ML Engine Start:

```bash
# Setup
cd ml_engine
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run
python api/ml_server.py
# or
uvicorn api.ml_server:app --host 0.0.0.0 --port 8000 --reload

# Output:
# INFO:     Uvicorn running on http://0.0.0.0:8000
# INFO:     Loaded model from ./saved_models/price_predictor_v1.0.0_*.h5
```

### Discord Bot Start:

```bash
cd discord_bot
npm install
npm start            # node bot.js

# Or with PM2
pm2 start bot.js --name aifx-discord-bot

# Output:
# ✅ Discord bot logged in as BotName#0000
# 🔄 Listening for interactions...
```

---

## 6. API ENDPOINTS SUMMARY

### Authentication (`/api/v1/auth`)

```
POST   /register              # Create new user
POST   /login                 # Get JWT token
POST   /refresh               # Refresh JWT token
POST   /logout                # Invalidate token
```

### Market Data (`/api/v1/market`)

```
GET    /price/:pair           # Current price (cached 60s)
GET    /history/:pair         # Historical OHLCV data
GET    /indicators/:pair      # SMA, RSI, MACD, Bollinger Bands
POST   /candles               # Get candlestick data
```

### Trading Signals (`/api/v1/trading`)

```
POST   /signals               # Generate signals for user preferences
GET    /signals/:id           # Get specific signal details
GET    /history               # Trading signal history
POST   /backtest              # Backtest strategy
```

### Notifications (`/api/v1/notifications`)

```
GET    /                      # List user notifications
POST   /                      # Create notification
GET    /:id                   # Get specific notification
DELETE /:id                   # Delete notification
POST   /discord/config        # Configure Discord settings
```

### Positions (`/api/v1/positions`)

```
GET    /                      # Get open positions
POST   /                      # Create position
PUT    /:id                   # Update position
DELETE /:id                   # Close position
GET    /monitor               # Monitor all positions
```

---

## 7. TECHNOLOGY STACK SUMMARY

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Backend** | Node.js | 18+ | Runtime |
| | Express.js | 4.18 | Web framework |
| | Sequelize | 6.0 | ORM |
| | PostgreSQL | 13+ | Database |
| | Redis | 6+ | Cache |
| | Socket.IO | 4.0 | Real-time |
| **Frontend** | React | 19 | UI |
| | Vite | 7.1 | Bundler |
| | Tailwind CSS | 4.1 | Styling |
| | Chart.js | 4.5 | Charts |
| | Axios | 1.1 | HTTP client |
| **ML** | Python | 3.8+ | Runtime |
| | TensorFlow | 2.10+ | Deep learning |
| | FastAPI | 0.100+ | API framework |
| | Scikit-learn | 1.0+ | ML utilities |
| | Pandas | 1.5+ | Data processing |
| **Notifications** | Discord.js | 14.14 | Discord bot |
| **DevOps** | Docker | - | Containerization |
| | PM2 | - | Process manager |
| | Git | - | Version control |

---

## 8. HOW SERVICES COMMUNICATE

### Synchronous (HTTP/REST):

1. **Frontend → Backend**: Axios HTTP requests
   - Authentication, data fetching, signal generation

2. **Backend → ML Engine**: Axios HTTP requests
   - POST predictions, GET model status

3. **Backend → External APIs**: Axios HTTP requests
   - Alpha Vantage, Twelve Data, Yahoo Finance

### Asynchronous (Socket.IO):

1. **Backend → Frontend**: Real-time updates
   - New trading signals
   - Price updates
   - Position changes

2. **Discord Bot → Backend**: Event listeners
   - Signal monitoring service
   - Position updates

### Pub/Sub (Redis):

1. **Services → Services**: Event publishing
   - New signal events
   - Position updates
   - Notification triggers

### Database:

1. **All Services → PostgreSQL**: Data persistence
   - Users, signals, positions, training logs

2. **All Services → Redis**: Caching
   - Market data (60s TTL)
   - Signals (1 day TTL)
   - Session tokens

---

## 9. DEPLOYMENT STRUCTURE

### Development:

```
Local Machine
├── Backend (npm run dev on 3000)
├── Frontend (npm run dev on 5173)
├── ML Engine (python on 8000)
├── Discord Bot (node bot.js)
├── PostgreSQL (5432)
└── Redis (6379)
```

### Production:

```
Server (VPS/Cloud)
├── Backend (PM2 or Docker on 3000)
├── Frontend (Nginx/Apache serving dist/ on 80/443)
├── ML Engine (gunicorn/Docker on 8000)
├── Discord Bot (PM2 or Docker)
├── PostgreSQL (managed or Docker)
└── Redis (managed or Docker)
```

---

## 10. DOCUMENTATION FILES

Located in root directory:

- `CLAUDE.md` - Project rules & conventions
- `START_HERE.md` - Quick start guide
- `PROJECT_STATUS.md` - Phase completion status
- `DISCORD_SERVICE_STATUS.md` - Discord bot status
- `ML_INTEGRATION_STATUS_REPORT.md` - ML pipeline status
- `DATABASE_ARCHITECTURE.md` - DB schema details
- `E2E_TEST_GUIDE.md` - End-to-end testing
- `COMPLETE_SETUP_GUIDE.md` - Full setup instructions
- `ML_ENGINE_DEPLOYMENT.md` - ML deployment
- `FINAL_TEST_REPORT.md` - Test results

---

## Summary

AIFX_v2 is a **modular, multi-service architecture** with:

1. **Backend** - RESTful API + WebSocket real-time updates
2. **Frontend** - React SPA with live charts and trading signals
3. **ML Engine** - TensorFlow LSTM for price predictions
4. **Discord Bot** - Automated trading notifications
5. **PostgreSQL** - Persistent data storage
6. **Redis** - High-performance caching

Each component runs independently but communicates seamlessly through well-defined APIs and event handlers.

