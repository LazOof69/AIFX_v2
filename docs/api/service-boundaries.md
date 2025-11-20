# AIFX v2 Service Boundaries Definition

**文檔版本**: 1.0
**創建日期**: 2025-11-20
**狀態**: Planning

---

## 📑 目錄

1. [服務概覽](#1-服務概覽)
2. [Backend Service](#2-backend-service)
3. [ML Engine Service](#3-ml-engine-service)
4. [Discord Bot Service](#4-discord-bot-service)
5. [Frontend Service](#5-frontend-service)
6. [服務依賴圖](#6-服務依賴圖)
7. [數據流向](#7-數據流向)
8. [API 端點映射](#8-api-端點映射)

---

## 1. 服務概覽

### 1.1 服務列表

| 服務 | 職責 | Port | 語言 | 數據庫訪問 |
|------|------|------|------|-----------|
| **Backend** | 數據訪問層、業務邏輯、認證 | 3000 | Node.js | ✅ 直接訪問 |
| **ML Engine** | 模型訓練、預測 | 8000 | Python | ❌ 通過 API |
| **Discord Bot** | Discord 互動、通知 | - | Node.js | ❌ 通過 API |
| **Frontend** | 用戶界面、可視化 | 5173 | React | ❌ 通過 API |

### 1.2 服務獨立性規則

每個服務必須滿足:

1. ✅ **獨立啟動**: 可以單獨啟動,不依賴其他服務運行
2. ✅ **獨立測試**: 可以使用 Mock 進行單元測試
3. ✅ **獨立部署**: 可以單獨部署,不影響其他服務
4. ✅ **故障隔離**: 服務故障不會導致其他服務崩潰
5. ✅ **健康檢查**: 提供 `/health` 端點

---

## 2. Backend Service

### 2.1 職責範圍

#### 核心職責 (Core Responsibilities)
- ✅ 用戶認證和授權 (JWT + API Key)
- ✅ 數據庫訪問層 (唯一可以直接訪問 PostgreSQL)
- ✅ Redis 緩存管理
- ✅ 市場數據收集和存儲
- ✅ 交易信號生成邏輯
- ✅ WebSocket 推送 (實時信號 to Frontend)
- ✅ 為其他服務提供 REST API

#### 不負責 (Out of Scope)
- ❌ Discord 消息發送 (Discord Bot 負責)
- ❌ ML 模型訓練 (ML Engine 負責)
- ❌ 前端渲染 (Frontend 負責)

### 2.2 技術棧

```yaml
Language: Node.js (ES6+)
Framework: Express.js
Database: PostgreSQL (Sequelize ORM)
Cache: Redis
Real-time: Socket.io
Authentication: JWT + API Key
Testing: Jest, Supertest
Documentation: Swagger/OpenAPI
```

### 2.3 提供的 API

#### For Discord Bot
```
GET    /api/v1/discord/users/:discordId
POST   /api/v1/discord/users
PUT    /api/v1/discord/users/:discordId/settings
GET    /api/v1/discord/signals
POST   /api/v1/discord/signals/:id/delivered
GET    /api/v1/discord/trades
POST   /api/v1/discord/trades
```

#### For ML Engine
```
GET    /api/v1/ml/training-data/market/:pair
GET    /api/v1/ml/training-data/signals
GET    /api/v1/ml/training-data/economic-events
POST   /api/v1/ml/models/version
POST   /api/v1/ml/predictions
GET    /api/v1/ml/predictions/accuracy
```

#### For Frontend
```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
GET    /api/v1/trading/signals
GET    /api/v1/market/data/:pair
GET    /api/v1/positions
WebSocket: ws://localhost:3000 (real-time signals)
```

### 2.4 依賴

**直接依賴**:
- PostgreSQL (直接連接)
- Redis (直接連接)
- ML Engine API (HTTP REST) - 調用預測

**被依賴**:
- Frontend
- Discord Bot
- ML Engine

### 2.5 環境變數

```env
NODE_ENV=development|production
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/aifx_v2
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# API Keys for service authentication
DISCORD_BOT_API_KEY=discord_bot_api_key_here
ML_ENGINE_API_KEY=ml_engine_api_key_here

# External APIs
ALPHA_VANTAGE_KEY=your_alpha_vantage_key
ML_API_URL=http://localhost:8000
```

### 2.6 啟動命令

```bash
cd backend
npm install
npm run migrate  # Run database migrations
npm start        # Production
npm run dev      # Development (nodemon)
```

---

## 3. ML Engine Service

### 3.1 職責範圍

#### 核心職責
- ✅ ML 模型訓練 (LSTM, Random Forest, etc.)
- ✅ 價格反轉預測
- ✅ 提供預測 API (for Backend)
- ✅ 模型版本管理
- ✅ 訓練日誌和指標記錄

#### 不負責
- ❌ 數據收集 (通過 Backend API 獲取)
- ❌ 交易信號發送 (Backend 負責)
- ❌ 用戶管理 (Backend 負責)
- ❌ Discord 通知 (Discord Bot 負責)

### 3.2 技術棧

```yaml
Language: Python 3.10+
Framework: FastAPI (API server)
ML Libraries: TensorFlow, scikit-learn, pandas, numpy
Storage: Local file system (models, checkpoints)
API Client: httpx (for Backend API calls)
Testing: pytest
Documentation: FastAPI auto-generated docs
```

### 3.3 提供的 API

```
POST   /predict/reversal
GET    /models/current
GET    /health
```

### 3.4 依賴

**直接依賴**:
- Backend API (獲取訓練數據)
- Local file system (模型存儲)

**被依賴**:
- Backend (調用預測 API)

### 3.5 環境變數

```env
# ML Engine Configuration
PORT=8000
BACKEND_API_URL=http://localhost:3000/api/v1
BACKEND_API_KEY=ml_engine_api_key_here

# Model Configuration
MODEL_PATH=/root/AIFX_v2/ml_engine/saved_models
CHECKPOINT_PATH=/root/AIFX_v2/ml_engine/checkpoints
LOG_PATH=/root/AIFX_v2/ml_engine/logs
```

### 3.6 啟動命令

```bash
cd ml_engine
source venv/bin/activate
pip install -r requirements.txt
python api/ml_server.py  # Starts FastAPI server on port 8000
```

---

## 4. Discord Bot Service

### 4.1 職責範圍

#### 核心職責
- ✅ Discord 命令處理 (`/subscribe`, `/preferences`, `/signals`)
- ✅ Discord 消息發送
- ✅ 交易信號推送 (to Discord users)
- ✅ Discord 用戶互動

#### 不負責
- ❌ 數據存儲 (通過 Backend API)
- ❌ 交易邏輯 (通過 Backend API)
- ❌ 市場數據收集 (Backend 負責)
- ❌ ML 預測 (ML Engine 負責)

### 4.2 技術棧

```yaml
Language: Node.js
Framework: Discord.js
API Client: axios (for Backend API)
Testing: Jest
```

### 4.3 調用的 API

**Backend APIs**:
```
GET    /api/v1/discord/users/:discordId
POST   /api/v1/discord/users
PUT    /api/v1/discord/users/:discordId/settings
GET    /api/v1/discord/signals
POST   /api/v1/discord/signals/:id/delivered
POST   /api/v1/discord/trades
```

### 4.4 依賴

**直接依賴**:
- Backend API (所有數據訪問)
- Discord API (WebSocket)

**被依賴**:
- 無 (純通知服務)

### 4.5 環境變數

```env
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id

# Backend API
BACKEND_API_URL=http://localhost:3000/api/v1
BACKEND_API_KEY=discord_bot_api_key_here
```

### 4.6 啟動命令

```bash
cd discord_bot
npm install
npm start        # Production
npm run dev      # Development (nodemon)
```

---

## 5. Frontend Service

### 5.1 職責範圍

#### 核心職責
- ✅ 用戶界面展示
- ✅ 圖表可視化 (Chart.js)
- ✅ WebSocket 連接 (接收實時信號)
- ✅ 用戶設置管理

#### 不負責
- ❌ 業務邏輯 (Backend 負責)
- ❌ 數據存儲 (Backend 負責)
- ❌ Discord 通知 (Discord Bot 負責)

### 5.2 技術棧

```yaml
Language: JavaScript/JSX
Framework: React 18
Build Tool: Vite
UI Library: TailwindCSS
Charts: Chart.js
API Client: axios
Real-time: Socket.io-client
Routing: react-router-dom
```

### 5.3 調用的 API

**Backend APIs**:
```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
GET    /api/v1/trading/signals
GET    /api/v1/market/data/:pair
GET    /api/v1/positions
WebSocket: ws://localhost:3000
```

### 5.4 依賴

**直接依賴**:
- Backend API (HTTP + WebSocket)

**被依賴**:
- 無

### 5.5 環境變數

```env
VITE_API_URL=/api/v1
VITE_WS_URL=ws://localhost:3000
```

### 5.6 啟動命令

```bash
cd frontend
npm install
npm run dev      # Development (port 5173)
npm run build    # Production build
npm run preview  # Preview production build
```

---

## 6. 服務依賴圖

### 6.1 依賴關係

```
┌─────────────────────────────────────────────────┐
│             Service Dependency Graph             │
└─────────────────────────────────────────────────┘

                  Frontend
                     │
                     │ HTTP/WS
                     ▼
                  Backend ◄────────┐
                     │             │
         ┌───────────┼─────────┐   │
         │           │         │   │
         │ HTTP      │ HTTP    │   │
         ▼           ▼         │   │
   ML Engine    Discord Bot    │   │
         │                     │   │
         └─────────────────────┘   │
                   HTTP             │
                                    │
                             PostgreSQL
                                 (DB)
```

### 6.2 通信矩陣

| From ↓ / To → | Frontend | Backend | ML Engine | Discord Bot | PostgreSQL |
|---------------|----------|---------|-----------|-------------|------------|
| Frontend | - | ✅ HTTP/WS | ❌ | ❌ | ❌ |
| Backend | ✅ WS Push | - | ✅ HTTP | ❌ | ✅ Direct |
| ML Engine | ❌ | ✅ HTTP | - | ❌ | ❌ |
| Discord Bot | ❌ | ✅ HTTP | ❌ | - | ❌ |

---

## 7. 數據流向

### 7.1 用戶登錄流程

```
1. User enters credentials in Frontend
   Frontend ──POST /api/v1/auth/login──► Backend

2. Backend validates credentials
   Backend ──Query User table──► PostgreSQL

3. Backend generates JWT token
   Backend ──Returns JWT──► Frontend

4. Frontend stores JWT in localStorage
   Frontend uses JWT for all future requests
```

### 7.2 交易信號生成流程

```
1. Backend collects market data
   Backend ──GET market data──► Alpha Vantage API
   Backend ──Store──► PostgreSQL

2. Backend calls ML Engine for prediction
   Backend ──POST /predict/reversal──► ML Engine
   ML Engine ──GET training data──► Backend API
   ML Engine ──Returns prediction──► Backend

3. Backend generates trading signal
   Backend ──Store signal──► PostgreSQL

4. Backend pushes to Frontend
   Backend ──WebSocket push──► Frontend

5. Backend notifies Discord Bot
   Discord Bot ──Polls GET /discord/signals──► Backend
   Discord Bot ──Send message──► Discord API
   Discord Bot ──POST /signals/:id/delivered──► Backend
```

### 7.3 Discord 命令流程

```
1. User types /subscribe in Discord
   Discord ──Command event──► Discord Bot

2. Discord Bot calls Backend API
   Discord Bot ──POST /discord/users──► Backend
   Backend ──Store user settings──► PostgreSQL
   Backend ──Returns success──► Discord Bot

3. Discord Bot replies to user
   Discord Bot ──Send message──► Discord API
```

---

## 8. API 端點映射

### 8.1 Backend 提供的完整 API 列表

#### Authentication APIs (for Frontend)
```
POST   /api/v1/auth/login           # User login
POST   /api/v1/auth/register        # User registration
POST   /api/v1/auth/refresh         # Refresh JWT token
POST   /api/v1/auth/logout          # Logout
```

#### Trading APIs (for Frontend)
```
GET    /api/v1/trading/signals      # Get trading signals
GET    /api/v1/trading/signals/:id  # Get specific signal
POST   /api/v1/trading/execute      # Execute trade
```

#### Market Data APIs (for Frontend)
```
GET    /api/v1/market/data/:pair    # Get market data
GET    /api/v1/market/pairs         # List available pairs
```

#### Discord Bot APIs
```
GET    /api/v1/discord/users/:discordId
POST   /api/v1/discord/users
PUT    /api/v1/discord/users/:discordId/settings
GET    /api/v1/discord/signals
POST   /api/v1/discord/signals/:id/delivered
GET    /api/v1/discord/trades
POST   /api/v1/discord/trades
```

#### ML Engine APIs
```
GET    /api/v1/ml/training-data/market/:pair
GET    /api/v1/ml/training-data/signals
GET    /api/v1/ml/training-data/economic-events
POST   /api/v1/ml/models/version
POST   /api/v1/ml/predictions
GET    /api/v1/ml/predictions/accuracy
```

#### Health Check
```
GET    /api/v1/health               # Service health
```

### 8.2 ML Engine 提供的 API 列表

```
POST   /predict/reversal            # Predict price reversal
GET    /models/current              # Get current model info
GET    /health                      # ML Engine health
```

---

## 9. 實施優先級

### Phase 1: Planning (Week 1-2) ✅
- [x] 定義服務邊界
- [x] API 契約規範
- [x] 更新 CLAUDE.md

### Phase 2: Backend APIs for Discord Bot (Week 3-4)
- [ ] 實現 `/api/v1/discord/*` 端點
- [ ] 添加 API Key 認證
- [ ] 編寫單元測試
- [ ] Swagger 文檔

### Phase 3: Backend APIs for ML Engine (Week 5-6)
- [ ] 實現 `/api/v1/ml/*` 端點
- [ ] 數據批量查詢優化
- [ ] 編寫單元測試

### Phase 4: Discord Bot Refactor (Week 7-8)
- [ ] 移除數據庫依賴
- [ ] 實現 Backend API Client
- [ ] 重構所有命令
- [ ] 刪除 `models/` 目錄

### Phase 5: Testing & Validation (Week 9-10)
- [ ] 端到端測試
- [ ] 性能測試
- [ ] 故障測試
- [ ] 文檔更新

---

**文檔維護**:
- 本文檔應隨著實施更新
- 任何服務邊界變更需更新此文檔
- 新增 API 端點需更新映射表

**最後更新**: 2025-11-20
**下次 Review**: 開始實施階段 2 時
