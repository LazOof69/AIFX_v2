#!/usr/bin/env python3
"""
Market Data Collector Script
Automatically fetches forex data from Twelve Data API and stores in database

Features:
- Incremental mode: Fetch latest candles (for cron jobs)
- Historical mode: Fetch historical data (one-time setup)
- Supports multiple pairs and timeframes
- Deduplication on timestamp+pair+timeframe
- API usage tracking

Usage:
    # Incremental (cron job)
    python data_collector.py --mode incremental --timeframe 15min
    python data_collector.py --mode incremental --timeframe 1h

    # Historical (one-time setup)
    python data_collector.py --mode historical --timeframe 15min --days 180
    python data_collector.py --mode historical --timeframe 1h --days 180
"""

import os
import sys
import argparse
import logging
from datetime import datetime, timedelta
from pathlib import Path
import requests

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from data_processing.twelvedata_fetcher import TwelveDataFetcher

# Setup logging
log_dir = Path(__file__).parent.parent / 'logs' / 'data_collection'
log_dir.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / f'collector_{datetime.now().strftime("%Y%m%d")}.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
BACKEND_API_URL = os.getenv('BACKEND_API_URL', 'http://localhost:3000')
BACKEND_API_KEY = os.getenv('ML_ENGINE_API_KEY', 'dev_ml_engine_key_replace_in_production')

# Target currency pairs (limited to 3 for API quota)
TARGET_PAIRS = ['EUR/USD', 'USD/JPY', 'GBP/USD']


class DataCollector:
    """Market data collector with database storage via Backend API"""

    def __init__(self):
        self.api_calls_count = 0
        self.successful_inserts = 0
        self.duplicate_skips = 0
        self.errors = 0

    def save_to_database(self, pair, timeframe, candles):
        """
        Save candles to database via Backend API (bulk insert)

        Args:
            pair: Currency pair (e.g., 'EUR/USD')
            timeframe: Timeframe (e.g., '15min', '1h')
            candles: List of candle dictionaries

        Returns:
            Number of successfully inserted candles
        """
        if not candles:
            logger.warning(f"No candles to save for {pair} {timeframe}")
            return 0

        try:
            # Call Backend API bulk insert endpoint
            response = requests.post(
                f"{BACKEND_API_URL}/api/v1/market/data/bulk",
                json={
                    'pair': pair,
                    'timeframe': timeframe,
                    'candles': candles,
                    'source': 'twelve_data'  # Use existing enum value
                },
                headers={
                    'Authorization': f'Bearer {BACKEND_API_KEY}',
                    'Content-Type': 'application/json'
                },
                timeout=60  # Longer timeout for bulk insert
            )

            if response.status_code == 201:
                result = response.json()
                inserted = result['data']['inserted']
                duplicates = result['data']['duplicatesSkipped']

                self.successful_inserts += inserted
                self.duplicate_skips += duplicates

                logger.info(f"✅ Saved {inserted}/{len(candles)} candles for {pair} {timeframe} ({duplicates} duplicates skipped)")
                return inserted
            else:
                logger.error(f"❌ Bulk insert failed: {response.status_code} - {response.text}")
                self.errors += 1
                return 0

        except Exception as e:
            logger.error(f"❌ Failed to save to database: {e}")
            self.errors += 1
            return 0

    def collect_incremental(self, timeframe):
        """
        Collect latest candles for all pairs (incremental mode)

        Args:
            timeframe: '15min' or '1h'
        """
        logger.info(f"🔄 Starting incremental collection for {timeframe}")
        logger.info(f"📊 Target pairs: {TARGET_PAIRS}")

        # Determine how many candles to fetch
        # For incremental, we fetch last 5 candles to ensure we don't miss any
        limit = 5

        for pair in TARGET_PAIRS:
            try:
                logger.info(f"🔍 Fetching {pair} {timeframe} (last {limit} candles)...")

                # Fetch from Twelve Data
                result = TwelveDataFetcher.fetch_historical_data(
                    pair=pair,
                    timeframe=timeframe,
                    limit=limit
                )

                self.api_calls_count += 1

                if result.get('success'):
                    candles = result.get('timeSeries', [])
                    logger.info(f"✅ Fetched {len(candles)} candles for {pair} {timeframe}")

                    # Save to database
                    self.save_to_database(pair, timeframe, candles)
                else:
                    logger.error(f"❌ Failed to fetch {pair} {timeframe}: {result.get('error')}")
                    self.errors += 1

            except Exception as e:
                logger.error(f"❌ Error collecting {pair} {timeframe}: {e}")
                self.errors += 1

        self._print_summary()

    def collect_historical(self, timeframe, days):
        """
        Collect historical data for all pairs (one-time setup)

        Args:
            timeframe: '15min' or '1h'
            days: Number of days to fetch (max ~180 for free tier)
        """
        logger.info(f"📜 Starting historical collection for {timeframe}")
        logger.info(f"📊 Target pairs: {TARGET_PAIRS}")
        logger.info(f"📅 Fetching last {days} days of data")

        # Calculate required API calls based on timeframe
        if timeframe == '15min':
            candles_per_day = 96  # 24h * 4
            total_candles = days * candles_per_day
        elif timeframe == '1h':
            candles_per_day = 24
            total_candles = days * candles_per_day
        else:
            logger.error(f"Unsupported timeframe: {timeframe}")
            return

        # Twelve Data free tier: max 5000 candles per request
        limit = min(total_candles, 5000)

        logger.info(f"📊 Will fetch {limit} candles per pair")
        logger.info(f"🔢 Total API calls: {len(TARGET_PAIRS)} (one per pair)")

        for pair in TARGET_PAIRS:
            try:
                logger.info(f"🔍 Fetching {pair} {timeframe} (historical {limit} candles)...")

                # Fetch from Twelve Data
                result = TwelveDataFetcher.fetch_historical_data(
                    pair=pair,
                    timeframe=timeframe,
                    limit=limit
                )

                self.api_calls_count += 1

                if result.get('success'):
                    candles = result.get('timeSeries', [])
                    logger.info(f"✅ Fetched {len(candles)} historical candles for {pair} {timeframe}")

                    # Save to database
                    self.save_to_database(pair, timeframe, candles)
                else:
                    logger.error(f"❌ Failed to fetch {pair} {timeframe}: {result.get('error')}")
                    self.errors += 1

            except Exception as e:
                logger.error(f"❌ Error collecting {pair} {timeframe}: {e}")
                self.errors += 1

        self._print_summary()

    def _print_summary(self):
        """Print collection summary"""
        logger.info("=" * 60)
        logger.info("📊 Collection Summary:")
        logger.info(f"  API Calls: {self.api_calls_count}")
        logger.info(f"  ✅ Successful Inserts: {self.successful_inserts}")
        logger.info(f"  ⏭️  Duplicate Skips: {self.duplicate_skips}")
        logger.info(f"  ❌ Errors: {self.errors}")
        logger.info("=" * 60)


def main():
    parser = argparse.ArgumentParser(description='Market Data Collector')
    parser.add_argument(
        '--mode',
        choices=['incremental', 'historical'],
        required=True,
        help='Collection mode: incremental (latest) or historical (one-time)'
    )
    parser.add_argument(
        '--timeframe',
        choices=['15min', '1h'],
        required=True,
        help='Timeframe to collect'
    )
    parser.add_argument(
        '--days',
        type=int,
        default=180,
        help='Number of days for historical mode (default: 180)'
    )

    args = parser.parse_args()

    collector = DataCollector()

    try:
        if args.mode == 'incremental':
            collector.collect_incremental(args.timeframe)
        else:  # historical
            collector.collect_historical(args.timeframe, args.days)

    except KeyboardInterrupt:
        logger.info("\n⚠️ Collection interrupted by user")
        collector._print_summary()
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        collector._print_summary()
        sys.exit(1)


if __name__ == '__main__':
    main()
