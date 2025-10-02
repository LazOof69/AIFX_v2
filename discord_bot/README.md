# AIFX_v2 Discord Bot

Discord bot for receiving trading signal notifications and managing subscriptions.

## Features

- **Real-time Notifications**: Receive trading signals directly in Discord DMs
- **Subscription Management**: Subscribe/unsubscribe to specific currency pairs
- **Signal Queries**: Get instant trading signals for any pair
- **User Preferences**: Customize notification settings
- **Rate Limiting**: Built-in rate limiting to prevent spam

## Commands

### `/subscribe`
Subscribe to trading signal notifications for a currency pair.

**Options:**
- `pair` (required): Currency pair (e.g., EUR/USD)
- `signal_type` (optional): Type of signals to receive
  - `All Signals` - Receive all signals (default)
  - `Buy Only` - Only buy signals
  - `Sell Only` - Only sell signals
  - `Strong Signals Only` - Only strong and very strong signals

**Example:**
```
/subscribe pair:EUR/USD signal_type:strong
```

### `/unsubscribe`
Unsubscribe from trading signal notifications.

**Options:**
- `pair` (optional): Currency pair to unsubscribe from (leave empty for all)

**Example:**
```
/unsubscribe pair:EUR/USD
/unsubscribe
```

### `/signal`
Get real-time trading signal for a currency pair.

**Options:**
- `pair` (required): Currency pair (e.g., EUR/USD)
- `timeframe` (optional): Timeframe for analysis
  - `15min`, `30min`, `1h` (default), `4h`, `1d`

**Example:**
```
/signal pair:EUR/USD timeframe:1h
```

### `/preferences`
Set your notification preferences.

**Options:**
- `risk_level` (optional): Risk level 1-10 (10 = highest risk)
- `trading_style` (optional): Preferred trading style
  - `Trend Following`
  - `Counter-Trend`
  - `Mixed`
- `min_confidence` (optional): Minimum confidence level (0.0-1.0)
- `strong_signals_only` (optional): Only receive strong signals (true/false)

**Example:**
```
/preferences risk_level:7 min_confidence:0.75 strong_signals_only:true
```

To view current preferences, use the command without any options:
```
/preferences
```

## Setup

### Prerequisites

1. Node.js >= 18.0.0
2. Discord Bot Token
3. Backend API running
4. Redis server running

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```env
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_guild_id_here  # Optional, for faster deployment

BACKEND_API_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
```

### Creating a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Go to "Bot" tab and click "Add Bot"
4. Copy the bot token to `.env` as `DISCORD_BOT_TOKEN`
5. Copy the Application ID to `.env` as `DISCORD_CLIENT_ID`
6. Enable these Privileged Gateway Intents:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent
7. Go to OAuth2 > URL Generator
8. Select scopes: `bot`, `applications.commands`
9. Select permissions:
   - Send Messages
   - Embed Links
   - Read Message History
10. Use the generated URL to invite the bot to your server

### Deploy Commands

Before running the bot, deploy the slash commands:

```bash
npm run deploy-commands
```

This will register all slash commands with Discord.

### Running the Bot

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Architecture

### Event Flow

1. **User subscribes** via `/subscribe` command
2. **Backend generates signal** when market conditions are met
3. **Backend publishes** signal to Redis channel
4. **Bot receives** signal from Redis pub/sub
5. **Bot filters** based on user preferences and rate limits
6. **Bot sends** DM notification to subscribed users

### Rate Limiting

- **Notifications**: Max 1 notification per user per minute
- **Commands**: Max 5 commands per user per minute

### Redis Pub/Sub

The bot uses Redis pub/sub to receive notifications from the backend:

- **Channel**: `trading-signals`
- **Message Format**:
```json
{
  "discordUserId": "123456789",
  "signal": { ... },
  "pair": "EUR/USD",
  "timeframe": "1h",
  "timestamp": "2025-01-15T10:30:00+08:00"
}
```

## Project Structure

```
discord_bot/
├── commands/
│   ├── subscribe.js       # Subscribe command
│   ├── unsubscribe.js     # Unsubscribe command
│   ├── signal.js          # Signal query command
│   └── preferences.js     # Preferences command
├── utils/
│   └── logger.js          # Winston logger
├── logs/                  # Log files
├── bot.js                 # Main bot file
├── deploy-commands.js     # Command deployment script
├── package.json
├── .env.example
└── README.md
```

## Notification Format

When a signal is generated, users receive a rich embed with:

- **Signal**: BUY/SELL/HOLD with strength indicators
- **Confidence**: Percentage confidence level
- **Entry Price**: Suggested entry point
- **Stop Loss**: Risk management level
- **Take Profit**: Target profit level
- **Market Condition**: Current market state
- **Technical Indicators**: SMA, RSI values
- **Risk Warning**: Always included

## Troubleshooting

### Commands not appearing in Discord

1. Make sure you ran `npm run deploy-commands`
2. Wait a few minutes for global commands to propagate
3. Use `DISCORD_GUILD_ID` in `.env` for instant testing in a specific server

### Bot not connecting

1. Check `DISCORD_BOT_TOKEN` is correct
2. Ensure bot has proper permissions
3. Check internet connection and firewall

### Notifications not working

1. Ensure Redis is running
2. Check `REDIS_URL` in `.env`
3. Verify backend is publishing to correct channel
4. Check bot logs for errors

### Rate limiting issues

- Users can only receive 1 notification per minute
- Adjust `RATE_LIMIT_MAX_NOTIFICATIONS_PER_MINUTE` in `.env`

## Integration with Backend

The backend should call the notification service when generating signals:

```javascript
const notificationService = require('./services/notificationService');

// After generating a signal
await notificationService.sendNotification(signal, pair, timeframe);
```

Or via HTTP API:

```bash
POST /api/v1/notifications/send
{
  "signal": { ... },
  "pair": "EUR/USD",
  "timeframe": "1h"
}
```

## Security

- Bot token should never be committed to git
- Use environment variables for all sensitive data
- Implement proper rate limiting
- Validate all user input
- Use ephemeral messages for sensitive commands

## Development

### Adding New Commands

1. Create new file in `commands/` directory
2. Export object with `data` and `execute` properties
3. Run `npm run deploy-commands` to register

### Logging

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console - Development mode only

## License

MIT License - See LICENSE file for details