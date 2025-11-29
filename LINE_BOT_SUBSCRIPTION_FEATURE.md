# LINE Bot 訂閱功能實作總結

## 📅 Implementation Date
2025-11-29

## ✅ 已完成的功能

### 1. **訂閱命令處理**

LINE Bot 現在支援以下訂閱功能：

#### 1️⃣ 訂閱貨幣對信號變化
```
訂閱 EUR/USD
訂閱 EUR/USD 1h
subscribe GBP/USD
subscribe GBP/USD 4h
```

#### 2️⃣ 取消訂閱
```
取消訂閱 EUR/USD
取消訂閱 EUR/USD 1h
unsubscribe GBP/USD
```

#### 3️⃣ 查看訂閱列表
```
我的訂閱
訂閱列表
subscriptions
```

### 2. **修改的文件**

#### `line_bot/handlers/messageHandler.js`
- 添加 `handleSubscribe()` 方法 - 處理訂閱命令
- 添加 `handleUnsubscribe()` 方法 - 處理取消訂閱命令
- 添加 `handleListSubscriptions()` 方法 - 顯示訂閱列表
- 添加 `mapPeriodToTimeframe()` 方法 - 將中文週期映射到時間框架
- 在 `handleText()` 中添加命令路由邏輯

#### `line_bot/services/backendClient.js`
- 添加 `getSubscriptions()` 方法 - 從後端獲取用戶訂閱列表

#### `line_bot/services/messageBuilder.js`
- 更新 `buildHelpMessage()` - 添加訂閱功能說明

### 3. **功能特點**

✅ **支援中英文命令**
- 中文：訂閱、取消訂閱、我的訂閱
- 英文：subscribe, unsubscribe, subscriptions

✅ **支援交易週期**
- 日內 → 15min
- 周內 → 1h
- 月內 → 1d
- 季內 → 1w

✅ **支援直接時間框架**
- 15min, 1h, 4h, 1d

✅ **完整錯誤處理**
- 格式錯誤提示
- 重複訂閱檢測
- 未訂閱檢測
- 網絡錯誤處理

✅ **自動通知機制**
- 後端監控服務每 15 分鐘檢查信號變化
- 信號改變時透過 Redis Pub/Sub 通知
- LINE Bot 接收通知並推送給訂閱用戶
- 30 分鐘冷卻期防止過度通知

## 🔄 運作流程

```
用戶輸入「訂閱 EUR/USD」
    ↓
LINE Bot messageHandler.handleSubscribe()
    ↓
backendClient.subscribe() → Backend API
    ↓
儲存到 UserSubscription 資料庫表
    ↓
後端監控服務 (每 15 分鐘)
    ↓
檢測信號變化
    ↓
發布 Redis 'signal-change' 事件
    ↓
LINE Bot 接收事件
    ↓
bot.js handleSignalChangeNotification()
    ↓
推送通知給所有訂閱用戶
```

## 📋 使用範例

### 訂閱信號變化
```
用戶輸入：訂閱 EUR/USD

LINE Bot 回應：
✅ 訂閱成功！

📊 貨幣對：EUR/USD
⏰ 時間框架：1h

當信號變化時，我會主動通知您！
輸入「我的訂閱」查看所有訂閱
```

### 查看訂閱列表
```
用戶輸入：我的訂閱

LINE Bot 回應：
📋 您的訂閱列表

1. EUR/USD (1h)
2. GBP/USD (4h)
3. USD/JPY (1d)

共 3 個訂閱

使用「取消訂閱 EUR/USD」來取消訂閱
```

### 接收信號變化通知
```
LINE Bot 主動推送：
🟢 信號變化通知

📊 貨幣對: EUR/USD
⏰ 時間框架: 1h

📈 信號變化: STANDBY → LONG
💪 信心度: 78%
📊 強度: STRONG
📉 市場狀況: TRENDING
💰 入場價格: 1.09245

⚠️ 這是自動通知，請謹慎交易！
```

### 取消訂閱
```
用戶輸入：取消訂閱 EUR/USD

LINE Bot 回應：
✅ 已取消訂閱

📊 貨幣對：EUR/USD
⏰ 時間框架：1h

您將不再收到此貨幣對的信號變化通知
```

## 🔧 技術細節

### 後端 API 端點

LINE Bot 使用以下 Backend API 端點：

1. **訂閱**
```http
POST /api/v1/notifications/subscribe
Body: {
  "lineUserId": "U1234567890",
  "pair": "EUR/USD",
  "timeframe": "1h"
}
```

2. **取消訂閱**
```http
POST /api/v1/notifications/unsubscribe
Body: {
  "lineUserId": "U1234567890",
  "pair": "EUR/USD",
  "timeframe": "1h"
}
```

3. **獲取訂閱列表**
```http
GET /api/v1/notifications/subscriptions/{lineUserId}
```

### Redis Pub/Sub

LINE Bot 訂閱 Redis channel: `signal-change`

事件格式：
```json
{
  "pair": "EUR/USD",
  "timeframe": "1h",
  "oldSignal": "standby",
  "newSignal": "long",
  "oldConfidence": 0.65,
  "newConfidence": 0.78,
  "signalStrength": "strong",
  "marketCondition": "trending",
  "entryPrice": 1.09245,
  "subscribers": [
    { "id": "U1234567890", "username": "張三" }
  ]
}
```

## 🚀 啟動 LINE Bot

### 前置條件

確保已設定環境變數：
```bash
LINE_CHANNEL_ACCESS_TOKEN=<your_line_channel_access_token>
LINE_CHANNEL_SECRET=<your_line_channel_secret>
BACKEND_API_URL=http://localhost:3000
LINE_BOT_API_KEY=<your_api_key>
REDIS_URL=redis://localhost:6379
REDIS_DB=2
PORT=3001
```

### 啟動方式

#### 選項 1: 直接啟動
```bash
cd /root/AIFX_v2/line_bot
node bot.js
```

#### 選項 2: 使用 PM2
```bash
cd /root/AIFX_v2/line_bot
pm2 start bot.js --name line-bot
pm2 save
```

#### 選項 3: 背景執行
```bash
cd /root/AIFX_v2/line_bot
nohup node bot.js > /tmp/line-bot.log 2>&1 &
```

### 驗證啟動成功

檢查健康狀態：
```bash
curl http://localhost:3001/health
```

應返回：
```json
{
  "status": "healthy",
  "service": "line-bot",
  "version": "1.0.0",
  "uptime": 123.456,
  "timestamp": "2025-11-29T10:30:00.000Z"
}
```

## 📊 功能對比

| 功能 | Discord Bot | LINE Bot |
|------|------------|----------|
| 查詢交易信號 | ✅ `/signal` | ✅ `EUR/USD` |
| 訂閱信號變化 | ✅ `/subscribe` | ✅ `訂閱 EUR/USD` |
| 取消訂閱 | ✅ `/unsubscribe` | ✅ `取消訂閱 EUR/USD` |
| 查看訂閱列表 | ✅ `/subscriptions` | ✅ `我的訂閱` |
| 接收自動通知 | ✅ | ✅ |
| 支援 STANDBY 信號 | ✅ | ✅ |

## 🎯 新功能總結

**之前（Before）：**
- ❌ LINE Bot 無法訂閱貨幣對
- ❌ 無法查看訂閱列表
- ❌ 用戶只能主動查詢信號
- ✅ 可以接收通知（但無法訂閱）

**現在（After）：**
- ✅ 支援完整的訂閱/取消訂閱功能
- ✅ 可以查看所有訂閱
- ✅ 自動接收信號變化通知
- ✅ 支援中英文命令
- ✅ 完整的錯誤處理和用戶提示
- ✅ 與 Discord Bot 功能對等

## 🧪 測試清單

部署後請測試以下功能：

- [ ] 輸入「幫助」查看新的幫助訊息
- [ ] 訂閱一個貨幣對：`訂閱 EUR/USD`
- [ ] 查看訂閱列表：`我的訂閱`
- [ ] 訂閱時指定時間框架：`訂閱 GBP/USD 4h`
- [ ] 嘗試重複訂閱（應該提示已訂閱）
- [ ] 取消訂閱：`取消訂閱 EUR/USD`
- [ ] 取消未訂閱的貨幣對（應該提示未訂閱）
- [ ] 等待信號變化並驗證收到通知
- [ ] 測試英文命令：`subscribe USD/JPY`

## 📝 注意事項

1. **LINE Bot 需要先部署到公開 URL** 才能接收 Webhook
   - 需要設定 LINE Channel Webhook URL
   - 例如：`https://yourdomain.com/webhook`

2. **確保後端監控服務正在運行**
   - Backend 的 `signalMonitoringService` 必須啟動
   - 每 15 分鐘自動檢查信號變化

3. **Redis 必須運行**
   - LINE Bot 需要連接 Redis 接收 pub/sub 事件
   - 預設使用 database 2

4. **環境變數必須正確設定**
   - LINE_CHANNEL_ACCESS_TOKEN
   - LINE_CHANNEL_SECRET
   - BACKEND_API_URL

## ✅ 驗證狀態

- ✅ 代碼實作完成
- ✅ 後端 API 支援已存在
- ✅ Redis Pub/Sub 機制已就緒
- ✅ 信號監控服務已實作
- ✅ 支援 STANDBY 信號（已更新 ML Engine）
- ⏳ 待部署測試（需要 LINE Channel 配置）

---

**Implementation Date**: 2025-11-29
**Status**: ✅ Ready for Deployment
**Next Step**: Configure LINE Channel and deploy to production
