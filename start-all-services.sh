#!/bin/bash

# AIFX_v2 Service Startup Script
# Starts all services in detached screen sessions

echo "🚀 Starting AIFX_v2 services in screen sessions..."
echo ""

# Kill existing screen sessions if they exist
screen -S ml-engine -X quit 2>/dev/null
screen -S backend -X quit 2>/dev/null
screen -S discord-bot -X quit 2>/dev/null

sleep 1

# Start ML Engine
echo "1️⃣  Starting ML Engine..."
cd /root/AIFX_v2/ml_engine
screen -dmS ml-engine bash -c "source venv/bin/activate && python api/ml_server.py"
sleep 3

# Start Backend
echo "2️⃣  Starting Backend..."
cd /root/AIFX_v2/backend
screen -dmS backend bash -c "npm start"
sleep 3

# Start Discord Bot
echo "3️⃣  Starting Discord Bot..."
cd /root/AIFX_v2/discord_bot
screen -dmS discord-bot bash -c "node bot.js"
sleep 2

echo ""
echo "✅ All services started in screen sessions!"
echo ""
echo "📋 Active screen sessions:"
screen -ls
echo ""
echo "🔧 Useful commands:"
echo "  screen -ls                    # List all screen sessions"
echo "  screen -r ml-engine          # Attach to ML Engine"
echo "  screen -r backend            # Attach to Backend"
echo "  screen -r discord-bot        # Attach to Discord Bot"
echo "  Ctrl+A then D                # Detach from screen (keeps running)"
echo "  screen -X -S backend quit    # Kill backend session"
echo ""
echo "🌐 Service URLs:"
echo "  ML Engine:    http://localhost:8000"
echo "  Backend API:  http://localhost:3000"
echo "  Discord Bot:  Running (check Discord)"
echo ""
