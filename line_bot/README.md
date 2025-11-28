# AIFX v2 LINE Bot

LINE Bot for AIFX_v2 trading signals and notifications.

## 🎯 Features

- ✅ Trading signal queries via text messages
- ✅ Real-time market sentiment analysis
- ✅ Technical indicators display
- ✅ Trading period recommendations (日內/周內/月內/季內)
- ✅ Push notifications for signal changes
- ✅ Beautiful Flex Message UI
- ✅ Redis pub/sub integration

## 🏗️ Architecture

This LINE Bot follows **microservices architecture**:

- ✅ Does NOT access database directly
- ✅ Uses Backend API for all data operations
- ✅ Communicates via REST APIs only
- ✅ Independent service with its own lifecycle

```
LINE User ──► LINE Bot ──REST API──► Backend ──► PostgreSQL
                 │                        │
                 └────Redis Pub/Sub───────┘
```

## 📋 Prerequisites

1. **LINE Messaging API Channel**
   - Channel Access Token
   - Channel Secret

2. **Backend API** (AIFX_v2 Backend must be running)
   - URL: `http://localhost:3000` (or your backend URL)

3. **Redis** (for notifications)
   - URL: `redis://localhost:6379`

4. **Node.js** >= 18.0.0

5. **ngrok** (for development webhook)
   - Used to expose local server to LINE

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd /root/AIFX_v2/line_bot
npm install
```

### 2. Create LINE Bot Channel

**Step-by-step guide:**

1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Login with your LINE account
3. Create a new Provider (or use existing)
4. Create a new Messaging API channel:
   - Channel name: `AIFX v2 Trading Bot`
   - Channel description: `AI-powered forex trading signals`
   - Category: Finance
   - Subcategory: Investment/Trading
5. After creation, go to **Messaging API** tab:
   - Copy **Channel secret** (you'll need this)
   - Issue **Channel access token** (long-lived) and copy it

### 3. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Update the following:

```env
# LINE Bot Configuration (from step 2)
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LINE_CHANNEL_SECRET=your_channel_secret_here

# Backend API
BACKEND_API_URL=http://localhost:3000
LINE_BOT_API_KEY=your_backend_api_key_here

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_DB=2

# Server Configuration
PORT=3001
NODE_ENV=development
```

### 4. Setup ngrok (for development)

Install ngrok:

```bash
# Download ngrok
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz
tar xvzf ngrok-v3-stable-linux-arm64.tgz
sudo mv ngrok /usr/local/bin/
```

Start ngrok tunnel:

```bash
ngrok http 3001
```

You'll see output like:

```
Forwarding  https://1234-56-78-90-12.ngrok.io -> http://localhost:3001
```

Copy the HTTPS URL (e.g., `https://1234-56-78-90-12.ngrok.io`)

### 5. Set Webhook URL in LINE Console

1. Go back to [LINE Developers Console](https://developers.line.biz/console/)
2. Select your channel
3. Go to **Messaging API** tab
4. Find **Webhook URL** field
5. Enter: `https://YOUR-NGROK-URL/webhook`
   - Example: `https://1234-56-78-90-12.ngrok.io/webhook`
6. Click **Update**
7. Click **Verify** to test the connection
8. Enable **Use webhook** toggle

### 6. Disable Auto-reply (Important!)

In LINE Console:
1. Go to **Messaging API** tab
2. Find **LINE Official Account features**
3. Click **Edit** next to **Auto-reply messages**
4. **Disable** auto-reply
5. **Disable** greeting message (or the bot will send duplicate messages)

### 7. Start the Bot

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

You should see:

```
✅ LINE Bot server listening on port 3001
📊 Webhook URL: http://localhost:3001/webhook
🏥 Health check: http://localhost:3001/health
✅ Redis connected successfully
✅ Subscribed to trading-signals channel
✅ Subscribed to signal-change channel
```

### 8. Test the Bot

1. Open LINE app on your phone
2. Scan the QR code from LINE Console (Messaging API tab)
3. Add the bot as a friend
4. Send a message: `EUR/USD`
5. You should receive a trading signal!

## 📱 Usage Examples

**Query trading signals:**

```
EUR/USD
EUR/USD 周內
GBP/USD 日內
USD/JPY
```

**Get help:**

```
幫助
help
說明
```

## 🔧 Troubleshooting

### Bot not responding?

1. Check if bot is running:
   ```bash
   curl http://localhost:3001/health
   ```

2. Check ngrok tunnel:
   ```bash
   curl https://YOUR-NGROK-URL/webhook
   ```

3. Check logs:
   ```bash
   tail -f logs/combined.log
   ```

4. Verify webhook in LINE Console (should show green checkmark)

### Webhook verification fails?

- Make sure bot is running on port 3001
- Make sure ngrok is forwarding to port 3001
- Check that .env has correct LINE_CHANNEL_SECRET

### Redis connection errors?

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Check Redis database
redis-cli -n 2 PING
```

### Backend API errors?

```bash
# Check if backend is running
curl http://localhost:3000/health

# Check if backend API key is correct
echo $LINE_BOT_API_KEY
```

## 📊 Supported Currency Pairs

- EUR/USD (歐元/美元)
- GBP/USD (英鎊/美元)
- USD/JPY (美元/日元)
- USD/CHF (美元/瑞郎)
- AUD/USD (澳元/美元)
- EUR/GBP (歐元/英鎊)
- EUR/JPY (歐元/日元)

## ⏰ Trading Periods

- **日內** (Day Trading) - 15min-1h timeframes
- **周內** (Swing Trading) - 4h timeframe ⭐ Recommended for beginners
- **月內** (Trend Following) - 1d timeframe
- **季內** (Position Trading) - 1w timeframe

## 🚀 Production Deployment

### Using PM2

```bash
npm install -g pm2

# Start bot with PM2
pm2 start ecosystem.config.js

# View logs
pm2 logs line-bot

# Restart
pm2 restart line-bot

# Stop
pm2 stop line-bot
```

### Using systemd

Create `/etc/systemd/system/aifx-line-bot.service`:

```ini
[Unit]
Description=AIFX v2 LINE Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/AIFX_v2/line_bot
ExecStart=/usr/bin/node bot.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable aifx-line-bot
sudo systemctl start aifx-line-bot
sudo systemctl status aifx-line-bot
```

## 📁 Project Structure

```
line_bot/
├── bot.js                  # Main server
├── handlers/
│   └── messageHandler.js   # Message handling logic
├── services/
│   ├── backendClient.js    # Backend API client
│   └── messageBuilder.js   # Flex Message builder
├── utils/
│   └── logger.js           # Winston logger
├── config/
├── logs/
│   ├── combined.log
│   └── error.log
├── package.json
├── .env
└── README.md
```

## 🔐 Security

- Never commit `.env` file
- Use strong API keys
- Enable HTTPS for production webhook
- Validate LINE signatures on webhook requests
- Rate limit user requests if needed

## 📝 Logs

Logs are stored in `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only

View real-time logs:

```bash
tail -f logs/combined.log
```

## 🆘 Support

If you encounter issues:

1. Check logs: `tail -f logs/combined.log`
2. Check backend health: `curl http://localhost:3000/health`
3. Check bot health: `curl http://localhost:3001/health`
4. Verify LINE webhook configuration
5. Check ngrok tunnel status

## 📚 Resources

- [LINE Messaging API Documentation](https://developers.line.biz/en/docs/messaging-api/)
- [Flex Message Simulator](https://developers.line.biz/flex-simulator/)
- [ngrok Documentation](https://ngrok.com/docs)

## 🔄 Next Steps

- [ ] Implement Rich Menu
- [ ] Add user preferences management
- [ ] Implement LIFF for advanced UI
- [ ] Add subscription management
- [ ] Add analytics and usage tracking
