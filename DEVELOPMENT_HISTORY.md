# AIFX_v2 開發歷史記錄

本文件整合了 AIFX_v2 專案的開發歷史與實作記錄。

---

## 目錄

1. [交易週期功能](#1-交易週期功能)
2. [信號變化通知系統](#2-信號變化通知系統)
3. [LINE Bot 整合](#3-line-bot-整合)
4. [數據收集系統](#4-數據收集系統)

---

## 1. 交易週期功能

### 1.1 概述

**實作日期**: 2025-11-26
**狀態**: 已完成

實作交易週期概念，讓用戶可以根據自己的交易風格查詢信號。

### 1.2 交易週期對照表

| 週期 | 中文 | 時間框架 | 說明 |
|------|------|----------|------|
| Intraday | 日內 | 15min | 當日交易，當天平倉 |
| Swing | 周內 | 1h | 波段操作，多日持倉 |
| Position | 月內 | 1d | 趨勢跟隨，週到月 |
| Long-term | 季內 | 1w | 長期持有，季度持倉 |

### 1.3 實作細節

**修改的檔案**:
- `backend/src/utils/periodMapper.js` - 週期到時間框架的映射
- `backend/src/controllers/api/v1/tradingController.js` - API 參數處理
- `discord_bot/commands/signal.js` - Discord 指令整合
- `line_bot/handlers/messageHandler.js` - LINE Bot 整合

**API 使用方式**:
```bash
# 中文參數
GET /api/v1/trading/signal?pair=EUR/USD&period=日內

# 英文參數
GET /api/v1/trading/signal?pair=EUR/USD&period=intraday
```

### 1.4 週期映射邏輯

```javascript
const PERIOD_MAPPING = {
  '日內': { timeframe: '15min', description: '當天平倉', holdingPeriod: '數小時' },
  '周內': { timeframe: '1h', description: '波段操作', holdingPeriod: '1-5天' },
  '月內': { timeframe: '1d', description: '趨勢跟隨', holdingPeriod: '1-4週' },
  '季內': { timeframe: '1w', description: '長期持有', holdingPeriod: '1-3個月' }
};
```

---

## 2. 信號變化通知系統

### 2.1 概述

**實作日期**: 2025-11-27 至 2025-11-28
**狀態**: 已完成 (第一階段 & 第二階段)

自動化通知系統，當交易信號改變時提醒用戶。

### 2.2 架構圖

```
後端信號監控器 (每 15 分鐘)
    ↓
偵測信號變化 (與 Redis 快取比較)
    ↓
發布到 Redis 'signal-change' 頻道
    ↓
Discord Bot / LINE Bot 接收通知
    ↓
推送給已訂閱的用戶
```

### 2.3 第一階段 - MVP 功能

- 用戶訂閱管理 (訂閱/取消訂閱)
- 信號監控服務 (15 分鐘間隔)
- Redis Pub/Sub 即時通知
- Discord 斜線指令: `/subscribe`, `/unsubscribe`, `/subscriptions`
- 訂閱資料存儲於 PostgreSQL `user_subscriptions` 資料表

### 2.4 第二階段 - 增強功能

- Redis 快取儲存信號狀態 (30 分鐘 TTL)
- 豐富的 Embed 通知 (含顏色標示)
- 30 分鐘冷卻期 (每用戶/每貨幣對)
- STANDBY 信號支援
- 改善通知格式

### 2.5 資料庫結構

**user_subscriptions 資料表**:
```sql
CREATE TABLE user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  pair VARCHAR(10) NOT NULL,           -- 貨幣對
  timeframe VARCHAR(10) NOT NULL,      -- 時間框架
  platform VARCHAR(20) NOT NULL,       -- 平台: 'discord' 或 'line'
  is_active BOOLEAN DEFAULT true,      -- 是否啟用
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, pair, timeframe, platform)
);
```

### 2.6 關鍵檔案

- `backend/src/services/signalChangeNotificationService.js` - 核心通知邏輯
- `backend/src/services/signalMonitoringService.js` - 信號監控排程器
- `backend/src/controllers/api/v1/subscriptionsController.js` - 訂閱 API
- `discord_bot/commands/subscribe.js` - Discord 訂閱指令
- `discord_bot/commands/unsubscribe.js` - Discord 取消訂閱指令
- `discord_bot/commands/subscriptions.js` - 查看訂閱列表指令

### 2.7 信號變化偵測

觸發通知的信號變化:
- BUY ↔ SELL (買入 ↔ 賣出)
- BUY ↔ HOLD (買入 ↔ 觀望)
- SELL ↔ HOLD (賣出 ↔ 觀望)
- 任何 → STANDBY (任何 → 待命)
- STANDBY → 任何 (待命 → 任何)

### 2.8 通知格式 (Discord Embed)

```
🟢 信號變化通知
貨幣對: EUR/USD
時間框架: 1h
信號變化: HOLD → BUY
信心度: 72%
強度: STRONG
市場狀況: TRENDING
入場價格: 1.09245
```

### 2.9 測試結果

- 建立訂閱: ✅ 正常運作
- 移除訂閱: ✅ 正常運作
- 信號監控: ✅ 每 15 分鐘執行
- Discord 通知: ✅ 成功送達
- LINE 通知: ✅ 成功送達

---

## 3. LINE Bot 整合

### 3.1 概述

**實作日期**: 2025-11-28 至 2025-11-29
**狀態**: MVP 已完成

完整的 LINE Bot 實作，功能與 Discord Bot 對等。

### 3.2 功能

- 透過文字訊息查詢交易信號
- Flex Message UI 呈現豐富回應
- 訂閱管理 (訂閱/取消訂閱)
- 即時信號變化通知
- 支援中英文指令

### 3.3 支援的指令

| 指令 | 說明 |
|------|------|
| `EUR/USD` | 查詢 EUR/USD 信號 |
| `EUR/USD 周內` | 查詢周內交易信號 |
| `訂閱 EUR/USD` | 訂閱信號變化 |
| `取消訂閱 EUR/USD` | 取消訂閱 |
| `我的訂閱` | 查看訂閱列表 |
| `幫助` | 顯示幫助訊息 |

### 3.4 架構圖

```
LINE 用戶 ──► LINE Bot (Port 3001) ──REST API──► Backend (Port 3000)
                       │                              │
                       └────────Redis Pub/Sub─────────┘
```

### 3.5 關鍵檔案

**LINE Bot 服務**:
- `line_bot/bot.js` - Express webhook 伺服器
- `line_bot/handlers/messageHandler.js` - 訊息處理
- `line_bot/services/backendClient.js` - Backend API 客戶端
- `line_bot/services/messageBuilder.js` - Flex Message 建構器

**Backend API**:
- `backend/src/routes/api/v1/line/users.js` - LINE 用戶端點
- `backend/src/controllers/api/line/usersController.js` - 用戶管理
- `backend/src/models/UserLineSettings.js` - LINE 用戶模型

### 3.6 資料庫

**user_line_settings 資料表**:
```sql
CREATE TABLE user_line_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  line_user_id VARCHAR(50) UNIQUE NOT NULL,  -- LINE 用戶 ID
  display_name VARCHAR(100),                  -- 顯示名稱
  notification_enabled BOOLEAN DEFAULT true,  -- 是否啟用通知
  preferred_pairs TEXT[],                     -- 偏好貨幣對
  risk_level INTEGER DEFAULT 5,               -- 風險等級
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.7 環境變數

```bash
LINE_CHANNEL_ACCESS_TOKEN=<你的 LINE Channel Access Token>
LINE_CHANNEL_SECRET=<你的 LINE Channel Secret>
BACKEND_API_URL=http://localhost:3000
LINE_BOT_API_KEY=<API 金鑰>
REDIS_URL=redis://localhost:6379
PORT=3001
```

### 3.8 部署方式

```bash
# 開發環境
cd /root/AIFX_v2/line_bot
node bot.js

# 正式環境 (使用 PM2)
pm2 start bot.js --name line-bot
```

### 3.9 未來規劃

- Rich Menu UI (快速選單)
- 透過 LIFF 進行互動設定
- 多語言支援
- 個人化推薦

---

## 4. 數據收集系統

### 4.1 概述

**實作日期**: 2025-11-29
**狀態**: 正式環境就緒

自動化市場數據收集，採用混合模式優化 API 配額使用。

### 4.2 功能

- **增量模式**: 每個週期抓取最新 5 根 K 線 (用於 cron 排程)
- **歷史模式**: 一次性批量抓取 (最多 5000 根 K 線)
- **混合查詢模式**: 資料庫 (99 根) + API (1 根最新)
- **去重機制**: 自動偵測重複資料

### 4.3 混合模式策略

```javascript
// 減少 99% API 呼叫
// 步驟 1: 從資料庫取得 99 根歷史 K 線
const dbCandles = await MarketData.findLatest(pair, timeframe, 99);

// 步驟 2: 從 Twelve Data API 取得 1 根最新 K 線
const latestCandle = await fetchFromAPI(pair, timeframe, 1);

// 步驟 3: 合併並回傳
return [latestCandle, ...dbCandles];
```

### 4.4 Cron 排程

| 時間框架 | 排程 | 每日 API 呼叫次數 |
|----------|------|-------------------|
| 15min | `*/15 * * * *` (每 15 分鐘) | 288 |
| 1h | `0 * * * *` (每小時) | 72 |
| **總計** | | **360** (每日限額 800 的 45%) |

### 4.5 目標貨幣對

- EUR/USD (歐元/美元)
- USD/JPY (美元/日圓)
- GBP/USD (英鎊/美元)

### 4.6 關鍵檔案

- `ml_engine/scripts/data_collector.py` - 數據收集腳本
- `ml_engine/scripts/setup_cron.sh` - Cron 設定腳本
- `ml_engine/data_processing/twelvedata_fetcher.py` - API 抓取器
- `backend/src/services/forexService.js` - 混合模式實作
- `backend/src/routes/market.js` - 批量寫入端點

### 4.7 API 端點

**批量寫入** (內部使用):
```http
POST /api/v1/market/data/bulk
Authorization: Bearer <API_KEY>
Body: { "data": [...candles] }
```

**歷史數據** (混合模式):
```http
GET /api/v1/market/history/EUR%2FUSD?timeframe=15min&limit=100
```

### 4.8 資料庫覆蓋範圍

| 貨幣對 | 15min | 1h |
|--------|-------|-----|
| EUR/USD | ~800+ 根 | ~300 根 |
| USD/JPY | ~800+ 根 | ~300 根 |
| GBP/USD | ~200+ 根 | - |

### 4.9 Bug 修復記錄

**快取雙重解析 Bug**:
- 檔案: `backend/src/services/forexService.js:53`
- 問題: 對已解析的物件再次執行 `JSON.parse(cachedData)`
- 修復: 移除多餘的 JSON.parse()

---

## 附錄: 關鍵架構決策

### 微服務原則

1. **服務獨立性**: 每個服務可以獨立運作
2. **純 API 通信**: 服務間透過 REST API 溝通
3. **單一資料庫擁有者**: 只有 Backend 可以直接存取 PostgreSQL
4. **事件驅動通知**: 使用 Redis Pub/Sub 進行即時更新

### 服務通信架構

```
Frontend ──REST/WS──► Backend ──REST──► ML Engine
                         │
                         └──REST──► Discord Bot
                         └──REST──► LINE Bot
```

### 安全性

- 服務間通信使用 API Key 認證
- 用戶 Session 使用 JWT 認證
- 所有公開端點都有速率限制

---

**最後更新**: 2025-12-02
