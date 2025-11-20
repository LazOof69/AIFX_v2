# Discord Bot Issue - Action Checklist

**Issue**: "Unknown interaction" error when using `/signal` command
**Root Cause**: Discord client cache has stale command IDs
**Solution**: User must restart Discord client

---

## User Instructions (Send to User)

Hi! Your `/signal` command issue is caused by Discord client cache. Here's how to fix it:

### Quick Fix (2 minutes)

**Step 1: Completely quit Discord**
- Windows: Right-click Discord in system tray → Quit Discord
- Mac: Discord menu → Quit Discord (or press Cmd+Q)
- Linux: Run `pkill discord` in terminal
- **Important**: Don't just close the window - fully quit the app!

**Step 2: Make sure Discord is completely closed**
- Windows: Open Task Manager → End any remaining Discord processes
- Mac: Open Activity Monitor → Force Quit any Discord processes
- Linux: Run `pkill -9 discord` to be sure

**Step 3: Restart Discord**
- Launch Discord normally
- Log in if needed

**Step 4: Wait 30 seconds**
- This allows Discord to sync with the server
- Commands need time to refresh

**Step 5: Try `/signal` again**
- Type `/signal` in the Discord channel
- Add currency pair (e.g., EUR/USD)
- It should work now!

---

## Admin Checklist

### ✅ Completed

- [x] Identified root cause (Discord client cache issue)
- [x] Verified command registration with Discord API
- [x] Confirmed timing is not the issue (172ms < 3000ms)
- [x] Created diagnostic tools (verify, debug, reset)
- [x] Created documentation (diagnosis, troubleshooting, summary)

### 📋 To Do

- [ ] **Send user instructions** (copy section above)
- [ ] **Wait for user confirmation** (did restart work?)
- [ ] **If restart doesn't work**: Run `node reset-commands.js`
- [ ] **Update bot help command** to mention restart requirement
- [ ] **Improve error handling** to catch Error 10062 and suggest restart
- [ ] **Add deployment notifications** to warn users about restarts

---

## If User Restart Doesn't Work

### Option 1: Force Reset Commands (Nuclear Option)

```bash
cd /root/AIFX_v2/discord_bot
node reset-commands.js
```

This will:
1. Delete all commands
2. Re-register with new IDs
3. Force Discord to invalidate all caches

**Note**: ALL users will need to restart Discord after this.

### Option 2: Switch to Debug Mode

```bash
cd /root/AIFX_v2/discord_bot

# Stop normal bot
pm2 stop discord-bot

# Start debug bot
node debug-interaction.js
```

Ask user to try `/signal` again, then check debug output for:
- Command ID sent by user's client
- Any timing anomalies
- Detailed error information

Compare command ID from logs with registered ID: `1437452216213442571`

If they don't match → User needs to clear cache (see below)

### Option 3: Clear Discord Cache

**Windows**:
```cmd
# Close Discord first
taskkill /F /IM Discord.exe

# Delete cache
del /F /Q %AppData%\Discord\Cache\*

# Restart Discord
start discord://
```

**macOS**:
```bash
# Close Discord first
pkill Discord

# Delete cache
rm -rf ~/Library/Application\ Support/Discord/Cache/*

# Restart Discord
open -a Discord
```

**Linux**:
```bash
# Close Discord first
pkill -9 discord

# Delete cache
rm -rf ~/.config/discord/Cache/*

# Restart Discord
discord &
```

---

## Verification

After user restarts Discord, verify fix:

### User Side
1. Open Discord
2. Wait 30 seconds
3. Type `/signal` in channel
4. Enter pair: `EUR/USD`
5. Press Enter

**Expected**: Trading signal displays correctly within 3 seconds

### Admin Side

Check logs for success:
```bash
tail -f /root/AIFX_v2/discord_bot/logs/combined.log
```

Look for:
```json
{"level":"info","message":"Signal requested by <username> for EUR/USD (1h)"}
```

**No errors about**:
- ❌ "Unknown interaction"
- ❌ "Failed to defer interaction"
- ❌ "Interaction expired"

---

## Monitoring

### Check Error Rate

```bash
# Count recent errors
grep "10062\|Unknown interaction" /root/AIFX_v2/discord_bot/logs/combined.log | wc -l

# If count is high, many users may have cache issues
```

### Check Recent Deployments

```bash
# When were commands last deployed?
stat /root/AIFX_v2/discord_bot/deploy-commands.js

# Compare with log timestamps
grep "Discord bot logged in" /root/AIFX_v2/discord_bot/logs/combined.log | tail -5
```

If commands were deployed recently (< 24 hours), expect cache issues.

---

## Prevention Going Forward

### After Any Command Deployment

1. **Post announcement** in Discord:
   ```
   📢 Bot commands updated!
   If you experience issues with commands:
   1. Completely quit Discord (don't just close)
   2. Restart Discord
   3. Wait 30 seconds
   4. Try commands again

   See troubleshooting guide: <link>
   ```

2. **Monitor error logs** for 24 hours after deployment

3. **Pro-actively reach out** to users who hit errors

### Long-Term

1. **Add to bot help command**:
   ```javascript
   .addFields({
     name: '❓ Commands not working?',
     value: 'Try restarting Discord completely. See troubleshooting guide for details.'
   })
   ```

2. **Implement smart error handling**:
   ```javascript
   if (error.code === 10062) {
     // Send DM to user with restart instructions
     await user.send({
       content: 'Your Discord client may have cached old command data. Please completely quit and restart Discord, wait 30 seconds, and try again.'
     });
   }
   ```

3. **Consider global commands** once development stabilizes
   - Pros: No cache issues
   - Cons: 1-hour update propagation

---

## Quick Reference

### Commands are properly registered?
```bash
node verify-commands.js
```

### Force reset commands?
```bash
node reset-commands.js
```

### Debug mode?
```bash
pm2 stop discord-bot
node debug-interaction.js
```

### Check logs?
```bash
tail -f logs/combined.log
```

### Restart bot?
```bash
pm2 restart discord-bot
```

---

## Success Metrics

**Issue resolved when**:
- ✅ User can invoke `/signal` without errors
- ✅ Bot responds within 3 seconds
- ✅ Trading signal displays correctly
- ✅ No Error 10062 in logs
- ✅ User confirms it's working

**Current Status**: **Waiting for user to restart Discord**

---

## Contact Info

**For Users**:
- See: `/root/AIFX_v2/discord_bot/TROUBLESHOOTING.md`
- Quick fix: Restart Discord completely

**For Developers**:
- See: `/root/AIFX_v2/discord_bot/DISCORD_BUG_DIAGNOSIS.md`
- Technical details and root cause analysis

**For Admins**:
- This checklist
- Tools: `verify-commands.js`, `debug-interaction.js`, `reset-commands.js`

---

**Created**: 2025-11-10 23:22 UTC
**Priority**: High
**Estimated Resolution Time**: 2-5 minutes (user restart)
