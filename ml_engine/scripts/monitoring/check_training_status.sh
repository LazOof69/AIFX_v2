#!/bin/bash
# 檢查訓練狀態腳本

echo "=========================================="
echo "🎯 ML 訓練狀態監控"
echo "=========================================="
echo ""

# 檢查 screen sessions
echo "📺 運行中的訓練任務:"
screen -ls | grep -E "gbpusd_training|usdjpy_training" | while read line; do
    echo "  ✓ $line"
done
echo ""

# GBPUSD 狀態
if screen -ls | grep -q "gbpusd_training"; then
    echo "🔹 GBPUSD 訓練進度:"
    echo "----------------------------------------"
    LOG_FILE=$(ls -t logs/gbpusd_training_*.log 2>/dev/null | head -1)
    if [ -f "$LOG_FILE" ]; then
        echo "  日誌: $LOG_FILE"
        echo "  大小: $(du -h "$LOG_FILE" | cut -f1)"
        echo ""
        tail -3 "$LOG_FILE" | grep -E "Epoch|loss|步驟|完成" | tail -1
    fi
    echo ""
else
    echo "⏹️  GBPUSD 訓練已結束或未運行"
    echo ""
fi

# USDJPY 狀態
if screen -ls | grep -q "usdjpy_training"; then
    echo "🔹 USDJPY 訓練進度:"
    echo "----------------------------------------"
    LOG_FILE=$(ls -t logs/usdjpy_training_*.log 2>/dev/null | head -1)
    if [ -f "$LOG_FILE" ]; then
        echo "  日誌: $LOG_FILE"
        echo "  大小: $(du -h "$LOG_FILE" | cut -f1)"
        echo ""
        tail -3 "$LOG_FILE" | grep -E "Epoch|loss|步驟|完成" | tail -1
    fi
    echo ""
else
    echo "⏹️  USDJPY 訓練已結束或未運行"
    echo ""
fi

# 檢查模型文件
echo "📁 已保存的模型:"
echo "----------------------------------------"
ls -lth saved_models/*.h5 2>/dev/null | head -3 | while read line; do
    echo "  $line"
done
echo ""

# 檢查 scaler 文件
echo "📊 Scaler 文件:"
echo "----------------------------------------"
ls -lth saved_models/*_scaler.pkl 2>/dev/null | while read line; do
    echo "  $line"
done
echo ""

echo "=========================================="
echo "💡 快速命令:"
echo "=========================================="
echo "  查看 GBPUSD 訓練: screen -r gbpusd_training"
echo "  查看 USDJPY 訓練: screen -r usdjpy_training"
echo "  離開 screen: Ctrl+A 然後按 D"
echo "  查看完整日誌:"
echo "    tail -f logs/gbpusd_training_*.log"
echo "    tail -f logs/usdjpy_training_*.log"
echo ""
