#!/bin/bash
#
# ML API 部署腳本
# 訓練完成後執行此腳本啟動 ML API 服務
#

set -e  # Exit on error

echo "========================================"
echo "AIFX v2 ML API 部署腳本"
echo "========================================"
echo ""

# 1. 檢查虛擬環境
echo "[1/6] 檢查 Python 虛擬環境..."
if [ ! -d "venv" ]; then
    echo "❌ 虛擬環境不存在！請先執行："
    echo "   python3 -m venv venv"
    echo "   source venv/bin/activate"
    echo "   pip install -r requirements.txt"
    exit 1
fi
echo "✓ 虛擬環境存在"

# 2. 檢查訓練好的模型
echo ""
echo "[2/6] 檢查訓練好的模型..."
MODEL_COUNT=$(ls -1 saved_models/*.h5 2>/dev/null | wc -l)
if [ $MODEL_COUNT -eq 0 ]; then
    echo "⚠️  警告：未找到訓練好的模型！"
    echo "   ML API 將啟動但無法進行預測"
    echo "   請先執行訓練：python scripts/train_classifier.py"
else
    echo "✓ 找到 $MODEL_COUNT 個模型檔案："
    ls -1 saved_models/*.h5 | tail -3
fi

# 3. 檢查端口 8000 是否被占用
echo ""
echo "[3/6] 檢查端口 8000..."
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  端口 8000 已被占用！"
    echo "   正在停止舊的服務..."
    pkill -f "uvicorn.*ml_server" || true
    sleep 2
fi
echo "✓ 端口 8000 可用"

# 4. 檢查 Redis
echo ""
echo "[4/6] 檢查 Redis 連接..."
if redis-cli ping >/dev/null 2>&1; then
    echo "✓ Redis 運行中"
else
    echo "⚠️  Redis 未運行（可選，不影響基本功能）"
fi

# 5. 創建必要目錄
echo ""
echo "[5/6] 創建必要目錄..."
mkdir -p logs metrics backups
echo "✓ 目錄創建完成"

# 6. 啟動 ML API
echo ""
echo "[6/6] 啟動 ML API 服務..."
echo ""
echo "啟動方式選擇："
echo "  1) 前台運行（顯示即時日誌，適合測試）"
echo "  2) screen 背景運行（適合生產環境）"
echo ""
read -p "請選擇 [1/2]: " choice

if [ "$choice" == "1" ]; then
    echo ""
    echo "========================================"
    echo "前台啟動 ML API..."
    echo "按 Ctrl+C 停止服務"
    echo "========================================"
    echo ""
    source venv/bin/activate
    uvicorn api.ml_server:app --host 0.0.0.0 --port 8000 --reload

elif [ "$choice" == "2" ]; then
    echo ""
    echo "========================================"
    echo "背景啟動 ML API（screen session）"
    echo "========================================"
    echo ""

    # 停止舊的 screen session
    screen -X -S ml_api quit 2>/dev/null || true

    # 啟動新的 screen session
    screen -dmS ml_api bash -c "cd /root/AIFX_v2/ml_engine && source venv/bin/activate && uvicorn api.ml_server:app --host 0.0.0.0 --port 8000"

    sleep 2

    echo "✓ ML API 已在背景啟動（screen session: ml_api）"
    echo ""
    echo "管理命令："
    echo "  - 查看日誌: screen -r ml_api"
    echo "  - 離開螢幕: Ctrl+A 然後 D"
    echo "  - 停止服務: screen -X -S ml_api quit"
    echo ""

    # 測試健康檢查
    echo "等待服務啟動..."
    sleep 3

    echo "測試健康檢查..."
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        echo "✓ ML API 健康檢查成功！"
        echo ""
        curl -s http://localhost:8000/health | python3 -m json.tool
    else
        echo "⚠️  健康檢查失敗，請檢查日誌: screen -r ml_api"
    fi

else
    echo "無效的選擇"
    exit 1
fi

echo ""
echo "========================================"
echo "部署完成！"
echo "========================================"
echo ""
echo "API 端點："
echo "  - 健康檢查: http://localhost:8000/health"
echo "  - 預測: http://localhost:8000/predict"
echo "  - 模型信息: http://localhost:8000/model/info"
echo "  - API 文檔: http://localhost:8000/docs"
echo ""
echo "外部訪問："
echo "  - http://144.24.41.178:8000"
echo "  - http://10.0.0.199:8000"
echo ""
