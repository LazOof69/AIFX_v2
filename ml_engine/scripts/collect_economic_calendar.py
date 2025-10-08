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
