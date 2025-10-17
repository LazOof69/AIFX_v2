# AIFX v2 資料庫架構說明
## 完整數據流：兩幣別 × 兩時間刻度 → Discord自動交易訊號

**建立日期**: 2025-10-16
**架構目標**: 支援EUR/USD和USD/JPY的1小時與15分鐘反轉訊號自動化系統

---

## 📊 **核心數據流架構**

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. 市場數據收集 (Market Data Collection)                            │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│   EUR/USD 1h     │   EUR/USD 15min  │   USD/JPY 1h     │   USD/JPY 15min  │
│   market_data    │   market_data    │   market_data    │   market_data    │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  2. ML模型預測 (ML Prediction Pipeline)                              │
│     - Stage 1: 反轉檢測 (Reversal Detection)                         │
│     - Stage 2: 方向分類 (Direction Classification)                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  3. 交易訊號生成 (Signal Generation)                                 │
│     trading_signals 表                                               │
│     - 每15分鐘檢查4種組合                                             │
│     - 信心度 >= user.min_confidence                                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  4. 用戶設定過濾 (User Preferences Filter)                           │
│     user_discord_settings 表                                         │
│     - enabled_timeframes: ['1h'] 或 ['15min'] 或 ['1h', '15min']    │
│     - preferred_pairs: ['EUR/USD', 'USD/JPY']                        │
│     - min_confidence: 0.70                                           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  5. Discord通知發送 (Discord Notification)                           │
│     signal_notifications 表                                          │
│     - 發送訊號embed到Discord                                          │
│     - 包含互動按鈕：✅ 開單 | ❌ 不開                                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  6. 用戶交易確認 (User Trade Confirmation)                           │
│     user_trades 表                                                   │
│     - 用戶點擊"開單"按鈕                                               │
│     - 輸入lot size, 確認entry/SL/TP                                  │
│     - status: 'open'                                                 │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  7. 倉位監控 (Position Monitoring)                                   │
│     trade_updates 表                                                 │
│     - 每1分鐘檢查當前價格                                              │
│     - 計算當前pips和P&L                                               │
│     - 檢測SL/TP觸發                                                   │
│     - 發送更新到Discord                                               │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  8. 交易關閉 (Trade Close)                                           │
│     user_trades.status = 'closed'                                    │
│     - close_reason: 'tp_hit', 'sl_hit', 'manual_close', 'timeout'    │
│     - result: 'win', 'loss', 'breakeven'                             │
│     - 發送最終P&L報告到Discord                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ **資料庫表結構說明**

### **1. market_data（市場K線數據）**
**目的**: 存儲所有幣對和時間刻度的OHLC數據

```sql
CREATE TABLE market_data (
  id UUID PRIMARY KEY,
  pair VARCHAR(20),           -- 'EUR/USD', 'USD/JPY'
  timeframe ENUM,             -- '1h', '15min'
  timestamp TIMESTAMP,        -- K線時間
  open DECIMAL(10,5),
  high DECIMAL(10,5),
  low DECIMAL(10,5),
  close DECIMAL(10,5),
  volume BIGINT,
  technical_indicators JSONB, -- 技術指標快取
  source ENUM,                -- 'yfinance', 'alpha_vantage', etc.
  cache_expires_at TIMESTAMP,
  is_real_time BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,

  UNIQUE(pair, timeframe, timestamp)  -- 防止重複數據
);
```

**使用場景**:
```javascript
// 獲取EUR/USD 1小時數據用於ML預測
const data = await MarketData.findLatest('EUR/USD', '1h', 100);

// 獲取USD/JPY 15分鐘數據
const data = await MarketData.findLatest('USD/JPY', '15min', 100);
```

**4種組合**:
- `EUR/USD` + `1h`
- `EUR/USD` + `15min`
- `USD/JPY` + `1h`
- `USD/JPY` + `15min`

---

### **2. trading_signals（ML生成的交易訊號）**
**目的**: 存儲ML模型預測的反轉訊號

```sql
CREATE TABLE trading_signals (
  id UUID PRIMARY KEY,
  user_id UUID,               -- NULL表示系統級訊號
  pair VARCHAR(20),
  timeframe ENUM,
  signal ENUM,                -- 'buy', 'sell', 'hold'
  confidence DECIMAL(3,2),    -- 0.00 - 1.00

  -- ML factors (v3.1 Profitable Reversal Model)
  factors JSONB {
    technical: 0.75,
    sentiment: 0.65,
    pattern: 0.80
  },

  -- Price levels
  entry_price DECIMAL(10,5),
  stop_loss DECIMAL(10,5),
  take_profit DECIMAL(10,5),
  risk_reward_ratio DECIMAL(4,2),

  -- Signal metadata
  source ENUM,                -- 'ml_engine'
  signal_strength ENUM,       -- 'strong', 'moderate', 'weak'
  status ENUM,                -- 'active', 'triggered', 'expired'

  created_at TIMESTAMP
);
```

**使用場景**:
```javascript
// Cron Job: 每15分鐘生成訊號
const signals = await mlEngine.predictReversal({
  pairs: ['EUR/USD', 'USD/JPY'],
  timeframes: ['1h', '15min']
});
// 保存到trading_signals表
```

---

### **3. user_discord_settings（用戶Discord偏好設定）**
**目的**: 用戶自定義接收哪些幣對和時間刻度的訊號

```sql
CREATE TABLE user_discord_settings (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  discord_user_id VARCHAR(255) UNIQUE,
  discord_username VARCHAR(255),

  -- 通知設定
  notifications_enabled BOOLEAN DEFAULT true,
  enabled_timeframes JSONB DEFAULT '["1h", "4h"]',     -- ← 用戶選擇
  preferred_pairs JSONB DEFAULT '["EUR/USD", "USD/JPY"]',  -- ← 用戶選擇

  -- 訊號過濾
  min_confidence DECIMAL(3,2) DEFAULT 0.60,
  only_ml_enhanced BOOLEAN DEFAULT true,

  -- 限流
  max_notifications_per_day INTEGER DEFAULT 20,
  notification_cooldown_minutes INTEGER DEFAULT 240,   -- 4小時

  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**用戶設定範例**:
```javascript
// 用戶A: 只接收EUR/USD 1小時訊號
{
  enabled_timeframes: ['1h'],
  preferred_pairs: ['EUR/USD'],
  min_confidence: 0.70
}

// 用戶B: 接收兩幣對的15分鐘訊號
{
  enabled_timeframes: ['15min'],
  preferred_pairs: ['EUR/USD', 'USD/JPY'],
  min_confidence: 0.65
}

// 用戶C: 接收所有訊號
{
  enabled_timeframes: ['1h', '15min'],
  preferred_pairs: ['EUR/USD', 'USD/JPY'],
  min_confidence: 0.60
}
```

---

### **4. signal_notifications（發送的訊號記錄）**
**目的**: 記錄每個發送到Discord的訊號

```sql
CREATE TABLE signal_notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),

  -- 訊號詳情
  pair VARCHAR(20),
  timeframe VARCHAR(10),
  signal_type VARCHAR(10),    -- 'long', 'short'
  confidence DECIMAL(5,4),

  -- 價格等級
  entry_price DECIMAL(10,5),
  stop_loss DECIMAL(10,5),
  take_profit DECIMAL(10,5),
  risk_reward_ratio DECIMAL(5,2),

  -- ML資訊
  model_version VARCHAR(20),  -- 'v3.1'
  stage1_prob DECIMAL(5,4),   -- 反轉檢測概率
  stage2_prob DECIMAL(5,4),   -- 方向分類概率

  -- Discord訊息
  discord_message_id VARCHAR(255),
  discord_channel_id VARCHAR(255),

  -- 狀態
  sent_at TIMESTAMP,
  acknowledged BOOLEAN DEFAULT false,  -- 用戶是否回應
  acknowledged_at TIMESTAMP,

  -- 關聯交易
  trade_id INTEGER REFERENCES user_trades(id),

  created_at TIMESTAMP
);
```

**Discord訊息範例**:
```
📈 EUR/USD 反轉訊號 (1小時)

方向: 做多 (Long)
信心度: 75.3% 🔥
模型: v3.1 Profitable Reversal

入場價: 1.08450
止損: 1.08200 (-25 pips)
止盈: 1.09200 (+75 pips)
風險回報比: 1:3

反轉概率: 78.2%
方向概率: 72.4%

[✅ 開單] [❌ 不開]
```

---

### **5. user_trades（用戶交易追蹤）**
**目的**: 記錄用戶實際開的倉位

```sql
CREATE TABLE user_trades (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  signal_notification_id INTEGER REFERENCES signal_notifications(id),

  -- 交易詳情
  pair VARCHAR(20),
  direction VARCHAR(10),      -- 'long', 'short'

  -- 入場
  entry_price DECIMAL(10,5),
  entry_time TIMESTAMP,
  lot_size DECIMAL(10,2),     -- 用戶輸入

  -- 出場等級
  stop_loss DECIMAL(10,5),
  take_profit DECIMAL(10,5),

  -- 平倉
  close_price DECIMAL(10,5),
  close_time TIMESTAMP,
  close_reason VARCHAR(50),   -- 'tp_hit', 'sl_hit', 'manual_close'

  -- 損益
  pips DECIMAL(10,2),
  profit_loss DECIMAL(10,2),
  profit_loss_percentage DECIMAL(5,2),

  -- 狀態
  status VARCHAR(20) DEFAULT 'open',  -- 'open', 'closed'
  result VARCHAR(10),         -- 'win', 'loss', 'breakeven'

  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**交易生命週期**:
```javascript
// 1. 用戶點擊Discord "開單"按鈕
const trade = await UserTrade.create({
  user_id: user.id,
  signal_notification_id: signal.id,
  pair: 'EUR/USD',
  direction: 'long',
  entry_price: 1.08450,
  lot_size: 0.10,  // 用戶輸入
  stop_loss: 1.08200,
  take_profit: 1.09200,
  status: 'open'
});

// 2. 監控cron job每分鐘檢查
const currentPrice = 1.08650;
const pnl = trade.calculatePnL(currentPrice);
// pips: +20, pnl: +$20

// 3. 觸發止盈
if (trade.isTakeProfitHit(currentPrice)) {
  await trade.closeTrade(currentPrice, 'tp_hit');
  // result: 'win', pips: +75, profit_loss: +$75
}
```

---

### **6. trade_updates（交易更新記錄）**
**目的**: 記錄倉位的每次價格更新

```sql
CREATE TABLE trade_updates (
  id SERIAL PRIMARY KEY,
  trade_id INTEGER REFERENCES user_trades(id),

  -- 價格快照
  current_price DECIMAL(10,5),
  current_pips DECIMAL(10,2),
  current_pnl DECIMAL(10,2),

  -- 更新詳情
  update_type VARCHAR(50),    -- 'price_update', 'sl_hit', 'tp_hit'
  message TEXT,

  -- Discord通知
  discord_notified BOOLEAN DEFAULT false,
  discord_message_id VARCHAR(255),

  created_at TIMESTAMP
);
```

**Discord更新訊息範例**:
```
📊 EUR/USD 倉位更新 #12345

當前價格: 1.08650
當前盈虧: +20 pips (+$20.00)

入場價: 1.08450
止損: 1.08200 (-25 pips)
止盈: 1.09200 (+75 pips)

進度: [=========>---] 26% 到TP
```

---

## 🔄 **完整工作流程範例**

### **場景: EUR/USD 1小時反轉訊號 → 用戶開單 → 自動追蹤**

```javascript
// Step 1: Cron Job 每15分鐘運行 (signalMonitoringService.js)
async function checkForSignals() {
  // 獲取最新市場數據
  const eurusd1h = await MarketData.findLatest('EUR/USD', '1h', 100);

  // ML預測
  const prediction = await mlEngine.predictReversal({
    pair: 'EUR/USD',
    timeframe: '1h',
    data: eurusd1h
  });

  if (prediction.hasReversal && prediction.confidence >= 0.70) {
    // 創建trading_signal
    const signal = await TradingSignal.create({
      pair: 'EUR/USD',
      timeframe: '1h',
      signal: prediction.direction, // 'buy'
      confidence: 0.753,
      entry_price: 1.08450,
      stop_loss: 1.08200,
      take_profit: 1.09200,
      factors: prediction.factors
    });

    // 獲取訂閱EUR/USD 1h的用戶
    const users = await UserDiscordSettings.findAll({
      where: {
        notifications_enabled: true,
        enabled_timeframes: { [Op.contains]: ['1h'] },
        preferred_pairs: { [Op.contains]: ['EUR/USD'] },
        min_confidence: { [Op.lte]: 0.753 }
      }
    });

    // 發送Discord通知給每個用戶
    for (const user of users) {
      const notification = await sendDiscordSignal(user, signal);

      // 記錄
      await SignalNotification.create({
        user_id: user.user_id,
        pair: signal.pair,
        timeframe: signal.timeframe,
        signal_type: signal.signal,
        confidence: signal.confidence,
        entry_price: signal.entry_price,
        stop_loss: signal.stop_loss,
        take_profit: signal.take_profit,
        model_version: 'v3.1',
        discord_message_id: notification.id,
        sent_at: new Date()
      });
    }
  }
}

// Step 2: 用戶點擊Discord "開單"按鈕
async function handleTradeConfirmation(interaction) {
  const signalNotificationId = interaction.message.id;
  const signalNotif = await SignalNotification.findOne({
    where: { discord_message_id: signalNotificationId }
  });

  // 彈出modal讓用戶輸入lot size
  const modal = new Modal()
    .addInput('lot_size', 'Lot Size', '0.10')
    .addInput('notes', 'Notes (optional)', '');

  const response = await interaction.showModal(modal);

  // 創建user_trade
  const trade = await UserTrade.create({
    user_id: interaction.user.id,
    signal_notification_id: signalNotif.id,
    pair: signalNotif.pair,
    direction: signalNotif.signal_type,
    entry_price: signalNotif.entry_price,
    lot_size: response.lot_size,
    stop_loss: signalNotif.stop_loss,
    take_profit: signalNotif.take_profit,
    status: 'open'
  });

  // 更新signal_notification
  signalNotif.acknowledged = true;
  signalNotif.acknowledged_at = new Date();
  signalNotif.trade_id = trade.id;
  await signalNotif.save();

  // 回覆用戶
  await interaction.reply(`✅ 倉位已開啟！Trade ID: ${trade.id}`);
}

// Step 3: Cron Job 每1分鐘監控倉位 (positionMonitoringService.js)
async function monitorPositions() {
  const openTrades = await UserTrade.findAll({
    where: { status: 'open' }
  });

  for (const trade of openTrades) {
    // 獲取當前價格
    const currentData = await MarketData.getCurrent(trade.pair, '1min');
    const currentPrice = currentData.close;

    // 計算P&L
    const pnl = trade.calculatePnL(currentPrice);

    // 記錄更新
    const update = await TradeUpdate.create({
      trade_id: trade.id,
      current_price: currentPrice,
      current_pips: pnl.pips,
      current_pnl: pnl.pnl,
      update_type: 'price_update'
    });

    // 檢查止損/止盈
    if (trade.isStopLossHit(currentPrice)) {
      await trade.closeTrade(currentPrice, 'sl_hit');
      await sendDiscordUpdate(trade, '❌ 止損觸發');
    } else if (trade.isTakeProfitHit(currentPrice)) {
      await trade.closeTrade(currentPrice, 'tp_hit');
      await sendDiscordUpdate(trade, '✅ 止盈觸發');
    } else {
      // 定期更新（每30分鐘或顯著變化）
      if (shouldSendUpdate(trade, pnl)) {
        await sendDiscordUpdate(trade, `📊 當前: ${pnl.pips} pips`);
      }
    }
  }
}
```

---

## ✅ **驗證：能否達到您的需求？**

### **需求1: 兩幣別 × 兩時間刻度**
✅ **完全支援**
```javascript
// market_data表可以存儲：
- EUR/USD + 1h
- EUR/USD + 15min
- USD/JPY + 1h
- USD/JPY + 15min

// 透過WHERE查詢過濾
SELECT * FROM market_data
WHERE pair = 'EUR/USD' AND timeframe = '1h'
ORDER BY timestamp DESC LIMIT 100;
```

### **需求2: Dashboard設定選擇時間刻度**
✅ **user_discord_settings表**
```javascript
// Frontend設定頁面
user.enabled_timeframes = ['1h'];        // 只接收1小時
user.enabled_timeframes = ['15min'];     // 只接收15分鐘
user.enabled_timeframes = ['1h', '15min']; // 兩者都接收
```

### **需求3: Discord通知 + 互動按鈕**
✅ **signal_notifications表 + Discord.js**
```javascript
// Discord embed with buttons
const embed = new MessageEmbed()
  .setTitle('📈 EUR/USD 反轉訊號')
  .addField('方向', 'Long')
  .addField('信心度', '75.3%');

const buttons = new MessageActionRow()
  .addComponents(
    new MessageButton().setCustomId('open_trade').setLabel('開單').setStyle('SUCCESS'),
    new MessageButton().setCustomId('ignore').setLabel('不開').setStyle('SECONDARY')
  );

await channel.send({ embeds: [embed], components: [buttons] });
```

### **需求4: 用戶回報是否開單**
✅ **user_trades表**
```javascript
// 用戶點擊"開單" → 創建user_trade記錄
// 用戶點擊"不開" → 不創建記錄，更新signal_notification.acknowledged
```

### **需求5: 自動追蹤交易**
✅ **trade_updates表 + Cron Job**
```javascript
// 每1分鐘自動檢查
// 計算當前P&L
// 檢測SL/TP觸發
// 發送Discord更新
```

---

## 🎯 **總結**

### **✅ 選項B完全可以達到您的需求！**

**優點**:
1. ✅ 支援多幣對多時間刻度（可擴展到更多）
2. ✅ 統一查詢（所有數據在同一個表）
3. ✅ ML訓練 + 實時預測共用數據源
4. ✅ Discord自動化完整工作流
5. ✅ 用戶自定義偏好設定
6. ✅ 完整的交易追蹤和P&L計算

**數據流總覽**:
```
CSV數據 → market_data表 → ML訓練
market_data表 → ML預測 → trading_signals表
trading_signals表 → 用戶過濾 → signal_notifications表
signal_notifications表 → Discord通知 → 用戶確認
用戶確認 → user_trades表 → 自動監控
自動監控 → trade_updates表 → Discord更新
```

**目前狀態**:
- ✅ 所有表已創建
- ✅ 外鍵關聯正確
- ✅ 索引已優化
- ⏳ 需要實現：
  - Signal Monitoring Cron Job
  - Discord Notification Service
  - Position Monitoring Cron Job
  - Frontend Dashboard設定頁面

**下一步建議**:
1. 開始實現Signal Monitoring Service（每15分鐘檢查訊號）
2. 實現Discord Notification Service（發送embed + 按鈕）
3. 實現Position Monitoring Service（每1分鐘檢查倉位）

您覺得這個架構如何？是否符合您的預期？
