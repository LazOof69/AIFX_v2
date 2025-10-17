# Automated Discord Signal System - Architecture Design

**Created**: 2025-10-16
**Purpose**: 全自動反轉信號推送和交易追蹤系統

---

## 🎯 系統目標

1. **自動監控**: 後台持續監控市場，檢測反轉信號
2. **Discord推送**: 自動發送信號到用戶Discord
3. **用戶設定**: Dashboard設定接收偏好（timeframe, pairs, confidence）
4. **互動確認**: Discord按鈕讓用戶確認是否開單
5. **交易追蹤**: 自動監控開倉position，計算盈虧

---

## 🏗️ 系統架構

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Dashboard                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Settings Page:                                            │  │
│  │ ✓ Link Discord Account                                   │  │
│  │ ✓ Select Timeframes: [✓] 1h  [✓] 15m  [ ] 5m            │  │
│  │ ✓ Select Pairs: EUR/USD, GBP/USD, USD/JPY               │  │
│  │ ✓ Min Confidence: 0.65 (slider)                          │  │
│  │ ✓ Enable Notifications: ON                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              Backend - Signal Monitoring Service                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Cron Job (every 15 minutes):                             │  │
│  │                                                           │  │
│  │ 1. Query active users with Discord enabled               │  │
│  │ 2. Get their subscribed pairs + timeframes               │  │
│  │ 3. Fetch latest market data                              │  │
│  │ 4. Call ML Engine for predictions                        │  │
│  │ 5. Filter signals (confidence >= threshold)              │  │
│  │ 6. Check for new reversals (not sent in last 4h)        │  │
│  │ 7. Send Discord notifications                            │  │
│  │ 8. Save to signal_notifications table                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Discord Bot Service                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Send Rich Embed:                                          │  │
│  │                                                           │  │
│  │ 🔔 REVERSAL SIGNAL DETECTED                              │  │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━                              │  │
│  │ 📊 Pair: EUR/USD                                         │  │
│  │ ⏰ Timeframe: 1h                                         │  │
│  │ 📈 Signal: LONG                                          │  │
│  │ 💯 Confidence: 75%                                       │  │
│  │ 💰 Entry: 1.0854                                         │  │
│  │ 🛑 Stop Loss: 1.0800 (-54 pips)                         │  │
│  │ 🎯 Take Profit: 1.0962 (+108 pips)                      │  │
│  │ 📊 R:R: 1:2                                              │  │
│  │ 🤖 Model: v3.1 Profitable Logic                         │  │
│  │                                                           │  │
│  │ [✅ Open Trade]  [❌ Ignore]  [📊 Details]              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ User clicks [✅ Open Trade]:                             │  │
│  │                                                           │  │
│  │ Modal Form:                                               │  │
│  │ - Entry Price: 1.0854 (pre-filled, editable)            │  │
│  │ - Lot Size: [0.1] lots                                   │  │
│  │ - Stop Loss: 1.0800 (editable)                           │  │
│  │ - Take Profit: 1.0962 (editable)                         │  │
│  │ - Notes: [Optional text]                                 │  │
│  │                                                           │  │
│  │ [Submit] [Cancel]                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Save to Database:                                         │  │
│  │ - Create user_trades record                              │  │
│  │ - Link to signal_notification                            │  │
│  │ - Status: OPEN                                            │  │
│  │                                                           │  │
│  │ Send Confirmation:                                        │  │
│  │ ✅ Trade opened successfully!                            │  │
│  │ 📊 EUR/USD LONG @ 1.0854                                │  │
│  │ 🆔 Trade ID: #12345                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│            Position Monitoring Service (Cron)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Every 1 minute:                                           │  │
│  │                                                           │  │
│  │ 1. Get all OPEN trades                                   │  │
│  │ 2. Fetch current market price                            │  │
│  │ 3. Calculate current P&L                                 │  │
│  │ 4. Check if SL or TP hit                                 │  │
│  │ 5. Update trade status if closed                         │  │
│  │ 6. Send Discord update                                   │  │
│  │                                                           │  │
│  │ Discord Update Examples:                                 │  │
│  │ ✅ Take Profit Hit! +108 pips (+$108)                   │  │
│  │ ❌ Stop Loss Hit! -54 pips (-$54)                       │  │
│  │ 📊 Trade still running: +42 pips (+$42)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### 1. User Discord Settings (新表)

```sql
CREATE TABLE user_discord_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discord_user_id VARCHAR(255) UNIQUE,
  discord_username VARCHAR(255),

  -- 通知設定
  notifications_enabled BOOLEAN DEFAULT true,

  -- Timeframe偏好 (JSON array)
  enabled_timeframes JSONB DEFAULT '["1h", "4h"]',

  -- 貨幣對偏好 (JSON array)
  preferred_pairs JSONB DEFAULT '["EUR/USD", "GBP/USD", "USD/JPY"]',

  -- 信號過濾
  min_confidence DECIMAL(3,2) DEFAULT 0.60,
  only_ml_enhanced BOOLEAN DEFAULT true,

  -- 通知頻率控制
  max_notifications_per_day INTEGER DEFAULT 20,
  notification_cooldown_minutes INTEGER DEFAULT 240, -- 同一pair 4小時內不重複通知

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id)
);

CREATE INDEX idx_discord_user_id ON user_discord_settings(discord_user_id);
CREATE INDEX idx_notifications_enabled ON user_discord_settings(notifications_enabled);
```

### 2. Signal Notifications (新表)

```sql
CREATE TABLE signal_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Signal details
  pair VARCHAR(20) NOT NULL,
  timeframe VARCHAR(10) NOT NULL,
  signal_type VARCHAR(10) NOT NULL, -- 'long', 'short', 'hold'
  confidence DECIMAL(5,4) NOT NULL,

  -- Price levels
  entry_price DECIMAL(10,5) NOT NULL,
  stop_loss DECIMAL(10,5),
  take_profit DECIMAL(10,5),
  risk_reward_ratio DECIMAL(5,2),

  -- ML info
  model_version VARCHAR(20),
  stage1_prob DECIMAL(5,4),
  stage2_prob DECIMAL(5,4),

  -- Discord message
  discord_message_id VARCHAR(255),
  discord_channel_id VARCHAR(255),

  -- Status
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP,

  -- Linked trade (if user opened)
  trade_id INTEGER REFERENCES user_trades(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_signal_user_pair ON signal_notifications(user_id, pair, sent_at);
CREATE INDEX idx_signal_sent_at ON signal_notifications(sent_at);
```

### 3. User Trades (新表)

```sql
CREATE TABLE user_trades (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_notification_id INTEGER REFERENCES signal_notifications(id),

  -- Trade details
  pair VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL, -- 'long', 'short'

  -- Entry
  entry_price DECIMAL(10,5) NOT NULL,
  entry_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lot_size DECIMAL(10,2) NOT NULL, -- 0.01 - 100.00

  -- Exit levels
  stop_loss DECIMAL(10,5) NOT NULL,
  take_profit DECIMAL(10,5) NOT NULL,

  -- Close
  close_price DECIMAL(10,5),
  close_time TIMESTAMP,
  close_reason VARCHAR(50), -- 'tp_hit', 'sl_hit', 'manual_close', 'timeout'

  -- P&L
  pips DECIMAL(10,2),
  profit_loss DECIMAL(10,2), -- in account currency
  profit_loss_percentage DECIMAL(5,2),

  -- Status
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'closed', 'cancelled'
  result VARCHAR(10), -- 'win', 'loss', 'breakeven'

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trade_user_status ON user_trades(user_id, status);
CREATE INDEX idx_trade_status ON user_trades(status);
CREATE INDEX idx_trade_entry_time ON user_trades(entry_time);
```

### 4. Trade Updates (新表 - 追蹤歷史)

```sql
CREATE TABLE trade_updates (
  id SERIAL PRIMARY KEY,
  trade_id INTEGER NOT NULL REFERENCES user_trades(id) ON DELETE CASCADE,

  -- Price snapshot
  current_price DECIMAL(10,5) NOT NULL,
  current_pips DECIMAL(10,2),
  current_pnl DECIMAL(10,2),

  -- Update details
  update_type VARCHAR(50), -- 'price_update', 'sl_hit', 'tp_hit', 'manual_close'
  message TEXT,

  -- Discord notification
  discord_notified BOOLEAN DEFAULT false,
  discord_message_id VARCHAR(255),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trade_updates_trade_id ON trade_updates(trade_id);
```

---

## 🔧 Core Services

### 1. Signal Monitoring Service
**File**: `backend/src/services/signalMonitoringService.js`

**Responsibilities**:
- Cron job (every 15 minutes)
- Fetch active users with Discord enabled
- Get market data for subscribed pairs
- Call ML Engine for predictions
- Filter and send notifications

### 2. Discord Notification Service
**File**: `backend/src/services/discordNotificationService.js`

**Responsibilities**:
- Send rich embeds to Discord
- Create interactive buttons
- Handle button interactions
- Manage Discord API rate limits

### 3. Trade Tracking Service
**File**: `backend/src/services/tradeTrackingService.js`

**Responsibilities**:
- Create/update trades
- Calculate P&L
- Check SL/TP conditions
- Update trade status

### 4. Position Monitoring Service
**File**: `backend/src/services/positionMonitoringService.js`

**Responsibilities**:
- Cron job (every 1 minute)
- Monitor all open trades
- Update current prices
- Detect SL/TP hits
- Send Discord updates

---

## 📱 Frontend Components

### 1. Discord Settings Page
**File**: `frontend/src/pages/DiscordSettings.jsx`

**Features**:
- Link Discord account (OAuth)
- Select timeframes
- Select currency pairs
- Set confidence threshold
- Enable/disable notifications
- View notification history

### 2. Trade History Page
**File**: `frontend/src/pages/TradeHistory.jsx`

**Features**:
- List all trades
- Filter by status/result
- View P&L statistics
- Export to CSV

---

## 🤖 Discord Bot Commands

### Slash Commands
- `/link` - Link Discord account to AIFX
- `/settings` - View/edit notification settings
- `/trades` - View open trades
- `/history` - View trade history
- `/stats` - View trading statistics
- `/stop <trade_id>` - Manually close a trade

---

## 🔄 Workflow Examples

### Example 1: User Receives Signal

```
1. [15:00] Cron job runs
2. [15:00] Detects EUR/USD 1h reversal (confidence: 0.78)
3. [15:00] User john@example.com has EUR/USD + 1h enabled
4. [15:00] Send Discord notification to John
5. [15:01] John clicks [✅ Open Trade]
6. [15:01] Modal shows pre-filled details
7. [15:02] John confirms with lot size 0.5
8. [15:02] Trade saved to database (status: OPEN)
9. [15:02] Discord confirms: "Trade #12345 opened"
10. [15:03+] Position monitoring tracks the trade
```

### Example 2: Trade Reaches Take Profit

```
1. [16:45] Position monitoring cron runs
2. [16:45] Trade #12345 current price: 1.0965
3. [16:45] TP was 1.0962 → HIT!
4. [16:45] Calculate P&L: +108 pips = +$54
5. [16:45] Update trade status: CLOSED (result: WIN)
6. [16:45] Send Discord notification:
   "✅ Trade #12345 closed at TP!
    Profit: +108 pips (+$54)
    Duration: 1h 43m"
7. [16:45] Save to trade_updates history
```

---

## ⚡ Performance Considerations

### Cron Job Scheduling
```javascript
// Signal monitoring: Every 15 minutes
'*/15 * * * *'  // For 1h, 4h timeframes

// Position monitoring: Every 1 minute
'* * * * *'     // For open trades

// Daily stats: Once per day
'0 0 * * *'     // At midnight
```

### Rate Limiting
- Alpha Vantage: 5 req/min → batch requests
- Discord API: 50 req/sec → queue messages
- Redis cache: Reduce API calls

### Scalability
- Use queue system (Bull/Redis) for Discord messages
- Batch ML predictions (max 100 pairs at once)
- Database indexing on hot queries
- Archive old trades to separate table

---

## 🎯 Success Metrics

### User Engagement
- % users with Discord linked
- Notifications sent per day
- % signals acknowledged
- % signals that result in trades

### Trading Performance
- Win rate (%)
- Average R:R ratio
- Average holding time
- Total P&L per user

### System Health
- Cron job success rate
- Average notification latency
- Discord API uptime
- ML Engine response time

---

## 🚀 Implementation Phases

### Phase 1: Database & Models ✅ (Next)
- [ ] Create migrations
- [ ] Create Sequelize models
- [ ] Seed test data

### Phase 2: Core Services ✅
- [ ] Signal monitoring service
- [ ] Discord notification service
- [ ] Trade tracking service
- [ ] Position monitoring service

### Phase 3: Discord Bot ✅
- [ ] Interactive embeds
- [ ] Button handlers
- [ ] Slash commands
- [ ] Error handling

### Phase 4: Frontend ✅
- [ ] Discord settings page
- [ ] Trade history page
- [ ] Real-time updates

### Phase 5: Testing & Deployment ✅
- [ ] Integration tests
- [ ] Load testing
- [ ] Production deployment
- [ ] Monitoring setup

---

**Total Estimated Time**: 8-12 hours
**Priority**: High (Core feature)
**Dependencies**: Discord Bot, ML Engine API, User Auth

---

**Next Steps**: Start with database migrations and models
