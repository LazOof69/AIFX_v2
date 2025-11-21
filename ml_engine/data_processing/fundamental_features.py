#!/usr/bin/env python3
"""
Fundamental Feature Engineering for Forex Trading
Extracts and calculates fundamental features from economic data

Features:
- Interest rate differentials
- GDP year-over-year growth rates
- Inflation differentials
- Economic event features (days to event, impact scores)
- Time alignment with forward-fill logic

Author: AIFX v2 ML Engine
Created: 2025-10-08

═══════════════════════════════════════════════════════════════════════
🚧 TODO: Phase 5 Backend API Refactoring - BLOCKED
═══════════════════════════════════════════════════════════════════════

STATUS: ⚠️ CANNOT BE REFACTORED YET - Missing Backend API Endpoints

This script currently uses direct PostgreSQL access via psycopg2 (Line 22, 77).
It violates microservices architecture principles by accessing database directly.

BLOCKING ISSUE:
--------------
Backend API does NOT provide endpoints for fundamental economic data.

REQUIRED BACKEND API ENDPOINTS:
-------------------------------
The following endpoints MUST be created in Backend before this script can be refactored:

1. GET /api/v1/ml/training-data/fundamental
   Query Parameters:
   - indicator: 'interest_rate' | 'gdp' | 'cpi'
   - countries: string[] (e.g., ['US', 'EU'])
   - start_date: ISO8601 date
   - end_date: ISO8601 date

   Response Format:
   {
     "success": true,
     "data": {
       "fundamentalData": [
         {
           "date": "2024-01-01T00:00:00Z",
           "country": "US",
           "indicator": "interest_rate",
           "value": 5.25,
           "unit": "percent"
         }
       ]
     }
   }

2. GET /api/v1/ml/training-data/economic-events
   Query Parameters:
   - currency: 'USD' | 'EUR' | 'GBP' | 'JPY'
   - impact_levels: string[] (e.g., ['high', 'medium'])
   - start_date: ISO8601 date
   - end_date: ISO8601 date

   Response Format:
   {
     "success": true,
     "data": {
       "events": [
         {
           "eventDate": "2024-01-05T14:30:00Z",
           "currency": "USD",
           "eventName": "Non-Farm Payrolls",
           "impactLevel": "high",
           "forecastValue": 180000,
           "actualValue": 185000,
           "previousValue": 175000
         }
       ]
     }
   }

REQUIRED BACKEND DATABASE MODELS:
---------------------------------
Backend needs these Sequelize models (currently don't exist):

1. models/FundamentalData.js
   Fields:
   - id: UUID primary key
   - date: DATE (indexed)
   - country: STRING (indexed)
   - indicator: ENUM('interest_rate', 'gdp', 'cpi', ...) (indexed)
   - value: DECIMAL(10,4)
   - unit: STRING
   - source: STRING
   - created_at, updated_at: TIMESTAMP

2. models/EconomicEvent.js
   Fields:
   - id: UUID primary key
   - event_date: DATE (indexed)
   - currency: STRING (indexed)
   - event_name: STRING
   - impact_level: ENUM('low', 'medium', 'high') (indexed)
   - forecast_value: DECIMAL(20,4)
   - actual_value: DECIMAL(20,4)
   - previous_value: DECIMAL(20,4)
   - created_at, updated_at: TIMESTAMP

REQUIRED BACKEND CONTROLLERS:
-----------------------------
3. backend/src/controllers/mlTrainingDataController.js
   Methods:
   - getFundamentalData(req, res) - Line ~150
   - getEconomicEvents(req, res) - Line ~250

REQUIRED BACKEND ROUTES:
------------------------
4. backend/src/routes/mlRoutes.js (if doesn't exist, create it)
   Add:
   - GET /api/v1/ml/training-data/fundamental
   - GET /api/v1/ml/training-data/economic-events

REFACTORING PLAN:
----------------
Once Backend APIs are ready, apply this pattern:

OLD CODE (Lines 75-77, 96-118):
    def _get_connection(self):
        return psycopg2.connect(**self.db_config)

    def get_interest_rates(self, start_date, end_date, countries=None):
        conn = self._get_connection()
        query = "SELECT date, country, value as interest_rate FROM fundamental_data..."
        df = pd.read_sql_query(query, conn, params=params)
        conn.close()
        return df

NEW CODE (should become):
    from services.backend_api_client import get_client

    def __init__(self):
        self.api_client = get_client()
        logger.info("✅ Fundamental Feature Engineer initialized (Backend API mode)")

    def get_interest_rates(self, start_date, end_date, countries=None):
        result = self.api_client.get_fundamental_data(
            indicator='interest_rate',
            countries=countries,
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat()
        )

        fundamental_data = result.get('fundamentalData', [])
        df = pd.DataFrame(fundamental_data)
        df['date'] = pd.to_datetime(df['date'])
        return df

ESTIMATED WORK REQUIRED:
-----------------------
Backend Development:
- Create FundamentalData model + migration: 1 hour
- Create EconomicEvent model + migration: 1 hour
- Create mlTrainingDataController: 2 hours
- Create mlRoutes: 30 minutes
- Write API tests: 1.5 hours
Total Backend: ~6 hours

ML Engine Refactoring:
- Refactor this script (617 lines): 2 hours
- Update BackendApiClient with new methods: 1 hour
- Test fundamental feature extraction: 1 hour
Total ML Engine: ~4 hours

GRAND TOTAL: ~10 hours

PRIORITY: MEDIUM
- This script is used by prepare_v2_training_data.py
- Not critical for daily/weekly training (those are already refactored)
- Should be completed in Phase 5 but can be deferred to Phase 6

DEPENDENCIES:
------------
This script is a dependency for:
- scripts/prepare_v2_training_data.py (Line 450-480)

ACTION ITEMS:
------------
1. [ ] Backend team: Create fundamental data endpoints (6 hours)
2. [ ] ML team: Update BackendApiClient (1 hour)
3. [ ] ML team: Refactor this script (2 hours)
4. [ ] ML team: Test end-to-end (1 hour)

REFERENCE:
---------
- See: /root/AIFX_v2/ml_engine/PHASE5_SCRIPT_REFACTOR_PROGRESS.md
- See: /root/AIFX_v2/MICROSERVICES_REFACTOR_PLAN.md
- Backend API Client: /root/AIFX_v2/ml_engine/services/backend_api_client.py

═══════════════════════════════════════════════════════════════════════
"""

import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FundamentalFeatureEngineer:
    """
    Extracts and engineers fundamental features for forex trading models

    Supports:
    - EURUSD (US vs EU)
    - GBPUSD (US vs GB)
    - USDJPY (US vs JP)
    """

    # Currency pair mapping to countries
    PAIR_COUNTRY_MAP = {
        'EURUSD': ('US', 'EU'),
        'GBPUSD': ('US', 'GB'),
        'USDJPY': ('US', 'JP')
    }

    # Event impact scoring
    IMPACT_SCORES = {
        'high': 1.0,
        'medium': 0.5,
        'low': 0.2
    }

    def __init__(self, db_config: Dict = None):
        """
        Initialize feature engineer

        Args:
            db_config: Database configuration dictionary
        """
        self.db_config = db_config or {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': os.getenv('DB_PORT', '5432'),
            'database': os.getenv('DB_NAME', 'aifx_v2_dev'),
            'user': os.getenv('DB_USER', 'postgres'),
            'password': os.getenv('DB_PASSWORD', 'postgres')
        }

        logger.info("✅ Fundamental Feature Engineer initialized")

    def _get_connection(self):
        """Get database connection"""
        return psycopg2.connect(**self.db_config)

    def get_interest_rates(
        self,
        start_date: datetime,
        end_date: datetime,
        countries: List[str] = None
    ) -> pd.DataFrame:
        """
        Get interest rate data from database

        Args:
            start_date: Start date
            end_date: End date
            countries: List of countries (default: all)

        Returns:
            DataFrame with columns: date, country, interest_rate
        """
        conn = self._get_connection()

        query = """
            SELECT
                date,
                country,
                value as interest_rate
            FROM fundamental_data
            WHERE indicator = 'interest_rate'
              AND date BETWEEN %s AND %s
        """

        params = [start_date, end_date]

        if countries:
            placeholders = ','.join(['%s'] * len(countries))
            query += f" AND country IN ({placeholders})"
            params.extend(countries)

        query += " ORDER BY date, country;"

        df = pd.read_sql_query(query, conn, params=params)
        conn.close()

        df['date'] = pd.to_datetime(df['date'])
        return df

    def get_gdp_data(
        self,
        start_date: datetime,
        end_date: datetime,
        countries: List[str] = None
    ) -> pd.DataFrame:
        """
        Get GDP data from database

        Args:
            start_date: Start date
            end_date: End date
            countries: List of countries

        Returns:
            DataFrame with GDP data
        """
        conn = self._get_connection()

        query = """
            SELECT
                date,
                country,
                value as gdp
            FROM fundamental_data
            WHERE indicator = 'gdp'
              AND date BETWEEN %s AND %s
        """

        params = [start_date, end_date]

        if countries:
            placeholders = ','.join(['%s'] * len(countries))
            query += f" AND country IN ({placeholders})"
            params.extend(countries)

        query += " ORDER BY date, country;"

        df = pd.read_sql_query(query, conn, params=params)
        conn.close()

        df['date'] = pd.to_datetime(df['date'])
        return df

    def get_cpi_data(
        self,
        start_date: datetime,
        end_date: datetime,
        countries: List[str] = None
    ) -> pd.DataFrame:
        """
        Get CPI (inflation) data from database

        Args:
            start_date: Start date
            end_date: End date
            countries: List of countries

        Returns:
            DataFrame with CPI data
        """
        conn = self._get_connection()

        query = """
            SELECT
                date,
                country,
                value as cpi
            FROM fundamental_data
            WHERE indicator = 'cpi'
              AND date BETWEEN %s AND %s
        """

        params = [start_date, end_date]

        if countries:
            placeholders = ','.join(['%s'] * len(countries))
            query += f" AND country IN ({placeholders})"
            params.extend(countries)

        query += " ORDER BY date, country;"

        df = pd.read_sql_query(query, conn, params=params)
        conn.close()

        df['date'] = pd.to_datetime(df['date'])
        return df

    def get_economic_events(
        self,
        start_date: datetime,
        end_date: datetime,
        currency: str = None,
        impact_levels: List[str] = None
    ) -> pd.DataFrame:
        """
        Get economic events from database

        Args:
            start_date: Start date
            end_date: End date
            currency: Currency filter (e.g., 'USD')
            impact_levels: List of impact levels (default: ['high'])

        Returns:
            DataFrame with economic events
        """
        if impact_levels is None:
            impact_levels = ['high']

        conn = self._get_connection()

        query = """
            SELECT
                event_date,
                currency,
                event_name,
                impact_level,
                forecast_value,
                actual_value,
                previous_value
            FROM economic_events
            WHERE event_date BETWEEN %s AND %s
        """

        params = [start_date, end_date]

        if currency:
            query += " AND currency = %s"
            params.append(currency)

        if impact_levels:
            placeholders = ','.join(['%s'] * len(impact_levels))
            query += f" AND impact_level IN ({placeholders})"
            params.extend(impact_levels)

        query += " ORDER BY event_date;"

        df = pd.read_sql_query(query, conn, params=params)
        conn.close()

        df['event_date'] = pd.to_datetime(df['event_date'])
        return df

    def calculate_interest_rate_diff(
        self,
        pair: str,
        start_date: datetime,
        end_date: datetime
    ) -> pd.DataFrame:
        """
        Calculate interest rate differential for a currency pair

        Args:
            pair: Currency pair (e.g., 'EURUSD')
            start_date: Start date
            end_date: End date

        Returns:
            DataFrame with date and interest_rate_diff columns
        """
        if pair not in self.PAIR_COUNTRY_MAP:
            raise ValueError(f"Unsupported pair: {pair}. Supported: {list(self.PAIR_COUNTRY_MAP.keys())}")

        base_country, quote_country = self.PAIR_COUNTRY_MAP[pair]

        # Get interest rates for both countries
        rates_df = self.get_interest_rates(start_date, end_date, [base_country, quote_country])

        # Pivot to get base and quote rates
        rates_pivot = rates_df.pivot(index='date', columns='country', values='interest_rate')

        # Calculate differential (base - quote)
        rates_pivot['interest_rate_diff'] = rates_pivot[base_country] - rates_pivot[quote_country]

        result = rates_pivot[['interest_rate_diff']].reset_index()
        result = result.rename(columns={'interest_rate_diff': f'interest_rate_diff_{base_country.lower()}_{quote_country.lower()}'})

        logger.info(f"✅ Calculated interest rate diff for {pair}: {len(result)} records")
        return result

    def calculate_gdp_growth_yoy(
        self,
        country: str,
        start_date: datetime,
        end_date: datetime
    ) -> pd.DataFrame:
        """
        Calculate GDP year-over-year growth rate

        Args:
            country: Country code (e.g., 'US')
            start_date: Start date
            end_date: End date

        Returns:
            DataFrame with date and gdp_growth_yoy columns
        """
        # Fetch GDP data with extra year for YoY calculation
        extended_start = start_date - timedelta(days=400)
        gdp_df = self.get_gdp_data(extended_start, end_date, [country])

        if len(gdp_df) == 0:
            logger.warning(f"No GDP data for {country}")
            return pd.DataFrame(columns=['date', f'gdp_growth_{country.lower()}_yoy'])

        # Sort by date
        gdp_df = gdp_df.sort_values('date').reset_index(drop=True)

        # Calculate YoY growth (quarterly data, so shift by 4)
        gdp_df['gdp_growth_yoy'] = gdp_df['gdp'].pct_change(periods=4) * 100

        # Filter to requested date range
        gdp_df = gdp_df[gdp_df['date'] >= start_date]

        result = gdp_df[['date', 'gdp_growth_yoy']].copy()
        result = result.rename(columns={'gdp_growth_yoy': f'gdp_growth_{country.lower()}_yoy'})

        logger.info(f"✅ Calculated GDP growth YoY for {country}: {len(result)} records")
        return result

    def calculate_inflation_diff(
        self,
        pair: str,
        start_date: datetime,
        end_date: datetime
    ) -> pd.DataFrame:
        """
        Calculate inflation (CPI) differential for a currency pair

        Args:
            pair: Currency pair (e.g., 'EURUSD')
            start_date: Start date
            end_date: End date

        Returns:
            DataFrame with date and inflation_diff columns
        """
        if pair not in self.PAIR_COUNTRY_MAP:
            raise ValueError(f"Unsupported pair: {pair}")

        base_country, quote_country = self.PAIR_COUNTRY_MAP[pair]

        # Get CPI data with extra year for YoY calculation
        extended_start = start_date - timedelta(days=400)
        cpi_df = self.get_cpi_data(extended_start, end_date, [base_country, quote_country])

        if len(cpi_df) == 0:
            logger.warning(f"No CPI data for {pair}")
            return pd.DataFrame(columns=['date', f'inflation_diff_{base_country.lower()}_{quote_country.lower()}'])

        # Calculate YoY inflation for each country
        cpi_pivot = cpi_df.pivot(index='date', columns='country', values='cpi')
        cpi_pivot = cpi_pivot.sort_index()

        # YoY inflation rate (12 months for monthly data)
        inflation_base = cpi_pivot[base_country].pct_change(periods=12) * 100
        inflation_quote = cpi_pivot[quote_country].pct_change(periods=12) * 100

        # Calculate differential
        result = pd.DataFrame({
            'date': cpi_pivot.index,
            f'inflation_diff_{base_country.lower()}_{quote_country.lower()}': inflation_base - inflation_quote
        })

        # Filter to requested date range
        result = result[result['date'] >= start_date].reset_index(drop=True)

        logger.info(f"✅ Calculated inflation diff for {pair}: {len(result)} records")
        return result

    def calculate_event_features(
        self,
        pair: str,
        start_date: datetime,
        end_date: datetime,
        lookforward_days: int = 30
    ) -> pd.DataFrame:
        """
        Calculate event-based features for a currency pair

        Args:
            pair: Currency pair (e.g., 'EURUSD')
            start_date: Start date
            end_date: End date
            lookforward_days: Days to look forward for events

        Returns:
            DataFrame with event features
        """
        if pair not in self.PAIR_COUNTRY_MAP:
            raise ValueError(f"Unsupported pair: {pair}")

        base_country, quote_country = self.PAIR_COUNTRY_MAP[pair]

        # Map country to currency
        country_currency_map = {
            'US': 'USD',
            'EU': 'EUR',
            'GB': 'GBP',
            'JP': 'JPY'
        }

        base_currency = country_currency_map[base_country]
        quote_currency = country_currency_map[quote_country]

        # Fetch events for both currencies (extend date range for lookforward)
        extended_end = end_date + timedelta(days=lookforward_days)

        base_events = self.get_economic_events(
            start_date, extended_end, base_currency, ['high']
        )
        quote_events = self.get_economic_events(
            start_date, extended_end, quote_currency, ['high']
        )

        # Combine events
        all_events = pd.concat([base_events, quote_events], ignore_index=True)
        all_events = all_events.sort_values('event_date').reset_index(drop=True)

        # Create daily date range
        date_range = pd.date_range(start=start_date, end=end_date, freq='D')

        features = []

        for current_date in date_range:
            # Find next high-impact event
            future_events = all_events[all_events['event_date'] > current_date]

            if len(future_events) > 0:
                next_event = future_events.iloc[0]
                days_to_event = (next_event['event_date'] - current_date).days
                impact_score = self.IMPACT_SCORES.get(next_event['impact_level'], 0.5)
                next_event_currency = next_event['currency']
            else:
                days_to_event = lookforward_days + 1  # No event in range
                impact_score = 0.0
                next_event_currency = None

            # Count high-impact events in next 7 days
            week_events = all_events[
                (all_events['event_date'] > current_date) &
                (all_events['event_date'] <= current_date + timedelta(days=7))
            ]
            events_next_7d = len(week_events)

            features.append({
                'date': current_date,
                'days_to_next_high_event': min(days_to_event, lookforward_days),
                'next_event_impact_score': impact_score,
                'high_events_next_7d': events_next_7d
            })

        result = pd.DataFrame(features)

        logger.info(f"✅ Calculated event features for {pair}: {len(result)} records")
        return result

    def align_features_with_timeseries(
        self,
        daily_dates: pd.DatetimeIndex,
        features_df: pd.DataFrame,
        date_column: str = 'date',
        method: str = 'ffill'
    ) -> pd.DataFrame:
        """
        Align fundamental features (monthly/quarterly) with daily timeseries

        Args:
            daily_dates: Daily date index
            features_df: Features DataFrame with date column
            date_column: Name of date column
            method: Fill method ('ffill' for forward fill)

        Returns:
            Aligned DataFrame with daily frequency
        """
        # Ensure date column is datetime
        features_df[date_column] = pd.to_datetime(features_df[date_column])

        # Set date as index
        features_indexed = features_df.set_index(date_column)

        # Reindex to daily dates
        aligned = features_indexed.reindex(daily_dates)

        # Forward fill (use last known value)
        if method == 'ffill':
            aligned = aligned.ffill()

        # Reset index
        aligned = aligned.reset_index()
        aligned = aligned.rename(columns={'index': 'date'})

        return aligned

    def get_all_features(
        self,
        pair: str,
        start_date: datetime,
        end_date: datetime
    ) -> pd.DataFrame:
        """
        Get all fundamental features for a currency pair

        Args:
            pair: Currency pair (e.g., 'EURUSD')
            start_date: Start date
            end_date: End date

        Returns:
            DataFrame with all fundamental features aligned to daily frequency
        """
        logger.info(f"🚀 Extracting fundamental features for {pair}")
        logger.info(f"   Date range: {start_date.date()} to {end_date.date()}")

        if pair not in self.PAIR_COUNTRY_MAP:
            raise ValueError(f"Unsupported pair: {pair}")

        base_country, quote_country = self.PAIR_COUNTRY_MAP[pair]

        # Create daily date range
        daily_dates = pd.date_range(start=start_date, end=end_date, freq='D')
        base_df = pd.DataFrame({'date': daily_dates})

        # 1. Interest rate differential
        try:
            rate_diff = self.calculate_interest_rate_diff(pair, start_date, end_date)
            # Align to daily frequency with forward fill
            rate_diff_daily = self.align_features_with_timeseries(
                daily_dates, rate_diff, 'date', 'ffill'
            )
            base_df = base_df.merge(rate_diff_daily, on='date', how='left')
        except Exception as e:
            logger.warning(f"Failed to calculate interest rate diff: {e}")

        # 2. GDP growth YoY for both countries
        for country in [base_country, quote_country]:
            try:
                gdp_growth = self.calculate_gdp_growth_yoy(country, start_date, end_date)
                # Align to daily
                gdp_growth_daily = self.align_features_with_timeseries(
                    daily_dates, gdp_growth, 'date', 'ffill'
                )
                base_df = base_df.merge(gdp_growth_daily, on='date', how='left')
            except Exception as e:
                logger.warning(f"Failed to calculate GDP growth for {country}: {e}")

        # 3. Inflation differential
        try:
            inflation_diff = self.calculate_inflation_diff(pair, start_date, end_date)
            # Align to daily
            inflation_diff_daily = self.align_features_with_timeseries(
                daily_dates, inflation_diff, 'date', 'ffill'
            )
            base_df = base_df.merge(inflation_diff_daily, on='date', how='left')
        except Exception as e:
            logger.warning(f"Failed to calculate inflation diff: {e}")

        # 4. Event features
        try:
            event_features = self.calculate_event_features(pair, start_date, end_date)
            base_df = base_df.merge(event_features, on='date', how='left')
        except Exception as e:
            logger.warning(f"Failed to calculate event features: {e}")

        # Fill any remaining NaN with forward fill
        base_df = base_df.ffill()

        # Fill any leading NaN with backward fill
        base_df = base_df.bfill()

        logger.info(f"✅ Extracted {len(base_df.columns) - 1} fundamental features")
        logger.info(f"   Features: {', '.join([c for c in base_df.columns if c != 'date'])}")

        return base_df


if __name__ == '__main__':
    # Test the feature engineer
    engineer = FundamentalFeatureEngineer()

    # Test EURUSD features
    start = datetime(2024, 1, 1)
    end = datetime(2024, 12, 31)

    features = engineer.get_all_features('EURUSD', start, end)

    print("\n" + "="*60)
    print("EURUSD Fundamental Features Sample")
    print("="*60)
    print(features.head(10))
    print("\nFeature Statistics:")
    print(features.describe())
