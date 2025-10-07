#!/bin/bash
#
# ML API 測試腳本
# 測試 ML API 的所有端點
#

set -e

API_URL="${API_URL:-http://localhost:8000}"

echo "========================================"
echo "AIFX v2 ML API 測試腳本"
echo "========================================"
echo "API URL: $API_URL"
echo ""

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 測試函數
test_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local data=$4

    echo -n "測試 $name... "

    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" == "200" ]; then
        echo -e "${GREEN}✓ 通過${NC} (HTTP $http_code)"
        echo "$body" | python3 -m json.tool 2>/dev/null | head -20
    else
        echo -e "${RED}✗ 失敗${NC} (HTTP $http_code)"
        echo "$body"
    fi
    echo ""
}

# 1. 健康檢查
echo "[1/4] 健康檢查"
echo "----------------------------------------"
test_endpoint "Health Check" "$API_URL/health"

# 2. 根端點
echo "[2/4] 根端點"
echo "----------------------------------------"
test_endpoint "Root Endpoint" "$API_URL/"

# 3. 模型信息
echo "[3/4] 模型信息"
echo "----------------------------------------"
test_endpoint "Model Info" "$API_URL/model/info"

# 4. 預測測試（需要至少 250 個數據點用於計算所有技術指標）
echo "[4/4] 預測測試"
echo "----------------------------------------"

# 生成測試數據（300個數據點，確保所有指標都能計算）
test_data=$(python3 << 'EOF'
import json
from datetime import datetime, timedelta

data_points = []
base_price = 1.0850
base_time = datetime.now()

for i in range(300):
    price = base_price + (i * 0.0001)
    data_points.append({
        "timestamp": (base_time - timedelta(hours=300-i)).isoformat(),
        "open": price,
        "high": price + 0.0005,
        "low": price - 0.0005,
        "close": price + 0.0002,
        "volume": 1000
    })

request_data = {
    "pair": "EUR/USD",
    "timeframe": "1h",
    "data": data_points,
    "add_indicators": True
}

print(json.dumps(request_data))
EOF
)

if [ -n "$test_data" ]; then
    test_endpoint "Prediction" "$API_URL/predict" "POST" "$test_data"
else
    echo -e "${YELLOW}⚠️  跳過預測測試（無法生成測試數據）${NC}"
    echo ""
fi

echo "========================================"
echo "測試完成"
echo "========================================"
echo ""
echo "文檔地址: $API_URL/docs"
echo ""
