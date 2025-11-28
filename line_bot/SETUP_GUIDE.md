# LINE Bot 快速設置指南

## 📋 設置步驟（5-10分鐘）

### 步驟 1: 創建 LINE Bot Channel

1. **訪問 LINE Developers Console**
   - 網址: https://developers.line.biz/console/
   - 使用您的 LINE 帳號登入

2. **創建 Provider**（如果還沒有）
   - 點擊 "Create a new provider"
   - Provider name: `AIFX Trading` （或任何您喜歡的名稱）

3. **創建 Messaging API Channel**
   - 點擊您的 Provider
   - 點擊 "Create a Messaging API channel"
   - 填寫信息：
     ```
     Channel type: Messaging API
     Provider: (選擇您剛創建的)
     Channel name: AIFX v2 Trading Bot
     Channel description: AI-powered forex trading signals
     Category: Finance
     Subcategory: Investment/Trading
     Email address: your-email@example.com
     ```
   - 閱讀並同意條款
   - 點擊 "Create"

4. **獲取 Channel Secret 和 Access Token**

   **在 "Basic settings" 頁面:**
   - 找到 "Channel secret"
   - 點擊 "show" 並複製（稍後會用到）

   **在 "Messaging API" 頁面:**
   - 找到 "Channel access token"
   - 點擊 "Issue" 按鈕
   - 複製生成的 token（稍後會用到）

5. **重要設定（避免重複消息）**

   在 "Messaging API" 頁面:
   - 找到 "LINE Official Account features"
   - 點擊 "Auto-reply messages" 旁的 "Edit"
   - **關閉** "Auto-reply messages" 開關
   - **關閉** "Greeting messages" 開關
   - 保存設定

---

### 步驟 2: 配置環境變量

編輯 `.env` 文件:

```bash
nano /root/AIFX_v2/line_bot/.env
```

更新以下內容（用步驟1獲取的值）:

```env
# ✅ 從 LINE Console 獲取
LINE_CHANNEL_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiJ9...（您的 access token）
LINE_CHANNEL_SECRET=1a2b3c4d5e6f7g8h9i0j...（您的 channel secret）

# ✅ Backend API（確保與 backend/.env 一致）
BACKEND_API_URL=http://localhost:3000
LINE_BOT_API_KEY=your_backend_api_key_here

# ✅ Redis（保持默認值）
REDIS_URL=redis://localhost:6379
REDIS_DB=2

# ✅ Server（保持默認值）
PORT=3001
NODE_ENV=development
```

保存文件 (Ctrl+X, Y, Enter)

---

### 步驟 3: 安裝 ngrok（開發用）

ngrok 將本地服務器暴露給 LINE（僅開發環境需要）

```bash
# 下載 ngrok
cd ~
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz

# 解壓
tar xvzf ngrok-v3-stable-linux-arm64.tgz

# 移動到系統路徑
sudo mv ngrok /usr/local/bin/

# 驗證安裝
ngrok version
```

---

### 步驟 4: 啟動 LINE Bot

**終端 1 - 啟動 Bot:**

```bash
cd /root/AIFX_v2/line_bot
npm start
```

您應該看到:

```
✅ LINE Bot server listening on port 3001
📊 Webhook URL: http://localhost:3001/webhook
✅ Redis connected successfully
```

**終端 2 - 啟動 ngrok:**

```bash
ngrok http 3001
```

您會看到類似:

```
Forwarding  https://a1b2-c3d4-e5f6.ngrok.io -> http://localhost:3001
                                           ^^^^^^^^^^^^^^^^^^^^^
                                           複製這個 HTTPS URL
```

**複製 HTTPS URL**（例如: `https://a1b2-c3d4-e5f6.ngrok.io`）

---

### 步驟 5: 設置 Webhook URL

1. 回到 LINE Developers Console
2. 選擇您的 Channel
3. 進入 "Messaging API" 頁面
4. 找到 "Webhook settings"
5. 在 "Webhook URL" 欄位輸入:
   ```
   https://YOUR-NGROK-URL/webhook
   ```
   例如: `https://a1b2-c3d4-e5f6.ngrok.io/webhook`

6. 點擊 "Update"
7. 點擊 "Verify" 測試連接（應該顯示 Success）
8. **啟用** "Use webhook" 開關

---

### 步驟 6: 測試 Bot

1. **掃描 QR Code**
   - 在 LINE Console 的 "Messaging API" 頁面
   - 找到 "Bot information" 區域
   - 使用手機 LINE 掃描 QR code

2. **加為好友**
   - 掃描後點擊 "加入好友"
   - Bot 會發送歡迎訊息

3. **測試查詢信號**
   - 發送: `EUR/USD`
   - 應該收到交易信號的 Flex Message

4. **測試其他功能**
   ```
   EUR/USD 周內
   GBP/USD 日內
   幫助
   ```

---

## ✅ 驗證清單

- [ ] LINE Bot Channel 已創建
- [ ] Channel Secret 和 Access Token 已獲取
- [ ] .env 文件已配置
- [ ] Auto-reply 和 Greeting 已關閉
- [ ] ngrok 已安裝並運行
- [ ] LINE Bot 服務已啟動（port 3001）
- [ ] Webhook URL 已設置並驗證成功
- [ ] 已掃描 QR Code 加為好友
- [ ] 已測試查詢信號功能

---

## 🔧 常見問題

### Q: Bot 沒有回應？

**檢查清單:**

```bash
# 1. Bot 是否運行？
curl http://localhost:3001/health

# 2. ngrok 是否運行？
curl https://YOUR-NGROK-URL/webhook

# 3. 查看 Bot 日誌
tail -f /root/AIFX_v2/line_bot/logs/combined.log

# 4. 查看 Backend 日誌
tail -f /root/AIFX_v2/backend/logs/combined.log
```

### Q: Webhook 驗證失敗？

**解決方法:**

1. 確認 Bot 正在運行（port 3001）
2. 確認 ngrok 正在運行
3. 確認 Webhook URL 格式正確: `https://xxx.ngrok.io/webhook`
4. 確認 .env 中的 `LINE_CHANNEL_SECRET` 正確

### Q: 收到重複消息？

**解決方法:**

1. 進入 LINE Console > Messaging API
2. 關閉 "Auto-reply messages"
3. 關閉 "Greeting messages"

### Q: Backend API 錯誤？

**檢查:**

```bash
# Backend 是否運行？
curl http://localhost:3000/health

# Backend API key 是否正確？
cat /root/AIFX_v2/line_bot/.env | grep LINE_BOT_API_KEY
cat /root/AIFX_v2/backend/.env | grep LINE_BOT_API_KEY
# 兩者應該相同
```

---

## 📱 使用示例

**查詢交易信號:**
- `EUR/USD` - 使用默認週期（周內）
- `EUR/USD 日內` - 指定日內交易
- `GBP/USD 周內` - 指定周內交易
- `USD/JPY 月內` - 指定月內交易

**獲取幫助:**
- `幫助`
- `help`
- `說明`

---

## 🚀 生產環境部署

### 使用 PM2（推薦）

```bash
# 安裝 PM2
npm install -g pm2

# 啟動 Bot
cd /root/AIFX_v2/line_bot
pm2 start ecosystem.config.js

# 設置開機啟動
pm2 startup
pm2 save

# 查看日誌
pm2 logs line-bot

# 重啟
pm2 restart line-bot
```

### 生產環境 Webhook

**生產環境不能用 ngrok（會過期）**

需要:
1. 有固定公網 IP 或域名的服務器
2. 配置 SSL 證書（Let's Encrypt）
3. 使用 Nginx/Apache 反向代理

示例 Nginx 配置:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location /line-webhook {
        proxy_pass http://localhost:3001/webhook;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

然後在 LINE Console 設置:
```
https://your-domain.com/line-webhook
```

---

## 📞 需要幫助？

1. 查看主要 README: `/root/AIFX_v2/line_bot/README.md`
2. 查看日誌文件: `/root/AIFX_v2/line_bot/logs/`
3. 檢查 Backend 狀態: `curl http://localhost:3000/health`
4. 檢查 Bot 狀態: `curl http://localhost:3001/health`

---

## 🎉 完成！

如果所有步驟都成功，您現在應該:
- ✅ 能夠在 LINE 上與 Bot 對話
- ✅ 能夠查詢交易信號（EUR/USD, GBP/USD 等）
- ✅ 能夠看到美觀的 Flex Message 顯示
- ✅ Bot 已集成 Redis 通知功能

下一步可以:
- 實現 Rich Menu（快捷按鈕）
- 添加用戶偏好設定
- 實現訂閱管理
- 添加更多貨幣對
