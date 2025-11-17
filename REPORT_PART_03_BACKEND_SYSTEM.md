# AIFX v2 專案報告書
# 第三部分：後端系統

> **Backend System Architecture & Implementation**
>
> Express.js · RESTful API · Microservices
>
> 文檔版本：1.0.0 | 報告日期：2025-11-11

---

## 目錄

- [3.1 技術選型與框架](#31-技術選型與框架)
- [3.2 API 端點完整清單](#32-api-端點完整清單)
- [3.3 身份驗證與授權](#33-身份驗證與授權)
- [3.4 核心服務模組](#34-核心服務模組)
- [3.5 中間件與攔截器](#35-中間件與攔截器)
- [3.6 錯誤處理機制](#36-錯誤處理機制)
- [3.7 快取策略](#37-快取策略)
- [3.8 背景服務](#38-背景服務)

---

## 3.1 技術選型與框架

### 🔧 核心技術棧

#### **運行環境**
```javascript
{
  "runtime": "Node.js 18.x+",
  "packageManager": "npm 9.x+",
  "language": "JavaScript (ES6+ / ES2020)",
  "moduleSystem": "CommonJS (require/module.exports)"
}
```

---

#### **Web 框架：Express.js 4.18.0**

**選型原因：**
- ✅ 成熟穩定（10+ 年生產驗證）
- ✅ 生態豐富（50,000+ npm 套件）
- ✅ 輕量級（核心功能精簡，可按需擴展）
- ✅ 中間件機制（靈活的請求處理管道）
- ✅ 社群活躍（問題解決快速）

**基礎配置：**
```javascript
// backend/src/app.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const app = express();

// 信任代理（用於獲取真實 IP）
app.set('trust proxy', 1);

// 安全標頭
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS 跨域配置
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 壓縮響應
app.use(compression());

// 請求體解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 全局限流
const rateLimit = require('express-rate-limit');
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100, // 最多 100 次請求
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

module.exports = app;
```

---

#### **ORM 框架：Sequelize 6.0+**

**選型原因：**
- ✅ 支持多種數據庫（PostgreSQL、MySQL、SQLite）
- ✅ Promise-based API（配合 async/await）
- ✅ 遷移管理（Migration）
- ✅ 模型驗證（內建驗證器）
- ✅ 關聯查詢（Eager Loading）
- ✅ 事務支持（Transaction）

**數據庫連接配置：**
```javascript
// backend/src/config/database.js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DATABASE_URL || {
    database: process.env.DB_NAME || 'aifx_v2',
    username: process.env.DB_USER || 'aifx_user',
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
  },
  {
    // 連接池配置
    pool: {
      max: 20,        // 最大連接數
      min: 5,         // 最小連接數
      acquire: 30000, // 獲取連接超時（30秒）
      idle: 10000,    // 閒置連接超時（10秒）
    },
    // 日誌配置
    logging: process.env.NODE_ENV === 'development'
      ? console.log
      : false,
    // 時區設定
    timezone: '+08:00',
    // 定義全局選項
    define: {
      timestamps: true,
      underscored: true, // 使用蛇形命名（created_at）
      freezeTableName: true, // 禁用自動複數化表名
    },
  }
);

// 測試連接
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to database:', error);
    process.exit(1);
  }
}

module.exports = { sequelize, testConnection };
```

---

#### **認證：JSON Web Token (JWT)**

**套件：jsonwebtoken 9.0+**

```javascript
// backend/src/utils/jwt.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

/**
 * 生成 Access Token
 */
function generateAccessToken(payload) {
  return jwt.sign(
    payload,
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'aifx-v2',
      audience: 'aifx-v2-users',
    }
  );
}

/**
 * 生成 Refresh Token
 */
function generateRefreshToken(payload) {
  return jwt.sign(
    payload,
    JWT_REFRESH_SECRET,
    {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'aifx-v2',
      audience: 'aifx-v2-users',
    }
  );
}

/**
 * 驗證 Access Token
 */
function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    issuer: 'aifx-v2',
    audience: 'aifx-v2-users',
  });
}

/**
 * 驗證 Refresh Token
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET, {
    issuer: 'aifx-v2',
    audience: 'aifx-v2-users',
  });
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
```

---

#### **快取：Redis 4.0+**

**套件：redis 4.0+**

```javascript
// backend/src/config/redis.js
const redis = require('redis');

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('❌ Redis max reconnection attempts reached');
        return new Error('Max retries reached');
      }
      return Math.min(retries * 100, 3000); // 指數退避
    },
  },
});

redisClient.on('connect', () => {
  console.log('✅ Redis client connected');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis client error:', err);
});

// 連接 Redis
async function connectRedis() {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    process.exit(1);
  }
}

module.exports = { redisClient, connectRedis };
```

---

#### **實時通訊：Socket.io 4.0+**

```javascript
// backend/src/config/socket.js
const socketIO = require('socket.io');
const { verifyAccessToken } = require('../utils/jwt');

function initializeSocket(server) {
  const io = socketIO(server, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // 認證中間件
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = verifyAccessToken(token);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // 連接處理
  io.on('connection', (socket) => {
    console.log(`✅ User ${socket.userId} connected`);

    // 加入用戶專屬房間
    socket.join(`user:${socket.userId}`);

    // 訂閱全局信號
    socket.on('subscribe:signals', () => {
      socket.join('signals:global');
      console.log(`User ${socket.userId} subscribed to signals`);
    });

    // 訂閱價格更新
    socket.on('subscribe:price', (pair) => {
      socket.join(`price:${pair}`);
      console.log(`User ${socket.userId} subscribed to ${pair}`);
    });

    // 取消訂閱
    socket.on('unsubscribe:price', (pair) => {
      socket.leave(`price:${pair}`);
    });

    // 斷開連接
    socket.on('disconnect', () => {
      console.log(`❌ User ${socket.userId} disconnected`);
    });
  });

  return io;
}

module.exports = { initializeSocket };
```

---

### 📦 關鍵依賴套件

| 套件 | 版本 | 用途 | 文件大小 |
|-----|------|------|---------|
| **express** | ^4.18.0 | Web 框架 | ~200 KB |
| **sequelize** | ^6.0.0 | ORM | ~500 KB |
| **pg** | ^8.0.0 | PostgreSQL 驅動 | ~150 KB |
| **redis** | ^4.0.0 | Redis 客戶端 | ~100 KB |
| **socket.io** | ^4.0.0 | WebSocket 支持 | ~300 KB |
| **jsonwebtoken** | ^9.0.0 | JWT 認證 | ~50 KB |
| **bcrypt** | ^5.0.0 | 密碼加密 | ~200 KB |
| **axios** | ^1.0.0 | HTTP 客戶端 | ~150 KB |
| **joi** | ^17.0.0 | 數據驗證 | ~300 KB |
| **helmet** | ^7.0.0 | 安全標頭 | ~50 KB |
| **cors** | ^2.8.0 | CORS 處理 | ~20 KB |
| **compression** | ^1.7.0 | gzip 壓縮 | ~30 KB |
| **express-rate-limit** | ^6.0.0 | 限流 | ~30 KB |
| **winston** | ^3.0.0 | 日誌管理 | ~200 KB |
| **dotenv** | ^16.0.0 | 環境變數 | ~10 KB |

**總依賴大小：** ~150 MB（含開發依賴）

---

### 🗂️ 專案目錄結構

```
backend/
├── src/
│   ├── app.js                    # Express 應用配置
│   ├── server.js                 # HTTP 伺服器啟動
│   │
│   ├── config/                   # 配置文件
│   │   ├── database.js           # Sequelize 配置
│   │   ├── redis.js              # Redis 配置
│   │   └── socket.js             # Socket.io 配置
│   │
│   ├── controllers/              # 控制器（處理 HTTP 請求）
│   │   ├── authController.js     # 認證相關（註冊、登入）
│   │   ├── tradingController.js  # 交易信號
│   │   ├── marketController.js   # 市場數據
│   │   ├── positionController.js # 倉位管理
│   │   ├── notificationController.js  # 通知管理
│   │   └── preferencesController.js   # 用戶偏好
│   │
│   ├── services/                 # 業務邏輯層
│   │   ├── authService.js        # 認證服務
│   │   ├── tradingSignalService.js    # 交易信號服務
│   │   ├── forexService.js       # 外匯數據服務
│   │   ├── mlEngineService.js    # ML 引擎整合
│   │   ├── positionService.js    # 倉位服務
│   │   ├── monitoringService.js  # 倉位監控
│   │   ├── notificationService.js     # 通知服務
│   │   ├── discordNotificationService.js  # Discord 通知
│   │   └── technicalAnalysis.js  # 技術分析
│   │
│   ├── models/                   # 數據模型（Sequelize）
│   │   ├── index.js              # 模型聚合與關聯
│   │   ├── User.js               # 用戶模型
│   │   ├── UserPreferences.js    # 用戶偏好
│   │   ├── TradingSignal.js      # 交易信號
│   │   ├── UserTradingHistory.js # 交易歷史
│   │   ├── PositionMonitoring.js # 倉位監控
│   │   ├── MarketData.js         # 市場數據
│   │   ├── ModelTrainingLog.js   # 模型訓練日誌
│   │   ├── ModelVersion.js       # 模型版本
│   │   └── ModelABTest.js        # A/B 測試
│   │
│   ├── middleware/               # 中間件
│   │   ├── auth.js               # 認證中間件
│   │   ├── validation.js         # 驗證中間件
│   │   ├── errorHandler.js       # 錯誤處理
│   │   └── rateLimiter.js        # 限流中間件
│   │
│   ├── routes/                   # 路由定義
│   │   ├── index.js              # 路由聚合
│   │   ├── authRoutes.js         # 認證路由
│   │   ├── tradingRoutes.js      # 交易路由
│   │   ├── marketRoutes.js       # 市場路由
│   │   ├── positionRoutes.js     # 倉位路由
│   │   ├── notificationRoutes.js # 通知路由
│   │   └── preferencesRoutes.js  # 偏好路由
│   │
│   ├── utils/                    # 工具函數
│   │   ├── jwt.js                # JWT 工具
│   │   ├── cache.js              # 快取工具
│   │   ├── logger.js             # 日誌工具
│   │   └── AppError.js           # 自定義錯誤類
│   │
│   └── validators/               # 驗證規則（Joi）
│       ├── authValidator.js
│       ├── tradingValidator.js
│       └── preferencesValidator.js
│
├── database/                     # 數據庫相關
│   ├── migrations/               # 數據庫遷移
│   │   ├── 20250101000001-create-users.js
│   │   ├── 20250101000002-create-user-preferences.js
│   │   └── ... (20+ 遷移文件)
│   │
│   └── seeders/                  # 種子數據
│       └── 20250101000001-demo-users.js
│
├── logs/                         # 日誌文件
│   ├── combined.log
│   ├── error.log
│   └── exceptions.log
│
├── tests/                        # 測試文件
│   ├── unit/                     # 單元測試
│   ├── integration/              # 整合測試
│   └── e2e/                      # 端到端測試
│
├── .env                          # 環境變數
├── .env.example                  # 環境變數範例
├── .sequelizerc                  # Sequelize CLI 配置
├── package.json                  # 依賴清單
├── package-lock.json
└── README.md
```

---

## 3.2 API 端點完整清單

### 📡 API 版本與路由前綴

```
API 版本: v1
基礎路徑: /api/v1
完整範例: http://localhost:3000/api/v1/auth/login
```

---

### 🔐 認證模組（Authentication）

**路由前綴：** `/api/v1/auth`

| 端點 | 方法 | 認證 | 限流 | 說明 |
|-----|------|------|------|------|
| `/register` | POST | ❌ | 5 req/15min | 用戶註冊 |
| `/login` | POST | ❌ | 5 req/15min | 用戶登入 |
| `/refresh` | POST | ❌ | 10 req/15min | 刷新 Token |
| `/logout` | POST | ✅ | - | 登出（單設備） |
| `/logout-all` | POST | ✅ | - | 登出（所有設備） |
| `/me` | GET | ✅ | - | 獲取當前用戶資料 |
| `/profile` | PUT | ✅ | - | 更新用戶資料 |
| `/change-password` | POST | ✅ | 3 req/15min | 修改密碼 |
| `/forgot-password` | POST | ❌ | 3 req/1hour | 忘記密碼 |
| `/reset-password` | POST | ❌ | 3 req/1hour | 重置密碼 |
| `/verify` | POST | ✅ | - | 驗證帳戶 |
| `/deactivate` | DELETE | ✅ | - | 停用帳戶 |
| `/validate` | GET | ✅ | - | 驗證當前會話 |

#### **詳細端點說明**

##### 1. **POST /api/v1/auth/register** - 用戶註冊

```javascript
// 請求
{
  "username": "john_trader",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "firstName": "John",      // 可選
  "lastName": "Doe"         // 可選
}

// 響應（201 Created）
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "username": "john_trader",
      "email": "john@example.com",
      "isActive": true,
      "isVerified": true,
      "createdAt": "2025-11-11T10:30:00Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  },
  "error": null,
  "timestamp": "2025-11-11T10:30:00Z"
}

// 錯誤響應（409 Conflict）
{
  "success": false,
  "data": null,
  "error": "Email already exists",
  "code": "EMAIL_EXISTS",
  "timestamp": "2025-11-11T10:30:00Z"
}
```

**驗證規則：**
- Username: 3-50 字符，字母數字與底線
- Email: 有效的 Email 格式
- Password: 最少 8 字符，包含大小寫、數字、特殊字符

---

##### 2. **POST /api/v1/auth/login** - 用戶登入

```javascript
// 請求
{
  "identifier": "john@example.com",  // Email 或 Username
  "password": "SecurePass123!"
}

// 響應（200 OK）
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "username": "john_trader",
      "email": "john@example.com",
      "lastLogin": "2025-11-11T10:30:00Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  },
  "error": null,
  "timestamp": "2025-11-11T10:30:00Z"
}

// 錯誤響應（401 Unauthorized）
{
  "success": false,
  "data": null,
  "error": "Invalid credentials",
  "code": "INVALID_CREDENTIALS",
  "timestamp": "2025-11-11T10:30:00Z"
}
```

---

##### 3. **POST /api/v1/auth/refresh** - 刷新 Token

```javascript
// 請求
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

// 響應（200 OK）
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."  // 新的 Refresh Token
  },
  "error": null,
  "timestamp": "2025-11-11T10:30:00Z"
}
```

---

### 📊 交易信號模組（Trading Signals）

**路由前綴：** `/api/v1/trading`

| 端點 | 方法 | 認證 | 限流 | 說明 |
|-----|------|------|------|------|
| `/signal` | GET | ✅* | 20 req/min | 查詢交易信號（Query: pair, timeframe） |
| `/signal/:pair` | GET | ✅* | 20 req/min | 查詢指定貨幣對信號 |
| `/analyze` | POST | ✅ | 10 req/min | 批量分析多個貨幣對 |
| `/history` | GET | ✅ | - | 獲取信號歷史（分頁） |
| `/pairs` | GET | ✅ | - | 獲取支持的貨幣對列表 |
| `/timeframes` | GET | ✅ | - | 獲取支持的時間框架 |

**註：** ✅* 表示支持靈活認證（JWT 或 API Key）

#### **詳細端點說明**

##### 1. **GET /api/v1/trading/signal** - 查詢交易信號

```javascript
// 請求（Query 參數）
GET /api/v1/trading/signal?pair=EUR/USD&timeframe=1h

// 響應（200 OK）
{
  "success": true,
  "data": {
    "signal": {
      "id": "uuid-here",
      "pair": "EUR/USD",
      "timeframe": "1h",
      "signal": "buy",
      "confidence": 0.85,
      "signalStrength": "very_strong",
      "entryPrice": 1.1234,
      "stopLoss": 1.1100,
      "takeProfit": 1.1500,
      "riskRewardRatio": 1.99,
      "positionSize": 2.5,
      "factors": {
        "technical": 0.78,
        "sentiment": 0.82,
        "pattern": 0.75
      },
      "technicalData": {
        "sma_20": 1.1200,
        "rsi_14": 45.2,
        "macd": 0.0012
      },
      "source": "ml_engine",
      "marketCondition": "trending",
      "createdAt": "2025-11-11T10:30:00Z",
      "expiresAt": "2025-11-11T14:30:00Z"
    }
  },
  "error": null,
  "timestamp": "2025-11-11T10:30:00Z"
}
```

**Query 參數：**
- `pair` (必填): 貨幣對（如 EUR/USD）
- `timeframe` (可選): 時間框架（預設 1h）

---

##### 2. **POST /api/v1/trading/analyze** - 批量分析

```javascript
// 請求
{
  "pairs": ["EUR/USD", "GBP/USD", "USD/JPY"],
  "timeframe": "1h",
  "minConfidence": 0.70
}

// 響應（200 OK）
{
  "success": true,
  "data": {
    "signals": [
      {
        "pair": "EUR/USD",
        "signal": "buy",
        "confidence": 0.85,
        "entryPrice": 1.1234
      },
      {
        "pair": "GBP/USD",
        "signal": "hold",
        "confidence": 0.62,
        "entryPrice": 1.2567
      },
      {
        "pair": "USD/JPY",
        "signal": "sell",
        "confidence": 0.78,
        "entryPrice": 149.23
      }
    ],
    "analyzedAt": "2025-11-11T10:30:00Z"
  },
  "error": null,
  "timestamp": "2025-11-11T10:30:00Z"
}
```

---

##### 3. **GET /api/v1/trading/history** - 信號歷史

```javascript
// 請求（Query 參數）
GET /api/v1/trading/history?page=1&limit=20&pair=EUR/USD&status=closed

// 響應（200 OK）
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-1",
        "pair": "EUR/USD",
        "signal": "buy",
        "confidence": 0.85,
        "status": "closed",
        "result": "win",
        "actualPnL": 150.00,
        "actualPnLPercent": 1.5,
        "createdAt": "2025-11-10T14:00:00Z",
        "closedAt": "2025-11-11T10:00:00Z"
      }
      // ... 更多信號
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "error": null,
  "timestamp": "2025-11-11T10:30:00Z"
}
```

**Query 參數：**
- `page` (可選): 頁碼（預設 1）
- `limit` (可選): 每頁筆數（預設 20，最大 100）
- `pair` (可選): 篩選貨幣對
- `status` (可選): 篩選狀態（active, closed, expired）
- `result` (可選): 篩選結果（win, loss, breakeven）

---

### 💹 市場數據模組（Market Data）

**路由前綴：** `/api/v1/market`

| 端點 | 方法 | 認證 | 限流 | 說明 |
|-----|------|------|------|------|
| `/realtime/:pair` | GET | 🔓 | 30 req/min | 獲取實時匯率 |
| `/history/:pair` | GET | 🔓 | 30 req/min | 獲取歷史數據（OHLCV） |
| `/pairs` | GET | 🔓 | - | 獲取支持的貨幣對列表 |
| `/status` | GET | 🔓 | - | 市場開放狀態 |
| `/cache/clear` | POST | ✅ | - | 清除快取（管理員） |
| `/analytics/:pair` | GET | 🔓 | 30 req/min | 獲取分析數據 |

**註：** 🔓 表示可選認證（公開訪問，認證用戶有更高配額）

#### **詳細端點說明**

##### 1. **GET /api/v1/market/realtime/:pair** - 實時匯率

```javascript
// 請求
GET /api/v1/market/realtime/EUR/USD

// 響應（200 OK）
{
  "success": true,
  "data": {
    "pair": "EUR/USD",
    "price": 1.1234,
    "bid": 1.1233,
    "ask": 1.1235,
    "change": 0.0012,
    "changePercent": 0.11,
    "timestamp": "2025-11-11T10:30:00Z",
    "source": "yfinance"
  },
  "error": null,
  "timestamp": "2025-11-11T10:30:00Z"
}
```

---

##### 2. **GET /api/v1/market/history/:pair** - 歷史數據

```javascript
// 請求（Query 參數）
GET /api/v1/market/history/EUR/USD?timeframe=1h&limit=100

// 響應（200 OK）
{
  "success": true,
  "data": {
    "pair": "EUR/USD",
    "timeframe": "1h",
    "timeSeries": [
      {
        "timestamp": "2025-11-11T10:00:00Z",
        "open": 1.1230,
        "high": 1.1245,
        "low": 1.1225,
        "close": 1.1234,
        "volume": 12500
      },
      {
        "timestamp": "2025-11-11T09:00:00Z",
        "open": 1.1220,
        "high": 1.1235,
        "low": 1.1215,
        "close": 1.1230,
        "volume": 11800
      }
      // ... 更多數據點
    ],
    "dataPoints": 100
  },
  "error": null,
  "timestamp": "2025-11-11T10:30:00Z"
}
```

**Query 參數：**
- `timeframe` (可選): 1min, 5min, 15min, 30min, 1h, 4h, 1d（預設 1h）
- `limit` (可選): 數據點數量（預設 100，最大 1000）
- `startDate` (可選): 開始日期（ISO 8601 格式）
- `endDate` (可選): 結束日期

---

##### 3. **GET /api/v1/market/analytics/:pair** - 分析數據

```javascript
// 請求
GET /api/v1/market/analytics/EUR/USD

// 響應（200 OK）
{
  "success": true,
  "data": {
    "pair": "EUR/USD",
    "statistics": {
      "avgPrice30d": 1.1200,
      "highPrice30d": 1.1450,
      "lowPrice30d": 1.0950,
      "volatility30d": 0.0125,
      "avgVolume30d": 125000
    },
    "technicalIndicators": {
      "sma_20": 1.1200,
      "sma_50": 1.1180,
      "rsi_14": 45.2,
      "macd": 0.0012,
      "macdSignal": 0.0010,
      "bollinger": {
        "upper": 1.1350,
        "middle": 1.1200,
        "lower": 1.1050
      }
    },
    "trendAnalysis": {
      "trend": "uptrend",
      "strength": 0.65,
      "support": 1.1150,
      "resistance": 1.1300
    }
  },
  "error": null,
  "timestamp": "2025-11-11T10:30:00Z"
}
```

---

### 💼 倉位管理模組（Position Management）

**路由前綴：** `/api/v1/positions`

| 端點 | 方法 | 認證 | 說明 |
|-----|------|------|------|
| `/open` | POST | ✅ | 開立新倉位 |
| `/close` | POST | ✅ | 平倉 |
| `/:id/adjust` | PUT | ✅ | 調整止損/止盈 |
| `/:id` | GET | ✅ | 獲取單個倉位詳情 |
| `/:id/monitor` | GET | ✅ | 獲取倉位監控歷史 |
| `/user/:userId` | GET | ✅ | 獲取用戶所有倉位 |
| `/user/:userId/statistics` | GET | ✅ | 獲取用戶統計數據 |
| `/open` (GET) | GET | ✅ | 獲取所有開倉（管理員） |

#### **詳細端點說明**

##### 1. **POST /api/v1/positions/open** - 開立倉位

```javascript
// 請求
{
  "signalId": "uuid-here",  // 可選，基於信號開倉
  "pair": "EUR/USD",
  "action": "buy",          // buy 或 sell
  "entryPrice": 1.1234,
  "stopLoss": 1.1100,
  "takeProfit": 1.1500,
  "positionSize": 0.05,     // Lot size
  "notes": "Based on strong uptrend"
}

// 響應（201 Created）
{
  "success": true,
  "data": {
    "position": {
      "id": "uuid-here",
      "userId": "user-uuid",
      "pair": "EUR/USD",
      "action": "buy",
      "entryPrice": 1.1234,
      "stopLoss": 1.1100,
      "takeProfit": 1.1500,
      "positionSize": 0.05,
      "status": "open",
      "openedAt": "2025-11-11T10:30:00Z",
      "riskReward": 1.99
    }
  },
  "error": null,
  "timestamp": "2025-11-11T10:30:00Z"
}
```

---

##### 2. **POST /api/v1/positions/close** - 平倉

```javascript
// 請求
{
  "positionId": "uuid-here",
  "exitPrice": 1.1350,
  "closeReason": "take_profit",  // take_profit, stop_loss, manual
  "notes": "Target reached"
}

// 響應（200 OK）
{
  "success": true,
  "data": {
    "position": {
      "id": "uuid-here",
      "status": "closed",
      "exitPrice": 1.1350,
      "closedAt": "2025-11-11T14:30:00Z",
      "result": "win",
      "profitLoss": 116.00,
      "profitLossPercent": 1.03,
      "pips": 116,
      "durationMinutes": 240
    }
  },
  "error": null,
  "timestamp": "2025-11-11T14:30:00Z"
}
```

---

##### 3. **GET /api/v1/positions/user/:userId/statistics** - 用戶統計

```javascript
// 請求
GET /api/v1/positions/user/uuid-here/statistics?period=30d

// 響應（200 OK）
{
  "success": true,
  "data": {
    "statistics": {
      "totalPositions": 50,
      "openPositions": 3,
      "closedPositions": 47,
      "winningPositions": 32,
      "losingPositions": 15,
      "winRate": 68.09,
      "totalPnL": 2340.50,
      "avgPnL": 49.80,
      "bestTrade": 450.00,
      "worstTrade": -180.00,
      "avgHoldingTime": 360,  // 分鐘
      "profitFactor": 2.1,    // 總利潤 / 總虧損
      "sharpeRatio": 1.45
    },
    "byPair": {
      "EUR/USD": {
        "positions": 20,
        "winRate": 70.00,
        "pnl": 980.00
      },
      "GBP/USD": {
        "positions": 15,
        "winRate": 66.67,
        "pnl": 720.00
      }
      // ... 其他貨幣對
    }
  },
  "error": null,
  "timestamp": "2025-11-11T10:30:00Z"
}
```

---

### 🔔 通知管理模組（Notifications）

**路由前綴：** `/api/v1/notifications`

| 端點 | 方法 | 認證 | 說明 |
|-----|------|------|------|
| `/subscribe` | POST | 🔓 | 訂閱交易信號 |
| `/unsubscribe` | POST | 🔓 | 取消訂閱 |
| `/preferences` | POST | 🔓 | 更新通知偏好 |
| `/preferences/:discordUserId` | GET | 🔓 | 獲取用戶偏好 |
| `/subscriptions/:discordUserId` | GET | 🔓 | 獲取用戶訂閱 |
| `/send` | POST | 🔒 | 發送通知（內部） |

---

### ⚙️ 用戶偏好模組（User Preferences）

**路由前綴：** `/api/v1/preferences`

| 端點 | 方法 | 認證 | 說明 |
|-----|------|------|------|
| `/` | GET | ✅ | 獲取當前用戶偏好 |
| `/` | PUT | ✅ | 更新用戶偏好 |
| `/notifications` | GET | ✅ | 獲取通知設置 |
| `/notifications` | PUT | ✅ | 更新通知設置 |

---

### ❤️ 健康檢查

| 端點 | 方法 | 認證 | 說明 |
|-----|------|------|------|
| `/api/v1/health` | GET | ❌ | 系統健康檢查 |

```javascript
// 響應
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 86400,  // 秒
  "timestamp": "2025-11-11T10:30:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "mlEngine": "available"
  }
}
```

---

### 📋 API 統計總覽

| 模組 | 端點數量 | 認證端點 | 公開端點 |
|-----|---------|---------|---------|
| **認證** | 13 | 7 | 6 |
| **交易信號** | 6 | 6 | 0 |
| **市場數據** | 6 | 0 | 6 |
| **倉位管理** | 8 | 8 | 0 |
| **通知** | 6 | 0 | 6 |
| **用戶偏好** | 4 | 4 | 0 |
| **健康檢查** | 1 | 0 | 1 |
| **總計** | **44** | **25** | **19** |

---

## 3.3 身份驗證與授權

### 🔐 JWT 雙 Token 機制

#### **Token 類型**

```javascript
// Access Token (短期)
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": "uuid-here",
    "iat": 1699708800,
    "exp": 1699712400,      // 1小時後過期
    "iss": "aifx-v2",
    "aud": "aifx-v2-users"
  },
  "signature": "..."
}

// Refresh Token (長期)
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": "uuid-here",
    "iat": 1699708800,
    "exp": 1702300800,      // 30天後過期
    "iss": "aifx-v2",
    "aud": "aifx-v2-users"
  },
  "signature": "..."
}
```

---

#### **認證流程**

```
┌─────────┐                              ┌─────────┐
│ Client  │                              │ Backend │
└────┬────┘                              └────┬────┘
     │                                        │
     │ 1. POST /auth/login                   │
     │    { identifier, password }           │
     ├──────────────────────────────────────>│
     │                                        │
     │                                   2. 驗證密碼
     │                                   bcrypt.compare()
     │                                        │
     │                                   3. 生成 Tokens
     │                                   - accessToken (1h)
     │                                   - refreshToken (30d)
     │                                        │
     │                                   4. 存儲 refreshToken
     │                                   User.update({ refreshToken })
     │                                        │
     │ 5. 返回 Tokens                         │
     │<──────────────────────────────────────┤
     │    { accessToken, refreshToken }      │
     │                                        │
     │ 6. 存儲在客戶端                         │
     │    localStorage.setItem(...)          │
     │                                        │
     │ 7. 後續請求攜帶 accessToken             │
     │    Authorization: Bearer <token>      │
     ├──────────────────────────────────────>│
     │                                        │
     │                                   8. 驗證 Token
     │                                   jwt.verify()
     │                                        │
     │<──────────────────────────────────────┤
     │    200 OK { data: ... }               │
     │                                        │
```

---

#### **Token 刷新流程**

```
┌─────────┐                              ┌─────────┐
│ Client  │                              │ Backend │
└────┬────┘                              └────┬────┘
     │                                        │
     │ 1. API 請求 (accessToken 過期)         │
     ├──────────────────────────────────────>│
     │                                        │
     │<──────────────────────────────────────┤
     │    401 Unauthorized                    │
     │    { error: "Token expired" }         │
     │                                        │
     │ 2. 攔截器捕獲 401                       │
     │    自動調用 /auth/refresh              │
     │    { refreshToken }                    │
     ├──────────────────────────────────────>│
     │                                        │
     │                                   3. 驗證 refreshToken
     │                                   jwt.verify()
     │                                        │
     │                                   4. 檢查數據庫
     │                                   User.findOne({ refreshToken })
     │                                        │
     │                                   5. 生成新 Tokens
     │                                   - 新 accessToken
     │                                   - 新 refreshToken (輪轉)
     │                                        │
     │ 6. 返回新 Tokens                       │
     │<──────────────────────────────────────┤
     │    { accessToken, refreshToken }      │
     │                                        │
     │ 7. 更新本地存儲                         │
     │    localStorage.setItem(...)          │
     │                                        │
     │ 8. 重試原始請求（使用新 Token）          │
     ├──────────────────────────────────────>│
     │                                        │
     │<──────────────────────────────────────┤
     │    200 OK { data: ... }               │
     │                                        │
```

---

### 🛡️ 認證中間件

```javascript
// backend/src/middleware/auth.js
const { verifyAccessToken } = require('../utils/jwt');
const { User } = require('../models');
const AppError = require('../utils/AppError');

/**
 * 嚴格認證中間件（必須提供有效 Token）
 */
async function authenticate(req, res, next) {
  try {
    // 1. 提取 Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401, 'NO_TOKEN');
    }

    const token = authHeader.substring(7); // 移除 "Bearer "

    // 2. 驗證 Token
    const decoded = verifyAccessToken(token);

    // 3. 查詢用戶
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      throw new AppError('User not found', 401, 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated', 403, 'ACCOUNT_INACTIVE');
    }

    // 4. 將用戶附加到請求對象
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
    }
    next(error);
  }
}

/**
 * 可選認證中間件（Token 存在則驗證，否則繼續）
 */
async function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // 沒有 Token，繼續處理
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    const user = await User.findByPk(decoded.userId);
    if (user && user.isActive) {
      req.user = user;
      req.userId = user.id;
    }

    next();
  } catch (error) {
    // Token 無效，但不阻止請求
    next();
  }
}

/**
 * 靈活認證中間件（支持 JWT 或 API Key）
 * 用於 Discord Bot 調用
 */
async function authenticateFlexible(req, res, next) {
  try {
    // 1. 檢查 API Key
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === process.env.API_KEY) {
      req.isInternalService = true;
      return next();
    }

    // 2. 降級到 JWT 認證
    return authenticate(req, res, next);
  } catch (error) {
    next(error);
  }
}

/**
 * 角色檢查中間件（未來擴展）
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
    }

    if (req.user.role !== role) {
      return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
    }

    next();
  };
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  authenticateFlexible,
  requireRole,
};
```

---

### 🔒 密碼安全

#### **密碼加密（Bcrypt）**

```javascript
// backend/src/models/User.js
const bcrypt = require('bcrypt');

// User 模型定義
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // ... 其他字段
}, {
  hooks: {
    // 創建用戶前自動加密密碼
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(
          parseInt(process.env.BCRYPT_ROUNDS) || 12
        );
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    // 更新用戶前檢查密碼是否變更
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(
          parseInt(process.env.BCRYPT_ROUNDS) || 12
        );
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
  },
});

// 實例方法：檢查密碼
User.prototype.checkPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// 實例方法：返回安全的用戶對象（不含密碼）
User.prototype.toSafeObject = function() {
  const { password, refreshToken, ...safeUser } = this.toJSON();
  return safeUser;
};

module.exports = User;
```

**安全特性：**
- ✅ Bcrypt 加密（12 輪鹽值）
- ✅ 每個密碼使用唯一鹽值
- ✅ 抗彩虹表攻擊
- ✅ 抗暴力破解（計算成本高）

---

## 3.4 核心服務模組

### 📦 服務層架構

```
Controller (HTTP 請求處理)
    ↓
Service (業務邏輯)
    ↓
Model (數據訪問)
    ↓
Database (數據存儲)
```

---

### 🔑 AuthService - 認證服務

**文件位置：** `/root/AIFX_v2/backend/src/services/authService.js`

```javascript
const bcrypt = require('bcrypt');
const { User, UserPreferences } = require('../models');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

class AuthService {
  /**
   * 用戶註冊
   */
  async registerUser(userData) {
    const { username, email, password, firstName, lastName } = userData;

    // 1. 檢查用戶是否存在
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { username }]
      }
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new AppError('Email already exists', 409, 'EMAIL_EXISTS');
      }
      throw new AppError('Username already exists', 409, 'USERNAME_EXISTS');
    }

    // 2. 創建用戶（密碼會自動加密）
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      isActive: true,
      isVerified: true, // 可改為 false，需要郵件驗證
    });

    // 3. 創建默認用戶偏好
    await UserPreferences.create({
      userId: user.id,
      tradingFrequency: 'daytrading',
      riskLevel: 5,
      preferredPairs: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
      tradingStyle: 'mixed',
    });

    // 4. 生成 Tokens
    const accessToken = generateAccessToken({ userId: user.id });
    const refreshToken = generateRefreshToken({ userId: user.id });

    // 5. 存儲 refreshToken
    await user.update({ refreshToken });

    return {
      user: user.toSafeObject(),
      accessToken,
      refreshToken,
    };
  }

  /**
   * 用戶登入
   */
  async loginUser(identifier, password) {
    // 1. 查找用戶（Email 或 Username）
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: identifier },
          { username: identifier }
        ]
      }
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // 2. 驗證密碼
    const isPasswordValid = await user.checkPassword(password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // 3. 檢查帳戶狀態
    if (!user.isActive) {
      throw new AppError('Account is deactivated', 403, 'ACCOUNT_INACTIVE');
    }

    // 4. 生成 Tokens
    const accessToken = generateAccessToken({ userId: user.id });
    const refreshToken = generateRefreshToken({ userId: user.id });

    // 5. 更新 refreshToken 和最後登入時間
    await user.update({
      refreshToken,
      lastLogin: new Date(),
    });

    return {
      user: user.toSafeObject(),
      accessToken,
      refreshToken,
    };
  }

  /**
   * 刷新 Access Token
   */
  async refreshAccessToken(refreshToken) {
    // 1. 驗證 refreshToken
    const decoded = verifyRefreshToken(refreshToken);

    // 2. 查詢用戶並驗證 refreshToken
    const user = await User.findOne({
      where: {
        id: decoded.userId,
        refreshToken,
        isActive: true,
      }
    });

    if (!user) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    // 3. 生成新 Tokens（Token 輪轉）
    const newAccessToken = generateAccessToken({ userId: user.id });
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    // 4. 更新數據庫
    await user.update({ refreshToken: newRefreshToken });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * 登出（單設備）
   */
  async logoutUser(userId) {
    await User.update(
      { refreshToken: null },
      { where: { id: userId } }
    );

    return { message: 'Logged out successfully' };
  }

  /**
   * 登出（所有設備）
   */
  async logoutAllDevices(userId) {
    await User.update(
      { refreshToken: null },
      { where: { id: userId } }
    );

    return { message: 'Logged out from all devices' };
  }

  /**
   * 修改密碼
   */
  async changePassword(userId, oldPassword, newPassword) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // 驗證舊密碼
    const isPasswordValid = await user.checkPassword(oldPassword);
    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');
    }

    // 更新密碼（會自動加密）
    await user.update({ password: newPassword });

    return { message: 'Password changed successfully' };
  }
}

module.exports = new AuthService();
```

---

### 📊 TradingSignalService - 交易信號服務

**文件位置：** `/root/AIFX_v2/backend/src/services/tradingSignalService.js`

```javascript
const { TradingSignal } = require('../models');
const mlEngineService = require('./mlEngineService');
const technicalAnalysis = require('./technicalAnalysis');
const { redisClient } = require('../config/redis');

class TradingSignalService {
  /**
   * 生成交易信號
   */
  async generateSignal(pair, options = {}) {
    const { timeframe = '1h', userId = null } = options;

    // 1. 檢查快取
    const cacheKey = `signal:${pair}:${timeframe}`;
    const cachedSignal = await redisClient.get(cacheKey);

    if (cachedSignal) {
      return JSON.parse(cachedSignal);
    }

    // 2. 獲取市場數據
    const marketData = await mlEngineService.fetchMarketData(
      pair,
      timeframe,
      100
    );

    // 3. 計算技術指標
    const technicalData = await technicalAnalysis.calculateIndicators(
      marketData,
      ['sma_20', 'rsi_14', 'macd']
    );

    // 4. 調用 ML 引擎預測
    let mlPrediction = null;
    try {
      mlPrediction = await mlEngineService.predictReversal(
        pair,
        timeframe,
        'v3.2'
      );
    } catch (error) {
      console.warn('ML prediction failed, using technical analysis only');
    }

    // 5. 綜合分析生成信號
    const signal = this._combineAnalysis(
      pair,
      timeframe,
      technicalData,
      mlPrediction
    );

    // 6. 存入數據庫
    const savedSignal = await TradingSignal.create({
      userId,
      pair,
      timeframe,
      signal: signal.signal,
      confidence: signal.confidence,
      entryPrice: signal.entryPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      riskRewardRatio: signal.riskRewardRatio,
      positionSize: signal.positionSize,
      factors: signal.factors,
      technicalData: signal.technicalData,
      source: mlPrediction ? 'ml_engine' : 'technical_analysis',
      signalStrength: this._calculateStrength(signal.confidence),
      status: 'active',
      expiresAt: this._calculateExpiry(timeframe),
    });

    // 7. 快取結果（5 分鐘）
    await redisClient.setEx(
      cacheKey,
      300,
      JSON.stringify(savedSignal)
    );

    // 8. 發布到 Redis Pub/Sub（通知 Discord Bot）
    await redisClient.publish(
      'trading-signals',
      JSON.stringify({
        pair,
        timeframe,
        signal: savedSignal.toJSON(),
      })
    );

    return savedSignal;
  }

  /**
   * 綜合分析（技術面 + ML）
   */
  _combineAnalysis(pair, timeframe, technicalData, mlPrediction) {
    const currentPrice = technicalData.currentPrice;

    // 如果有 ML 預測，優先使用
    if (mlPrediction && mlPrediction.confidence > 0.6) {
      return {
        signal: mlPrediction.signal === 'long' ? 'buy' :
                mlPrediction.signal === 'short' ? 'sell' : 'hold',
        confidence: mlPrediction.confidence,
        entryPrice: currentPrice,
        stopLoss: this._calculateStopLoss(currentPrice, mlPrediction.signal),
        takeProfit: this._calculateTakeProfit(currentPrice, mlPrediction.signal),
        riskRewardRatio: 2.0,
        positionSize: this._calculatePositionSize(mlPrediction.confidence),
        factors: {
          technical: mlPrediction.stage1_prob || 0.7,
          sentiment: mlPrediction.stage2_prob || 0.8,
          pattern: mlPrediction.confidence,
        },
        technicalData,
      };
    }

    // 降級到純技術分析
    const signal = this._technicalSignal(technicalData);
    return {
      signal: signal.direction,
      confidence: signal.confidence,
      entryPrice: currentPrice,
      stopLoss: this._calculateStopLoss(currentPrice, signal.direction),
      takeProfit: this._calculateTakeProfit(currentPrice, signal.direction),
      riskRewardRatio: 1.5,
      positionSize: this._calculatePositionSize(signal.confidence),
      factors: {
        technical: signal.confidence,
        sentiment: 0.5,
        pattern: 0.5,
      },
      technicalData,
    };
  }

  /**
   * 純技術分析信號
   */
  _technicalSignal(technicalData) {
    const { sma_20, rsi_14, macd, currentPrice } = technicalData;

    let buySignals = 0;
    let sellSignals = 0;

    // RSI 超賣/超買
    if (rsi_14 < 30) buySignals++;
    if (rsi_14 > 70) sellSignals++;

    // 價格相對 SMA
    if (currentPrice > sma_20) buySignals++;
    if (currentPrice < sma_20) sellSignals++;

    // MACD
    if (macd > 0) buySignals++;
    if (macd < 0) sellSignals++;

    const totalSignals = buySignals + sellSignals;
    const confidence = Math.max(buySignals, sellSignals) / totalSignals;

    if (buySignals > sellSignals) {
      return { direction: 'buy', confidence };
    } else if (sellSignals > buySignals) {
      return { direction: 'sell', confidence };
    } else {
      return { direction: 'hold', confidence: 0.5 };
    }
  }

  // ... 其他輔助方法
}

module.exports = new TradingSignalService();
```

---

### 🌐 ForexService - 外匯數據服務

**文件位置：** `/root/AIFX_v2/backend/src/services/forexService.js`

**主要方法：**
- `getRealtimePrice(pair)` - 獲取實時匯率
- `getHistoricalData(pair, timeframe, limit)` - 獲取歷史數據
- `getSupportedPairs()` - 獲取支持的貨幣對
- `getAnalytics(pair)` - 獲取分析數據
- `clearCache(pattern)` - 清除快取

---

### 🤖 MLEngineService - ML 引擎整合

**文件位置：** `/root/AIFX_v2/backend/src/services/mlEngineService.js`

**主要方法：**
- `healthCheck()` - 檢查 ML 引擎可用性
- `fetchMarketData(pair, timeframe, limit)` - 從 ML API 獲取市場數據
- `predictReversal(pair, timeframe, version)` - 反轉預測
- `classifyDirection(pair, timeframe)` - 方向分類

---

### 💼 PositionService - 倉位服務

**文件位置：** `/root/AIFX_v2/backend/src/services/positionService.js`

**主要方法：**
- `openPosition(positionData)` - 開立新倉位
- `closePosition(positionId, exitPrice, notes)` - 平倉
- `adjustPosition(positionId, stopLoss, takeProfit)` - 調整止損/止盈
- `getPosition(positionId, includeMonitoring)` - 獲取倉位詳情
- `getUserPositions(userId, filters)` - 獲取用戶倉位列表
- `getPositionStatistics(userId, filters)` - 計算統計數據

---

### 🔄 MonitoringService - 倉位監控服務

**文件位置：** `/root/AIFX_v2/backend/src/services/monitoringService.js`

**功能：** 每 60 秒檢查所有開倉倉位，更新盈虧，檢查止損/止盈觸發

```javascript
class MonitoringService {
  constructor() {
    this.intervalId = null;
  }

  /**
   * 啟動監控服務
   */
  start() {
    console.log('✅ Position monitoring service started');
    this.intervalId = setInterval(() => {
      this.monitorPositions();
    }, 60000); // 每 60 秒
  }

  /**
   * 停止監控服務
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('❌ Position monitoring service stopped');
    }
  }

  /**
   * 監控所有開倉倉位
   */
  async monitorPositions() {
    try {
      // 1. 查詢所有開倉倉位
      const openPositions = await UserTradingHistory.findAll({
        where: { status: 'open' }
      });

      console.log(`Monitoring ${openPositions.length} open positions`);

      // 2. 逐一檢查
      for (const position of openPositions) {
        await this.checkPosition(position);
      }
    } catch (error) {
      console.error('Position monitoring error:', error);
    }
  }

  /**
   * 檢查單個倉位
   */
  async checkPosition(position) {
    try {
      // 1. 獲取當前價格
      const currentPrice = await forexService.getRealtimePrice(position.pair);

      // 2. 計算當前盈虧
      const pnl = this._calculatePnL(
        position.entryPrice,
        currentPrice.price,
        position.action,
        position.positionSize
      );

      // 3. 創建監控記錄
      await PositionMonitoring.create({
        positionId: position.id,
        currentPrice: currentPrice.price,
        currentPnL: pnl.amount,
        currentPnLPercent: pnl.percent,
        highPrice: Math.max(position.highPrice || 0, currentPrice.price),
        lowPrice: Math.min(position.lowPrice || Infinity, currentPrice.price),
        alerts: {
          stopLossTriggered: this._checkStopLoss(position, currentPrice.price),
          takeProfitTriggered: this._checkTakeProfit(position, currentPrice.price),
        },
      });

      // 4. 檢查是否觸發止損/止盈
      if (this._checkStopLoss(position, currentPrice.price)) {
        await this._triggerStopLoss(position, currentPrice.price);
      } else if (this._checkTakeProfit(position, currentPrice.price)) {
        await this._triggerTakeProfit(position, currentPrice.price);
      }
    } catch (error) {
      console.error(`Error monitoring position ${position.id}:`, error);
    }
  }

  // ... 其他輔助方法
}

module.exports = new MonitoringService();
```

---

## 3.5 中間件與攔截器

### 🔧 全局中間件棧

```javascript
// backend/src/app.js

// 1. 信任代理（獲取真實 IP）
app.set('trust proxy', 1);

// 2. 安全標頭（Helmet）
app.use(helmet());

// 3. CORS 跨域
app.use(cors());

// 4. 壓縮響應
app.use(compression());

// 5. 請求體解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 6. 全局限流
app.use(globalLimiter);

// 7. 請求日誌
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// 8. 路由
app.use('/api/v1', routes);

// 9. 404 處理
app.use((req, res, next) => {
  next(new AppError('Route not found', 404, 'ROUTE_NOT_FOUND'));
});

// 10. 全局錯誤處理
app.use(errorHandler);
```

---

### ✅ 驗證中間件（Validation Middleware）

**文件位置：** `/root/AIFX_v2/backend/src/middleware/validation.js`

```javascript
const Joi = require('joi');
const AppError = require('../utils/AppError');

/**
 * 通用驗證中間件工廠
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // 返回所有錯誤
      stripUnknown: true, // 移除未定義的字段
    });

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(', ');

      return next(new AppError(errorMessage, 400, 'VALIDATION_ERROR'));
    }

    // 將驗證後的值替換到 req.body
    req.body = value;
    next();
  };
}

// 驗證規則定義
const schemas = {
  // 用戶註冊
  register: Joi.object({
    username: Joi.string().min(3).max(50).alphanum().required(),
    email: Joi.string().email().required(),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
      }),
    firstName: Joi.string().max(50),
    lastName: Joi.string().max(50),
  }),

  // 用戶登入
  login: Joi.object({
    identifier: Joi.string().required(),
    password: Joi.string().required(),
  }),

  // 交易信號查詢
  tradingSignal: Joi.object({
    pair: Joi.string().pattern(/^[A-Z]{3}\/[A-Z]{3}$/).required(),
    timeframe: Joi.string()
      .valid('1min', '5min', '15min', '30min', '1h', '4h', '1d', '1w', '1M')
      .default('1h'),
  }),

  // 開立倉位
  openPosition: Joi.object({
    signalId: Joi.string().uuid(),
    pair: Joi.string().pattern(/^[A-Z]{3}\/[A-Z]{3}$/).required(),
    action: Joi.string().valid('buy', 'sell').required(),
    entryPrice: Joi.number().positive().required(),
    stopLoss: Joi.number().positive().required(),
    takeProfit: Joi.number().positive().required(),
    positionSize: Joi.number().positive().max(100).required(),
    notes: Joi.string().max(500),
  }),

  // 用戶偏好
  userPreferences: Joi.object({
    tradingFrequency: Joi.string().valid('scalping', 'daytrading', 'swing', 'position'),
    riskLevel: Joi.number().integer().min(1).max(10),
    preferredPairs: Joi.array().items(Joi.string().pattern(/^[A-Z]{3}\/[A-Z]{3}$/)),
    tradingStyle: Joi.string().valid('trend', 'counter-trend', 'mixed'),
    indicators: Joi.object(),
  }),
};

module.exports = { validate, schemas };
```

**使用範例：**
```javascript
const { validate, schemas } = require('../middleware/validation');

router.post(
  '/register',
  validate(schemas.register),
  authController.register
);
```

---

### ⏱️ 限流中間件（Rate Limiter）

```javascript
// backend/src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// 全局限流
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/v1/health', // 跳過健康檢查
});

// 認證限流（嚴格）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later.',
});

// 密碼重置限流（非常嚴格）
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小時
  max: 3,
  message: 'Too many password reset attempts, please try again later.',
});

// 市場數據限流（較寬鬆）
const marketDataLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 分鐘
  max: 30,
});

module.exports = {
  globalLimiter,
  authLimiter,
  passwordResetLimiter,
  marketDataLimiter,
};
```

---

## 3.6 錯誤處理機制

### 🚨 自定義錯誤類

```javascript
// backend/src/utils/AppError.js
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);

    this.statusCode = statusCode;
    this.code = code; // 如 'INVALID_CREDENTIALS', 'EMAIL_EXISTS'
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // 區分操作錯誤與程式錯誤

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
```

---

### 🛡️ 全局錯誤處理中間件

```javascript
// backend/src/middleware/errorHandler.js
const AppError = require('../utils/AppError');

/**
 * 全局錯誤處理中間件
 */
function errorHandler(err, req, res, next) {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // 開發環境：返回完整錯誤訊息
  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      success: false,
      data: null,
      error: err.message,
      code: err.code,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
  }

  // 生產環境：根據錯誤類型處理
  if (err.isOperational) {
    // 操作錯誤：可信任，發送給客戶端
    return res.status(err.statusCode).json({
      success: false,
      data: null,
      error: err.message,
      code: err.code,
      timestamp: new Date().toISOString(),
    });
  }

  // 程式錯誤：不洩漏細節
  console.error('💥 UNEXPECTED ERROR:', err);

  return res.status(500).json({
    success: false,
    data: null,
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
  });
}

/**
 * 異步錯誤包裝器
 */
function catchAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 處理 Sequelize 錯誤
 */
function handleSequelizeError(err) {
  if (err.name === 'SequelizeValidationError') {
    const message = err.errors.map((e) => e.message).join(', ');
    return new AppError(message, 400, 'VALIDATION_ERROR');
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors[0].path;
    return new AppError(`${field} already exists`, 409, 'DUPLICATE_ENTRY');
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return new AppError('Referenced resource not found', 400, 'FOREIGN_KEY_ERROR');
  }

  return new AppError('Database operation failed', 500, 'DATABASE_ERROR');
}

module.exports = {
  errorHandler,
  catchAsync,
  handleSequelizeError,
};
```

---

### 📊 錯誤處理最佳實踐

```javascript
// 控制器中使用 catchAsync
const { catchAsync } = require('../middleware/errorHandler');

exports.getSignal = catchAsync(async (req, res, next) => {
  const { pair } = req.params;

  // 業務邏輯
  const signal = await tradingSignalService.generateSignal(pair);

  if (!signal) {
    return next(new AppError('Signal not found', 404, 'SIGNAL_NOT_FOUND'));
  }

  res.status(200).json({
    success: true,
    data: { signal },
    error: null,
    timestamp: new Date().toISOString(),
  });
});
```

---

## 3.7 快取策略

### 🚀 Redis 快取實現

```javascript
// backend/src/utils/cache.js
const { redisClient } = require('../config/redis');

class CacheService {
  /**
   * 獲取快取
   */
  async get(key) {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null; // 快取失敗不阻塞業務
    }
  }

  /**
   * 設置快取
   */
  async set(key, value, ttl = 300) {
    try {
      await redisClient.setEx(
        key,
        ttl,
        JSON.stringify(value)
      );
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * 刪除快取
   */
  async del(key) {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.error('Cache del error:', error);
    }
  }

  /**
   * 清除匹配的快取
   */
  async clearPattern(pattern) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * 快取包裝器（高階函數）
   */
  withCache(key, ttl) {
    return async (fn) => {
      // 1. 嘗試從快取獲取
      const cached = await this.get(key);
      if (cached) {
        return cached;
      }

      // 2. 快取未命中，執行函數
      const result = await fn();

      // 3. 存入快取
      await this.set(key, result, ttl);

      return result;
    };
  }
}

module.exports = new CacheService();
```

---

### 📦 快取策略應用

```javascript
// 在服務中使用快取
const cache = require('../utils/cache');

class ForexService {
  async getRealtimePrice(pair) {
    const cacheKey = `forex:realtime:${pair}`;

    // 使用快取包裝器
    return await cache.withCache(cacheKey, 30)(async () => {
      // 實際獲取數據的邏輯
      const response = await axios.get(
        `${ML_API_URL}/market-data/${pair}?timeframe=1min&limit=1`
      );

      return {
        pair,
        price: response.data.data.timeSeries[0].close,
        timestamp: new Date().toISOString(),
      };
    });
  }
}
```

---

## 3.8 背景服務

### ⏰ 市場數據採集服務

```javascript
// backend/src/services/marketDataCollector.js
class MarketDataCollector {
  constructor() {
    this.intervalId = null;
    this.pairs = [
      'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF',
      'AUD/USD', 'USD/CAD', 'NZD/USD'
    ];
  }

  start() {
    console.log('✅ Market data collector started');
    this.collect(); // 立即執行一次
    this.intervalId = setInterval(() => {
      this.collect();
    }, 15 * 60 * 1000); // 每 15 分鐘
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('❌ Market data collector stopped');
    }
  }

  async collect() {
    console.log('Collecting market data...');

    for (const pair of this.pairs) {
      try {
        const data = await mlEngineService.fetchMarketData(pair, '1h', 100);

        // 存入數據庫
        await MarketData.bulkCreate(data.map((candle) => ({
          pair,
          timeframe: '1h',
          timestamp: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          source: 'yfinance',
        })), {
          updateOnDuplicate: ['open', 'high', 'low', 'close', 'volume'],
        });

        console.log(`✅ Collected ${pair} data`);
      } catch (error) {
        console.error(`❌ Failed to collect ${pair}:`, error.message);
      }
    }
  }
}

module.exports = new MarketDataCollector();
```

---

### 📢 信號監控服務

```javascript
// backend/src/services/signalMonitoringService.js
class SignalMonitoringService {
  constructor() {
    this.intervalId = null;
  }

  start() {
    console.log('✅ Signal monitoring service started');
    this.intervalId = setInterval(() => {
      this.generateSignals();
    }, 15 * 60 * 1000); // 每 15 分鐘
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('❌ Signal monitoring service stopped');
    }
  }

  async generateSignals() {
    const pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY'];
    const timeframes = ['1h', '4h'];

    for (const pair of pairs) {
      for (const timeframe of timeframes) {
        try {
          const signal = await tradingSignalService.generateSignal(pair, {
            timeframe,
          });

          console.log(`Generated signal for ${pair} ${timeframe}: ${signal.signal}`);
        } catch (error) {
          console.error(`Failed to generate signal for ${pair}:`, error);
        }
      }
    }
  }
}

module.exports = new SignalMonitoringService();
```

---

### 🚀 服務啟動與停止

```javascript
// backend/src/server.js
const marketDataCollector = require('./services/marketDataCollector');
const monitoringService = require('./services/monitoringService');
const signalMonitoringService = require('./services/signalMonitoringService');

// 啟動背景服務
marketDataCollector.start();
monitoringService.start();
signalMonitoringService.start();

// 優雅關機
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');

  marketDataCollector.stop();
  monitoringService.stop();
  signalMonitoringService.stop();

  // 關閉 HTTP 伺服器
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // 超時強制關閉
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});
```

---

## 📝 總結

### 後端系統特點

✅ **模組化設計** - 控制器、服務、模型分離
✅ **RESTful API** - 44+ 端點，統一響應格式
✅ **JWT 認證** - 雙 Token 機制，安全可靠
✅ **Sequelize ORM** - 類型安全，遷移管理
✅ **Redis 快取** - 多層快取，性能優化
✅ **WebSocket** - 實時推送，低延遲
✅ **錯誤處理** - 全局錯誤處理，詳細日誌
✅ **背景服務** - 數據採集、倉位監控、信號生成
✅ **API 限流** - 多層限流，防止濫用
✅ **輸入驗證** - Joi 驗證，安全可靠

---

## 📚 相關文檔

- **[第一部分：專案概述](./REPORT_PART_01_PROJECT_OVERVIEW.md)**
- **[第二部分：系統架構](./REPORT_PART_02_SYSTEM_ARCHITECTURE.md)**
- **[第四部分：機器學習引擎](./REPORT_PART_04_ML_ENGINE.md)**
- **[附錄 A：API 速查表](./REPORT_APPENDIX_A_API_REFERENCE.md)**

---

**文檔元數據：**
- 文檔版本：1.0.0
- 最後更新：2025-11-11
- 作者：AIFX v2 開發團隊
- 狀態：✅ 完成

---

**© 2025 AIFX v2 Project. All rights reserved.**
