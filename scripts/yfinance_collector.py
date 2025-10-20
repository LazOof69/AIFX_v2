#!/usr/bin/env python3
"""
YFinance Data Collector for AIFX v2

Purpose: Collect real-time forex data from Yahoo Finance and store in PostgreSQL
Author: Claude Code
Created: 2025-10-20
"""

import yfinance as yf
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import sys
import uuid

# Load environment variables
load_dotenv('/root/AIFX_v2/backend/.env')

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'aifx_v2_dev'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}

# Forex pairs configuration (yfinance format)
FOREX_PAIRS = {
    'EUR/USD': 'EURUSD=X',
    'USD/JPY': 'USDJPY=X'
}

# Timeframes configuration
TIMEFRAMES = {
    '15min': {'interval': '15m', 'period': '7d', 'limit': 200},
    '1h': {'interval': '1h', 'period': '30d', 'limit': 200}
}


def get_db_connection():
    """Establish PostgreSQL connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)


def fetch_forex_data(pair_symbol, interval, period):
    """
    Fetch forex data from yfinance

    Args:
        pair_symbol (str): yfinance ticker symbol (e.g., 'EURUSD=X')
        interval (str): Data interval ('15m', '1h', '1d')
        period (str): Data period ('1d', '7d', '1mo')

    Returns:
        pandas.DataFrame: OHLCV data
    """
    try:
        ticker = yf.Ticker(pair_symbol)
        data = ticker.history(period=period, interval=interval)

        if data.empty:
            print(f"⚠️  No data returned for {pair_symbol}")
            return None

        return data

    except Exception as e:
        print(f"❌ Error fetching {pair_symbol}: {e}")
        return None


def insert_market_data(conn, pair, timeframe, data):
    """
    Insert market data into PostgreSQL using batch upsert

    Args:
        conn: psycopg2 connection
        pair (str): Currency pair (e.g., 'EUR/USD')
        timeframe (str): Timeframe ('15min', '1h')
        data (DataFrame): OHLCV data from yfinance

    Returns:
        int: Number of rows inserted
    """
    if data is None or data.empty:
        return 0

    cursor = conn.cursor()

    # Prepare batch data
    values = []
    for timestamp, row in data.iterrows():
        # Convert timezone-aware timestamp to UTC
        timestamp_utc = timestamp.tz_convert('UTC').replace(tzinfo=None)

        values.append((
            str(uuid.uuid4()),  # id
            pair,  # pair
            timeframe,  # timeframe
            timestamp_utc,  # timestamp
            float(row['Open']),  # open
            float(row['High']),  # high
            float(row['Low']),  # low
            float(row['Close']),  # close
            int(row.get('Volume', 0)),  # volume
            'yfinance',  # source
            False,  # is_real_time
            datetime.now(),  # created_at
            datetime.now()  # updated_at
        ))

    # Batch insert with ON CONFLICT DO UPDATE
    insert_query = """
        INSERT INTO market_data (
            id, pair, timeframe, timestamp, open, high, low, close, volume,
            source, is_real_time, created_at, updated_at
        ) VALUES %s
        ON CONFLICT (pair, timeframe, timestamp)
        DO UPDATE SET
            open = EXCLUDED.open,
            high = EXCLUDED.high,
            low = EXCLUDED.low,
            close = EXCLUDED.close,
            volume = EXCLUDED.volume,
            source = EXCLUDED.source,
            updated_at = EXCLUDED.updated_at
    """

    try:
        execute_values(cursor, insert_query, values, page_size=100)
        conn.commit()
        rows_affected = cursor.rowcount
        cursor.close()
        return rows_affected

    except Exception as e:
        conn.rollback()
        print(f"❌ Database insert failed: {e}")
        cursor.close()
        return 0


def collect_all_data():
    """Main function to collect all configured forex data"""
    print("=" * 70)
    print("🚀 Starting YFinance Data Collection")
    print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    conn = get_db_connection()
    total_inserted = 0

    try:
        for pair_name, pair_symbol in FOREX_PAIRS.items():
            print(f"\n📊 Processing {pair_name} ({pair_symbol})")

            for timeframe, config in TIMEFRAMES.items():
                try:
                    # Fetch data from yfinance
                    data = fetch_forex_data(
                        pair_symbol,
                        config['interval'],
                        config['period']
                    )

                    if data is not None and not data.empty:
                        # Take only the most recent N candles
                        data = data.tail(config['limit'])

                        # Insert into database
                        inserted = insert_market_data(conn, pair_name, timeframe, data)
                        total_inserted += inserted

                        print(f"   ✅ {timeframe}: {len(data)} candles fetched, {inserted} rows affected")
                        print(f"      Latest: {data.index[-1].strftime('%Y-%m-%d %H:%M:%S')}")
                        print(f"      Close: {data['Close'].iloc[-1]:.5f}")
                    else:
                        print(f"   ⚠️  {timeframe}: No data available")

                except Exception as e:
                    print(f"   ❌ {timeframe}: Error - {e}")
                    continue

        print("\n" + "=" * 70)
        print(f"✅ Collection completed: {total_inserted} total rows affected")
        print("=" * 70)

    finally:
        conn.close()

    return total_inserted


def main():
    """Entry point"""
    try:
        collect_all_data()
        sys.exit(0)
    except KeyboardInterrupt:
        print("\n⚠️  Collection interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
