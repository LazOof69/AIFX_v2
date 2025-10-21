#!/bin/bash
###############################################################################
# Daily Incremental Training - Cron Wrapper Script
#
# Purpose: Executes daily incremental ML model training
# Schedule: Daily at UTC 01:00
# Duration: ~5-15 minutes
#
# Installation:
#   1. Make this script executable: chmod +x daily_training.sh
#   2. Add to crontab: crontab -e
#   3. Add line: 0 1 * * * /root/AIFX_v2/ml_engine/cron/daily_training.sh
#
# Logs: /root/AIFX_v2/ml_engine/logs/training/daily_training_YYYYMMDD.log
###############################################################################

# Exit on any error
set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ML_ENGINE_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$ML_ENGINE_DIR")"

# Load environment variables
if [ -f "$PROJECT_ROOT/backend/.env" ]; then
    echo "📄 Loading environment variables from backend/.env"
    export $(grep -v '^#' "$PROJECT_ROOT/backend/.env" | xargs)
fi

if [ -f "$ML_ENGINE_DIR/.env" ]; then
    echo "📄 Loading environment variables from ml_engine/.env"
    export $(grep -v '^#' "$ML_ENGINE_DIR/.env" | xargs)
fi

# Activate Python virtual environment
VENV_PATH="$ML_ENGINE_DIR/venv"

if [ -d "$VENV_PATH" ]; then
    echo "🐍 Activating Python virtual environment: $VENV_PATH"
    source "$VENV_PATH/bin/activate"
else
    echo "⚠️ Virtual environment not found at $VENV_PATH"
    echo "⚠️ Using system Python"
fi

# Set Python path
export PYTHONPATH="$ML_ENGINE_DIR:$PYTHONPATH"

# Log file
DATE=$(date +%Y%m%d)
LOG_DIR="$ML_ENGINE_DIR/logs/cron"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/daily_training_cron_$DATE.log"

echo "=============================================================================" | tee -a "$LOG_FILE"
echo "🚀 Daily Incremental Training - Cron Job" | tee -a "$LOG_FILE"
echo "⏰ Started at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')" | tee -a "$LOG_FILE"
echo "=============================================================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Run daily training script
echo "📊 Executing daily incremental training script..." | tee -a "$LOG_FILE"

cd "$ML_ENGINE_DIR"

python3 scripts/daily_incremental_training.py \
    --pairs "EUR/USD,GBP/USD,USD/JPY,AUD/USD,USD/CAD" \
    --timeframes "1h,4h,1d" \
    2>&1 | tee -a "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

echo "" | tee -a "$LOG_FILE"
echo "=============================================================================" | tee -a "$LOG_FILE"

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Daily training completed successfully" | tee -a "$LOG_FILE"
else
    echo "❌ Daily training failed with exit code: $EXIT_CODE" | tee -a "$LOG_FILE"
fi

echo "⏰ Finished at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')" | tee -a "$LOG_FILE"
echo "=============================================================================" | tee -a "$LOG_FILE"

# Deactivate virtual environment
if [ -d "$VENV_PATH" ]; then
    deactivate
fi

exit $EXIT_CODE
