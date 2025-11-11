#!/bin/bash
# Safe Bot Startup Script
# Ensures only one instance starts

BOT_DIR="/root/AIFX_v2/discord_bot"
PID_FILE="/tmp/discord_bot.pid"
LOG_FILE="/tmp/discord_bot.log"

cd "$BOT_DIR" || exit 1

# Check if bot is already running
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if ps -p "$OLD_PID" > /dev/null 2>&1; then
    echo "ERROR: Bot is already running with PID: $OLD_PID"
    echo "To restart, first run: kill $OLD_PID"
    exit 1
  else
    echo "Removing stale PID file..."
    rm "$PID_FILE"
  fi
fi

# Check for any running bot processes
RUNNING=$(ps aux | grep "node bot.js" | grep -v grep | wc -l)
if [ "$RUNNING" -gt 0 ]; then
  echo "ERROR: Found $RUNNING running bot instance(s)!"
  echo "Kill them first: pkill -f 'node bot.js'"
  exit 1
fi

# Start bot
echo "Starting Discord bot..."
node bot.js > "$LOG_FILE" 2>&1 &
BOT_PID=$!

echo "$BOT_PID" > "$PID_FILE"
echo "Bot started with PID: $BOT_PID"
echo "Logs: tail -f $LOG_FILE"

sleep 2

# Verify bot started successfully
if ps -p "$BOT_PID" > /dev/null 2>&1; then
  echo "✅ Bot is running successfully"
  exit 0
else
  echo "❌ Bot failed to start. Check logs: $LOG_FILE"
  rm "$PID_FILE"
  exit 1
fi
