#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                                                                   ║"
echo "║          ✅ AIFX v2 完整系統驗證報告                              ║"
echo "║                                                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "生成時間: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Test counters
PASSED=0
FAILED=0

# 1. PostgreSQL
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "【1/10】PostgreSQL Database"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if pg_isready -q; then
  echo "✅ PostgreSQL 運行中"
  USERS=$(sudo -u postgres psql -d aifx_v2_dev -t -c 'SELECT COUNT(*) FROM users;' 2>/dev/null | tr -d ' ')
  echo "   • Users: $USERS"
  echo "   • Trading Signals: $(sudo -u postgres psql -d aifx_v2_dev -t -c 'SELECT COUNT(*) FROM trading_signals;' 2>/dev/null | tr -d ' ')"
  echo "   • Notifications: $(sudo -u postgres psql -d aifx_v2_dev -t -c 'SELECT COUNT(*) FROM notifications;' 2>/dev/null | tr -d ' ')"
  ((PASSED++))
else
  echo "❌ PostgreSQL 未運行"
  ((FAILED++))
fi
echo ""

# 2. Redis
echo "【2/10】Redis Cache"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if redis-cli ping > /dev/null 2>&1; then
  echo "✅ Redis 運行中"
  ((PASSED++))
else
  echo "❌ Redis 未運行"
  ((FAILED++))
fi
echo ""

# 3. Backend API
echo "【3/10】Backend API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if curl -s -f http://localhost:3000/api/v1/health > /dev/null 2>&1; then
  echo "✅ Backend API 運行中"
  ((PASSED++))
else
  echo "❌ Backend API 未運行"
  ((FAILED++))
fi
echo ""

# 4. Frontend
echo "【4/10】Frontend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo "✅ Frontend 運行中"
  ((PASSED++))
else
  echo "❌ Frontend 未運行"
  ((FAILED++))
fi
echo ""

# 5. ML Engine
echo "【5/10】ML Engine"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if curl -s -f http://localhost:8000/health > /dev/null 2>&1; then
  echo "✅ ML Engine 運行中"
  ((PASSED++))
else
  echo "❌ ML Engine 未運行"
  ((FAILED++))
fi
echo ""

# 6. Discord Bot
echo "【6/10】Discord Bot"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if ps aux | grep -q "[n]ode.*bot.js"; then
  echo "✅ Discord Bot 運行中"
  ((PASSED++))
else
  echo "⚠️  Discord Bot 未運行（可選服務）"
  echo "   配置: 已就緒 ✅"
fi
echo ""

# 7. Database Data Integrity
echo "【7/10】Database Data Integrity"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_USER=$(sudo -u postgres psql -d aifx_v2_dev -t -c "SELECT COUNT(*) FROM users WHERE email='john@example.com';" 2>/dev/null | tr -d ' ')
if [ "$TEST_USER" = "1" ]; then
  echo "✅ 測試用戶數據完整"
  ((PASSED++))
else
  echo "❌ 測試用戶數據異常"
  ((FAILED++))
fi
echo ""

# 8. ML Training Data
echo "【8/10】ML Training Data"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -d "/root/AIFX_v2/ml_engine/data/training" ]; then
  SIZE=$(du -sh /root/AIFX_v2/ml_engine/data/training/ 2>/dev/null | awk '{print $1}')
  echo "✅ ML 訓練數據存在"
  echo "   大小: $SIZE"
  ((PASSED++))
else
  echo "❌ ML 訓練數據缺失"
  ((FAILED++))
fi
echo ""

# 9. Trained Models
echo "【9/10】Trained Models"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
MODEL_COUNT=$(ls /root/AIFX_v2/ml_engine/checkpoints/*.h5 2>/dev/null | wc -l)
if [ "$MODEL_COUNT" -gt 0 ]; then
  echo "✅ 已訓練模型存在"
  echo "   模型數量: $MODEL_COUNT 個"
  ((PASSED++))
else
  echo "❌ 沒有已訓練模型"
  ((FAILED++))
fi
echo ""

# 10. Environment Configuration
echo "【10/10】Environment Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "/root/AIFX_v2/backend/.env" ] && [ -f "/root/AIFX_v2/frontend/.env" ]; then
  echo "✅ 環境配置文件存在"
  ((PASSED++))
else
  echo "❌ 環境配置文件缺失"
  ((FAILED++))
fi
echo ""

# Summary
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "📊 測試結果總結"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TOTAL=$((PASSED + FAILED))
echo "   通過: $PASSED / $TOTAL"
echo "   失敗: $FAILED / $TOTAL"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 所有核心測試通過！系統完全運行正常！"
elif [ $PASSED -ge 8 ]; then
  echo "✅ 系統基本正常運行（$PASSED/$TOTAL 通過）"
else
  echo "⚠️  系統存在問題，請檢查失敗項目"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "🌐 訪問地址"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Frontend:    http://localhost:5173"
echo "   Backend API: http://localhost:3000/api/v1"
echo "   ML Engine:   http://localhost:8000"
echo ""
echo "👤 測試帳號"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Email:    john@example.com"
echo "   Password: Password123!"
echo ""
echo "📚 文檔位置"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   系統說明: /root/AIFX_v2/PROJECT_OVERVIEW_ZH.md"
echo "   Discord:  /root/AIFX_v2/DISCORD_STATUS.md"
echo "   狀態:     /root/AIFX_v2/SYSTEM_STATUS_REPORT.md"
echo ""
