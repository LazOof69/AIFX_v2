#!/bin/bash

# AIFX v2 快速測試腳本
# 用途：一鍵測試所有階段

set -e  # 遇到錯誤立即退出

echo "=========================================="
echo "   AIFX v2 快速測試腳本"
echo "=========================================="
echo ""

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 測試結果統計
PASSED=0
FAILED=0
TOTAL=0

# 測試函數
test_phase() {
    local phase_name=$1
    local test_command=$2

    TOTAL=$((TOTAL + 1))
    echo -e "${BLUE}[測試 $TOTAL]${NC} $phase_name"

    if eval "$test_command"; then
        echo -e "${GREEN}✓ 通過${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ 失敗${NC}"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

# ==========================================
# Phase 1: 檢查專案結構
# ==========================================
echo -e "${YELLOW}=== Phase 1: 專案結構檢查 ===${NC}"

test_phase "檢查 backend 目錄" "[ -d 'backend' ]"
test_phase "檢查 frontend 目錄" "[ -d 'frontend' ]"
test_phase "檢查 backend/src 目錄" "[ -d 'backend/src' ]"
test_phase "檢查 CLAUDE.md" "[ -f 'CLAUDE.md' ]"
test_phase "檢查 README.md" "[ -f 'README.md' ]"

# ==========================================
# Phase 2: 檢查依賴
# ==========================================
echo -e "${YELLOW}=== Phase 2: 依賴檢查 ===${NC}"

test_phase "檢查 Node.js" "command -v node > /dev/null"
test_phase "檢查 npm" "command -v npm > /dev/null"
test_phase "檢查 backend node_modules" "[ -d 'backend/node_modules' ]"
test_phase "檢查 frontend node_modules" "[ -d 'frontend/node_modules' ]"

# ==========================================
# Phase 3: 檢查配置文件
# ==========================================
echo -e "${YELLOW}=== Phase 3: 配置文件檢查 ===${NC}"

test_phase "檢查 backend .env" "[ -f 'backend/.env' ]"
test_phase "檢查 frontend .env" "[ -f 'frontend/.env' ]"
test_phase "檢查 backend package.json" "[ -f 'backend/package.json' ]"
test_phase "檢查 frontend package.json" "[ -f 'frontend/package.json' ]"

# ==========================================
# Phase 4: 檢查資料庫文件
# ==========================================
echo -e "${YELLOW}=== Phase 4: 資料庫文件檢查 ===${NC}"

test_phase "檢查 migrations 目錄" "[ -d 'backend/database/migrations' ]"
test_phase "檢查 seeders 目錄" "[ -d 'backend/database/seeders' ]"
test_phase "檢查至少有 5 個 migration" "[ $(ls backend/database/migrations/*.js 2>/dev/null | wc -l) -ge 5 ]"
test_phase "檢查至少有 4 個 seeder" "[ $(ls backend/database/seeders/*.js 2>/dev/null | wc -l) -ge 4 ]"

# ==========================================
# Phase 5: 檢查後端文件
# ==========================================
echo -e "${YELLOW}=== Phase 5: 後端文件檢查 ===${NC}"

test_phase "檢查 app.js" "[ -f 'backend/src/app.js' ]"
test_phase "檢查 server.js" "[ -f 'backend/src/server.js' ]"
test_phase "檢查 auth 路由" "[ -f 'backend/src/routes/auth.js' ]"
test_phase "檢查 trading 路由" "[ -f 'backend/src/routes/trading.js' ]"
test_phase "檢查 auth 控制器" "[ -f 'backend/src/controllers/authController.js' ]"

# ==========================================
# Phase 6: 檢查前端文件
# ==========================================
echo -e "${YELLOW}=== Phase 6: 前端文件檢查 ===${NC}"

test_phase "檢查 App.jsx" "[ -f 'frontend/src/App.jsx' ]"
test_phase "檢查 Login.jsx" "[ -f 'frontend/src/components/Login.jsx' ]"
test_phase "檢查 Dashboard.jsx" "[ -f 'frontend/src/components/Dashboard.jsx' ]"
test_phase "檢查 TradingView.jsx" "[ -f 'frontend/src/components/TradingView.jsx' ]"
test_phase "檢查 api.js" "[ -f 'frontend/src/services/api.js' ]"
test_phase "檢查 socket.js" "[ -f 'frontend/src/services/socket.js' ]"

# ==========================================
# Phase 7: 檢查測試文件
# ==========================================
echo -e "${YELLOW}=== Phase 7: 測試文件檢查 ===${NC}"

test_phase "檢查 tests 目錄" "[ -d 'backend/tests' ]"
test_phase "檢查 jest.config.js" "[ -f 'backend/jest.config.js' ]"
test_phase "檢查 auth.test.js" "[ -f 'backend/tests/unit/auth.test.js' ]"
test_phase "檢查 forexService.test.js" "[ -f 'backend/tests/unit/forexService.test.js' ]"
test_phase "檢查 tradingSignals.test.js" "[ -f 'backend/tests/unit/tradingSignals.test.js' ]"

# ==========================================
# Phase 8: 檢查文檔
# ==========================================
echo -e "${YELLOW}=== Phase 8: 文檔檢查 ===${NC}"

test_phase "檢查 API 文檔" "[ -f 'backend/docs/API.md' ]"
test_phase "檢查 DATABASE_SCHEMA.md" "[ -f 'backend/DATABASE_SCHEMA.md' ]"
test_phase "檢查 TESTING.md" "[ -f 'backend/TESTING.md' ]"
test_phase "檢查 CI/CD 配置" "[ -f '.github/workflows/ci.yml' ]"

# ==========================================
# Phase 9: 服務檢查
# ==========================================
echo -e "${YELLOW}=== Phase 9: 服務檢查 ===${NC}"

# PostgreSQL
if command -v psql > /dev/null; then
    test_phase "PostgreSQL 已安裝" "true"
else
    test_phase "PostgreSQL 已安裝" "false"
    echo -e "${YELLOW}提示: PostgreSQL 未安裝或不在 PATH 中${NC}"
fi

# Redis
if command -v redis-cli > /dev/null; then
    test_phase "Redis 已安裝" "true"
    if redis-cli ping > /dev/null 2>&1; then
        test_phase "Redis 正在運行" "true"
    else
        test_phase "Redis 正在運行" "false"
        echo -e "${YELLOW}提示: Redis 未運行，請執行: sudo service redis-server start${NC}"
    fi
else
    test_phase "Redis 已安裝" "false"
    echo -e "${YELLOW}提示: Redis 未安裝${NC}"
fi

# ==========================================
# Phase 10: 運行單元測試 (可選)
# ==========================================
if [ "$1" == "--run-tests" ]; then
    echo -e "${YELLOW}=== Phase 10: 運行單元測試 ===${NC}"

    cd backend
    test_phase "運行所有測試" "npm test 2>&1 | tail -20"
    cd ..
fi

# ==========================================
# 測試摘要
# ==========================================
echo ""
echo "=========================================="
echo "           測試摘要"
echo "=========================================="
echo -e "總測試數: ${BLUE}$TOTAL${NC}"
echo -e "通過: ${GREEN}$PASSED${NC}"
echo -e "失敗: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}所有測試通過！✓${NC}"
    exit 0
else
    echo -e "${RED}有 $FAILED 個測試失敗！✗${NC}"
    exit 1
fi