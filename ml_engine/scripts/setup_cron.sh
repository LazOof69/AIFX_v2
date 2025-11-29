#!/bin/bash
# AIFX_v2 Data Collection Cron Setup
# This script sets up automated data collection for Twelve Data API

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ML_ENGINE_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
VENV_PATH="$ML_ENGINE_DIR/venv"
COLLECTOR_SCRIPT="$SCRIPT_DIR/data_collector.py"

# LD_PRELOAD for scikit-learn
export LD_PRELOAD="$VENV_PATH/lib/python3.9/site-packages/scikit_learn.libs/libgomp-d22c30c5.so.1.0.0"

echo "🔧 AIFX_v2 Cron Setup"
echo "===================="
echo "ML Engine Dir: $ML_ENGINE_DIR"
echo "Collector Script: $COLLECTOR_SCRIPT"
echo ""

# Create cron jobs
CRON_FILE="/tmp/aifx_cron.txt"

cat > $CRON_FILE << 'EOF'
# AIFX_v2 Market Data Collection
# Collects forex data from Twelve Data API and saves to database

# 15min timeframe: Every 15 minutes
*/15 * * * * cd /root/AIFX_v2/ml_engine && export LD_PRELOAD=/root/AIFX_v2/ml_engine/venv/lib/python3.9/site-packages/scikit_learn.libs/libgomp-d22c30c5.so.1.0.0 && source venv/bin/activate && source .env && export TWELVE_DATA_KEY && /root/AIFX_v2/ml_engine/venv/bin/python scripts/data_collector.py --mode incremental --timeframe 15min >> /tmp/data-collector-15min.log 2>&1

# 1h timeframe: Every hour at minute 0
0 * * * * cd /root/AIFX_v2/ml_engine && export LD_PRELOAD=/root/AIFX_v2/ml_engine/venv/lib/python3.9/site-packages/scikit_learn.libs/libgomp-d22c30c5.so.1.0.0 && source venv/bin/activate && source .env && export TWELVE_DATA_KEY && /root/AIFX_v2/ml_engine/venv/bin/python scripts/data_collector.py --mode incremental --timeframe 1h >> /tmp/data-collector-1h.log 2>&1

# Weekly cleanup: Delete data older than 1 year (optional, every Sunday at 2am)
# 0 2 * * 0 psql -U aifx_user -d aifx_db -c "DELETE FROM market_data WHERE timestamp < NOW() - INTERVAL '1 year';" >> /tmp/data-cleanup.log 2>&1

EOF

echo "📋 Generated Cron Configuration:"
echo "================================"
cat $CRON_FILE
echo ""
echo "================================"
echo ""

# Ask user if they want to install
read -p "❓ Install these cron jobs? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    # Backup existing crontab
    crontab -l > /tmp/crontab_backup_$(date +%Y%m%d_%H%M%S).txt 2>/dev/null

    # Install new cron jobs
    (crontab -l 2>/dev/null; cat $CRON_FILE) | crontab -

    echo "✅ Cron jobs installed successfully!"
    echo ""
    echo "📊 Current crontab:"
    crontab -l | grep -A 2 "AIFX_v2"
    echo ""
    echo "📁 Log files will be created at:"
    echo "   - /tmp/data-collector-15min.log"
    echo "   - /tmp/data-collector-1h.log"
    echo ""
    echo "🔍 To view logs:"
    echo "   tail -f /tmp/data-collector-15min.log"
    echo "   tail -f /tmp/data-collector-1h.log"
else
    echo "❌ Installation cancelled"
    echo "📋 Cron configuration saved to: $CRON_FILE"
    echo "   You can manually install it with: crontab $CRON_FILE"
fi

echo ""
echo "📊 Expected API Usage:"
echo "   - 15min: 3 pairs × 96 times/day = 288 requests/day"
echo "   - 1h:    3 pairs × 24 times/day = 72 requests/day"
echo "   - Total: 360 requests/day (45% of 800 daily limit)"
