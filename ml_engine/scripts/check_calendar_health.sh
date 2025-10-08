#!/bin/bash
################################################################################
# Economic Calendar Health Check Script
#
# Purpose: Monitor economic calendar data quality and update status
# Checks:
# - Total event count
# - Recent updates (last 24h)
# - Upcoming events (next 7 days)
# - Data gaps
# - Last successful update time
#
# Usage: ./check_calendar_health.sh [--verbose]
#
# Author: AIFX v2 ML Engine
# Created: 2025-10-08
################################################################################

set -e

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-aifx_v2_dev}"
export PGPASSWORD="${DB_PASSWORD:-postgres}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

VERBOSE=0
if [ "$1" == "--verbose" ]; then
    VERBOSE=1
fi

# Function: Execute SQL and get result
query() {
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "$1" | xargs
}

echo "========================================="
echo "Economic Calendar Health Check"
echo "$(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="
echo ""

# 1. Total Events
echo "📊 Database Statistics:"
TOTAL_EVENTS=$(query "SELECT COUNT(*) FROM economic_events;")
echo "   Total events: $TOTAL_EVENTS"

if [ "$TOTAL_EVENTS" -lt 10000 ]; then
    echo -e "   ${YELLOW}⚠️  Warning: Event count seems low${NC}"
fi

# 2. Date Range
EARLIEST=$(query "SELECT MIN(event_date)::date FROM economic_events;")
LATEST=$(query "SELECT MAX(event_date)::date FROM economic_events;")
echo "   Date range: $EARLIEST to $LATEST"

# 3. Recent Updates
echo ""
echo "🔄 Update Status:"
UPDATED_24H=$(query "SELECT COUNT(*) FROM economic_events WHERE updated_at >= NOW() - INTERVAL '24 hours';")
echo "   Updated in last 24h: $UPDATED_24H events"

if [ "$UPDATED_24H" -eq 0 ]; then
    echo -e "   ${RED}❌ Warning: No updates in last 24 hours${NC}"
else
    echo -e "   ${GREEN}✅ System is updating normally${NC}"
fi

# 4. Upcoming High-Impact Events
echo ""
echo "📅 Upcoming High-Impact Events (Next 7 Days):"
UPCOMING_HIGH=$(query "SELECT COUNT(*) FROM economic_events WHERE impact_level = 'high' AND event_date BETWEEN NOW() AND NOW() + INTERVAL '7 days';")
echo "   Count: $UPCOMING_HIGH events"

if [ "$VERBOSE" -eq 1 ] && [ "$UPCOMING_HIGH" -gt 0 ]; then
    echo ""
    echo "   Details:"
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT
            TO_CHAR(event_date, 'YYYY-MM-DD HH24:MI') as date,
            currency,
            event_name
        FROM economic_events
        WHERE impact_level = 'high'
          AND event_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        ORDER BY event_date
        LIMIT 10;
    " | sed 's/^/   /'
fi

# 5. Currency Distribution
echo ""
echo "💱 Event Distribution by Currency:"
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT
        currency,
        SUM(CASE WHEN impact_level = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN impact_level = 'medium' THEN 1 ELSE 0 END) as medium,
        COUNT(*) as total
    FROM economic_events
    GROUP BY currency
    ORDER BY currency;
" | while read line; do
    echo "   $line"
done

# 6. Data Freshness
echo ""
echo "🕐 Data Freshness:"
LAST_UPDATE=$(query "SELECT MAX(updated_at)::timestamp(0) FROM economic_events;")
echo "   Last update: $LAST_UPDATE"

# Check if last update is more than 48 hours old
LAST_UPDATE_EPOCH=$(date -d "$LAST_UPDATE" +%s 2>/dev/null || echo 0)
NOW_EPOCH=$(date +%s)
HOURS_SINCE=$((($NOW_EPOCH - $LAST_UPDATE_EPOCH) / 3600))

if [ "$HOURS_SINCE" -gt 48 ]; then
    echo -e "   ${RED}❌ Warning: Data is $HOURS_SINCE hours old${NC}"
elif [ "$HOURS_SINCE" -gt 24 ]; then
    echo -e "   ${YELLOW}⚠️  Data is $HOURS_SINCE hours old${NC}"
else
    echo -e "   ${GREEN}✅ Data is fresh (${HOURS_SINCE}h old)${NC}"
fi

# 7. Check for gaps in upcoming events
echo ""
echo "🔍 Data Quality Checks:"
FUTURE_EVENTS=$(query "SELECT COUNT(*) FROM economic_events WHERE event_date > NOW();")
echo "   Future events: $FUTURE_EVENTS"

if [ "$FUTURE_EVENTS" -lt 100 ]; then
    echo -e "   ${YELLOW}⚠️  Low number of future events - consider updating${NC}"
else
    echo -e "   ${GREEN}✅ Sufficient future events${NC}"
fi

# 8. Last auto-update log check
echo ""
echo "📝 Last Auto-Update Log:"
if [ -f "/root/AIFX_v2/ml_engine/logs/calendar_auto_update.log" ]; then
    tail -5 /root/AIFX_v2/ml_engine/logs/calendar_auto_update.log | sed 's/^/   /'
else
    echo "   Log file not found"
fi

echo ""
echo "========================================="
echo "Health check complete"
echo "========================================="
