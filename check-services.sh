#!/bin/bash

# AIFX_v2 Service Status Check Script
# Checks status of all services

echo "📊 AIFX_v2 Service Status"
echo "════════════════════════════════════════════════════════════"
echo ""

# Check screen sessions
echo "🖥️  Screen Sessions:"
screen -ls
echo ""

# Check if services are responding
echo "🔍 Service Health Checks:"
echo ""

# ML Engine
echo -n "ML Engine (port 8000): "
if curl -s -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ RUNNING"
else
    echo "❌ NOT RESPONDING"
fi

# Backend
echo -n "Backend (port 3000): "
if curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ RUNNING"
else
    echo "❌ NOT RESPONDING"
fi

# Redis
echo -n "Redis (port 6379): "
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ RUNNING"
else
    echo "❌ NOT RESPONDING"
fi

# Discord Bot (check screen session)
echo -n "Discord Bot: "
if screen -ls | grep -q discord-bot; then
    echo "✅ RUNNING (screen session active)"
else
    echo "❌ NOT RUNNING"
fi

echo ""
echo "🌐 Service URLs:"
echo "  ML Engine:    http://localhost:8000/health"
echo "  Backend API:  http://localhost:3000/health"
echo "  Redis:        redis://localhost:6379"
echo ""
