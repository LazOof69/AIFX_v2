#!/bin/bash

# AIFX_v2 Service Shutdown Script
# Stops all services running in screen sessions

echo "🛑 Stopping AIFX_v2 services..."
echo ""

# Kill screen sessions
screen -S ml-engine -X quit 2>/dev/null && echo "✅ ML Engine stopped" || echo "⚠️  ML Engine not running"
screen -S backend -X quit 2>/dev/null && echo "✅ Backend stopped" || echo "⚠️  Backend not running"
screen -S discord-bot -X quit 2>/dev/null && echo "✅ Discord Bot stopped" || echo "⚠️  Discord Bot not running"

echo ""
echo "✅ All services stopped!"
echo ""
