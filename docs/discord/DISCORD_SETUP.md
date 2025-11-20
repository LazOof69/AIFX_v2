# Discord Notification Setup Guide

## 📋 Overview

The AIFX v2 system includes automated Discord notifications for trading signal alerts. When the Signal Monitoring Service detects a reversal signal, it automatically sends a formatted message to your Discord channel.

## 🎯 Features

- **Rich Embed Messages**: Beautiful, color-coded notifications with all signal details
- **Real-time Alerts**: Instant notifications when reversal signals are detected
- **Message Deduplication**: Prevents spam by not sending duplicate signals within 30 minutes
- **Multi-channel Support**: Can send to multiple Discord channels simultaneously
- **Error Resilience**: Monitoring continues even if Discord fails

## 🚀 Setup Instructions

### Step 1: Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Give it a name (e.g., "AIFX Signal Bot")
4. Go to the **Bot** section
5. Click **Add Bot**
6. Copy the **Bot Token** (you'll need this)

### Step 2: Configure Bot Permissions

In the Discord Developer Portal, under **Bot**:

1. Enable these **Privileged Gateway Intents**:
   - ❌ Presence Intent (not needed)
   - ❌ Server Members Intent (not needed)
   - ❌ Message Content Intent (not needed)

2. Under **Bot Permissions**, enable:
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Read Message History

### Step 3: Invite Bot to Your Server

1. In Discord Developer Portal, go to **OAuth2** → **URL Generator**
2. Select scopes:
   - ✅ `bot`
3. Select permissions:
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Read Message History
4. Copy the generated URL
5. Open it in your browser and select your Discord server
6. Authorize the bot

### Step 4: Get Your Channel ID

1. In Discord, enable **Developer Mode**:
   - User Settings → Advanced → Developer Mode (toggle on)
2. Right-click on the channel where you want signals
3. Click **Copy ID**
4. This is your `DISCORD_SIGNAL_CHANNEL_ID`

### Step 5: Configure Environment Variables

Edit `/root/AIFX_v2/backend/.env`:

```env
# Discord Bot
DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN_HERE_FROM_STEP_1
DISCORD_SIGNAL_CHANNEL_ID=YOUR_CHANNEL_ID_HERE_FROM_STEP_4
```

Replace with your actual values:
- `DISCORD_BOT_TOKEN`: The token from Step 1
- `DISCORD_SIGNAL_CHANNEL_ID`: The channel ID from Step 4

## 🧪 Testing

### Test 1: Discord Connection Only

```bash
cd /root/AIFX_v2/backend
node scripts/test-discord-notification.js
```

This will:
- ✅ Connect to Discord
- ✅ Send a test message
- ✅ Send mock LONG and SHORT signals
- ✅ Test deduplication
- ✅ Display statistics

### Test 2: End-to-End with Real Signals

```bash
cd /root/AIFX_v2/backend
node scripts/test-signal-with-discord.js
```

This will:
- ✅ Check for real reversal signals from ML Engine
- ✅ Send Discord notifications for detected signals
- ✅ Create a mock signal if none detected (for testing)

### Test 3: Full Signal Monitoring Service

```bash
cd /root/AIFX_v2/backend
node scripts/test-signal-monitoring.js
```

This tests the complete service including Discord integration.

## 📊 Message Format

### Long Signal Example

![Long Signal](https://via.placeholder.com/400x300/00FF00/FFFFFF?text=LONG+Signal)

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

### Short Signal Example

![Short Signal](https://via.placeholder.com/400x300/FF0000/FFFFFF?text=SHORT+Signal)

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

## 🔧 Service Integration

The Discord notification service is automatically integrated with the Signal Monitoring Service:

```javascript
// In signalMonitoringService.js
const discordNotificationService = require('./discordNotificationService');

// Discord initializes when monitoring service starts
await signalMonitoringService.start();

// Notifications sent automatically when signals detected
// No manual action required
```

## 📈 Monitoring Configuration

Current settings in `signalMonitoringService.js`:

```javascript
const MONITORING_CONFIG = {
  pairs: ['EUR/USD', 'USD/JPY'],
  timeframes: ['1h', '15min']
};

// Runs every 15 minutes
// 4 checks per run (2 pairs × 2 timeframes)
```

## 🛠️ Troubleshooting

### Error: "DISCORD_BOT_TOKEN not configured"

**Solution**: Check that your `.env` file has the correct token:
```bash
grep DISCORD_BOT_TOKEN /root/AIFX_v2/backend/.env
```

### Error: "Channel not found"

**Solution**:
1. Verify the bot was invited to your server
2. Check the channel ID is correct
3. Ensure the bot has access to the channel

### Error: "Missing Permissions"

**Solution**:
1. Check bot permissions in Discord server settings
2. Verify bot role has "Send Messages" and "Embed Links" permissions
3. Make sure the channel isn't private or restricted

### Error: "Discord connection timeout"

**Solution**:
1. Check internet connectivity
2. Verify bot token is valid and not expired
3. Ensure Discord API is accessible (not blocked by firewall)

## 🔒 Security Best Practices

1. **Never commit the bot token** to Git
2. **Restrict bot permissions** to only what's needed
3. **Use environment variables** for all sensitive data
4. **Rotate bot token** periodically
5. **Monitor bot usage** for suspicious activity

## 📝 Advanced Features

### Multiple Channel Support

To send notifications to multiple channels:

```javascript
const channelIds = [
  '1234567890123456789', // Main alerts channel
  '9876543210987654321'  // Admin channel
];

const results = await discordNotificationService.sendToMultipleChannels(
  signal,
  channelIds
);
```

### Custom Channel per Signal

```javascript
// Send to different channels based on pair
const channelId = signal.pair === 'EUR/USD'
  ? process.env.EURUSD_CHANNEL_ID
  : process.env.DEFAULT_CHANNEL_ID;

await discordNotificationService.sendSignalNotification(signal, channelId);
```

### Message Customization

Edit `/backend/src/services/discordNotificationService.js`:

```javascript
formatSignalEmbed(signal) {
  // Customize colors, emojis, fields, footer, etc.
  const embed = new EmbedBuilder()
    .setTitle('Your Custom Title')
    .setColor(yourCustomColor)
    // ... add your customizations
}
```

## 🎯 Next Steps

After successful setup:

1. ✅ Test Discord notifications work correctly
2. ✅ Run the signal monitoring service
3. ✅ Configure additional currency pairs if needed
4. ✅ Set up database persistence for signals
5. ✅ Implement user subscription management

## 📚 API Reference

### DiscordNotificationService

#### `initialize()`
Connects to Discord and initializes the bot.

```javascript
await discordNotificationService.initialize();
```

#### `sendSignalNotification(signal, channelId?)`
Sends a signal notification to Discord.

```javascript
const result = await discordNotificationService.sendSignalNotification({
  pair: 'EUR/USD',
  timeframe: '1h',
  signal: 'long',
  confidence: 0.75,
  stage1_prob: 0.76,
  stage2_prob: 0.74,
  model_version: 'v3.1',
  detected_at: new Date()
});
```

#### `sendTestMessage(channelId?)`
Sends a test message to verify connection.

```javascript
await discordNotificationService.sendTestMessage();
```

#### `getStatus()`
Returns service status and statistics.

```javascript
const status = discordNotificationService.getStatus();
console.log(status);
// {
//   isReady: true,
//   connected: 'BotName#1234',
//   defaultChannel: '1234567890123456789',
//   stats: { totalSent: 5, failures: 0, deduplicated: 1 }
// }
```

#### `disconnect()`
Disconnects from Discord.

```javascript
await discordNotificationService.disconnect();
```

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the test script output for error messages
3. Check Discord API status: https://discordstatus.com/
4. Review Discord.js documentation: https://discord.js.org/

---

**Generated**: 2025-10-17
**Version**: 1.0
**Part of**: AIFX v2 Trading Signal System
