# Discord Bot Troubleshooting Guide

## "Unknown Interaction" Error (Code 10062)

### Symptoms
- User invokes `/signal` command
- Bot shows as "thinking..." then fails
- Logs show: `Failed to defer interaction: Unknown interaction`
- Error code: 10062
- Interaction age is < 3 seconds (timing is NOT the issue)

### Root Cause
**Discord client cache contains stale command IDs.**

When commands are re-deployed, Discord generates new command IDs. However, user's Discord client may have cached the old command IDs. When user invokes a command, their client sends the old ID, which Discord API doesn't recognize.

### Quick Fix (User Side)

**User must completely restart Discord:**

#### Windows
1. **Quit Discord**: Right-click system tray icon → Quit Discord (or Alt+F4)
2. **Kill processes**: Open Task Manager (Ctrl+Shift+Esc)
   - End all "Discord" processes
3. **Optional - Clear cache**:
   - Press Win+R, type: `%AppData%\Discord\Cache`
   - Delete all files in Cache folder
4. **Restart Discord**
5. **Wait 30 seconds** for commands to sync
6. **Try `/signal` again**

#### macOS
1. **Quit Discord**: Discord → Quit Discord (or Cmd+Q)
2. **Kill processes**: Open Activity Monitor
   - Search "Discord"
   - Force Quit all Discord processes
3. **Optional - Clear cache**:
   - Open Finder → Go → Go to Folder
   - Type: `~/Library/Application Support/Discord/Cache`
   - Delete all files in Cache folder
4. **Restart Discord**
5. **Wait 30 seconds** for commands to sync
6. **Try `/signal` again**

#### Linux
```bash
# Kill Discord
pkill -9 discord

# Optional: Clear cache
rm -rf ~/.config/discord/Cache/*

# Restart Discord
discord &

# Wait 30 seconds, then try /signal
```

#### Mobile (iOS/Android)
1. **Force close Discord app**:
   - iOS: Swipe up from bottom, swipe Discord up
   - Android: Recent apps → Swipe Discord away
2. **Clear app cache** (Android only):
   - Settings → Apps → Discord → Storage → Clear Cache
3. **Restart Discord**
4. **Wait 30 seconds**
5. **Try `/signal` again**

---

## Advanced Troubleshooting

### Verify Command Registration

Check if commands are actually registered with Discord:

```bash
cd /root/AIFX_v2/discord_bot
node verify-commands.js
```

**Expected output**:
```
✅ Found 5 guild commands:
  Command: /signal
    ID: 1437452216213442571
```

**If no commands found**:
```bash
node deploy-commands.js
```

---

### Force Command Reset

If user restart doesn't work, force-reset all commands:

```bash
cd /root/AIFX_v2/discord_bot
node reset-commands.js
```

**This will**:
1. Delete all existing commands
2. Wait 5 seconds
3. Re-register commands with new IDs
4. Display new command IDs

**WARNING**: All users will need to restart Discord after this.

---

### Debug Mode

Run bot in debug mode to see detailed interaction logs:

```bash
cd /root/AIFX_v2/discord_bot

# Stop normal bot
pkill -f "node bot.js"

# Start debug bot
node debug-interaction.js
```

**Debug bot will log**:
- Interaction ID, command ID, guild ID
- Interaction token (first 20 chars)
- Timing (creation time, age, defer duration)
- State (repliable, replied, deferred)
- Detailed error information

**When user invokes `/signal`**, check logs for:
```
Command ID: <ID from user's client>
```

Compare this with registered command ID from `verify-commands.js`.

**If IDs don't match** → User has cached old commands → Restart required

---

## Other Common Issues

### Bot Not Responding at All

**Symptoms**: No "thinking..." indicator, no response

**Checks**:
1. Is bot online?
   ```bash
   pm2 status discord-bot
   ```

2. Check bot logs:
   ```bash
   tail -f /root/AIFX_v2/discord_bot/logs/combined.log
   ```

3. Verify bot token:
   ```bash
   cat /root/AIFX_v2/discord_bot/.env | grep DISCORD_BOT_TOKEN
   ```

4. Check bot permissions in Discord:
   - Server Settings → Roles → Bot Role
   - Must have: `Send Messages`, `Use Application Commands`

---

### "Application did not respond"

**Symptoms**: Bot shows "thinking..." for 15 seconds, then error

**Cause**: Bot is not deferring or replying within 3 seconds

**Checks**:
1. Check backend API connectivity:
   ```bash
   curl http://localhost:3000/api/v1/health
   ```

2. Check bot.js interaction handling:
   - Is defer being called?
   - Is backend timing out?

3. Check signal.js execution time:
   ```bash
   grep "Signal command error" /root/AIFX_v2/discord_bot/logs/combined.log
   ```

---

### Backend Service Unavailable

**Symptoms**: Bot responds but says "Backend service is unavailable"

**Checks**:
1. Is backend running?
   ```bash
   pm2 status backend
   curl http://localhost:3000/api/v1/health
   ```

2. Check backend logs:
   ```bash
   tail -f /root/AIFX_v2/backend/logs/combined.log
   ```

3. Verify `.env` configuration:
   ```bash
   cat /root/AIFX_v2/discord_bot/.env | grep BACKEND_API_URL
   ```
   Should be: `http://localhost:3000`

---

### ML Model Not Available

**Symptoms**: Bot responds but says "ML model not available"

**Checks**:
1. Is ML engine running?
   ```bash
   # Check if ML engine process is running
   ps aux | grep -i "ml\|python.*main.py"
   ```

2. Check ML engine endpoint:
   ```bash
   curl http://localhost:8000/health
   ```

3. Check backend ML integration:
   ```bash
   grep "ML" /root/AIFX_v2/backend/logs/combined.log
   ```

---

## Quick Reference

### Start Services
```bash
# Backend
cd /root/AIFX_v2/backend
pm2 start ecosystem.config.js

# Discord Bot
cd /root/AIFX_v2/discord_bot
pm2 start bot.js --name discord-bot

# Check status
pm2 status
```

### View Logs
```bash
# Discord bot logs
pm2 logs discord-bot

# Or view file directly
tail -f /root/AIFX_v2/discord_bot/logs/combined.log
```

### Restart Services
```bash
pm2 restart discord-bot
pm2 restart backend
```

### Deploy Commands
```bash
cd /root/AIFX_v2/discord_bot
node deploy-commands.js
```

### Verify Commands
```bash
cd /root/AIFX_v2/discord_bot
node verify-commands.js
```

### Reset Commands
```bash
cd /root/AIFX_v2/discord_bot
node reset-commands.js
```

### Debug Mode
```bash
cd /root/AIFX_v2/discord_bot
pkill -f "node bot.js"
node debug-interaction.js
```

---

## Contact & Support

**For developers**:
- See: `DISCORD_BUG_DIAGNOSIS.md` for technical deep-dive
- See: `bot.js` for interaction handling logic
- See: `commands/signal.js` for command implementation

**For users**:
- **First step**: Always restart Discord client completely
- **Second step**: Wait 30 seconds after restart
- **Third step**: Try command again
- **If still failing**: Contact bot administrator

---

**Last Updated**: 2025-11-10
**Version**: 1.0
**File**: `/root/AIFX_v2/discord_bot/TROUBLESHOOTING.md`
