# AIFX v2 - 服務說明
# Backend、Frontend、Admin

本文件說明 AIFX v2 的核心服務架構。

---

## 概述

| 服務 | 技術 | 端口 | 說明 |
|------|------|------|------|
| Backend API | Node.js + Express | 3000 | 核心 API 服務 |
| Frontend | React + Vite | 5173 | 網頁介面 (開發中) |
| Admin | Python + Tkinter | - | 桌面管理後台 |

---

## Backend API

### 架構

```
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Port 3000)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Routes     │  │ Controllers  │  │   Services   │       │
│  │   路由層     │─▶│   控制器層   │─▶│   服務層     │       │
│  └──────────────┘  └──────────────┘  └──────┬───────┘       │
│                                              │               │
│                    ┌─────────────────────────┼───────┐      │
│                    ▼                         ▼       ▼      │
│             ┌──────────┐              ┌─────────┐ ┌─────┐   │
│             │  Models  │              │  Redis  │ │ ML  │   │
│             │  模型層  │              │  快取   │ │ API │   │
│             └────┬─────┘              └─────────┘ └─────┘   │
│                  ▼                                          │
│             ┌──────────┐                                    │
│             │PostgreSQL│                                    │
│             │  資料庫  │                                    │
│             └──────────┘                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 目錄結構

```
backend/
├── src/
│   ├── app.js              # Express 應用程式
│   ├── server.js           # 伺服器入口
│   ├── config/
│   │   ├── database.js     # 資料庫配置
│   │   └── redis.js        # Redis 配置
│   ├── controllers/        # 控制器
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── tradingController.js
│   │   ├── marketController.js
│   │   └── subscriptionsController.js
│   ├── services/           # 業務邏輯
│   │   ├── forexService.js
│   │   ├── tradingSignalService.js
│   │   ├── signalMonitoringService.js
│   │   ├── mlEngineService.js
│   │   └── technicalAnalysis.js
│   ├── models/             # Sequelize 模型
│   │   ├── User.js
│   │   ├── UserDiscordSettings.js
│   │   ├── UserLineSettings.js
│   │   ├── TradingSignal.js
│   │   ├── MarketData.js
│   │   └── UserSubscription.js
│   ├── routes/             # API 路由
│   │   └── api/v1/
│   ├── middleware/         # 中間件
│   │   ├── auth.js
│   │   └── adminAuth.js
│   └── utils/              # 工具函式
├── package.json
└── .env
```

### API 路由

#### 公開路由

| 路由 | 方法 | 說明 |
|------|------|------|
| `/health` | GET | 健康檢查 |
| `/api/v1/auth/login` | POST | 用戶登入 |
| `/api/v1/auth/register` | POST | 用戶註冊 |

#### Discord Bot API (需 API Key)

| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/v1/discord/signals` | GET | 獲取所有訊號 |
| `/api/v1/discord/signals/:pair` | GET | 獲取特定貨幣對訊號 |
| `/api/v1/discord/users/:discordId` | GET | 獲取用戶資訊 |
| `/api/v1/discord/users` | POST | 建立/更新用戶 |

#### LINE Bot API (需 API Key)

| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/v1/line/signals` | GET | 獲取所有訊號 |
| `/api/v1/line/signals/:pair` | GET | 獲取特定貨幣對訊號 |
| `/api/v1/line/users/:lineUserId` | GET | 獲取用戶資訊 |
| `/api/v1/line/users` | POST | 建立/更新用戶 |

#### 交易 API

| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/v1/trading/signal` | GET | 查詢交易訊號 |
| `/api/v1/trading/signals` | GET | 列出所有訊號 |

#### 訂閱 API

| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/v1/notifications/subscribe` | POST | 訂閱通知 |
| `/api/v1/notifications/unsubscribe` | POST | 取消訂閱 |
| `/api/v1/notifications/subscriptions/:userId` | GET | 獲取訂閱列表 |

#### Admin API (需 Admin Token)

| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/v1/admin/login` | POST | 管理員登入 |
| `/api/v1/admin/verify` | GET | 驗證 Token |
| `/api/v1/admin/health` | GET | 系統健康狀態 |
| `/api/v1/admin/stats` | GET | 統計資訊 |
| `/api/v1/admin/users` | GET | 用戶列表 |
| `/api/v1/admin/signals` | GET | 訊號列表 |
| `/api/v1/admin/ml/status` | GET | ML Engine 狀態 |
| `/api/v1/admin/sentiment/test/:pair` | GET | 測試情緒分析 |

### 核心服務

#### forexService.js
- 市場數據獲取
- Twelve Data API 整合
- Redis 快取管理
- 混合模式 (DB + API)

#### tradingSignalService.js
- 交易訊號生成
- ML Engine 整合
- 技術指標計算

#### signalMonitoringService.js
- 信號變化監控 (每 15 分鐘)
- Redis Pub/Sub 發布
- 訂閱者通知

#### mlEngineService.js
- ML Engine API 客戶端
- 預測請求處理
- 情緒分析整合

### 資料庫模型

| 模型 | 資料表 | 說明 |
|------|--------|------|
| User | users | 用戶基本資訊 |
| UserDiscordSettings | user_discord_settings | Discord 用戶設定 |
| UserLineSettings | user_line_settings | LINE 用戶設定 |
| TradingSignal | trading_signals | 交易訊號記錄 |
| MarketData | market_data | 市場數據 |
| UserSubscription | user_subscriptions | 用戶訂閱 |

### 環境變數

```env
# 服務配置
NODE_ENV=development
PORT=3000

# 資料庫
DATABASE_URL=postgresql://user:password@localhost:5432/aifx_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# 外部 API
TWELVE_DATA_KEY=your-api-key
ML_API_URL=http://localhost:8000

# Bot API Keys
API_KEY=your-discord-api-key
LINE_BOT_API_KEY=your-line-api-key

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password
ADMIN_JWT_SECRET=your-admin-secret
```

### 啟動方式

```bash
cd backend

# 開發環境
npm run dev

# 正式環境
npm start

# PM2
pm2 start src/server.js --name aifx-backend
```

---

## Frontend (開發中)

### 技術棧

| 技術 | 版本 | 用途 |
|------|------|------|
| React | 18.2 | UI 框架 |
| Vite | 4.x | 建置工具 |
| Tailwind CSS | 3.x | 樣式框架 |
| Chart.js | 4.x | 圖表繪製 |
| Socket.io | 4.x | 即時通訊 |

### 目錄結構

```
frontend/
├── src/
│   ├── components/     # React 組件
│   ├── pages/          # 頁面
│   ├── services/       # API 服務
│   ├── hooks/          # 自定義 Hooks
│   └── App.jsx         # 主程式
├── public/
├── package.json
└── vite.config.js
```

### 預計功能

- 用戶登入/註冊
- 交易訊號儀表板
- 即時價格圖表
- 訂閱管理
- 個人偏好設定

### 啟動方式

```bash
cd frontend
npm install
npm run dev
# 訪問 http://localhost:5173
```

---

## Admin 管理後台

### 概述

Python 桌面應用程式，使用 Tkinter GUI 框架。

### 功能

| 功能 | 說明 |
|------|------|
| 系統監控 | 查看服務健康狀態 |
| 用戶管理 | 查看/管理用戶列表 |
| 訊號管理 | 查看交易訊號歷史 |
| 情緒分析 | 測試情緒分析功能 |
| ML 狀態 | 查看 ML Engine 狀態 |

### 目錄結構

```
admin_app/
└── aifx_admin_v2.py    # 主程式
```

### 介面

```
┌─────────────────────────────────────────────────────────────┐
│  AIFX Admin Dashboard                              [_][□][X]│
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐                                            │
│  │ 登入        │  帳號: [____________]                      │
│  │             │  密碼: [____________]                      │
│  │             │         [  登入  ]                         │
│  └─────────────┘                                            │
├─────────────────────────────────────────────────────────────┤
│  [系統監控] [用戶管理] [訊號管理] [情緒分析] [重新整理]     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  系統狀態                                              │  │
│  │  ─────────                                             │  │
│  │  PostgreSQL: ● 已連線                                  │  │
│  │  Redis:      ● 已連線                                  │  │
│  │  ML Engine:  ● 已連線                                  │  │
│  │  Sentiment:  ● 運行中                                  │  │
│  │                                                        │  │
│  │  統計資訊                                              │  │
│  │  ─────────                                             │  │
│  │  總用戶數:  156                                        │  │
│  │  今日訊號:  24                                         │  │
│  │  活躍模型:  3                                          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 環境變數

```env
ADMIN_API_URL=http://localhost:3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password
```

### 啟動方式

```bash
cd admin_app
python aifx_admin_v2.py
```

### 功能說明

#### 系統監控
- 顯示各服務連線狀態
- 顯示系統統計資訊
- 顯示記憶體使用量

#### 用戶管理
- 列出所有用戶 (Discord + LINE)
- 搜尋用戶
- 啟用/停用用戶

#### 訊號管理
- 列出交易訊號歷史
- 篩選：貨幣對、方向、時間框架
- 查看訊號詳情

#### 情緒分析測試
- 選擇貨幣對
- 執行情緒分析
- 顯示結果：
  - 情緒分數
  - 情緒訊號 (bullish/bearish/neutral)
  - 新聞數量
  - 央行政策分析

---

## API 認證機制

### 類型對照

| 認證類型 | Header | 格式 | 使用者 |
|----------|--------|------|--------|
| API Key | X-API-Key | 64 字元 hex | Discord Bot |
| Bearer Token | Authorization | Bearer + 64 字元 | LINE Bot |
| JWT Token | Authorization | Bearer + JWT | 前端用戶 |
| Admin Token | Authorization | Bearer + JWT | 管理員 |

### 中間件判斷

```javascript
// 區分 API Key 和 JWT
if (token.length === 64 && !token.includes('.')) {
  // API Key 認證
  return authenticateApiKey(token);
} else {
  // JWT 認證
  return authenticateJwt(token);
}
```

---

## 服務間通訊

```
┌─────────────────────────────────────────────────────────────┐
│                      服務通訊架構                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Frontend ─── JWT ───────┐                                  │
│                           │                                  │
│   Discord Bot ─ API Key ──┼───▶ Backend ──▶ PostgreSQL      │
│                           │        │                         │
│   LINE Bot ─── API Key ───┘        │                         │
│                                    ├───▶ Redis               │
│   Admin ─── Admin JWT ────────────▶│                         │
│                                    └───▶ ML Engine           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 常見問題

### Q1: Backend 連不上資料庫？
檢查 `DATABASE_URL` 格式和 PostgreSQL 服務狀態。

### Q2: Redis 連線失敗？
確認 Redis 服務運行中：`redis-cli ping`

### Q3: Admin 登入失敗？
確認 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 設定正確。

### Q4: ML Engine 連線失敗？
確認 ML Engine 運行中且 `ML_API_URL` 正確。

---

**最後更新**: 2025-12-02
