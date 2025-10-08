#!/usr/bin/env python3
"""
Collect Fundamental Data from FRED API
Fetches interest rates, GDP, CPI, unemployment data for forex pairs

Usage:
    python collect_fundamental_data.py [--test] [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD]

Environment Variables:
    FRED_API_KEY: FRED API key (required)
    DB_HOST: Database host (default: localhost)
    DB_PORT: Database port (default: 5432)
    DB_NAME: Database name (default: aifx_v2_dev)
    DB_USER: Database user (default: postgres)
    DB_PASSWORD: Database password (default: postgres)
"""

import os
import sys
import requests
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

# FRED API Configuration
FRED_API_KEY = os.getenv('FRED_API_KEY', '')
FRED_BASE_URL = 'https://api.stlouisfed.org/fred/series/observations'

# Database Configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'aifx_v2_dev'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}


class FREDDataCollector:
    """Collects fundamental economic data from FRED API"""

    # FRED Series IDs for key indicators
    SERIES_MAP = {
        'US': {
            'interest_rate': 'FEDFUNDS',           # Federal Funds Rate
            'gdp': 'GDP',                           # Gross Domestic Product (billions)
            'cpi': 'CPIAUCSL',                      # Consumer Price Index
            'unemployment': 'UNRATE',               # Unemployment Rate (%)
            'inflation': 'FPCPITOTLZGUSA',          # Inflation YoY (%)
            'pmi': 'MANEMP',                        # Manufacturing PMI proxy
            'trade_balance': 'BOPGSTB',             # Trade Balance
        },
        'EU': {
            'interest_rate': 'ECBDFR',              # ECB Deposit Facility Rate
            'gdp': 'CLVMNACSCAB1GQEA19',            # Euro Area GDP
            'cpi': 'CP0000EZ19M086NEST',            # Euro Area CPI
            'unemployment': 'LRHUTTTTEZM156S',      # Euro Area Unemployment
        },
        'GB': {
            'interest_rate': 'IRSTCB01GBM156N',     # Bank of England Rate
            'gdp': 'GBRRGDPQDSNAQ',                 # UK GDP
            'cpi': 'GBRCPIALLMINMEI',               # UK CPI
            'unemployment': 'LRHUTTTTGBM156S',      # UK Unemployment
        },
        'JP': {
            'interest_rate': 'IRSTCI01JPM156N',     # Bank of Japan Rate
            'gdp': 'JPNRGDPEXP',                    # Japan GDP
            'cpi': 'JPNCPIALLMINMEI',               # Japan CPI
            'unemployment': 'LRHUTTTTJPM156S',      # Japan Unemployment
        }
    }

    def __init__(self, api_key: str):
        """Initialize FRED data collector"""
        if not api_key:
            raise ValueError(
                "FRED API key is required.\n"
                "Get one free at: https://fred.stlouisfed.org/docs/api/api_key.html"
            )

        self.api_key = api_key
        self.session = requests.Session()
        logger.info("✅ FRED Data Collector initialized")

    def fetch_series(
        self,
        series_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> pd.DataFrame:
        """
        Fetch data for a specific FRED series

        Args:
            series_id: FRED series ID (e.g., 'FEDFUNDS')
            start_date: Start date YYYY-MM-DD (default: 20 years ago)
            end_date: End date YYYY-MM-DD (default: today)

        Returns:
            DataFrame with date and value columns
        """
        if not start_date:
            start_date = (datetime.now() - timedelta(days=365*20)).strftime('%Y-%m-%d')
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')

        params = {
            'series_id': series_id,
            'api_key': self.api_key,
            'file_type': 'json',
            'observation_start': start_date,
            'observation_end': end_date
        }

        try:
            logger.info(f"Fetching FRED series: {series_id} ({start_date} to {end_date})")
            response = self.session.get(FRED_BASE_URL, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()

            # Check for errors
            if 'error_message' in data:
                logger.error(f"FRED API error for {series_id}: {data['error_message']}")
                return pd.DataFrame()

            observations = data.get('observations', [])

            if not observations:
                logger.warning(f"No data found for series: {series_id}")
                return pd.DataFrame()

            # Convert to DataFrame
            df = pd.DataFrame(observations)
            df = df[['date', 'value']]

            # Convert value to numeric, handle '.' for missing data
            df['value'] = pd.to_numeric(df['value'], errors='coerce')
            df = df.dropna()

            logger.info(f"✅ Fetched {len(df)} observations for {series_id}")
            return df

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to fetch series {series_id}: {e}")
            return pd.DataFrame()
        except Exception as e:
            logger.error(f"❌ Unexpected error fetching {series_id}: {e}")
            return pd.DataFrame()

    def collect_all_indicators(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Dict[str, pd.DataFrame]]:
        """
        Collect all fundamental indicators for all countries

        Returns:
            Nested dict: {country: {indicator: DataFrame}}
        """
        results = {}
        total_series = sum(len(indicators) for indicators in self.SERIES_MAP.values())
        current = 0

        for country, indicators in self.SERIES_MAP.items():
            logger.info(f"\n{'='*60}")
            logger.info(f"Collecting data for {country}...")
            logger.info(f"{'='*60}")
            results[country] = {}

            for indicator_name, series_id in indicators.items():
                current += 1
                logger.info(f"[{current}/{total_series}] {country} - {indicator_name}")

                df = self.fetch_series(series_id, start_date, end_date)
                results[country][indicator_name] = df

                # Rate limiting: FRED allows 120 req/min
                time.sleep(0.6)

        return results

    def save_to_database(self, data: Dict[str, Dict[str, pd.DataFrame]]) -> int:
        """
        Save collected data to PostgreSQL database

        Args:
            data: Nested dict from collect_all_indicators()

        Returns:
            Number of records inserted/updated
        """
        try:
            logger.info("\n" + "="*60)
            logger.info("Saving to database...")
            logger.info("="*60)

            conn = psycopg2.connect(**DB_CONFIG)
            cursor = conn.cursor()

            total_inserted = 0

            for country, indicators in data.items():
                for indicator_name, df in indicators.items():
                    if df.empty:
                        logger.warning(f"⚠️  No data for {country} - {indicator_name}, skipping")
                        continue

                    for _, row in df.iterrows():
                        # Upsert query (insert or update if exists)
                        query = """
                        INSERT INTO fundamental_data (date, country, indicator, value, source, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                        ON CONFLICT (date, country, indicator)
                        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                        """

                        cursor.execute(query, (
                            row['date'],
                            country,
                            indicator_name,
                            float(row['value']),
                            'FRED'
                        ))
                        total_inserted += 1

                    logger.info(f"✅ Saved {len(df)} records for {country} - {indicator_name}")

            conn.commit()
            logger.info(f"\n{'='*60}")
            logger.info(f"✅ TOTAL: Saved {total_inserted} fundamental data records to database")
            logger.info(f"{'='*60}\n")

            cursor.close()
            conn.close()

            return total_inserted

        except psycopg2.Error as e:
            logger.error(f"❌ Database error: {e}")
            if conn:
                conn.rollback()
            return 0
        except Exception as e:
            logger.error(f"❌ Unexpected error saving to database: {e}")
            if conn:
                conn.rollback()
            return 0

    def sync_interest_rates_table(self) -> int:
        """
        Sync interest rates to optimized interest_rates table

        Returns:
            Number of dates synced
        """
        try:
            logger.info("\n" + "="*60)
            logger.info("Syncing interest_rates table...")
            logger.info("="*60)

            conn = psycopg2.connect(**DB_CONFIG)
            cursor = conn.cursor()

            # Get all interest rate data
            cursor.execute("""
                SELECT date, country, value
                FROM fundamental_data
                WHERE indicator = 'interest_rate'
                ORDER BY date
            """)

            rows = cursor.fetchall()

            if not rows:
                logger.warning("⚠️  No interest rate data found in fundamental_data table")
                cursor.close()
                conn.close()
                return 0

            # Group by date
            rates_by_date = {}
            for date, country, value in rows:
                if date not in rates_by_date:
                    rates_by_date[date] = {}

                # Map country code to column name
                country_column_map = {
                    'US': 'fed_rate',
                    'EU': 'ecb_rate',
                    'GB': 'boe_rate',
                    'JP': 'boj_rate'
                }

                column_name = country_column_map.get(country)
                if column_name:
                    rates_by_date[date][column_name] = value

            # Insert/update interest_rates table
            synced_count = 0
            for date, rates in rates_by_date.items():
                query = """
                INSERT INTO interest_rates (date, fed_rate, ecb_rate, boe_rate, boj_rate, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                ON CONFLICT (date)
                DO UPDATE SET
                    fed_rate = COALESCE(EXCLUDED.fed_rate, interest_rates.fed_rate),
                    ecb_rate = COALESCE(EXCLUDED.ecb_rate, interest_rates.ecb_rate),
                    boe_rate = COALESCE(EXCLUDED.boe_rate, interest_rates.boe_rate),
                    boj_rate = COALESCE(EXCLUDED.boj_rate, interest_rates.boj_rate),
                    updated_at = NOW()
                """

                cursor.execute(query, (
                    date,
                    rates.get('fed_rate'),
                    rates.get('ecb_rate'),
                    rates.get('boe_rate'),
                    rates.get('boj_rate')
                ))
                synced_count += 1

            conn.commit()
            logger.info(f"✅ Synced {synced_count} dates to interest_rates table")

            cursor.close()
            conn.close()

            return synced_count

        except psycopg2.Error as e:
            logger.error(f"❌ Database error syncing interest rates: {e}")
            if conn:
                conn.rollback()
            return 0
        except Exception as e:
            logger.error(f"❌ Unexpected error syncing interest rates: {e}")
            if conn:
                conn.rollback()
            return 0

    def test_connection(self) -> bool:
        """Test FRED API connection"""
        try:
            logger.info("Testing FRED API connection...")
            df = self.fetch_series('FEDFUNDS',
                                   start_date=(datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'),
                                   end_date=datetime.now().strftime('%Y-%m-%d'))

            if not df.empty:
                logger.info(f"✅ FRED API connection successful! Fetched {len(df)} test records")
                logger.info(f"Latest Fed Rate: {df.iloc[-1]['value']}% on {df.iloc[-1]['date']}")
                return True
            else:
                logger.error("❌ FRED API test failed: No data returned")
                return False

        except Exception as e:
            logger.error(f"❌ FRED API test failed: {e}")
            return False


def main():
    """Main execution function"""

    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Collect fundamental data from FRED API')
    parser.add_argument('--test', action='store_true', help='Test FRED API connection only')
    parser.add_argument('--start-date', type=str, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, help='End date (YYYY-MM-DD)')
    args = parser.parse_args()

    # Check for API key
    api_key = os.getenv('FRED_API_KEY')
    if not api_key:
        logger.error("❌ FRED_API_KEY not found in environment variables")
        logger.info("📝 Register for free at: https://fred.stlouisfed.org/docs/api/api_key.html")
        logger.info("📝 Then set: export FRED_API_KEY='your_key_here'")
        sys.exit(1)

    # Initialize collector
    collector = FREDDataCollector(api_key)

    # Test mode
    if args.test:
        logger.info("Running in TEST mode...")
        if collector.test_connection():
            logger.info("✅ Test passed! Ready to collect data.")
            sys.exit(0)
        else:
            logger.error("❌ Test failed! Check your API key and internet connection.")
            sys.exit(1)

    # Collect data
    logger.info("\n" + "="*60)
    logger.info("🚀 Starting fundamental data collection from FRED...")
    logger.info("="*60)

    data = collector.collect_all_indicators(
        start_date=args.start_date,
        end_date=args.end_date
    )

    # Save to database
    total_saved = collector.save_to_database(data)

    if total_saved == 0:
        logger.error("❌ No data saved to database")
        sys.exit(1)

    # Sync interest rates table
    synced_count = collector.sync_interest_rates_table()

    # Final summary
    logger.info("\n" + "="*60)
    logger.info("📊 COLLECTION SUMMARY")
    logger.info("="*60)
    logger.info(f"Total records saved: {total_saved}")
    logger.info(f"Interest rate dates synced: {synced_count}")
    logger.info("="*60)
    logger.info("✅ Fundamental data collection complete!")
    logger.info("="*60 + "\n")


if __name__ == '__main__':
    main()
