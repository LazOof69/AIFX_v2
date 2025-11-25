# Discord Bot Testing Guide
**Date**: 2025-11-22
**Bot Name**: AIFX Signal Bot#3478
**Status**: ✅ RUNNING (PID: 951459)

---

## 📊 Current System Status

```
✅ Discord Bot:    ONLINE
                  Name: AIFX Signal Bot#3478
                  Server: 1 guild connected
                  Commands: 5 loaded
                  Backend: Connected (localhost:3000)
                  Redis: Connected (localhost:6379)

✅ Backend API:    HEALTHY (localhost:3000)
✅ ML Engine:      RUNNING (localhost:8000)
✅ PostgreSQL:     CONNECTED
✅ Redis:          CONNECTED
```

---

## 🤖 Available Commands (5)

### 1. `/signal` - Get Trading Signal
**Description**: Get real-time ML-powered trading signal for a currency pair

**Syntax**:
```
/signal [pair] [timeframe]
```

**Parameters**:
- `pair` (required): Currency pair (e.g., EUR/USD, GBP/USD, USD/JPY)
- `timeframe` (optional): Time frame (1m, 5m, 15m, 30m, 1h, 4h, 1d) - default: 1h

**Example Usage**:
```
/signal EUR/USD 4h
/signal GBP/USD 1h
/signal USD/JPY
```

**Expected Response**:
```
📊 Trading Signal: EUR/USD (4H)
━━━━━━━━━━━━━━━━━━━━━━

🎯 Signal: BUY
📈 Confidence: 75%

💰 Entry Price: 1.0850
🛡️ Stop Loss: 1.0820 (-30 pips)
🎯 Take Profit: 1.0910 (+60 pips)
📊 Risk/Reward: 1:2

📍 Technical Indicators:
  • RSI: 45 (Neutral)
  • SMA: Bullish
  • MACD: Buy Signal

⏰ Generated: 2025-11-22 13:45:00 UTC
```

---

### 2. `/subscribe` - Subscribe to Notifications
**Description**: Subscribe to real-time trading signal notifications

**Syntax**:
```
/subscribe [pair] [signal_type]
```

**Parameters**:
- `pair` (required): Currency pair to subscribe to
- `signal_type` (optional): Type of signal (all, buy, sell, high_confidence) - default: all

**Example Usage**:
```
/subscribe EUR/USD all
/subscribe GBP/USD buy
/subscribe USD/JPY high_confidence
```

**Expected Response**:
```
✅ Subscription Created

You will now receive notifications for:
📊 Pair: EUR/USD
🔔 Signal Type: All signals
📬 Channel: This channel

You'll be notified when new signals are generated.
```

---

### 3. `/unsubscribe` - Unsubscribe from Notifications
**Description**: Unsubscribe from trading signal notifications

**Syntax**:
```
/unsubscribe [pair]
```

**Parameters**:
- `pair` (optional): Currency pair to unsubscribe from. Leave empty to unsubscribe from all.

**Example Usage**:
```
/unsubscribe EUR/USD
/unsubscribe
```

**Expected Response**:
```
✅ Unsubscribed

You will no longer receive notifications for:
📊 Pair: EUR/USD

Use /subscribe to re-subscribe.
```

---

### 4. `/preferences` - Set User Preferences
**Description**: Configure your trading preferences and risk settings

**Syntax**:
```
/preferences
```

**Parameters**: None (interactive form)

**Example Usage**:
```
/preferences
```

**Expected Response**:
Interactive form with fields:
- **Risk Level**: 1-10 slider
- **Trading Style**: Dropdown (Scalping, Day Trading, Swing Trading, Position Trading)
- **Min Confidence**: Percentage slider (50%-95%)
- **Preferred Pairs**: Multi-select (EUR/USD, GBP/USD, USD/JPY, etc.)

**After Submission**:
```
✅ Preferences Updated

Your trading preferences:
🎯 Risk Level: 7/10
📊 Trading Style: Day Trading
💪 Min Confidence: 70%
💱 Preferred Pairs: EUR/USD, GBP/USD, USD/JPY

These settings will be used to filter signals and notifications.
```

---

### 5. `/position` - Position Management
**Description**: Manage your trading positions (open, view, close)

**Syntax**:
```
/position <action> [pair] [size] [entry_price]
```

**Sub-commands**:

#### `/position open` - Open New Position
```
/position open EUR/USD 1000 1.0850
```

**Parameters**:
- `pair`: Currency pair
- `size`: Position size (units)
- `entry_price`: Entry price

**Expected Response**:
```
✅ Position Opened

📊 Pair: EUR/USD
💰 Size: 1000 units
💵 Entry: 1.0850
📈 Current: 1.0855 (+5 pips)
💚 P/L: +$5.00 (+0.05%)

🛡️ Stop Loss: 1.0820
🎯 Take Profit: 1.0910

Position ID: #12345
```

#### `/position list` - View All Positions
```
/position list
```

**Expected Response**:
```
📊 Your Open Positions (3)
━━━━━━━━━━━━━━━━━━━━━━

1️⃣ EUR/USD
   💰 1000 units @ 1.0850
   📈 Current: 1.0855
   💚 P/L: +$5.00 (+0.05%)

2️⃣ GBP/USD
   💰 500 units @ 1.2650
   📉 Current: 1.2640
   ❌ P/L: -$5.00 (-0.08%)

3️⃣ USD/JPY
   💰 2000 units @ 149.50
   📈 Current: 149.75
   💚 P/L: +$25.00 (+0.17%)

━━━━━━━━━━━━━━━━━━━━━━
💰 Total P/L: +$25.00 (+0.14%)
```

#### `/position close` - Close Position
```
/position close EUR/USD
```

**Expected Response**:
```
✅ Position Closed

📊 Pair: EUR/USD
💰 Size: 1000 units
💵 Entry: 1.0850
💵 Exit: 1.0870
📊 Duration: 2h 34m

💚 Profit: +$20.00 (+0.18%)

The position has been closed and profit recorded.
```

---

## 🧪 Testing Checklist

### Pre-Test Verification
- [ ] Discord Bot is online (check with `ps aux | grep "node bot.js"`)
- [ ] Backend API is healthy (curl http://localhost:3000/api/v1/health)
- [ ] ML Engine is running (curl http://localhost:8000/health)
- [ ] Redis is connected (redis-cli ping)
- [ ] PostgreSQL is running (psql -U aifx_user -d aifx_v2 -c "SELECT 1")

### Test Sequence

#### Test 1: Signal Command ✅
```
1. Open Discord
2. Navigate to your server with AIFX Signal Bot
3. Type: /signal EUR/USD 4h
4. Press Enter
5. Wait for response (should be < 3 seconds)
6. Verify:
   - Signal direction (BUY/SELL/HOLD)
   - Confidence percentage
   - Entry price, SL, TP
   - Technical indicators
   - Timestamp
```

**Expected Result**: Rich embed with signal details

---

#### Test 2: Subscribe Command ✅
```
1. Type: /subscribe EUR/USD all
2. Press Enter
3. Verify response confirms subscription
4. Check database (optional):
   SELECT * FROM subscriptions WHERE user_id = YOUR_DISCORD_ID;
```

**Expected Result**: Confirmation message with subscription details

---

#### Test 3: Preferences Command ✅
```
1. Type: /preferences
2. Press Enter
3. Fill out interactive form:
   - Risk Level: 7
   - Trading Style: Day Trading
   - Min Confidence: 70%
   - Preferred Pairs: EUR/USD, GBP/USD
4. Submit
5. Verify confirmation
```

**Expected Result**: Preferences saved and confirmed

---

#### Test 4: Position Open ✅
```
1. Type: /position open EUR/USD 1000 1.0850
2. Press Enter
3. Verify:
   - Position ID assigned
   - Current price shown
   - P/L calculated
   - SL/TP displayed
```

**Expected Result**: Position created with details

---

#### Test 5: Position List ✅
```
1. Type: /position list
2. Press Enter
3. Verify:
   - All open positions shown
   - P/L calculated for each
   - Total P/L at bottom
```

**Expected Result**: List of all positions with P/L

---

#### Test 6: Position Close ✅
```
1. Type: /position close EUR/USD
2. Press Enter
3. Verify:
   - Position closed
   - Final P/L shown
   - Duration displayed
```

**Expected Result**: Position closed with profit/loss

---

#### Test 7: Unsubscribe Command ✅
```
1. Type: /unsubscribe EUR/USD
2. Press Enter
3. Verify confirmation
```

**Expected Result**: Unsubscribed from EUR/USD

---

#### Test 8: Real-time Notification (Advanced) 🔔
```
1. Subscribe to a pair: /subscribe EUR/USD high_confidence
2. Wait for ML engine to generate a new signal (or trigger manually)
3. Verify notification received in Discord channel
```

**Expected Result**: Automatic notification when signal generated

---

## 🐛 Troubleshooting

### Bot Not Responding

**Check 1: Is bot online?**
```bash
ps aux | grep "node bot.js"
```

**Check 2: Check logs**
```bash
tail -f /root/AIFX_v2/logs/discord-bot.log
```

**Check 3: Backend API**
```bash
curl http://localhost:3000/api/v1/health
```

**Fix: Restart bot**
```bash
cd /root/AIFX_v2/discord_bot
pkill -f "node bot.js"
node bot.js
```

---

### Commands Not Showing Up

**Issue**: Slash commands don't appear when typing `/`

**Fix: Re-deploy commands**
```bash
cd /root/AIFX_v2/discord_bot
node deploy-commands.js
```

**Wait**: Up to 1 hour for Discord to sync globally (instant in your guild)

---

### Backend API Errors

**Check Backend logs**:
```bash
tail -f /root/AIFX_v2/logs/backend.log
```

**Restart Backend**:
```bash
cd /root/AIFX_v2/backend
npm start
```

---

### Redis Connection Issues

**Check Redis**:
```bash
redis-cli ping
# Should return: PONG
```

**Restart Redis**:
```bash
sudo systemctl restart redis
```

---

## 📊 Performance Metrics

### Expected Response Times
- `/signal`: < 3 seconds (includes ML prediction)
- `/subscribe`: < 500ms
- `/unsubscribe`: < 500ms
- `/preferences`: < 1 second
- `/position open`: < 1 second
- `/position list`: < 1 second
- `/position close`: < 1 second

### Success Criteria
- ✅ All commands respond within expected time
- ✅ No error messages
- ✅ Rich embeds display correctly
- ✅ Data persists correctly
- ✅ Notifications arrive in real-time
- ✅ Backend API integration works

---

## 🔗 Discord Server Information

**Bot Name**: AIFX Signal Bot#3478
**Guild ID**: 1316785145042178149
**Signal Channel ID**: 1428593335966367885

**Invite Link**: Ask admin for invite link

---

## 📝 Test Result Template

```
### Test Session: [Date/Time]

**Tester**: [Your Name]
**Bot Version**: 1.0.0
**Environment**: Development

| Command | Status | Response Time | Notes |
|---------|--------|---------------|-------|
| /signal | ✅ | 2.3s | Working perfectly |
| /subscribe | ✅ | 450ms | Fast response |
| /unsubscribe | ✅ | 420ms | No issues |
| /preferences | ✅ | 850ms | Form works |
| /position open | ✅ | 920ms | Position created |
| /position list | ✅ | 780ms | All positions shown |
| /position close | ✅ | 890ms | Position closed |

**Overall Status**: ✅ All tests passing
**Issues Found**: None
**Recommendations**: Ready for production
```

---

## 🎯 Next Steps After Testing

1. **If All Tests Pass**:
   - Document any minor issues
   - Consider adding /dashboard, /market, /history commands (optional)
   - Plan production deployment

2. **If Issues Found**:
   - Document errors in detail
   - Check logs for root cause
   - Fix and re-test

3. **Production Readiness**:
   - Replace `DISCORD_BOT_API_KEY` with production key
   - Update `NODE_ENV=production`
   - Configure PM2 for auto-restart
   - Setup monitoring and alerts

---

**Ready to Test**: ✅ All systems running
**Documentation**: Complete
**Support**: Check logs at `/root/AIFX_v2/logs/discord-bot.log`
