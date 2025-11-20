#!/bin/bash
# Safe Bot Shutdown Script

PID_FILE="/tmp/discord_bot.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  echo "Stopping bot (PID: $PID)..."

  if ps -p "$PID" > /dev/null 2>&1; then
    kill "$PID"
    sleep 2

    # Force kill if still running
    if ps -p "$PID" > /dev/null 2>&1; then
      echo "Process didn't stop, force killing..."
      kill -9 "$PID"
    fi

    echo "✅ Bot stopped"
  else
    echo "Process $PID not found (already stopped)"
  fi

  rm "$PID_FILE"
else
  echo "No PID file found. Checking for running processes..."
  RUNNING=$(ps aux | grep "node bot.js" | grep -v grep)

  if [ -n "$RUNNING" ]; then
    echo "Found running bot processes:"
    echo "$RUNNING"
    echo ""
    echo "Killing all bot processes..."
    pkill -f "node bot.js"
    echo "✅ All bot processes killed"
  else
    echo "No running bot processes found"
  fi
fi

exit 0
