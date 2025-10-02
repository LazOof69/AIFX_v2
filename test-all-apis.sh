#!/bin/bash

echo "========================================="
echo "AIFX v2 API 完整測試"
echo "========================================="
echo ""

# 獲取 Token
echo "1️⃣  登入並獲取 Token..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"john@example.com","password":"password123"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['accessToken'])")

echo "✅ Token 已獲取"
echo ""

# 測試健康檢查
echo "2️⃣  健康檢查..."
curl -s http://localhost:3000/api/v1/health | python3 -m json.tool
echo ""

# 測試市場數據
echo "3️⃣  獲取市場總覽..."
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/market/overview | python3 -m json.tool | head -30
echo ""

# 測試通知
echo "4️⃣  獲取通知..."
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/notifications | python3 -m json.tool | head -30
echo ""

echo "========================================="
echo "測試完成！"
echo "========================================="
