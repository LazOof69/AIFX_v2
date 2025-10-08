#!/bin/bash
################################################################################
# Economic Calendar Auto-Update Script
#
# Purpose: Daily automatic update of economic calendar events
# - Update past 7 days (for actual values)
# - Fetch next 30 days (for upcoming forecasts)
#
# Schedule: Run daily at 01:00 AM via cron
# Cron entry: 0 1 * * * /root/AIFX_v2/ml_engine/scripts/update_calendar.sh
#
# Author: AIFX v2 ML Engine
# Created: 2025-10-08
################################################################################

set -e  # Exit on error

# Configuration
PROJECT_ROOT="/root/AIFX_v2/ml_engine"
VENV_PATH="$PROJECT_ROOT/venv"
SCRIPT_PATH="$PROJECT_ROOT/scripts/collect_economic_calendar.py"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/calendar_auto_update.log"
ERROR_LOG="$LOG_DIR/calendar_auto_update_error.log"

# Create log directory if not exists
mkdir -p "$LOG_DIR"

# Function: Log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function: Log error
log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "$ERROR_LOG" "$LOG_FILE"
}

# Start update
log "========================================="
log "Starting Economic Calendar Auto-Update"
log "========================================="

# Check if virtual environment exists
if [ ! -d "$VENV_PATH" ]; then
    log_error "Virtual environment not found at $VENV_PATH"
    exit 1
fi

# Check if script exists
if [ ! -f "$SCRIPT_PATH" ]; then
    log_error "Collection script not found at $SCRIPT_PATH"
    exit 1
fi

# Activate virtual environment
source "$VENV_PATH/bin/activate"
log "✅ Virtual environment activated"

# Calculate date range
# Update past 7 days (for actual values) + next 30 days (for forecasts)
START_DATE=$(date -d '7 days ago' '+%Y-%m-%d')
END_DATE=$(date -d '30 days' '+%Y-%m-%d')

log "📅 Date range: $START_DATE to $END_DATE"

# Run collection script
log "🚀 Starting data collection..."

if python "$SCRIPT_PATH" --start-date "$START_DATE" --end-date "$END_DATE" >> "$LOG_FILE" 2>&1; then
    log "✅ Collection completed successfully"

    # Get statistics from database
    log "📊 Fetching database statistics..."

    export PGPASSWORD="${DB_PASSWORD:-postgres}"
    STATS=$(psql -h "${DB_HOST:-localhost}" \
                 -U "${DB_USER:-postgres}" \
                 -d "${DB_NAME:-aifx_v2_dev}" \
                 -t -c "SELECT COUNT(*) FROM economic_events;")

    log "   Total events in database: $(echo $STATS | xargs)"

    # Check for recent events (within last 24 hours)
    RECENT=$(psql -h "${DB_HOST:-localhost}" \
                  -U "${DB_USER:-postgres}" \
                  -d "${DB_NAME:-aifx_v2_dev}" \
                  -t -c "SELECT COUNT(*) FROM economic_events WHERE updated_at >= NOW() - INTERVAL '24 hours';")

    log "   Updated in last 24h: $(echo $RECENT | xargs)"

else
    log_error "Collection failed - see logs for details"
    exit 1
fi

# Deactivate virtual environment
deactivate
log "✅ Update complete"
log "========================================="

exit 0
