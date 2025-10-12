# Phase 3 衝突分析報告

**檢查日期**: 2025-10-12
**檢查範圍**: 資料庫 schema, 後端 API, ML API, Discord bot, 運行中服務

---

## 🟢 現有系統運行狀態

### 運行中的服務
```
✅ Backend API (port 3000)
   - Process: node src/server.js (PID 1776726, 1775886)
   - Screen: backend (1776712)
   - 狀態: 正常運行

✅ Frontend (port 5173)
   - Process: vite --host 0.0.0.0 --port 5173 (PID 1751239)
   - Screen: vite (1751201)
   - 狀態: 正常運行

✅ ML API (port 8000)
   - Process: uvicorn api.ml_server:app (screen session)
   - Screen: ml_api (2077573)
   - 狀態: 正常運行
   - 端點: /health, /predict, /train, /model/info

❌ Discord Bot
   - 狀態: 未運行（僅有代碼）
   - 文件: discord_bot/bot.js
   - 命令: signal, subscribe, unsubscribe, preferences
```

---

## 🗄️ 資料庫現有 Schema

### ✅ 已存在的表（可複用）

#### 1. `users` 表
```sql
- id (uuid, PK)
- username, email, password_hash
- is_active, is_verified
- last_login, created_at, updated_at
```
**狀態**: ✅ 完整，無需修改

#### 2. `user_preferences` 表 ⭐ 重要
```sql
- id (uuid, PK)
- user_id (uuid, FK → users.id)
- trading_frequency (enum)
- risk_level (integer, 1-10)
- preferred_pairs (varchar[])
- trading_style (enum)
- indicators (jsonb)
- notification_settings (jsonb) ⭐
  現有結構:
  {
    "email": true,
    "browser": true,
    "discord": false,
    "signalTypes": {"buy": true, "sell": true, "hold": false},
    "minConfidence": 70
  }
```
**狀態**: ✅ 可擴展 notification_settings JSONB
**建議**: 擴展 notification_settings 而不新增欄位

#### 3. `trading_signals` 表 ⭐ 關鍵
```sql
- id (uuid, PK)
- pair (varchar)
- action (enum: buy/sell/hold)
- confidence (numeric 0-1)
- entry_price, stop_loss, take_profit (numeric)
- risk_reward (numeric)
- timeframe (varchar)
- technical_factors (jsonb)
- sentiment_factors (jsonb)
- ml_prediction (jsonb)
- status (enum: active/expired/cancelled)
- result (enum: hit_tp/hit_sl/expired)
- closed_at, created_at, updated_at
```
**狀態**: ✅ **已有完整信號表**
**衝突**: 與計畫的 `signals` 表功能重疊 100%
**解決方案**: **直接使用** trading_signals 表，不新增 signals 表

#### 4. `user_trading_history` 表 ⭐ 關鍵
```sql
- id (uuid, PK)
- user_id (uuid, FK → users.id)
- signal_id (uuid, FK → trading_signals.id)
- pair (varchar)
- action (enum: buy/sell/hold)
- entry_price, exit_price (numeric)
- stop_loss, take_profit (numeric)
- position_size (numeric)
- profit_loss, profit_loss_percentage (numeric)
- status (enum: open/closed)
- result (enum: win/loss/breakeven)
- notes (text)
- opened_at, closed_at, created_at, updated_at
```
**狀態**: ✅ **已有完整持倉表**
**衝突**: 與計畫的 `user_positions` 表功能重疊 95%
**解決方案**: **直接使用** user_trading_history 表，不新增 user_positions 表

#### 5. `notifications` 表
```sql
- id (uuid, PK)
- user_id (uuid, FK → users.id)
- type (enum)
- title, message (text)
- data (jsonb)
- is_read (boolean)
- priority (enum: low/medium/high/critical)
- channels (varchar[])
- sent_at, read_at, created_at, updated_at
```
**狀態**: ✅ 完整，無需修改

#### 6. Phase 2 基本面數據表
```sql
- fundamental_data (10,409 條記錄)
- economic_events (21,179 條記錄)
- interest_rates (7,301 條記錄)
```
**狀態**: ✅ 完整，供 ML 模型使用

---

### ❌ 缺少的表（需要新增）

#### 1. `position_monitoring` 表 ⭐ 關鍵
```sql
-- 需要新增：監控歷史記錄表
CREATE TABLE position_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL REFERENCES user_trading_history(id),

  -- 當前市場狀態
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  current_price DECIMAL(10,5) NOT NULL,

  -- 浮動盈虧
  unrealized_pnl_pips DECIMAL(10,2),
  unrealized_pnl_percentage DECIMAL(8,4),

  -- 趨勢分析（ML 模型輸出）
  trend_direction VARCHAR(20),
  trend_strength DECIMAL(5,4),
  reversal_probability DECIMAL(5,4),

  -- 風險報酬分析
  current_risk DECIMAL(10,5),
  current_reward DECIMAL(10,5),
  current_rr_ratio DECIMAL(5,2),

  -- 建議動作
  recommendation VARCHAR(20),
  recommendation_confidence DECIMAL(5,4),
  reasoning TEXT,

  -- 通知狀態
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_level INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_position_monitoring_position_id ON position_monitoring(position_id);
CREATE INDEX idx_position_monitoring_timestamp ON position_monitoring(timestamp);
```

**理由**: 這是 Phase 3 的核心功能，記錄每分鐘的持倉監控數據

---

## 🔌 後端 API 端點分析

### ✅ 現有端點（可複用或擴展）

#### Trading 路由 (`/api/v1/trading/*`)
```javascript
GET  /api/v1/trading/signal/:pair
     - 功能: 生成單一貨幣對信號
     - 參數: timeframe, riskLevel
     - 與計畫的 POST /signals/evaluate 功能類似
     - 建議: 擴展此端點而非新增

POST /api/v1/trading/analyze
     - 功能: 分析多個貨幣對
     - 可用於批量信號生成

GET  /api/v1/trading/history
     - 功能: 獲取交易歷史
     - 可擴展為持倉查詢

GET  /api/v1/trading/pairs
GET  /api/v1/trading/timeframes
     - 功能: 元數據查詢
```

#### Notifications 路由 (`/api/v1/notifications/*`)
```javascript
POST /api/v1/notifications/subscribe
POST /api/v1/notifications/unsubscribe
POST /api/v1/notifications/preferences
GET  /api/v1/notifications/preferences/:discordUserId
GET  /api/v1/notifications/subscriptions/:discordUserId
POST /api/v1/notifications/send
```

### ❌ 缺少的端點（需要新增）

#### Positions 路由（新增）
```javascript
POST /api/v1/positions/open
     - 功能: 用戶回報開倉
     - Body: { signal_id, pair, direction, entry_price, position_size }
     - 寫入: user_trading_history 表

POST /api/v1/positions/close
     - 功能: 用戶回報平倉
     - Body: { position_id, exit_price, exit_percentage }
     - 更新: user_trading_history 表

GET  /api/v1/positions/:id
     - 功能: 查詢單一持倉詳情
     - 返回: 持倉信息 + 最新監控數據

GET  /api/v1/positions/:id/monitor
     - 功能: 查詢持倉監控歷史
     - 返回: position_monitoring 記錄列表

GET  /api/v1/positions/user/:userId
     - 功能: 查詢用戶所有持倉
     - 參數: status (open/closed)
     - 返回: 持倉列表

PUT  /api/v1/positions/:id/adjust
     - 功能: 調整止損止盈
     - Body: { new_stop_loss, new_take_profit }
     - 更新: user_trading_history 表
```

---

## 🤖 ML API 端點分析

### ✅ 現有端點
```python
GET  /health          - 健康檢查
POST /predict         - 價格預測（v1.0 單輸入 LSTM）
POST /train           - 模型訓練
GET  /model/info      - 模型信息
```

### ❌ 缺少的端點（需要新增 v3.0）

```python
POST /api/ml/v3/evaluate_entry
     - 功能: 評估進場機會（v3.0 進場評估模型）
     - Request: { pair, user_preferences }
     - Response: { has_opportunity, direction, recommended_entry,
                   stop_loss, take_profit, risk_reward_ratio,
                   confidence, reasoning }

POST /api/ml/v3/analyze_position
     - 功能: 分析持倉狀態（v3.0 持倉監控模型）
     - Request: { pair, direction, entry_price, current_price,
                  holding_duration, unrealized_pnl }
     - Response: { trend_direction, trend_strength,
                   reversal_probability, recommendation,
                   confidence, reasoning }

GET  /api/ml/v3/risk-assessment/:pair
     - 功能: 評估當前風險等級
     - Response: { risk_level, upcoming_events, volatility }
```

---

## 💬 Discord Bot 命令分析

### ✅ 現有命令
```
/signal <pair> [timeframe]
    - 功能: 查詢即時信號
    - 調用: Backend API /api/v1/trading/signal/:pair

/subscribe <pair> [signal_type]
    - 功能: 訂閱通知
    - 調用: Backend API /api/v1/notifications/subscribe

/unsubscribe [pair]
    - 功能: 取消訂閱
    - 調用: Backend API /api/v1/notifications/unsubscribe

/preferences [options]
    - 功能: 設置偏好
    - 調用: Backend API /api/v1/notifications/preferences
```

### ❌ 缺少的命令（需要新增）

```
/position open <pair> <price> <size> [signal_id]
    - 功能: 回報開倉
    - 調用: Backend API /api/v1/positions/open

/position close <position_id> <price> [percentage]
    - 功能: 回報平倉
    - 調用: Backend API /api/v1/positions/close

/position list [status]
    - 功能: 查看所有持倉
    - 調用: Backend API /api/v1/positions/user/:userId

/position detail <position_id>
    - 功能: 查看持倉詳情
    - 調用: Backend API /api/v1/positions/:id

/position settings
    - 功能: 設置監控偏好
    - 調用: Backend API /api/v1/preferences
```

---

## ⚠️ 關鍵衝突點與解決方案

### 1. 資料庫表衝突

| 計畫的表 | 現有表 | 衝突程度 | 解決方案 |
|---------|--------|---------|---------|
| `signals` | `trading_signals` | 🔴 100% 重疊 | **直接使用** trading_signals |
| `user_positions` | `user_trading_history` | 🟡 95% 重疊 | **直接使用** user_trading_history |
| `position_monitoring` | ❌ 不存在 | 🟢 無衝突 | **新增表** |

**修改後的 Migration 計畫**:
```javascript
// ✅ 保留：user_trading_history (已有)
// ✅ 保留：trading_signals (已有)
// ❌ 移除：signals 表（不建立）
// ❌ 移除：user_positions 表（不建立）
// ✅ 新增：position_monitoring 表
```

### 2. API 端點衝突

**衝突端點**:
- ❌ 計畫的 `POST /api/v1/signals/evaluate`
- ✅ 現有的 `GET /api/v1/trading/signal/:pair`

**解決方案**:
- 保留現有端點作為「信號查詢」
- 新增 `POST /api/v1/positions/*` 路由專門處理持倉管理
- 不建立 `/signals/*` 路由，避免與 `/trading/*` 混淆

### 3. 監控服務衝突

**現狀**: ❌ 無監控服務運行

**解決方案**:
- 建立新的 `positionMonitor.js` 服務
- 獨立進程運行（不影響現有 backend）
- 啟動方式: `npm run monitor:start`

### 4. Discord Bot 衝突

**現狀**: ❌ Bot 未運行（僅有代碼）

**解決方案**:
- Discord bot 需要先啟動（目前未運行）
- 新增 `/position` 命令組
- 修改 `/signal` 命令調用 v3.0 ML API

---

## 📋 修改後的 Phase 3 實作計畫

### Week 1: 資料庫 + 後端（5-7 天）

#### Day 1: 資料庫擴展
- [x] 複用 `trading_signals` 表（不新增 signals）
- [x] 複用 `user_trading_history` 表（不新增 user_positions）
- [ ] 新增 `position_monitoring` 表 ⭐
- [ ] 擴展 `user_preferences.notification_settings` JSONB
  ```json
  {
    // 現有欄位
    "email": true,
    "discord": false,
    "signalTypes": {...},
    "minConfidence": 70,

    // 新增欄位
    "urgency_threshold": 2,        // 1-4
    "level2_cooldown": 5,          // 分鐘
    "level3_cooldown": 30,         // 分鐘
    "daily_summary_time": "22:00",
    "mute_hours": ["00:00-07:00"],
    "trailing_stop_enabled": true
  }
  ```

#### Day 2-3: 後端 Service 層
- [ ] 擴展 `tradingSignalService.js`
  - generateSignal() 改為調用 ML API v3.0
- [ ] 創建 `positionService.js` ⭐ 新增
  - openPosition()
  - closePosition()
  - updatePosition()
  - getUserPositions()
- [ ] 創建 `monitoringService.js` ⭐ 新增
  - recordMonitoring()
  - getMonitoringHistory()

#### Day 4-5: 後端 Controller + API
- [ ] 創建 `positionController.js` ⭐ 新增
  - POST /api/v1/positions/open
  - POST /api/v1/positions/close
  - GET  /api/v1/positions/:id
  - GET  /api/v1/positions/:id/monitor
  - GET  /api/v1/positions/user/:userId
  - PUT  /api/v1/positions/:id/adjust

#### Day 6-7: 持倉監控服務 ⭐ 核心
- [ ] 創建 `positionMonitor.js`
  - 每分鐘定時執行
  - 查詢所有 open positions (user_trading_history)
  - 調用 ML API v3.0 /analyze_position
  - 記錄到 position_monitoring 表
  - 判斷 4級通知條件
  - 發送 Discord/WebSocket 通知

### Week 2-3: ML v3.0 + API（保持原計畫）
- 重新標註數據
- 訓練 v3.0 雙模式模型
- 新增 ML API 端點

### Week 4: Discord + 前端（保持原計畫）
- 啟動 Discord bot（目前未運行）
- 新增 /position 命令組
- 前端新增持倉監控組件

---

## ✅ 修改後的優勢

1. **減少工作量**
   - ❌ 不需要建立 signals 表
   - ❌ 不需要建立 user_positions 表
   - ✅ 只需建立 position_monitoring 表

2. **無縫整合**
   - ✅ 直接使用現有 trading_signals 表
   - ✅ 直接使用現有 user_trading_history 表
   - ✅ 保持資料庫一致性

3. **向後兼容**
   - ✅ 現有 API 不受影響
   - ✅ 現有前端不受影響
   - ✅ 漸進式升級

4. **清晰的職責劃分**
   - `/trading/*` → 信號生成和查詢
   - `/positions/*` → 持倉管理和監控 ⭐ 新增
   - `/notifications/*` → 通知管理

---

## 🚨 需要注意的風險

### 1. Discord Bot 未運行
**風險**: Bot 功能未測試
**緩解**: Week 4 優先啟動 Discord bot 並測試

### 2. user_trading_history 表可能有數據
**風險**: 測試時可能有舊數據
**緩解**: 使用 seeder 清理測試數據

### 3. 監控服務負載
**風險**: 監控 100+ 持倉可能超時
**緩解**:
- 並發處理
- Redis 緩存
- 批量 ML API 調用

### 4. 通知頻率控制
**風險**: 通知過多導致用戶疲勞
**緩解**: 4級通知系統 + 冷卻機制

---

## 📝 下一步建議

### 立即執行（確認無誤後）

1. **更新 TODO.md**
   - 修正資料庫設計（移除 signals, user_positions）
   - 強調複用現有表
   - 調整 API 路由設計

2. **開始 Week 1 Day 1**
   - 創建 position_monitoring Migration
   - 測試 user_trading_history 表操作
   - 設計 positionService 接口

3. **啟動 Discord Bot**
   - 檢查 .env 配置
   - 測試現有命令
   - 準備新增 /position 命令

---

**報告完成**: 2025-10-12
**結論**: 現有系統已有 80% 的 Phase 3 基礎架構，只需新增監控服務和 ML v3.0 模型，大幅減少開發工作量。
