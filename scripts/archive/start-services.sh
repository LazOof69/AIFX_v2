#!/bin/bash

echo "🚀 啟動 AIFX v2 服務..."
echo ""

# 停止舊進程
echo "清理舊進程..."
pkill -9 -f "node.*server.js" 2>/dev/null
pkill -9 -f "node.*vite" 2>/dev/null

# 啟動後端
echo "啟動後端 (端口 3000)..."
cd /root/AIFX_v2/backend
nohup npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "後端 PID: $BACKEND_PID"

# 等待後端啟動
sleep 3

# 啟動前端  
echo "啟動前端 (端口 5173)..."
cd /root/AIFX_v2/frontend
nohup npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "前端 PID: $FRONTEND_PID"

# 等待啟動
sleep 5

echo ""
echo "========================================="
echo "✅ 服務啟動完成"
echo "========================================="
echo ""
echo "📊 後端: http://localhost:3000"
echo "🎨 前端: http://localhost:5173"
echo ""
echo "查看日誌:"
echo "  tail -f /tmp/backend.log"
echo "  tail -f /tmp/frontend.log"
echo ""
