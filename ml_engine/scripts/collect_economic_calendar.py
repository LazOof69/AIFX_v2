#!/usr/bin/env python3
"""
Collect Economic Calendar Events from Investing.com via investpy
Fetches high/medium impact events for USD, EUR, GBP, JPY currencies

Usage:
    python collect_economic_calendar.py [--test] [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD] [--days N]

Environment Variables:
    DB_HOST: Database host (default: localhost)
    DB_PORT: Database port (default: 5432)
    DB_NAME: Database name (default: aifx_v2_dev)
    DB_USER: Database user (default: postgres)
    DB_PASSWORD: Database password (default: postgres)

Examples:
    # Test mode - collect last 7 days
    python collect_economic_calendar.py --test

    # Collect last 30 days
    python collect_economic_calendar.py --days 30

    # Collect specific date range
    python collect_economic_calendar.py --start-date 2024-01-01 --end-date 2024-12-31

═══════════════════════════════════════════════════════════════════════
🚧 TODO: Phase 5 Architecture Refactoring - SHOULD MOVE TO BACKEND
═══════════════════════════════════════════════════════════════════════

STATUS: ⚠️ ARCHITECTURAL VIOLATION - Data Collection in ML Engine

PROBLEM:
-------
This script violates microservices architecture principles:
1. ML Engine should NOT be responsible for data collection
2. ML Engine should focus on machine learning tasks only
3. Data collection is a Backend service responsibility
4. This script uses direct PostgreSQL access (Line 33: import psycopg2)

CURRENT ARCHITECTURE (WRONG):
----------------------------
ML Engine (collect_economic_calendar.py)
    └─> Fetches data from Investing.com API
    └─> Writes directly to PostgreSQL database ❌

DESIRED ARCHITECTURE (CORRECT):
------------------------------
Backend Service
    └─> Scheduled job (cron/PM2) runs data collection
    └─> Fetches data from external APIs
    └─> Writes to PostgreSQL (only Backend has DB access) ✅

ML Engine
    └─> Uses Backend API to read economic events
    └─> Never collects external data directly ✅

RECOMMENDATION:
--------------
🔄 MOVE this entire script to Backend service

Proposed location:
  /root/AIFX_v2/backend/src/services/dataCollection/economicCalendar.js

Or keep as Python script but run as Backend subprocess:
  /root/AIFX_v2/backend/scripts/collect_economic_calendar.py

BENEFITS OF MOVING TO BACKEND:
------------------------------
1. ✅ Separation of Concerns: ML Engine focuses on ML, Backend handles data
2. ✅ Single Database Access Point: Only Backend accesses PostgreSQL
3. ✅ Centralized Scheduling: Backend PM2 can manage all data collection jobs
4. ✅ Better Security: No database credentials in ML Engine
5. ✅ Easier Scaling: Data collection scales independently from ML
6. ✅ API-First: ML Engine would use Backend API to access events

MIGRATION PLAN:
--------------
Option A: Convert to Node.js Service (Recommended)
------------------------------------------------
1. Create backend/src/services/dataCollection/economicCalendar.js
2. Use npm package like 'node-fetch' or 'axios' to fetch from Investing.com API
3. Use Sequelize ORM to write to EconomicEvent model
4. Schedule via PM2 ecosystem.config.js with cron
5. Expose data via existing Backend API:
   - GET /api/v1/ml/training-data/economic-events

Estimated Time: 4-5 hours
Files to Create:
- backend/src/services/dataCollection/economicCalendar.js (new)
- backend/src/jobs/collectEconomicCalendar.js (scheduler)
- Update backend/ecosystem.config.js (cron scheduling)

Option B: Keep as Python Script but Manage from Backend
-------------------------------------------------------
1. Move script to backend/scripts/collect_economic_calendar.py
2. Create Node.js wrapper: backend/src/jobs/economicCalendarJob.js
3. Use child_process.spawn() to run Python script
4. Schedule via PM2 ecosystem.config.js
5. Python script still writes to database (Backend has DB access)

Estimated Time: 2-3 hours
Files to Move/Create:
- backend/scripts/collect_economic_calendar.py (moved from ml_engine)
- backend/src/jobs/economicCalendarJob.js (new wrapper)
- Update backend/ecosystem.config.js (cron scheduling)

ALTERNATIVE (If Keeping in ML Engine):
--------------------------------------
If this script MUST stay in ML Engine, at minimum:
- Remove direct PostgreSQL access
- Send collected data to Backend via REST API:
  POST /api/v1/ml/training-data/economic-events (bulk insert)
- Let Backend handle database writes

Estimated Time: 2 hours
Changes Required:
- Replace psycopg2 with Backend API client
- Implement batch POST to Backend API
- Backend must create bulk insert endpoint

SCHEDULING:
----------
Current: Manual execution or custom cron
Recommended: PM2 scheduled job in Backend

Example PM2 config:
{
  "name": "collect-economic-calendar",
  "script": "src/jobs/collectEconomicCalendar.js",
  "cron_restart": "0 0 * * *",  // Daily at midnight
  "autorestart": false,
  "watch": false
}

PRIORITY: LOW
-------------
- This script is for v2.0 advanced features (fundamental analysis)
- Not critical for current v1.0 production system
- Can be completed in Phase 6 (Backend enhancement phase)
- Daily/weekly training (v1.0) doesn't depend on this

DEPENDENCIES:
------------
This script collects data that is used by:
- data_processing/fundamental_features.py (Line 211-265: get_economic_events)
- scripts/prepare_v2_training_data.py (v2.0 multi-input training)

CURRENT DATABASE ACCESS (Lines 180-230):
----------------------------------------
This script directly:
- Connects to PostgreSQL (Line 186: psycopg2.connect)
- Queries economic_events table (Line 200)
- Inserts/updates events (Lines 210-225)
❌ ALL OF THIS SHOULD BE IN BACKEND

ESTIMATED TOTAL WORK:
--------------------
Option A (Node.js): 4-5 hours
Option B (Python + wrapper): 2-3 hours
Option C (API-based): 2 hours

RECOMMENDED: Option B (Python script managed by Backend)
- Keeps existing Python code
- Quick to implement
- Maintains Backend as sole DB accessor
- Easy to schedule with PM2

ACTION ITEMS:
------------
1. [ ] Decide on migration approach (A, B, or C)
2. [ ] Create Backend service/job for economic calendar collection
3. [ ] Move or refactor this script
4. [ ] Update scheduling to use PM2
5. [ ] Test end-to-end data collection flow
6. [ ] Verify ML Engine can access events via Backend API

REFERENCE:
---------
- Architecture plan: /root/AIFX_v2/MICROSERVICES_REFACTOR_PLAN.md
- Progress tracking: /root/AIFX_v2/ml_engine/PHASE5_SCRIPT_REFACTOR_PROGRESS.md
- Backend API: /root/AIFX_v2/backend/src/routes/mlRoutes.js (future)

═══════════════════════════════════════════════════════════════════════
"""

import os
import sys
import investpy
import pandas as pd
from datetime import datetime, timedelta
import logging
import psycopg2
from typing import Dict, List, Optional
import time
import argparse

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database Configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'aifx_v2_dev'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}


class EconomicCalendarCollector:
    """Collects economic calendar events from Investing.com via investpy"""

    # Country mapping (investpy uses full names)
    COUNTRIES = ['united states', 'united kingdom', 'japan', 'euro zone']

    # Currency mapping (zone -> currency code)
    CURRENCY_MAP = {
        'united states': 'USD',
        'united kingdom': 'GBP',
        'japan': 'JPY',
        'euro zone': 'EUR'
    }

    # Importance levels
    IMPORTANCES = ['high', 'medium', 'low']

    def __init__(self):
        """Initialize Economic Calendar Collector"""
        logger.info("✅ Economic Calendar Collector initialized")

    def fetch_calendar(
        self,
        start_date: datetime,
        end_date: datetime,
        importances: List[str] = None
    ) -> pd.DataFrame:
        """
        Fetch economic calendar events from investpy

        Args:
            start_date: Start date
            end_date: End date
            importances: List of importance levels (default: ['high', 'medium'])

        Returns:
            DataFrame with economic events
        """
        if importances is None:
            importances = ['high', 'medium']

        logger.info(f"📅 Fetching calendar: {start_date.date()} to {end_date.date()}")
        logger.info(f"   Countries: {', '.join(self.COUNTRIES)}")
        logger.info(f"   Importance: {', '.join(importances)}")

        try:
            calendar = investpy.economic_calendar(
                from_date=start_date.strftime('%d/%m/%Y'),
                to_date=end_date.strftime('%d/%m/%Y'),
                countries=self.COUNTRIES,
                importances=importances
            )

            logger.info(f"✅ Fetched {len(calendar)} events")
            return calendar

        except Exception as e:
            logger.error(f"❌ Failed to fetch calendar: {e}")
            return pd.DataFrame()

    def parse_event(self, row: pd.Series) -> Optional[Dict]:
        """
        Parse event row into database-ready format

        Args:
            row: DataFrame row from investpy

        Returns:
            Dictionary with parsed event data, or None if invalid
        """
        # Skip events without importance (usually holidays)
        if pd.isna(row['importance']) or row['importance'] not in ['high', 'medium', 'low']:
            return None

        # Combine date and time
        event_date_str = f"{row['date']} {row['time'] if pd.notna(row['time']) else '00:00'}"

        try:
            # investpy returns date as dd/mm/yyyy
            event_datetime = datetime.strptime(event_date_str, '%d/%m/%Y %H:%M')
        except ValueError:
            # If time is missing or invalid, use date only
            event_datetime = datetime.strptime(row['date'], '%d/%m/%Y')

        # Map zone to currency
        currency = self.CURRENCY_MAP.get(row['zone'], row['currency'])

        # Parse numeric values (handle None, '-', empty strings)
        def parse_value(val):
            if pd.isna(val) or val is None or val == '' or val == '-':
                return None
            # Remove % sign and convert to float
            if isinstance(val, str):
                val = val.replace('%', '').replace(',', '').strip()
                if val == '' or val == '-':
                    return None
            try:
                return float(val)
            except (ValueError, TypeError):
                return None

        return {
            'event_date': event_datetime,
            'currency': currency,
            'event_name': row['event'],
            'impact_level': row['importance'],  # 'high', 'medium', 'low'
            'forecast_value': parse_value(row['forecast']),
            'actual_value': parse_value(row['actual']),
            'previous_value': parse_value(row['previous']),
            'source': 'Investing.com'
        }

    def save_to_database(self, events: List[Dict], test_mode: bool = False) -> int:
        """
        Save events to PostgreSQL database using UPSERT

        Args:
            events: List of parsed event dictionaries
            test_mode: If True, only print SQL without executing

        Returns:
            Number of events inserted/updated
        """
        if not events:
            logger.warning("⚠️  No events to save")
            return 0

        logger.info(f"💾 Saving {len(events)} events to database...")

        if test_mode:
            logger.info("🧪 TEST MODE - Sample event:")
            logger.info(events[0])
            return 0

        try:
            conn = psycopg2.connect(**DB_CONFIG)
            cursor = conn.cursor()

            insert_count = 0
            update_count = 0

            for event in events:
                # UPSERT query (insert or update if event exists)
                # Unique constraint: event_date + currency + event_name
                query = """
                INSERT INTO economic_events (
                    event_date, currency, event_name, impact_level,
                    forecast_value, actual_value, previous_value, source
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (event_date, currency, event_name)
                DO UPDATE SET
                    impact_level = EXCLUDED.impact_level,
                    forecast_value = COALESCE(EXCLUDED.forecast_value, economic_events.forecast_value),
                    actual_value = COALESCE(EXCLUDED.actual_value, economic_events.actual_value),
                    previous_value = COALESCE(EXCLUDED.previous_value, economic_events.previous_value),
                    updated_at = CURRENT_TIMESTAMP
                RETURNING (xmax = 0) AS inserted;
                """

                cursor.execute(query, (
                    event['event_date'],
                    event['currency'],
                    event['event_name'],
                    event['impact_level'],
                    event['forecast_value'],
                    event['actual_value'],
                    event['previous_value'],
                    event['source']
                ))

                # Check if inserted (True) or updated (False)
                result = cursor.fetchone()
                if result and result[0]:
                    insert_count += 1
                else:
                    update_count += 1

            conn.commit()
            logger.info(f"✅ Inserted: {insert_count}, Updated: {update_count}")

            cursor.close()
            conn.close()

            return insert_count + update_count

        except Exception as e:
            logger.error(f"❌ Database error: {e}")
            if 'conn' in locals():
                conn.rollback()
                conn.close()
            return 0

    def collect_historical(
        self,
        start_date: datetime,
        end_date: datetime,
        batch_days: int = 90,
        test_mode: bool = False
    ) -> int:
        """
        Collect historical economic calendar data in batches

        Args:
            start_date: Start date
            end_date: End date
            batch_days: Number of days per batch (default: 90)
            test_mode: If True, don't save to database

        Returns:
            Total number of events collected
        """
        total_events = 0
        current_date = start_date

        logger.info(f"🚀 Starting historical collection: {start_date.date()} to {end_date.date()}")

        while current_date < end_date:
            batch_end = min(current_date + timedelta(days=batch_days), end_date)

            # Fetch calendar for this batch
            calendar_df = self.fetch_calendar(current_date, batch_end)

            if len(calendar_df) > 0:
                # Parse events (filter out None values from invalid events)
                events = [self.parse_event(row) for _, row in calendar_df.iterrows()]
                events = [e for e in events if e is not None]

                logger.info(f"   Parsed {len(events)} valid events (filtered out {len(calendar_df) - len(events)} invalid)")

                # Save to database
                saved_count = self.save_to_database(events, test_mode)
                total_events += saved_count

                # Rate limiting (be nice to investpy/Investing.com)
                time.sleep(1)
            else:
                logger.warning(f"⚠️  No events found for {current_date.date()} to {batch_end.date()}")

            current_date = batch_end

        logger.info(f"🎉 Collection complete! Total events: {total_events}")
        return total_events


def main():
    """Main function"""
    parser = argparse.ArgumentParser(
        description='Collect economic calendar events from Investing.com'
    )
    parser.add_argument(
        '--test',
        action='store_true',
        help='Test mode - collect last 7 days without saving to database'
    )
    parser.add_argument(
        '--days',
        type=int,
        default=None,
        help='Number of days to collect (backwards from today)'
    )
    parser.add_argument(
        '--start-date',
        type=str,
        default=None,
        help='Start date (YYYY-MM-DD)'
    )
    parser.add_argument(
        '--end-date',
        type=str,
        default=None,
        help='End date (YYYY-MM-DD)'
    )

    args = parser.parse_args()

    # Determine date range
    if args.test:
        logger.info("🧪 TEST MODE - Collecting last 7 days")
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)
        test_mode = True
    elif args.start_date and args.end_date:
        start_date = datetime.strptime(args.start_date, '%Y-%m-%d')
        end_date = datetime.strptime(args.end_date, '%Y-%m-%d')
        test_mode = False
    elif args.days:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=args.days)
        test_mode = False
    else:
        # Default: last 30 days
        logger.info("📅 No date range specified, collecting last 30 days")
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        test_mode = False

    # Create collector
    collector = EconomicCalendarCollector()

    # Collect data
    total = collector.collect_historical(
        start_date=start_date,
        end_date=end_date,
        batch_days=90,
        test_mode=test_mode
    )

    logger.info(f"✅ Collection complete: {total} events")

    # Show database stats (if not test mode)
    if not test_mode:
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            cursor = conn.cursor()

            cursor.execute("""
                SELECT
                    currency,
                    impact_level,
                    COUNT(*) as count
                FROM economic_events
                GROUP BY currency, impact_level
                ORDER BY currency, impact_level;
            """)

            logger.info("\n📊 Database Statistics:")
            for row in cursor.fetchall():
                logger.info(f"   {row[0]} {row[1]}: {row[2]} events")

            cursor.execute("SELECT COUNT(*) FROM economic_events;")
            total_db = cursor.fetchone()[0]
            logger.info(f"\n   Total events in database: {total_db}")

            cursor.close()
            conn.close()

        except Exception as e:
            logger.error(f"❌ Failed to query database stats: {e}")


if __name__ == '__main__':
    main()
