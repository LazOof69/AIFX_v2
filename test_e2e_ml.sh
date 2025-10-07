#!/bin/bash
# End-to-end test for ML integration with backend API

API_URL="http://localhost:3000/api/v1"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhMGE1ZTg4My00OTk0LTRhNzctODY5ZS05YzY1N2EyOGM3NGUiLCJpYXQiOjE3NTk0NjQyMjEsImV4cCI6MTc1OTQ2NzgyMSwiYXVkIjoiYWlmeC12Mi11c2VycyIsImlzcyI6ImFpZngtdjIifQ.NfTQ-QLIDAkipJw3snU9yJ8hck_TJlsT1WxCf5JIkZQ"

echo "=========================================="
echo "端對端 ML 整合測試"
echo "=========================================="
echo ""

echo "[1/2] 測試後端健康狀態..."
HEALTH=$(curl -s "$API_URL/health")
echo "$HEALTH" | python3 -m json.tool
echo ""

echo "[2/2] 測試交易信號生成 (包含 ML 預測)..."
SIGNAL=$(curl -s -X GET "$API_URL/trading/signal/EUR/USD?timeframe=1h" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

echo "$SIGNAL" | python3 -m json.tool

# Check if ML prediction was used
if echo "$SIGNAL" | grep -q "prediction"; then
    echo ""
    echo "✓ ML 預測已整合到交易信號中！"
else
    echo ""
    echo "⚠️  未檢測到 ML 預測數據"
fi

echo ""
echo "=========================================="
echo "測試完成"
echo "=========================================="
