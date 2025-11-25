# Discord Bot 完整功能說明

## 📊 Discord Bot 狀態

**當前狀態**: ⚠️ 已配置但未運行

### 已完成配置
✅ Discord Bot Token 已設置
✅ Discord Channel ID 已配置
✅ Bot 命令已實現
✅ 後端通知服務已集成
✅ Redis pub/sub 已就緒

### 需要啟動
⏳ Discord Bot 服務未運行
⏳ 需要部署斜線命令
⏳ 需要將 Bot 加入 Discord 伺服器

---

## 🤖 Discord Bot 功能

### 1. 即時交易信號推送
- 自動推送 EUR/USD, USD/JPY 等貨幣對的交易信號
- 每 15 分鐘檢查一次市場
- 信號包含：方向（LONG/SHORT）、信心度、反轉概率

### 2. 斜線命令（Slash Commands）

#### `/subscribe` - 訂閱信號通知
訂閱特定貨幣對的交易信號
```
/subscribe pair:EUR/USD signal_type:strong
```
選項：
- `pair`: 貨幣對（必填）
- `signal_type`: 信號類型
  - All Signals（所有信號）
  - Buy Only（只接收買入）
  - Sell Only（只接收賣出）
  - Strong Signals Only（只接收強信號）

#### `/unsubscribe` - 取消訂閱
取消特定或所有貨幣對的訂閱
```
/unsubscribe pair:EUR/USD
/unsubscribe  # 取消所有
```

#### `/signal` - 即時查詢交易信號
立即獲取特定貨幣對的交易建議
```
/signal pair:EUR/USD timeframe:1h
```
選項：
- `pair`: 貨幣對（必填）
- `timeframe`: 時間框架（15min, 30min, 1h, 4h, 1d）

#### `/preferences` - 設定偏好
自訂通知偏好設定
```
/preferences risk_level:7 min_confidence:0.75 strong_signals_only:true
```
選項：
- `risk_level`: 風險等級 1-10
- `trading_style`: 交易風格
  - Trend Following（趨勢跟隨）
  - Counter-Trend（反轉交易）
  - Mixed（混合）
- `min_confidence`: 最低信心度 0.0-1.0
- `strong_signals_only`: 只接收強信號

#### `/position` - 倉位管理（新功能！）

**開倉** - 記錄新的交易倉位
```
/position open pair:EUR/USD action:buy entry_price:1.0825 stop_loss:1.0785 take_profit:1.0905
```

**查看倉位** - 列出所有開倉
```
/position list
/position list pair:EUR/USD
```

**平倉** - 關閉倉位
```
/position close position_id:abc123 exit_price:1.0890 percentage:100
```
支持部分平倉（percentage: 50 = 平倉 50%）

---

## 📨 Discord 通知格式

### 反轉信號通知範例

**LONG 信號（綠色）**
```
🚨 反轉訊號偵測
━━━━━━━━━━━━━━━━━━━━
💱 貨幣對: EUR/USD
⏱️ 時間框架: 1h
📊 訊號: LONG (做多) ⬆️
🎯 信心度: 68.3%
🔄 反轉機率 (Stage 1): 68.4%
📈 方向機率 (Stage 2): 68.3%

AIFX v2 | Model: v3.1
```

**SHORT 信號（紅色）**
```
🚨 反轉訊號偵測
━━━━━━━━━━━━━━━━━━━━
💱 貨幣對: USD/JPY
⏱️ 時間框架: 15min
📊 訊號: SHORT (做空) ⬇️
🎯 信心度: 72.5%
🔄 反轉機率 (Stage 1): 73.0%
📈 方向機率 (Stage 2): 72.0%

AIFX v2 | Model: v3.1
```

---

## 🏗️ Discord 整合架構

```
ML Engine (Python)
    ↓ 生成反轉信號
Backend (Node.js)
    ↓ signalMonitoringService (每 15 分鐘運行)
    ↓ 檢測 EUR/USD, USD/JPY (1h, 15min)
    ↓
discordNotificationService
    ↓ 格式化信號為 Discord Embed
    ↓ 檢查去重（30 分鐘內不重複）
    ↓ 發送到 Discord Channel
    ↓
Discord Server
    ↓ 用戶收到通知
    
┌─────────────────┐
│  Discord Bot    │
│  (獨立進程)     │
├─────────────────┤
│ • 監聽斜線命令  │
│ • 管理用戶訂閱  │
│ • 查詢即時信號  │
│ • 倉位管理      │
│ • 偏好設定      │
└─────────────────┘
```

---

## 🚀 如何啟動 Discord Bot

### 方法 1: 直接啟動 Bot

```bash
cd /root/AIFX_v2/discord_bot

# 1. 部署斜線命令到 Discord
node deploy-commands.js

# 2. 啟動 Bot
node bot.js

# 或使用 tmux 背景運行
tmux new-session -d -s aifx-discord "cd /root/AIFX_v2/discord_bot && node bot.js"
```

### 方法 2: 加入到啟動腳本

編輯 `/root/AIFX_v2/start-all-services.sh`：

```bash
# 添加 Discord Bot 啟動
echo "Starting Discord Bot..."
tmux new-session -d -s aifx-discord "cd /root/AIFX_v2/discord_bot && node bot.js"
sleep 2
```

---

## 🔧 配置檢查

### Backend Discord 配置
```bash
# 檢查 /root/AIFX_v2/backend/.env
DISCORD_BOT_TOKEN=<REDACTED>
DISCORD_SIGNAL_CHANNEL_ID=1428593335966367885
```

### Discord Bot 配置
```bash
# 檢查 /root/AIFX_v2/discord_bot/.env
DISCORD_BOT_TOKEN=<REDACTED>
DISCORD_CLIENT_ID=1428590030619672647
DISCORD_GUILD_ID=1428591722968039455
BACKEND_API_URL=http://localhost:3000
```

---

## 📊 運作方式

### 場景 1: 自動信號推送

```
1. signalMonitoringService 每 15 分鐘運行
   ↓
2. 呼叫 ML Engine 檢查 EUR/USD (1h, 15min) 和 USD/JPY (1h, 15min)
   ↓
3. 如果檢測到反轉信號（信心度 > 65%）
   ↓
4. discordNotificationService.sendSignalNotification()
   ↓
5. 檢查是否在 30 分鐘內已發送過相同信號
   ↓
6. 如果沒有，格式化為 Discord Embed
   ↓
7. 發送到配置的 Discord Channel
   ↓
8. 用戶在 Discord 看到即時通知
```

### 場景 2: 用戶使用命令

```
用戶在 Discord 輸入：/signal pair:EUR/USD timeframe:1h
   ↓
Discord Bot 接收命令
   ↓
Bot 呼叫 Backend API: GET /api/v1/trading/signal/EURUSD?timeframe=1h
   ↓
Backend 處理：
  → 獲取市場數據
  → 計算技術指標
  → 呼叫 ML Engine 預測
  → 生成交易信號
   ↓
返回信號給 Bot
   ↓
Bot 格式化為 Discord Embed
   ↓
發送給用戶（DM 或 Channel）
```

### 場景 3: 倉位管理

```
用戶開倉：/position open pair:EUR/USD action:buy entry_price:1.0825
   ↓
Discord Bot 驗證用戶映射
   ↓
插入記錄到 user_trading_history 表
   ↓
返回倉位 ID 給用戶

用戶查看：/position list
   ↓
查詢該用戶所有 OPEN 狀態的倉位
   ↓
顯示：倉位 ID、貨幣對、方向、進場價、P&L

用戶平倉：/position close position_id:abc123 exit_price:1.0890
   ↓
更新倉位狀態為 CLOSED
   ↓
計算實際盈虧
   ↓
返回結果給用戶
```

---

## ⚠️ 目前狀態

### 已實現
✅ Discord Bot Token 已配置
✅ 所有斜線命令已編寫
✅ 後端 discordNotificationService 已實現
✅ signalMonitoringService 已集成 Discord 推送
✅ 去重機制（30 分鐘內不重複）
✅ 倉位管理功能完整

### 未運行
❌ Discord Bot 服務未啟動
❌ 斜線命令未部署到 Discord
❌ 用戶無法使用命令

---

## 🎯 立即啟動步驟

### 1. 部署命令
```bash
cd /root/AIFX_v2/discord_bot
node deploy-commands.js
```

### 2. 啟動 Bot
```bash
tmux new-session -d -s aifx-discord "cd /root/AIFX_v2/discord_bot && node bot.js"
```

### 3. 驗證運行
```bash
tmux attach -t aifx-discord  # Ctrl+B, D 退出
```

### 4. 測試命令
在 Discord 輸入：
```
/signal pair:EUR/USD
```

---

## 📚 相關文檔

- Discord Bot 詳細文檔: `/root/AIFX_v2/discord_bot/README.md`
- Discord 設置指南: `/root/AIFX_v2/DISCORD_SETUP.md`
- Backend 通知服務: `/root/AIFX_v2/backend/src/services/discordNotificationService.js`

---

**生成時間**: 2025-10-27
**狀態**: 已配置，等待啟動
