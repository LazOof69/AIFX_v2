#!/bin/bash
# 快速查看回測報告腳本

REPORT_DIR="/root/AIFX_v2/ml_engine/backtest/reports"
PORT=8889

echo "========================================"
echo "📊 AIFX v2 回測報告查看器"
echo "========================================"
echo ""

# 檢查報告是否存在
if [ ! -f "$REPORT_DIR/historical_backtest_report.html" ]; then
    echo "❌ 錯誤：找不到回測報告"
    echo "   請先運行回測："
    echo "   cd /root/AIFX_v2/ml_engine"
    echo "   python3 backtest/run_historical_backtest.py"
    exit 1
fi

# 檢查端口是否被佔用
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  端口 $PORT 已被使用，嘗試使用其他端口..."
    PORT=$((PORT + 1))
fi

echo "🚀 啟動HTTP服務器..."
echo "   端口: $PORT"
echo "   目錄: $REPORT_DIR"
echo ""

# 啟動HTTP服務器
cd "$REPORT_DIR"
python3 -m http.server $PORT > /tmp/backtest_http_server.log 2>&1 &
HTTP_PID=$!

sleep 2

# 檢查服務器是否成功啟動
if ps -p $HTTP_PID > /dev/null 2>&1; then
    echo "✅ 服務器已啟動（PID: $HTTP_PID）"
    echo ""
    echo "📄 訪問報告："
    echo "   http://144.24.41.178:$PORT/historical_backtest_report.html"
    echo ""
    echo "📊 查看圖表："
    echo "   http://144.24.41.178:$PORT/backtest_charts/"
    echo ""
    echo "💡 提示："
    echo "   - 按 Ctrl+C 停止服務器"
    echo "   - 或執行：kill $HTTP_PID"
    echo ""
    echo "========================================"

    # 保存PID到文件
    echo $HTTP_PID > /tmp/backtest_http_server.pid

    # 等待用戶按Ctrl+C
    trap "echo ''; echo '🛑 停止服務器...'; kill $HTTP_PID 2>/dev/null; rm -f /tmp/backtest_http_server.pid; echo '✅ 已停止'; exit 0" INT

    echo "⏳ 服務器運行中... (按 Ctrl+C 停止)"
    wait $HTTP_PID
else
    echo "❌ 啟動失敗"
    echo "   查看日誌：cat /tmp/backtest_http_server.log"
    exit 1
fi
