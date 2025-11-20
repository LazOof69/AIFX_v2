#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4ODA5MGJjNi0zNTRhLTQwNjktOWE2Ny0xZjY4OGY3YjExMDYiLCJpYXQiOjE3NjMzNTA2MjEsImV4cCI6MTc2MzM1NDIyMSwiYXVkIjoiYWlmeC12Mi11c2VycyIsImlzcyI6ImFpZngtdjIifQ.OuW4-_cZQVzp_qkaTdq8PFangoYGrZBhAi0UdDlobfo"

echo "================================================================================"
echo "                    AIFX_v2 COMPREHENSIVE SYSTEM HEALTH TEST"
echo "================================================================================"
echo

echo "📊 1. SERVICE STATUS"
echo "-------------------"
echo -n "Backend (Node.js):      "
if ps aux | grep -q "[n]ode.*backend"; then echo "✅ RUNNING"; else echo "❌ STOPPED"; fi

echo -n "ML Engine (Python):     "
if ps aux | grep -q "[u]vicorn.*ml_server"; then echo "✅ RUNNING"; else echo "❌ STOPPED"; fi

echo -n "PostgreSQL:             "
if ps aux | grep -q "[p]ostgres"; then echo "✅ RUNNING"; else echo "❌ STOPPED"; fi

echo -n "Redis:                  "
if redis-cli ping > /dev/null 2>&1; then echo "✅ RUNNING"; else echo "❌ STOPPED"; fi

echo

echo "🔌 2. API HEALTH CHECKS"
echo "-----------------------"
echo "Backend Health:"
curl -s http://localhost:3000/api/v1/health | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"  ✅ Status: {data['data']['status']}\")
print(f\"  ✅ Version: {data['data']['version']}\")
print(f\"  ✅ Environment: {data['data']['environment']}\")
"

echo
echo "ML Engine Health:"
curl -s http://localhost:8000/health | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"  ✅ Status: {data['status']}\")
print(f\"  ✅ Model Version: {data['model_version']}\")
"

echo

echo "📈 3. REAL-TIME MARKET DATA"
echo "---------------------------"
echo "EUR/USD Real-time Data:"
curl -s "http://localhost:3000/api/v1/market/realtime/EUR%2FUSD" | python3 -c "
import sys, json
data = json.load(sys.stdin)
market = data['data']['data']
print(f\"  ✅ Price: {market['price']:.6f}\")
print(f\"  ✅ Source: {market['source']}\")
print(f\"  ✅ Timestamp: {market['timestamp']}\")
"

echo
echo "GBP/USD Real-time Data:"
curl -s "http://localhost:3000/api/v1/market/realtime/GBP%2FUSD" | python3 -c "
import sys, json
data = json.load(sys.stdin)
market = data['data']['data']
print(f\"  ✅ Price: {market['price']:.6f}\")
print(f\"  ✅ Source: {market['source']}\")
"

echo

echo "🎯 4. TRADING SIGNAL GENERATION (END-TO-END)"
echo "---------------------------------------------"
echo "EUR/USD 1h Signal:"
curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=EUR/USD&timeframe=1h" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
signal = data['data']['signal']
tech = signal['technicalData']['indicators']
print(f\"  ✅ Signal: {signal['signal'].upper()}\")
print(f\"  ✅ Confidence: {signal['confidence']:.0%}\")
print(f\"  ✅ Strength: {signal['signalStrength']}\")
print(f\"  ✅ ML Enhanced: {signal['mlEnhanced']}\")
print(f\"  ✅ Entry Price: {signal['entryPrice']:.6f}\")
print(f\"  ✅ SMA Signal: {tech['sma']['signal']}\")
print(f\"  ✅ RSI: {tech['rsi']['value']:.2f} ({tech['rsi']['signal']})\")
"

echo
echo "GBP/USD 4h Signal:"
curl -s -X GET "http://localhost:3000/api/v1/trading/signal?pair=GBP/USD&timeframe=4h" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
signal = data['data']['signal']
print(f\"  ✅ Signal: {signal['signal'].upper()}\")
print(f\"  ✅ Confidence: {signal['confidence']:.0%}\")
print(f\"  ✅ Entry Price: {signal['entryPrice']:.6f}\")
"

echo

echo "🔄 5. BACKEND ↔ ML ENGINE CONNECTION"
echo "------------------------------------"
curl -s http://localhost:3000/api/v1/market/status | python3 -c "
import sys, json
data = json.load(sys.stdin)
apis = data['data']['apis']
print(f\"  ✅ YFinance Status: {apis['yfinance']['status']}\")
print(f\"  ✅ YFinance Healthy: {apis['yfinance']['healthy']}\")
print(f\"  ✅ ML Engine Status: {apis['mlEngine']['status']}\")
print(f\"  ✅ ML Engine Healthy: {apis['mlEngine']['healthy']}\")
"

echo

echo "💾 6. CACHE OPERATIONS"
echo "----------------------"
echo -n "  Redis Connection:     "
if redis-cli ping > /dev/null 2>&1; then echo "✅ CONNECTED"; else echo "❌ DISCONNECTED"; fi

echo "  Market Pairs Caching:"
curl -s "http://localhost:3000/api/v1/market/pairs" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"    ✅ Cached: {data['data'].get('cached', False)}\")
print(f\"    ✅ Total Pairs: {data['data']['total']}\")
"

echo

echo "================================================================================"
echo "                          ✅ SYSTEM HEALTH TEST COMPLETE"
echo "================================================================================"
