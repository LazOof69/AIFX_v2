#!/usr/bin/env python3
"""
Download Historical Forex Data from Yahoo Finance

Purpose: Download maximum available historical data for model retraining
Author: Claude Code
Created: 2025-10-20

Data Ranges:
- 1h interval: Up to 730 days (~2 years) of data
- 15min interval: Up to 60 days of data

This script downloads ALL available historical data to enable proper ML model training
with real market data instead of synthetic/interpolated data.
"""

import yfinance as yf
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import sys
import uuid
import pandas as pd
import time

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

# Forex pairs configuration
FOREX_PAIRS = {
    'EUR/USD': 'EURUSD=X',
    'USD/JPY': 'USDJPY=X'
}

# Historical data configuration
HISTORICAL_CONFIG = {
    '1h': {
        'interval': '1h',
        'period': '730d',  # 2 years (maximum reliable data from yfinance)
        'description': '2 years of hourly data'
    },
    '15min': {
        'interval': '15m',
        'period': '60d',  # 60 days (yfinance limit for 15min)
        'description': '60 days of 15-minute data'
    }
}


def get_db_connection():
    """Establish PostgreSQL connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)


def download_historical_data(pair_symbol, interval, period, retries=3):
    """
    Download historical forex data from yfinance with retry logic

    Args:
        pair_symbol (str): yfinance ticker symbol (e.g., 'EURUSD=X')
        interval (str): Data interval ('15m', '1h')
        period (str): Data period ('60d', '730d')
        retries (int): Number of retry attempts

    Returns:
        pandas.DataFrame: OHLCV data
    """
    for attempt in range(retries):
        try:
            print(f"   📥 Downloading {pair_symbol} {interval} (attempt {attempt + 1}/{retries})...")

            ticker = yf.Ticker(pair_symbol)
            data = ticker.history(period=period, interval=interval)

            if data.empty:
                print(f"   ⚠️  No data returned for {pair_symbol} {interval}")
                if attempt < retries - 1:
                    print(f"   🔄 Retrying in 5 seconds...")
                    time.sleep(5)
                    continue
                return None

            print(f"   ✅ Downloaded {len(data)} candles")
            print(f"   📅 Date range: {data.index[0]} to {data.index[-1]}")
            return data

        except Exception as e:
            print(f"   ❌ Error downloading {pair_symbol} {interval}: {e}")
            if attempt < retries - 1:
                print(f"   🔄 Retrying in 5 seconds...")
                time.sleep(5)
            else:
                print(f"   ❌ All retry attempts failed")
                return None

    return None


def insert_historical_data(conn, pair, timeframe, data, batch_size=500):
    """
    Insert historical market data into PostgreSQL using batch upsert

    Args:
        conn: psycopg2 connection
        pair (str): Currency pair (e.g., 'EUR/USD')
        timeframe (str): Timeframe ('15min', '1h')
        data (DataFrame): OHLCV data from yfinance
        batch_size (int): Batch size for insertion

    Returns:
        int: Number of rows inserted
    """
    if data is None or data.empty:
        return 0

    cursor = conn.cursor()
    total_inserted = 0

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
        # Insert in batches
        for i in range(0, len(values), batch_size):
            batch = values[i:i + batch_size]
            execute_values(cursor, insert_query, batch, page_size=100)
            conn.commit()
            total_inserted += len(batch)
            print(f"      💾 Inserted batch {i//batch_size + 1}: {len(batch)} rows")

        cursor.close()
        return total_inserted

    except Exception as e:
        conn.rollback()
        print(f"   ❌ Database insert failed: {e}")
        cursor.close()
        return 0


def verify_data_quality(conn, pair, timeframe):
    """
    Verify data quality after insertion

    Args:
        conn: psycopg2 connection
        pair (str): Currency pair
        timeframe (str): Timeframe

    Returns:
        dict: Data quality metrics
    """
    cursor = conn.cursor()

    try:
        # Get data statistics
        cursor.execute("""
            SELECT
                COUNT(*) as total_candles,
                MIN(timestamp) as oldest,
                MAX(timestamp) as newest,
                COUNT(DISTINCT DATE(timestamp)) as unique_days
            FROM market_data
            WHERE pair = %s AND timeframe = %s AND source = 'yfinance'
        """, (pair, timeframe))

        result = cursor.fetchone()
        cursor.close()

        return {
            'total_candles': result[0],
            'oldest': result[1],
            'newest': result[2],
            'unique_days': result[3]
        }

    except Exception as e:
        print(f"   ⚠️  Verification failed: {e}")
        cursor.close()
        return None


def download_all_historical_data():
    """Main function to download all historical forex data"""
    print("=" * 80)
    print("🚀 HISTORICAL DATA DOWNLOAD - YFinance")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print("\n📋 Configuration:")
    for timeframe, config in HISTORICAL_CONFIG.items():
        print(f"   • {timeframe}: {config['description']} ({config['period']})")
    print(f"\n💱 Pairs: {', '.join(FOREX_PAIRS.keys())}")
    print("\n" + "=" * 80)

    conn = get_db_connection()
    total_downloaded = 0

    summary = []

    try:
        for pair_name, pair_symbol in FOREX_PAIRS.items():
            print(f"\n{'='*80}")
            print(f"📊 Processing {pair_name} ({pair_symbol})")
            print(f"{'='*80}")

            for timeframe, config in HISTORICAL_CONFIG.items():
                print(f"\n⏱️  Timeframe: {timeframe}")
                print(f"   Description: {config['description']}")

                # Download data
                data = download_historical_data(
                    pair_symbol,
                    config['interval'],
                    config['period']
                )

                if data is not None and not data.empty:
                    # Insert into database
                    print(f"   💾 Storing in database...")
                    inserted = insert_historical_data(conn, pair_name, timeframe, data)
                    total_downloaded += inserted

                    # Verify data quality
                    print(f"   🔍 Verifying data quality...")
                    quality = verify_data_quality(conn, pair_name, timeframe)

                    if quality:
                        print(f"   ✅ Verification complete:")
                        print(f"      Total candles: {quality['total_candles']}")
                        print(f"      Date range: {quality['oldest']} to {quality['newest']}")
                        print(f"      Unique days: {quality['unique_days']}")

                        summary.append({
                            'pair': pair_name,
                            'timeframe': timeframe,
                            'candles': quality['total_candles'],
                            'oldest': quality['oldest'],
                            'newest': quality['newest']
                        })
                else:
                    print(f"   ⚠️  No data downloaded for {pair_name} {timeframe}")
                    summary.append({
                        'pair': pair_name,
                        'timeframe': timeframe,
                        'candles': 0,
                        'oldest': None,
                        'newest': None
                    })

                # Small delay between requests
                time.sleep(2)

        # Print final summary
        print("\n\n" + "=" * 80)
        print("📊 DOWNLOAD SUMMARY")
        print("=" * 80)

        for item in summary:
            if item['candles'] > 0:
                print(f"\n✅ {item['pair']} {item['timeframe']}:")
                print(f"   Candles: {item['candles']}")
                print(f"   Range: {item['oldest']} → {item['newest']}")
            else:
                print(f"\n❌ {item['pair']} {item['timeframe']}: No data")

        print("\n" + "=" * 80)
        print(f"✅ DOWNLOAD COMPLETE")
        print(f"   Total candles downloaded: {total_downloaded}")
        print(f"   Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)

    finally:
        conn.close()

    return total_downloaded


def main():
    """Entry point"""
    try:
        total = download_all_historical_data()

        if total > 0:
            print(f"\n🎉 Success! Downloaded {total} historical candles")
            sys.exit(0)
        else:
            print(f"\n⚠️  Warning: No data was downloaded")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n⚠️  Download interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
