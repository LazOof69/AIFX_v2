#!/bin/bash

# AIFX v2 API 測試腳本
# 測試所有主要 API 端點

set -e

echo "=========================================="
echo "   AIFX v2 API 端點測試"
echo "=========================================="
echo ""

# API 配置
API_URL="http://localhost:3000/api/v1"
TOKEN=""

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 測試計數
PASSED=0
FAILED=0
TOTAL=0

# 測試函數
test_api() {
    local test_name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5

    TOTAL=$((TOTAL + 1))
    echo -e "${BLUE}[測試 $TOTAL]${NC} $test_name"

    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$API_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json")
    elif [ "$method" == "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    elif [ "$method" == "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT "$API_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data")
    elif [ "$method" == "PATCH" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json")
    elif [ "$method" == "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN")
    fi

    # 提取狀態碼
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    # 檢查狀態碼
    if [ "$status_code" == "$expected_status" ]; then
        echo -e "${GREEN}✓ 通過${NC} (狀態碼: $status_code)"
        PASSED=$((PASSED + 1))

        # 顯示響應預覽
        if [ ! -z "$body" ]; then
            echo "$body" | jq -C '.' 2>/dev/null | head -10 || echo "$body" | head -3
        fi
    else
        echo -e "${RED}✗ 失敗${NC} (預期: $expected_status, 實際: $status_code)"
        echo "響應: $body"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

# ==========================================
# 檢查服務器是否運行
# ==========================================
echo -e "${YELLOW}檢查後端服務器...${NC}"
if ! curl -s "$API_URL/../health" > /dev/null 2>&1; then
    echo -e "${RED}錯誤: 後端服務器未運行${NC}"
    echo "請先啟動後端: cd backend && npm run dev"
    exit 1
fi
echo -e "${GREEN}✓ 後端服務器正在運行${NC}"
echo ""

# ==========================================
# Phase 1: 認證測試
# ==========================================
echo -e "${YELLOW}=== Phase 1: 認證 API 測試 ===${NC}"

# 註冊測試用戶
TIMESTAMP=$(date +%s)
TEST_EMAIL="test_${TIMESTAMP}@example.com"
TEST_PASSWORD="Test12345"

echo "測試帳號: $TEST_EMAIL"
echo ""

test_api "註冊新用戶" "POST" "/auth/register" \
    "{\"username\":\"test_${TIMESTAMP}\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
    "201"

# 登入並獲取 token
echo "登入並獲取 token..."
login_response=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

TOKEN=$(echo "$login_response" | jq -r '.data.accessToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}錯誤: 無法獲取 token${NC}"
    echo "登入響應: $login_response"
    exit 1
fi

echo -e "${GREEN}✓ 成功獲取 token${NC}"
echo "Token: ${TOKEN:0:50}..."
echo ""

test_api "登入" "POST" "/auth/login" \
    "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
    "200"

test_api "獲取用戶資料" "GET" "/auth/profile" "" "200"

# ==========================================
# Phase 2: 交易信號測試
# ==========================================
echo -e "${YELLOW}=== Phase 2: 交易信號 API 測試 ===${NC}"

test_api "獲取 EUR/USD 信號" "GET" "/trading/signal/EUR%2FUSD" "" "200"

test_api "獲取所有信號" "GET" "/trading/signals?limit=10" "" "200"

test_api "獲取個性化推薦" "GET" "/trading/recommendation" "" "200"

# ==========================================
# Phase 3: 市場數據測試
# ==========================================
echo -e "${YELLOW}=== Phase 3: 市場數據 API 測試 ===${NC}"

test_api "獲取 EUR/USD 價格" "GET" "/market/price/EUR%2FUSD" "" "200"

test_api "獲取歷史數據" "GET" "/market/history/EUR%2FUSD?timeframe=1hour&limit=50" "" "200"

test_api "獲取市場總覽" "GET" "/market/overview" "" "200"

test_api "獲取技術指標" "GET" "/market/indicators/EUR%2FUSD?indicators=sma,rsi" "" "200"

# ==========================================
# Phase 4: 用戶偏好測試
# ==========================================
echo -e "${YELLOW}=== Phase 4: 用戶偏好 API 測試 ===${NC}"

test_api "獲取偏好設定" "GET" "/preferences" "" "200"

test_api "更新偏好設定" "PUT" "/preferences" \
    "{\"tradingFrequency\":\"daytrading\",\"riskLevel\":7,\"preferredPairs\":[\"EUR/USD\",\"GBP/USD\"]}" \
    "200"

test_api "獲取通知設定" "GET" "/preferences/notifications" "" "200"

test_api "更新通知設定" "PUT" "/preferences/notifications" \
    "{\"email\":true,\"discord\":false,\"browser\":true,\"minConfidence\":75}" \
    "200"

# ==========================================
# Phase 5: 通知測試
# ==========================================
echo -e "${YELLOW}=== Phase 5: 通知 API 測試 ===${NC}"

test_api "獲取通知列表" "GET" "/notifications?limit=20" "" "200"

# ==========================================
# 測試摘要
# ==========================================
echo ""
echo "=========================================="
echo "           測試摘要"
echo "=========================================="
echo -e "API URL: ${BLUE}$API_URL${NC}"
echo -e "總測試數: ${BLUE}$TOTAL${NC}"
echo -e "通過: ${GREEN}$PASSED${NC}"
echo -e "失敗: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}所有 API 測試通過！✓${NC}"
    exit 0
else
    echo -e "${RED}有 $FAILED 個測試失敗！✗${NC}"
    exit 1
fi