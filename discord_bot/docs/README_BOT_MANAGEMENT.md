# Discord Bot Management Guide

## Quick Reference

### Starting the Bot

```bash
cd /root/AIFX_v2/discord_bot

# Option 1: Using the start script (recommended)
./start_bot.sh

# Option 2: Manual start
node bot.js > /tmp/discord_bot.log 2>&1 &

# Option 3: Using PM2 (if installed)
pm2 start ecosystem.config.js
```

### Stopping the Bot

```bash
# Option 1: Using the stop script (recommended)
./stop_bot.sh

# Option 2: Using PM2
pm2 stop discord-bot

# Option 3: Manual kill
pkill -f "node bot.js"
```

### Checking Bot Status

```bash
# Check if bot is running
ps aux | grep "node bot.js" | grep -v grep

# Check how many instances are running (MUST BE 1!)
ps aux | grep "node bot.js" | grep -v grep | wc -l

# View logs
tail -f /tmp/discord_bot.log

# Check bot health (if health endpoint is enabled)
curl http://localhost:3001/health
```

### Troubleshooting

#### Problem: Multiple Instances Running

```bash
# Check instance count
ps aux | grep "node bot.js" | grep -v grep | wc -l

# If > 1, kill all instances
./stop_bot.sh

# Or manually
pkill -9 -f "node bot.js"

# Start fresh
./start_bot.sh
```

#### Problem: "Unknown interaction" Errors

**Root Cause:** Multiple bot instances racing to handle the same interaction.

**Solution:**
```bash
# 1. Verify only one instance is running
ps aux | grep "node bot.js" | grep -v grep | wc -l

# 2. If multiple instances found, kill all and restart
./stop_bot.sh
./start_bot.sh

# 3. Check logs for successful defers
grep "Deferred signal" /tmp/discord_bot.log
```

#### Problem: Bot Not Responding

```bash
# Check if bot is running
ps aux | grep "node bot.js" | grep -v grep

# Check logs for errors
tail -50 /tmp/discord_bot.log

# Check backend API is running
curl http://localhost:3000/health

# Check Redis is running
redis-cli ping
```

### Monitoring

#### Setup Automated Monitoring (Recommended)

```bash
# Add to crontab
crontab -e

# Add this line:
*/5 * * * * /root/AIFX_v2/discord_bot/check_bot_instances.sh >> /var/log/discord_bot_monitor.log 2>&1
```

#### Manual Monitoring

```bash
# Run the check script manually
./check_bot_instances.sh

# View monitoring logs
tail -f /var/log/discord_bot_monitor.log
```

### PM2 Management (Recommended for Production)

#### Initial Setup

```bash
# Install PM2 globally
npm install -g pm2

# Start bot with PM2
cd /root/AIFX_v2/discord_bot
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Run the command it outputs
```

#### PM2 Commands

```bash
# Start bot
pm2 start discord-bot

# Stop bot
pm2 stop discord-bot

# Restart bot
pm2 restart discord-bot

# View logs
pm2 logs discord-bot

# View bot status
pm2 status

# Monitor resources
pm2 monit

# Delete bot from PM2
pm2 delete discord-bot
```

### Important Rules

1. **NEVER run multiple bot instances** - This causes race conditions and "Unknown interaction" errors
2. **Always check instance count before starting** - Use `ps aux | grep "node bot.js" | wc -l`
3. **Use the provided scripts** - They include safety checks
4. **Monitor logs for "Deferred" messages** - Should see successful defer logs
5. **Setup automated monitoring** - Use cron job with check_bot_instances.sh

### Command Deployment

```bash
# Deploy slash commands to Discord
node deploy-commands.js

# Verify command registration
node check_command_id.js
```

### Log Files

- Bot logs: `/tmp/discord_bot.log` or `./logs/combined.log`
- Error logs: `./logs/error.log`
- Monitor logs: `/var/log/discord_bot_monitor.log`

### Environment Variables

Required in `.env`:
```bash
DISCORD_BOT_TOKEN=your_token_here
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id
BACKEND_API_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
```

### Health Checks

```bash
# Check Discord bot
ps aux | grep "node bot.js" | grep -v grep

# Check backend API
curl http://localhost:3000/health

# Check Redis
redis-cli ping

# Check PostgreSQL
psql -U postgres -d aifx_v2_dev -c "SELECT 1"
```

### Emergency Recovery

If bot is completely broken:

```bash
# 1. Kill everything
./stop_bot.sh
pkill -9 -f "node.*bot"

# 2. Check nothing is running
ps aux | grep bot

# 3. Restart fresh
./start_bot.sh

# 4. Verify single instance
ps aux | grep "node bot.js" | grep -v grep | wc -l
# Should output: 1

# 5. Test command in Discord
# Run: /signal pair:EUR/USD

# 6. Check logs for success
grep "Deferred signal" /tmp/discord_bot.log
```

### Debugging

Enable debug logging:

```bash
# Set LOG_LEVEL in .env
echo "LOG_LEVEL=debug" >> .env

# Restart bot
./stop_bot.sh
./start_bot.sh

# Watch debug logs
tail -f /tmp/discord_bot.log | grep debug
```

### Performance Monitoring

```bash
# Check memory usage
ps aux | grep "node bot.js" | grep -v grep | awk '{print $6/1024 " MB"}'

# Check CPU usage
ps aux | grep "node bot.js" | grep -v grep | awk '{print $3 "%"}'

# Monitor real-time (if PM2 installed)
pm2 monit
```

---

## Root Cause of Recent Issues

**Problem:** Discord interactions failing with "Unknown interaction" at 206ms

**Cause:** 7 concurrent bot instances racing to handle the same interaction

**Solution:** Ensure only ONE bot instance runs at all times

**Verification:** `ps aux | grep "node bot.js" | grep -v grep | wc -l` should output `1`

**Details:** See `INTERACTION_FAILURE_ANALYSIS.md` for complete technical analysis

---

## Prevention Checklist

- [ ] Only one bot instance running (`ps aux | grep "node bot.js" | wc -l` = 1)
- [ ] PID file exists (`/tmp/discord_bot.pid`)
- [ ] Bot logs show successful startup
- [ ] Bot logs show "Deferred" messages when commands execute
- [ ] No "Unknown interaction" errors in logs
- [ ] Monitoring cron job is active
- [ ] PM2 process manager configured (recommended)
- [ ] Health check endpoint responding

---

Last Updated: 2025-11-10
