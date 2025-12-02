# AIFX v2 - AI 外匯交易顧問系統

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![Python](https://img.shields.io/badge/python-%3E%3D3.9-blue.svg)

**智能外匯交易顧問系統 | AI-Powered Forex Trading Advisory**

*運用機器學習與技術分析，透過 Discord / LINE 推送即時交易訊號*

</div>

---

## 功能特色

- **AI 預測引擎** - LSTM 深度學習模型分析歷史數據
- **多維度分析** - 技術指標 + 市場情緒 (FinBERT/VADER) 加權融合
- **即時通知** - Discord / LINE Bot 推送交易訊號
- **訂閱系統** - 用戶可訂閱特定貨幣對的信號變化通知 (Redis Pub/Sub)
- **回測系統** - 歷史數據回測驗證策略，生成績效報告
- **數據收集** - 自動收集市場數據 (Twelve Data API)，混合模式節省 API 配額
- **管理後台** - Python 桌面應用程式監控系統狀態、用戶管理、情緒分析測試

---

## 系統架構

```
┌─────────────────────────────────────────────────────────────┐
│                      用戶端                                  │
│              Discord App / LINE App                         │
└─────────────────┬───────────────────┬───────────────────────┘
                  │                   │
┌─────────────────▼─────────┐ ┌───────▼───────────┐
│     Discord Bot           │ │    LINE Bot       │
│     (Node.js)             │ │   (Port 3001)     │
└─────────────────┬─────────┘ └───────┬───────────┘
                  │   REST API        │
                  └─────────┬─────────┘
                            ▼
              ┌─────────────────────────────┐
              │      Backend API            │
              │       (Port 3000)           │
              │  • 用戶管理                 │
              │  • 訂閱管理                 │
              │  • 交易訊號生成             │
              └──────────┬──────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ PostgreSQL  │  │    Redis    │  │  ML Engine  │
│  Database   │  │    Cache    │  │ (Port 8000) │
└─────────────┘  └─────────────┘  └─────────────┘
```

**重要規則**：
- 只有 Backend 可直接存取 PostgreSQL
- Discord Bot / LINE Bot 必須透過 Backend API
- 所有服務間通訊使用 REST API

---

## 技術棧

| 層級 | 技術 |
|------|------|
| **後端** | Node.js 18, Express 4.18, Sequelize, JWT |
| **ML 引擎** | Python 3.9, TensorFlow, FastAPI, FinBERT |
| **資料庫** | PostgreSQL 14, Redis 6 |
| **Bot** | Discord.js 14, LINE Bot SDK 8 |
| **管理** | Python Tkinter |

---

## 目錄結構

```
AIFX_v2/
├── backend/           # Node.js API 服務 (Port 3000)
├── ml_engine/         # Python ML 引擎 (Port 8000)
├── discord_bot/       # Discord Bot
├── line_bot/          # LINE Bot (Port 3001)
├── admin_app/         # Python 管理後台 (Tkinter)
├── frontend/          # React 前端 (開發中)
├── database/          # 資料庫 migration
├── docs/              # API 文件
├── scripts/           # 工具腳本
├── tests/             # 測試檔案
├── logs/              # 日誌檔案
├── start-all-services.sh   # 一鍵啟動所有服務
├── stop-all-services.sh    # 一鍵停止所有服務
├── check_services.sh       # 檢查服務狀態
├── CLAUDE.md               # Claude Code 開發規範
└── DEVELOPMENT_HISTORY.md  # 開發歷史記錄
```

---

## 快速開始

### 前置需求

- Node.js ≥ 18.0.0
- Python ≥ 3.9
- PostgreSQL ≥ 14.0
- Redis ≥ 6.0

### 安裝步驟

```bash
# 1. 克隆專案
git clone https://github.com/LazOof69/AIFX_v2.git
cd AIFX_v2

# 2. 安裝依賴
cd backend && npm install
cd ../ml_engine && pip install -r requirements.txt
cd ../discord_bot && npm install
cd ../line_bot && npm install

# 3. 設置環境變數
cp backend/.env.example backend/.env
# 編輯 .env 配置

# 4. 資料庫遷移
cd backend && npx sequelize-cli db:migrate

# 5. 啟動服務
./start-all-services.sh
```

---

## 環境變數

```env
# 服務配置
NODE_ENV=development
PORT=3000

# 資料庫
DATABASE_URL=postgresql://user:password@localhost:5432/aifx_db
REDIS_URL=redis://localhost:6379

# JWT 認證
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-jwt-refresh-secret

# 外部 API
TWELVE_DATA_KEY=your-twelve-data-key

# ML Engine
ML_API_URL=http://localhost:8000

# Discord Bot
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_CLIENT_ID=your-discord-client-id

# LINE Bot
LINE_CHANNEL_ACCESS_TOKEN=your-line-token
LINE_CHANNEL_SECRET=your-line-secret

# 服務間認證 (64字元十六進位)
API_KEY=your-discord-api-key
LINE_BOT_API_KEY=your-line-api-key

# Admin 管理後台
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-admin-password
ADMIN_JWT_SECRET=your-admin-jwt-secret
```

---

## 交易週期

| 週期 | 時間框架 | 適用者 |
|------|----------|--------|
| 日內 | 15min | 短線交易 |
| 周內 | 1h | 波段交易 |
| 月內 | 1d | 中期投資 |
| 季內 | 1w | 長期投資 |

---

## Bot 指令

### Discord
| 指令 | 說明 |
|------|------|
| `/signal [貨幣對] [週期]` | 查詢交易訊號 |
| `/subscribe [貨幣對]` | 訂閱信號變化通知 |
| `/unsubscribe [貨幣對]` | 取消訂閱 |
| `/subscriptions` | 查看訂閱列表 |
| `/position [貨幣對]` | 查看持倉建議 |
| `/preferences` | 設定交易偏好 |
| `/trading-guide` | 交易指南 |
| `/ping` | 測試 Bot 連線 |

### LINE
| 指令 | 說明 |
|------|------|
| `EUR/USD` 或 `EUR/USD 周內` | 查詢交易訊號 |
| `訂閱 EUR/USD` | 訂閱信號變化通知 |
| `取消訂閱 EUR/USD` | 取消訂閱 |
| `我的訂閱` | 查看訂閱列表 |
| `幫助` | 顯示指令說明 |

---

## 支援貨幣對

- EUR/USD (歐元/美元)
- USD/JPY (美元/日圓)
- GBP/USD (英鎊/美元)

---

## 服務端口

| 服務 | 端口 |
|------|------|
| Backend API | 3000 |
| ML Engine | 8000 |
| LINE Bot | 3001 |
| PostgreSQL | 5432 |
| Redis | 6379 |

---

## 免責聲明

1. 本系統提供的交易訊號僅供參考，不構成投資建議
2. 外匯交易涉及高風險，可能導致資金損失
3. 過去表現不保證未來結果
4. 用戶應自行評估風險並做出交易決策

---

## 授權

MIT License

---

<div align="center">

**AIFX v2** - *Empowering Traders with AI*

[GitHub](https://github.com/LazOof69/AIFX_v2) •
[回報問題](https://github.com/LazOof69/AIFX_v2/issues)

</div>
