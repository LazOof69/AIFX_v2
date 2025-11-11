#!/bin/bash
# Bot Instance Monitor Script
# Ensures only ONE Discord bot instance is running
# Add to crontab: */5 * * * * /root/AIFX_v2/discord_bot/check_bot_instances.sh

BOT_DIR="/root/AIFX_v2/discord_bot"
LOG_FILE="/var/log/discord_bot_monitor.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Count running bot instances
INSTANCES=$(ps aux | grep "node bot.js" | grep -v grep | wc -l)

log "Checking bot instances... Found: $INSTANCES"

if [ "$INSTANCES" -gt 1 ]; then
  log "ERROR: Multiple bot instances detected ($INSTANCES) - RACE CONDITION RISK!"
  log "Killing all bot instances..."

  # Kill all instances
  pkill -9 -f "node bot.js"
  pkill -9 -f "nodemon bot.js"

  sleep 2

  # Restart single instance via PM2 (if installed)
  if command -v pm2 &> /dev/null; then
    log "Restarting bot via PM2..."
    cd "$BOT_DIR" || exit 1
    pm2 restart discord-bot
  else
    log "PM2 not found - manual restart required"
  fi

  exit 1

elif [ "$INSTANCES" -eq 0 ]; then
  log "ERROR: No bot instances running - Bot is DOWN!"

  # Restart via PM2 (if installed)
  if command -v pm2 &> /dev/null; then
    log "Starting bot via PM2..."
    cd "$BOT_DIR" || exit 1
    pm2 start ecosystem.config.js
  else
    log "PM2 not found - manual start required"
  fi

  exit 1

else
  log "OK: Single bot instance running (PID: $(pgrep -f 'node bot.js'))"
  exit 0
fi
