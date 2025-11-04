#!/bin/bash
echo "=================================================="
echo "   AIFX v2 System Services Status Check"
echo "=================================================="
echo ""

# Check Backend
echo "🔵 Backend (Node.js + Express)"
if lsof -i :3000 | grep LISTEN > /dev/null 2>&1; then
    echo "   Status: ✅ Running on port 3000"
    echo "   PID: $(lsof -ti :3000)"
else
    echo "   Status: ❌ Not running"
fi
echo ""

# Check ML Engine
echo "🟣 ML Engine (Python + FastAPI)"
if lsof -i :8000 | grep LISTEN > /dev/null 2>&1; then
    echo "   Status: ✅ Running on port 8000"
    echo "   PID: $(lsof -ti :8000)"
else
    echo "   Status: ❌ Not running"
fi
echo ""

# Check Frontend
echo "🟢 Frontend (React + Vite)"
if lsof -i :5173 | grep LISTEN > /dev/null 2>&1; then
    echo "   Status: ✅ Running on port 5173"
    echo "   PID: $(lsof -ti :5173)"
else
    echo "   Status: ❌ Not running"
fi
echo ""

# Check Discord Bot
echo "🟡 Discord Bot"
if ps aux | grep "node bot.js" | grep -v grep > /dev/null 2>&1; then
    echo "   Status: ✅ Running"
    echo "   PID: $(ps aux | grep "node bot.js" | grep -v grep | awk '{print $2}' | head -1)"
else
    echo "   Status: ❌ Not running"
fi
echo ""

# Check PostgreSQL
echo "🔶 PostgreSQL Database"
if pg_isready > /dev/null 2>&1; then
    echo "   Status: ✅ Running"
else
    echo "   Status: ❌ Not running"
fi
echo ""

# Check Redis
echo "🔴 Redis Cache"
if redis-cli PING > /dev/null 2>&1; then
    echo "   Status: ✅ Running"
    echo "   Active Channels: $(redis-cli PUBSUB CHANNELS | wc -l)"
else
    echo "   Status: ❌ Not running"
fi
echo ""

echo "=================================================="
echo "   API Health Checks"
echo "=================================================="
echo ""

# Backend Health
echo "🔵 Backend API Health:"
BACKEND_HEALTH=$(curl -s http://localhost:3000/api/v1/health 2>/dev/null || echo "error")
if [ "$BACKEND_HEALTH" != "error" ]; then
    echo "   ✅ Healthy"
else
    echo "   ❌ Unreachable"
fi
echo ""

# ML Engine Health
echo "🟣 ML Engine API Health:"
ML_HEALTH=$(curl -s http://localhost:8000/health 2>/dev/null || echo "error")
if [ "$ML_HEALTH" != "error" ]; then
    echo "   ✅ Healthy"
else
    echo "   ❌ Unreachable"
fi
echo ""

echo "=================================================="
echo "   Log Files"
echo "=================================================="
echo "   Backend:      /tmp/backend.log"
echo "   ML Engine:    Check ML engine directory"
echo "   Discord Bot:  /tmp/discord_bot.log"
echo ""
echo "=================================================="
