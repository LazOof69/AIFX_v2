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
4. This script uses direct PostgreSQL access (Line 24: import psycopg2)
5. This script stores FRED API key (should be Backend's secret)

CURRENT ARCHITECTURE (WRONG):
----------------------------
ML Engine (collect_fundamental_data.py)
    └─> Fetches data from FRED API
    └─> Writes directly to PostgreSQL database ❌
    └─> Manages FRED API key ❌

DESIRED ARCHITECTURE (CORRECT):
------------------------------
Backend Service
    └─> Scheduled job (cron/PM2) runs data collection
    └─> Fetches data from FRED API
    └─> Manages API keys securely
    └─> Writes to PostgreSQL (only Backend has DB access) ✅
    └─> Exposes data via REST API

ML Engine
    └─> Uses Backend API to read fundamental data
    └─> Never collects external data directly ✅
    └─> Never manages API keys ✅

RECOMMENDATION:
--------------
🔄 MOVE this entire script to Backend service

Proposed location:
  /root/AIFX_v2/backend/src/services/dataCollection/fredDataCollector.js

Or keep as Python script but run as Backend subprocess:
  /root/AIFX_v2/backend/scripts/collect_fundamental_data.py

BENEFITS OF MOVING TO BACKEND:
------------------------------
1. ✅ Separation of Concerns: ML Engine focuses on ML, Backend handles data
2. ✅ Single Database Access Point: Only Backend accesses PostgreSQL
3. ✅ Centralized API Key Management: FRED_API_KEY stays in Backend .env
4. ✅ Centralized Scheduling: Backend PM2 manages all data collection jobs
5. ✅ Better Security: No external API keys in ML Engine
6. ✅ Easier Scaling: Data collection scales independently from ML
7. ✅ API-First: ML Engine would use Backend API to access fundamental data

MIGRATION PLAN:
--------------
Option A: Convert to Node.js Service (Recommended)
------------------------------------------------
1. Create backend/src/services/dataCollection/fredDataCollector.js
2. Use axios to fetch from FRED API
3. Use Sequelize ORM to write to FundamentalData model
4. Schedule via PM2 ecosystem.config.js with cron
5. Expose data via Backend API:
   - GET /api/v1/ml/training-data/fundamental

Estimated Time: 5-6 hours
Files to Create:
- backend/src/services/dataCollection/fredDataCollector.js (new)
- backend/src/jobs/collectFundamentalData.js (scheduler)
- backend/src/models/FundamentalData.js (Sequelize model)
- backend/src/migrations/YYYYMMDDHHMMSS-create-fundamental-data.js
- Update backend/ecosystem.config.js (cron scheduling)
- Update backend/.env (add FRED_API_KEY)

Node.js Implementation Example:
```javascript
// backend/src/services/dataCollection/fredDataCollector.js
const axios = require('axios');
const { FundamentalData } = require('../../models');

class FREDDataCollector {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.stlouisfed.org/fred/series/observations';
  }

  async fetchSeries(seriesId, startDate, endDate) {
    const response = await axios.get(this.baseUrl, {
      params: {
        series_id: seriesId,
        api_key: this.apiKey,
        observation_start: startDate,
        observation_end: endDate,
        file_type: 'json'
      }
    });
    return response.data.observations;
  }

  async collectAndStore(country, indicator, seriesId, startDate, endDate) {
    const data = await this.fetchSeries(seriesId, startDate, endDate);

    for (const observation of data) {
      await FundamentalData.upsert({
        date: observation.date,
        country: country,
        indicator: indicator,
        value: parseFloat(observation.value),
        source: 'FRED',
        series_id: seriesId
      });
    }

    console.log(`✅ Collected ${data.length} ${indicator} records for ${country}`);
  }
}

module.exports = FREDDataCollector;
```

Option B: Keep as Python Script but Manage from Backend
-------------------------------------------------------
1. Move script to backend/scripts/collect_fundamental_data.py
2. Create Node.js wrapper: backend/src/jobs/fredDataJob.js
3. Use child_process.spawn() to run Python script
4. Schedule via PM2 ecosystem.config.js
5. Python script writes to database (Backend has DB access)

Estimated Time: 2-3 hours
Files to Move/Create:
- backend/scripts/collect_fundamental_data.py (moved from ml_engine)
- backend/src/jobs/fredDataJob.js (new wrapper)
- Update backend/ecosystem.config.js (cron scheduling)
- Update backend/.env (add FRED_API_KEY)

Option C: API-Based Approach (Keep in ML Engine)
------------------------------------------------
If this script MUST stay in ML Engine:
- Remove direct PostgreSQL access
- Send collected data to Backend via REST API:
  POST /api/v1/ml/training-data/fundamental (bulk insert)
- Backend handles database writes
- Backend manages FRED_API_KEY

Estimated Time: 2-3 hours
Changes Required:
- Replace psycopg2 with Backend API client
- Implement batch POST to Backend API
- Backend must create bulk insert endpoint
- Backend must proxy FRED API requests (or accept bulk data)

SCHEDULING:
----------
Current: Manual execution or custom cron
Recommended: PM2 scheduled job in Backend

Example PM2 config:
{
  "name": "collect-fundamental-data",
  "script": "src/jobs/collectFundamentalData.js",
  "cron_restart": "0 2 * * 0",  // Weekly Sunday 2 AM
  "autorestart": false,
  "watch": false,
  "env": {
    "FRED_API_KEY": "your-api-key-here"
  }
}

DATA COLLECTED BY THIS SCRIPT:
-----------------------------
Countries: US, EU, GB, JP
Indicators per country:
- interest_rate: Central bank policy rate
- gdp: Gross Domestic Product
- cpi: Consumer Price Index
- unemployment: Unemployment rate
- inflation: Year-over-year inflation
- pmi: Manufacturing PMI
- trade_balance: Trade balance

FRED Series IDs (Lines 54-81):
- US: FEDFUNDS, GDP, CPIAUCSL, UNRATE, FPCPITOTLZGUSA, MANEMP, BOPGSTB
- EU: ECBDFR, CLVMNACSCAB1GQEA19, CP0000EZ19M086NEST, LRHUTTTTEZM156S
- GB: IRSTCB01GBM156N, GBRRGDPQDSNAQ, GBRCPIALLMINMEI, LRHUTTTTGBM156S
- JP: IRSTCI01JPM156N, JPNRGDPEXP, JPNCPIALLMINMEI, LRHUTTTTJPM156S

PRIORITY: LOW
-------------
- This script is for v2.0 advanced features (fundamental analysis)
- Not critical for current v1.0 production system
- Can be completed in Phase 6 (Backend enhancement phase)
- Daily/weekly training (v1.0) doesn't depend on this
- FRED data updates infrequently (monthly/quarterly)

DEPENDENCIES:
------------
This script collects data that is used by:
- data_processing/fundamental_features.py (Lines 79-210: get_interest_rates, get_gdp_data, get_cpi_data)
- scripts/prepare_v2_training_data.py (v2.0 multi-input training)

CURRENT DATABASE ACCESS (Lines 200-350):
----------------------------------------
This script directly:
- Connects to PostgreSQL (Line 210: psycopg2.connect)
- Queries fundamental_data table (Line 230)
- Inserts/updates fundamental data (Lines 250-280)
❌ ALL OF THIS SHOULD BE IN BACKEND

ESTIMATED TOTAL WORK:
--------------------
Option A (Node.js): 5-6 hours
Option B (Python + wrapper): 2-3 hours
Option C (API-based): 2-3 hours

RECOMMENDED: Option A (Full Node.js rewrite)
- Modern, maintainable code
- Native integration with Backend
- Better error handling and logging
- Easier to extend with more data sources
- Sequelize ORM for database operations

SECURITY CONSIDERATIONS:
-----------------------
FRED API Key Management:
- Current: Stored in ML Engine .env ❌
- Desired: Stored in Backend .env only ✅
- Backend can rate-limit FRED requests
- Backend can cache FRED responses (Redis)
- Backend can implement retry logic

API Rate Limits:
- FRED API: 120 requests/minute
- Should implement exponential backoff
- Should cache responses (1 day TTL for historical data)

ACTION ITEMS:
------------
1. [ ] Decide on migration approach (A, B, or C)
2. [ ] Move FRED_API_KEY to Backend .env
3. [ ] Create Backend service/job for FRED data collection
4. [ ] Create FundamentalData Sequelize model in Backend
5. [ ] Implement scheduling via PM2
6. [ ] Test end-to-end data collection flow
7. [ ] Verify ML Engine can access fundamental data via Backend API
8. [ ] Remove this script from ml_engine/ (after migration)

REFERENCE:
---------
- FRED API Docs: https://fred.stlouisfed.org/docs/api/fred/
- Architecture plan: /root/AIFX_v2/MICROSERVICES_REFACTOR_PLAN.md
- Progress tracking: /root/AIFX_v2/ml_engine/PHASE5_SCRIPT_REFACTOR_PROGRESS.md
- Backend API: /root/AIFX_v2/backend/src/routes/mlRoutes.js (future)

═══════════════════════════════════════════════════════════════════════
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
