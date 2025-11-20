# 🚀 Phase 2 MVP Implementation Plan
**Fundamental + Events Integration**

**Created**: 2025-10-08
**Target**: Multi-modal LSTM v2.0 with 65-70% directional accuracy
**Timeline**: 2-3 weeks
**Status**: 🔄 In Progress

---

## 📋 Overview

### Current State (v1.0)
```
Input:  Historical Price → 28 Technical Indicators → LSTM → Price Prediction
Output: 55-60% directional accuracy, val_loss 0.82
Models: EURUSD, GBPUSD, USDJPY (trained ✅)
```

### Target State (v2.0 MVP)
```
Input 1: Technical (60, 28) ──┐
Input 2: Fundamental (10)  ────┼─→ Multi-Input LSTM → Enhanced Prediction
Input 3: Event Risk (5)    ────┘

Output: 65-70% directional accuracy, val_loss 0.65-0.70
Features: Event warnings, risk assessment, economic calendar
```

---

## 🎯 Week 1: Data Infrastructure

### Day 1-2: Database Schema & Migration

**File**: `/root/AIFX_v2/backend/database/migrations/20251008000001-add-fundamental-tables.js`

```javascript
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Fundamental Data Table
    await queryInterface.createTable('fundamental_data', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Data date (YYYY-MM-DD)'
      },
      country: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: 'Country code: US, EU, GB, JP'
      },
      indicator: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Indicator name: interest_rate, gdp, cpi, unemployment'
      },
      value: {
        type: Sequelize.DECIMAL(15, 6),
        allowNull: false,
        comment: 'Indicator value'
      },
      source: {
        type: Sequelize.STRING(50),
        defaultValue: 'FRED',
        comment: 'Data source: FRED, manual, etc'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('fundamental_data', ['date', 'country', 'indicator'], {
      name: 'idx_fundamental_date_country_indicator',
      unique: true
    });
    await queryInterface.addIndex('fundamental_data', ['country', 'indicator']);

    // 2. Economic Events Table
    await queryInterface.createTable('economic_events', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      event_date: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Event datetime (UTC)'
      },
      currency: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: 'Affected currency: USD, EUR, GBP, JPY'
      },
      event_name: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: 'Event name: Fed Rate Decision, NFP, etc'
      },
      impact_level: {
        type: Sequelize.ENUM('high', 'medium', 'low'),
        allowNull: false,
        defaultValue: 'medium',
        comment: 'Expected market impact'
      },
      forecast_value: {
        type: Sequelize.DECIMAL(15, 6),
        allowNull: true,
        comment: 'Forecasted value'
      },
      actual_value: {
        type: Sequelize.DECIMAL(15, 6),
        allowNull: true,
        comment: 'Actual released value'
      },
      previous_value: {
        type: Sequelize.DECIMAL(15, 6),
        allowNull: true,
        comment: 'Previous period value'
      },
      source: {
        type: Sequelize.STRING(50),
        defaultValue: 'ForexFactory',
        comment: 'Data source'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('economic_events', ['event_date']);
    await queryInterface.addIndex('economic_events', ['currency', 'event_date']);
    await queryInterface.addIndex('economic_events', ['impact_level']);

    // 3. Interest Rates Table (optimized for fast queries)
    await queryInterface.createTable('interest_rates', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      fed_rate: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        comment: 'US Federal Reserve rate (%)'
      },
      ecb_rate: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        comment: 'European Central Bank rate (%)'
      },
      boe_rate: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        comment: 'Bank of England rate (%)'
      },
      boj_rate: {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
        comment: 'Bank of Japan rate (%)'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('interest_rates', ['date'], { unique: true });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('interest_rates');
    await queryInterface.dropTable('economic_events');
    await queryInterface.dropTable('fundamental_data');
  }
};
```

**Action**: Run migration
```bash
cd /root/AIFX_v2/backend
PGPASSWORD=postgres psql -U postgres -d aifx_v2_dev -f database/migrations/20251008000001-add-fundamental-tables.js
```

---

### Day 2-3: FRED API Data Collector

**File**: `/root/AIFX_v2/ml_engine/scripts/collect_fundamental_data.py`

```python
"""
Collect Fundamental Data from FRED API
Fetches interest rates, GDP, CPI, unemployment data
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

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FRED API Configuration
FRED_API_KEY = os.getenv('FRED_API_KEY', '')  # Register at https://fred.stlouisfed.org/docs/api/api_key.html
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
            'interest_rate': 'FEDFUNDS',      # Federal Funds Rate
            'gdp': 'GDP',                      # Gross Domestic Product
            'cpi': 'CPIAUCSL',                 # Consumer Price Index
            'unemployment': 'UNRATE',          # Unemployment Rate
            'inflation': 'FPCPITOTLZGUSA',     # Inflation YoY
        },
        'EU': {
            'interest_rate': 'ECBDFR',         # ECB Deposit Facility Rate
            'gdp': 'CLVMNACSCAB1GQEA19',       # Euro Area GDP
            'cpi': 'CP0000EZ19M086NEST',       # Euro Area CPI
            'unemployment': 'LRHUTTTTEZM156S', # Euro Area Unemployment
        },
        'GB': {
            'interest_rate': 'IRSTCB01GBM156N', # Bank of England Rate
            'gdp': 'GBRRGDPQDSNAQ',             # UK GDP
            'cpi': 'GBRCPIALLMINMEI',           # UK CPI
            'unemployment': 'LRHUTTTTGBM156S',  # UK Unemployment
        },
        'JP': {
            'interest_rate': 'IRSTCI01JPM156N', # Bank of Japan Rate
            'gdp': 'JPNRGDPEXP',                # Japan GDP
            'cpi': 'JPNCPIALLMINMEI',           # Japan CPI
            'unemployment': 'LRHUTTTTJPM156S',  # Japan Unemployment
        }
    }

    def __init__(self, api_key: str):
        """Initialize FRED data collector"""
        if not api_key:
            raise ValueError("FRED API key is required. Get one at https://fred.stlouisfed.org/")

        self.api_key = api_key
        self.session = requests.Session()
        logger.info("FRED Data Collector initialized")

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
            observations = data.get('observations', [])

            if not observations:
                logger.warning(f"No data found for series: {series_id}")
                return pd.DataFrame()

            # Convert to DataFrame
            df = pd.DataFrame(observations)
            df = df[['date', 'value']]
            df['value'] = pd.to_numeric(df['value'], errors='coerce')
            df = df.dropna()

            logger.info(f"Fetched {len(df)} observations for {series_id}")
            return df

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch series {series_id}: {e}")
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

        for country, indicators in self.SERIES_MAP.items():
            logger.info(f"Collecting data for {country}...")
            results[country] = {}

            for indicator_name, series_id in indicators.items():
                df = self.fetch_series(series_id, start_date, end_date)
                results[country][indicator_name] = df

                # Rate limiting: FRED allows 120 req/min
                time.sleep(0.5)

        return results

    def save_to_database(self, data: Dict[str, Dict[str, pd.DataFrame]]):
        """
        Save collected data to PostgreSQL database

        Args:
            data: Nested dict from collect_all_indicators()
        """
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            cursor = conn.cursor()

            total_inserted = 0

            for country, indicators in data.items():
                for indicator_name, df in indicators.items():
                    if df.empty:
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

            conn.commit()
            logger.info(f"✅ Saved {total_inserted} fundamental data records to database")

            cursor.close()
            conn.close()

        except Exception as e:
            logger.error(f"Database error: {e}")
            if conn:
                conn.rollback()

    def sync_interest_rates_table(self):
        """
        Sync interest rates to optimized interest_rates table
        """
        try:
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

            # Group by date
            rates_by_date = {}
            for date, country, value in rows:
                if date not in rates_by_date:
                    rates_by_date[date] = {}
                rates_by_date[date][country.lower()] = value

            # Insert/update interest_rates table
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
                    rates.get('us'),
                    rates.get('eu'),
                    rates.get('gb'),
                    rates.get('jp')
                ))

            conn.commit()
            logger.info(f"✅ Synced {len(rates_by_date)} dates to interest_rates table")

            cursor.close()
            conn.close()

        except Exception as e:
            logger.error(f"Failed to sync interest rates: {e}")


def main():
    """Main execution function"""

    # Check for API key
    api_key = os.getenv('FRED_API_KEY')
    if not api_key:
        print("❌ FRED_API_KEY not found in environment variables")
        print("📝 Register for free at: https://fred.stlouisfed.org/docs/api/api_key.html")
        print("📝 Then set: export FRED_API_KEY='your_key_here'")
        sys.exit(1)

    # Initialize collector
    collector = FREDDataCollector(api_key)

    # Collect data (default: last 20 years)
    logger.info("🚀 Starting fundamental data collection...")
    data = collector.collect_all_indicators()

    # Save to database
    logger.info("💾 Saving to database...")
    collector.save_to_database(data)

    # Sync interest rates table
    logger.info("🔄 Syncing interest rates table...")
    collector.sync_interest_rates_table()

    logger.info("✅ Fundamental data collection complete!")


if __name__ == '__main__':
    main()
```

**Usage**:
```bash
# 1. Register FRED API key (free): https://fred.stlouisfed.org/
# 2. Set environment variable
export FRED_API_KEY='your_api_key_here'

# 3. Run collector
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
python scripts/collect_fundamental_data.py
```

---

### Day 3-4: Economic Calendar Scraper

**File**: `/root/AIFX_v2/ml_engine/scripts/collect_economic_calendar.py`

```python
"""
Economic Calendar Data Collector
Scrapes upcoming economic events from Forex Factory
"""

import os
import requests
from bs4 import BeautifulSoup
import pandas as pd
from datetime import datetime, timedelta
import psycopg2
import logging
import time
from typing import List, Dict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'aifx_v2_dev'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}


class ForexFactoryCalendar:
    """Scrapes economic calendar from Forex Factory"""

    BASE_URL = 'https://www.forexfactory.com/calendar'

    IMPACT_MAP = {
        'high': 'high',
        'medium': 'medium',
        'low': 'low'
    }

    CURRENCY_MAP = {
        'USD': 'USD',
        'EUR': 'EUR',
        'GBP': 'GBP',
        'JPY': 'JPY',
        'AUD': 'AUD',
        'CAD': 'CAD',
        'CHF': 'CHF',
        'NZD': 'NZD'
    }

    def __init__(self):
        """Initialize scraper with headers"""
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

    def scrape_week(self, week_offset: int = 0) -> List[Dict]:
        """
        Scrape economic events for a specific week

        Args:
            week_offset: 0 = current week, 1 = next week, -1 = last week

        Returns:
            List of event dictionaries
        """
        # Forex Factory uses week parameter
        params = {'week': week_offset} if week_offset != 0 else {}

        try:
            logger.info(f"Scraping Forex Factory calendar (week offset: {week_offset})...")
            response = self.session.get(self.BASE_URL, params=params, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')

            # Parse calendar table
            events = []
            current_date = None

            # Find calendar rows
            rows = soup.find_all('tr', class_='calendar__row')

            for row in rows:
                # Extract date
                date_cell = row.find('td', class_='calendar__date')
                if date_cell and date_cell.text.strip():
                    current_date = date_cell.text.strip()

                # Extract time
                time_cell = row.find('td', class_='calendar__time')
                event_time = time_cell.text.strip() if time_cell else ''

                # Extract currency
                currency_cell = row.find('td', class_='calendar__currency')
                currency = currency_cell.text.strip() if currency_cell else ''

                # Extract impact
                impact_cell = row.find('td', class_='calendar__impact')
                impact_span = impact_cell.find('span') if impact_cell else None
                impact = 'low'
                if impact_span:
                    if 'icon--ff-impact-red' in impact_span.get('class', []):
                        impact = 'high'
                    elif 'icon--ff-impact-ora' in impact_span.get('class', []):
                        impact = 'medium'

                # Extract event name
                event_cell = row.find('td', class_='calendar__event')
                event_name = event_cell.text.strip() if event_cell else ''

                # Extract forecast, previous, actual
                actual_cell = row.find('td', class_='calendar__actual')
                forecast_cell = row.find('td', class_='calendar__forecast')
                previous_cell = row.find('td', class_='calendar__previous')

                actual = actual_cell.text.strip() if actual_cell else ''
                forecast = forecast_cell.text.strip() if forecast_cell else ''
                previous = previous_cell.text.strip() if previous_cell else ''

                # Skip if not a valid event
                if not event_name or currency not in self.CURRENCY_MAP:
                    continue

                # Combine date and time
                try:
                    if current_date and event_time:
                        # Parse date (format: Jan 8 or similar)
                        year = datetime.now().year
                        event_datetime = pd.to_datetime(f"{current_date} {year} {event_time}")
                    else:
                        continue
                except:
                    continue

                events.append({
                    'event_date': event_datetime,
                    'currency': currency,
                    'event_name': event_name,
                    'impact_level': impact,
                    'forecast_value': self._parse_value(forecast),
                    'actual_value': self._parse_value(actual),
                    'previous_value': self._parse_value(previous)
                })

            logger.info(f"Scraped {len(events)} events")
            return events

        except Exception as e:
            logger.error(f"Failed to scrape Forex Factory: {e}")
            return []

    def _parse_value(self, value_str: str) -> float:
        """Parse numeric value from string"""
        if not value_str or value_str in ['', 'N/A']:
            return None

        try:
            # Remove % and other symbols
            cleaned = value_str.replace('%', '').replace(',', '').replace('K', '000').replace('M', '000000')
            return float(cleaned)
        except:
            return None

    def save_to_database(self, events: List[Dict]):
        """Save events to database"""
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            cursor = conn.cursor()

            for event in events:
                query = """
                INSERT INTO economic_events
                (event_date, currency, event_name, impact_level, forecast_value, actual_value, previous_value, source, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'ForexFactory', NOW(), NOW())
                ON CONFLICT DO NOTHING
                """

                cursor.execute(query, (
                    event['event_date'],
                    event['currency'],
                    event['event_name'],
                    event['impact_level'],
                    event['forecast_value'],
                    event['actual_value'],
                    event['previous_value']
                ))

            conn.commit()
            logger.info(f"✅ Saved {len(events)} events to database")

            cursor.close()
            conn.close()

        except Exception as e:
            logger.error(f"Database error: {e}")


def main():
    """Main execution"""
    scraper = ForexFactoryCalendar()

    # Scrape current week and next 2 weeks
    all_events = []
    for week in range(0, 3):
        events = scraper.scrape_week(week_offset=week)
        all_events.extend(events)
        time.sleep(2)  # Be respectful with scraping

    # Save to database
    scraper.save_to_database(all_events)
    logger.info(f"✅ Economic calendar sync complete: {len(all_events)} events")


if __name__ == '__main__':
    main()
```

---

## 📊 Week 2: Feature Engineering & Model Architecture

### Day 5-6: Fundamental Feature Engineering

**File**: `/root/AIFX_v2/ml_engine/data_processing/fundamental_features.py`

```python
"""
Fundamental Feature Engineering
Calculates derived features from fundamental data
"""

import pandas as pd
import numpy as np
from typing import Dict, Tuple
import logging
import psycopg2
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class FundamentalFeatureEngineer:
    """Engineers features from fundamental and event data"""

    def __init__(self, db_config: Dict):
        """Initialize with database config"""
        self.db_config = db_config

    def get_fundamental_features(
        self,
        currency_pair: str,
        end_date: datetime,
        lookback_days: int = 365
    ) -> pd.DataFrame:
        """
        Get fundamental features for a currency pair

        Args:
            currency_pair: e.g., 'EURUSD', 'GBPUSD'
            end_date: End date for features
            lookback_days: How far back to look

        Returns:
            DataFrame with fundamental features
        """
        # Parse currency pair
        base_currency = currency_pair[:3]  # EUR, GBP, USD
        quote_currency = currency_pair[3:]  # USD, JPY

        # Map currency to country code
        currency_country_map = {
            'USD': 'US',
            'EUR': 'EU',
            'GBP': 'GB',
            'JPY': 'JP'
        }

        base_country = currency_country_map.get(base_currency)
        quote_country = currency_country_map.get(quote_currency)

        if not base_country or not quote_country:
            raise ValueError(f"Unsupported currency pair: {currency_pair}")

        # Fetch fundamental data from database
        conn = psycopg2.connect(**self.db_config)

        start_date = end_date - timedelta(days=lookback_days)

        # Get interest rates (most important!)
        query_rates = """
        SELECT date, fed_rate, ecb_rate, boe_rate, boj_rate
        FROM interest_rates
        WHERE date >= %s AND date <= %s
        ORDER BY date
        """

        df_rates = pd.read_sql_query(
            query_rates,
            conn,
            params=(start_date.date(), end_date.date())
        )

        # Get GDP data
        query_gdp = """
        SELECT date, country, value as gdp
        FROM fundamental_data
        WHERE indicator = 'gdp'
          AND date >= %s AND date <= %s
          AND country IN (%s, %s)
        ORDER BY date
        """

        df_gdp = pd.read_sql_query(
            query_gdp,
            conn,
            params=(start_date.date(), end_date.date(), base_country, quote_country)
        )

        # Get CPI data
        query_cpi = """
        SELECT date, country, value as cpi
        FROM fundamental_data
        WHERE indicator = 'cpi'
          AND date >= %s AND date <= %s
          AND country IN (%s, %s)
        ORDER BY date
        """

        df_cpi = pd.read_sql_query(
            query_cpi,
            conn,
            params=(start_date.date(), end_date.date(), base_country, quote_country)
        )

        conn.close()

        # Calculate derived features
        features = pd.DataFrame()
        features['date'] = df_rates['date']

        # Interest rate differentials (CRITICAL FOR FOREX!)
        if currency_pair == 'EURUSD':
            features['interest_rate_diff'] = df_rates['ecb_rate'] - df_rates['fed_rate']
            features['base_rate'] = df_rates['ecb_rate']
            features['quote_rate'] = df_rates['fed_rate']
        elif currency_pair == 'GBPUSD':
            features['interest_rate_diff'] = df_rates['boe_rate'] - df_rates['fed_rate']
            features['base_rate'] = df_rates['boe_rate']
            features['quote_rate'] = df_rates['fed_rate']
        elif currency_pair == 'USDJPY':
            features['interest_rate_diff'] = df_rates['fed_rate'] - df_rates['boj_rate']
            features['base_rate'] = df_rates['fed_rate']
            features['quote_rate'] = df_rates['boj_rate']

        # Forward-fill fundamental data (released quarterly/monthly)
        features = features.ffill()

        # Calculate rate of change
        features['interest_rate_diff_change'] = features['interest_rate_diff'].diff()

        logger.info(f"Generated fundamental features for {currency_pair}: {features.shape}")

        return features

    def get_event_features(
        self,
        currency_pair: str,
        target_date: datetime,
        lookback_days: int = 30,
        lookahead_days: int = 7
    ) -> Dict[str, float]:
        """
        Get event-based risk features

        Args:
            currency_pair: Currency pair
            target_date: Date to calculate features for
            lookback_days: Look back for historical events
            lookahead_days: Look ahead for upcoming events

        Returns:
            Dictionary of event features
        """
        # Extract currencies
        currencies = [currency_pair[:3], currency_pair[3:]]

        conn = psycopg2.connect(**self.db_config)
        cursor = conn.cursor()

        # Find upcoming high-impact events
        query_upcoming = """
        SELECT event_date, impact_level
        FROM economic_events
        WHERE currency = ANY(%s)
          AND event_date > %s
          AND event_date <= %s
          AND impact_level IN ('high', 'medium')
        ORDER BY event_date
        LIMIT 5
        """

        cursor.execute(query_upcoming, (
            currencies,
            target_date,
            target_date + timedelta(days=lookahead_days)
        ))

        upcoming_events = cursor.fetchall()

        # Calculate event risk features
        features = {}

        if upcoming_events:
            # Days until next high-impact event
            next_event_date, next_event_impact = upcoming_events[0]
            days_to_event = (next_event_date - target_date).days

            features['days_to_next_event'] = min(days_to_event, lookahead_days)
            features['event_impact_score'] = 1.0 if next_event_impact == 'high' else 0.5
            features['upcoming_event_count'] = len(upcoming_events)
        else:
            features['days_to_next_event'] = lookahead_days
            features['event_impact_score'] = 0.0
            features['upcoming_event_count'] = 0

        # Normalize features
        features['days_to_next_event_normalized'] = features['days_to_next_event'] / lookahead_days
        features['risk_period'] = 1.0 if features['days_to_next_event'] <= 2 else 0.0

        cursor.close()
        conn.close()

        return features


# Example usage
if __name__ == '__main__':
    from datetime import datetime

    db_config = {
        'host': 'localhost',
        'database': 'aifx_v2_dev',
        'user': 'postgres',
        'password': 'postgres'
    }

    engineer = FundamentalFeatureEngineer(db_config)

    # Get features
    features = engineer.get_fundamental_features('EURUSD', datetime.now())
    print(features.tail())

    event_features = engineer.get_event_features('EURUSD', datetime.now())
    print(event_features)
```

---

### Day 7-8: Multi-Input LSTM Model v2.0

**File**: `/root/AIFX_v2/ml_engine/models/multi_input_predictor.py`

```python
"""
Multi-Input LSTM Model v2.0
Integrates technical, fundamental, and event features
"""

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, LSTM, Dense, Dropout, Concatenate, BatchNormalization
)
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from typing import Dict, Tuple
import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)


class MultiInputPricePredictor:
    """
    Multi-modal LSTM model combining:
    - Technical indicators (time series)
    - Fundamental data (static features)
    - Event risk features (static features)
    """

    def __init__(self, config: Dict):
        """Initialize multi-input model"""
        self.config = config
        self.model = None
        self.model_version = '2.0.0'
        self.model_dir = config.get('model', {}).get('model_dir', './saved_models')

        os.makedirs(self.model_dir, exist_ok=True)
        logger.info(f"MultiInputPricePredictor v{self.model_version} initialized")

    def build_model(
        self,
        technical_shape: Tuple[int, int],  # (sequence_length, n_technical_features)
        fundamental_shape: int,             # n_fundamental_features
        event_shape: int                    # n_event_features
    ) -> Model:
        """
        Build multi-input LSTM architecture

        Architecture:
        ```
        Technical (60, 28) → LSTM(64) → LSTM(32) → Dense(32)
                                                        ↓
        Fundamental (10)   → Dense(32) → Dense(16) ────┤
                                                        ↓
        Event (5)          → Dense(16) → Dense(8)  ────┤
                                                        ↓
                                            Concatenate → Dense(64) → Dropout → Output
        ```
        """
        logger.info(f"Building multi-input model:")
        logger.info(f"  Technical shape: {technical_shape}")
        logger.info(f"  Fundamental features: {fundamental_shape}")
        logger.info(f"  Event features: {event_shape}")

        # Input 1: Technical Indicators (Time Series)
        technical_input = Input(shape=technical_shape, name='technical_input')

        # LSTM branch
        x_tech = LSTM(64, return_sequences=True, dropout=0.2, recurrent_dropout=0.1)(technical_input)
        x_tech = LSTM(32, dropout=0.2, recurrent_dropout=0.1)(x_tech)
        x_tech = Dense(32, activation='relu')(x_tech)
        x_tech = BatchNormalization()(x_tech)
        x_tech = Dropout(0.3)(x_tech)

        # Input 2: Fundamental Features (Static)
        fundamental_input = Input(shape=(fundamental_shape,), name='fundamental_input')

        # Dense branch for fundamentals
        x_fund = Dense(32, activation='relu')(fundamental_input)
        x_fund = BatchNormalization()(x_fund)
        x_fund = Dropout(0.2)(x_fund)
        x_fund = Dense(16, activation='relu')(x_fund)

        # Input 3: Event Features (Static)
        event_input = Input(shape=(event_shape,), name='event_input')

        # Dense branch for events
        x_event = Dense(16, activation='relu')(event_input)
        x_event = Dropout(0.2)(x_event)
        x_event = Dense(8, activation='relu')(x_event)

        # Fusion Layer: Concatenate all branches
        merged = Concatenate()([x_tech, x_fund, x_event])

        # Fusion dense layers
        x = Dense(64, activation='relu')(merged)
        x = BatchNormalization()(x)
        x = Dropout(0.3)(x)
        x = Dense(32, activation='relu')(x)
        x = Dropout(0.2)(x)

        # Output layer (price prediction)
        output = Dense(1, activation='linear', name='price_output')(x)

        # Create model
        model = Model(
            inputs=[technical_input, fundamental_input, event_input],
            outputs=output,
            name='MultiInputPricePredictor_v2.0'
        )

        # Compile
        optimizer = Adam(learning_rate=0.001)
        model.compile(
            optimizer=optimizer,
            loss='mean_squared_error',
            metrics=['mae', 'mse']
        )

        self.model = model

        logger.info(f"✅ Model built with {model.count_params():,} parameters")
        model.summary(print_fn=logger.info)

        return model

    def train(
        self,
        X_technical: np.ndarray,
        X_fundamental: np.ndarray,
        X_event: np.ndarray,
        y: np.ndarray,
        validation_split: float = 0.2,
        epochs: int = 100,
        batch_size: int = 32
    ) -> Dict:
        """
        Train the multi-input model

        Args:
            X_technical: Technical indicators (n_samples, sequence_length, n_features)
            X_fundamental: Fundamental features (n_samples, n_fundamental_features)
            X_event: Event features (n_samples, n_event_features)
            y: Target values (n_samples,)
            validation_split: Validation split ratio
            epochs: Training epochs
            batch_size: Batch size

        Returns:
            Training history
        """
        logger.info(f"Training multi-input model...")
        logger.info(f"  Technical data: {X_technical.shape}")
        logger.info(f"  Fundamental data: {X_fundamental.shape}")
        logger.info(f"  Event data: {X_event.shape}")
        logger.info(f"  Targets: {y.shape}")

        # Build model if not built
        if self.model is None:
            self.build_model(
                technical_shape=(X_technical.shape[1], X_technical.shape[2]),
                fundamental_shape=X_fundamental.shape[1],
                event_shape=X_event.shape[1]
            )

        # Callbacks
        callbacks = [
            EarlyStopping(
                monitor='val_loss',
                patience=15,
                restore_best_weights=True,
                verbose=1
            ),
            ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=7,
                min_lr=1e-7,
                verbose=1
            ),
            ModelCheckpoint(
                os.path.join(self.model_dir, 'best_model_v2.0.h5'),
                monitor='val_loss',
                save_best_only=True,
                verbose=1
            )
        ]

        # Train
        history = self.model.fit(
            [X_technical, X_fundamental, X_event],
            y,
            validation_split=validation_split,
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1
        )

        final_loss = history.history['loss'][-1]
        final_val_loss = history.history['val_loss'][-1]

        logger.info(f"✅ Training complete!")
        logger.info(f"   Final loss: {final_loss:.6f}")
        logger.info(f"   Final val_loss: {final_val_loss:.6f}")

        return history.history

    def predict(
        self,
        X_technical: np.ndarray,
        X_fundamental: np.ndarray,
        X_event: np.ndarray
    ) -> np.ndarray:
        """Make prediction with multi-input model"""
        if self.model is None:
            raise ValueError("Model not trained or loaded")

        prediction = self.model.predict(
            [X_technical, X_fundamental, X_event],
            verbose=0
        )

        return prediction

    def evaluate(
        self,
        X_technical: np.ndarray,
        X_fundamental: np.ndarray,
        X_event: np.ndarray,
        y: np.ndarray
    ) -> Dict:
        """Evaluate model performance"""
        if self.model is None:
            raise ValueError("Model not trained or loaded")

        # Get predictions
        y_pred = self.predict(X_technical, X_fundamental, X_event).flatten()

        # Calculate metrics
        mse = np.mean((y - y_pred) ** 2)
        mae = np.mean(np.abs(y - y_pred))
        rmse = np.sqrt(mse)

        # Directional accuracy
        if len(y) > 1:
            y_direction = np.diff(y) > 0
            pred_direction = np.diff(y_pred) > 0
            directional_accuracy = np.mean(y_direction == pred_direction)
        else:
            directional_accuracy = 0.0

        metrics = {
            'mse': float(mse),
            'mae': float(mae),
            'rmse': float(rmse),
            'directional_accuracy': float(directional_accuracy)
        }

        logger.info(f"Evaluation metrics: {metrics}")

        return metrics

    def save_model(self, filepath: str = None):
        """Save trained model"""
        if self.model is None:
            raise ValueError("No model to save")

        if filepath is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filepath = os.path.join(
                self.model_dir,
                f"multi_input_predictor_v2.0.0_{timestamp}.h5"
            )

        self.model.save(filepath)
        logger.info(f"✅ Model saved to {filepath}")

        return filepath

    def load_model(self, filepath: str):
        """Load saved model"""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Model file not found: {filepath}")

        self.model = keras.models.load_model(filepath)
        logger.info(f"✅ Model loaded from {filepath}")
```

---

## ⏭️ Week 3-4: Training, API, Testing

**Full implementation continues in next section...**

---

## 📝 Summary

**✅ Week 1 Deliverables:**
- Database schema with 3 new tables
- FRED API data collector (all fundamental indicators)
- Economic calendar scraper (Forex Factory)
- 20 years of fundamental data collected

**✅ Week 2 Deliverables:**
- Fundamental feature engineering module
- Multi-input LSTM model v2.0 architecture
- Training pipeline for combined features

**✅ Week 3-4 Deliverables:**
- Train EURUSD v2.0 model
- Compare v1.0 vs v2.0 accuracy
- Upgrade ML API with 3 new endpoints
- Integration testing

---

**Status**: 📝 Plan created, ready for implementation
**Next Step**: Register FRED API key and run database migrations
