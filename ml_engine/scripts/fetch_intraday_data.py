"""
Fetch Intraday Forex Data

Purpose: Download 1h and 15min data from yfinance for EUR/USD and USD/JPY
Output: CSV files compatible with market_data table
"""

import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import os

def fetch_forex_data(pair_symbol, interval, period='60d'):
    """
    Fetch forex data from yfinance

    Args:
        pair_symbol: str - e.g., 'EURUSD=X'
        interval: str - '1h', '15m', etc.
        period: str - '1d', '5d', '1mo', '60d', etc.

    Returns:
        DataFrame with OHLC data
    """
    print(f"Fetching {pair_symbol} {interval} data...")

    ticker = yf.Ticker(pair_symbol)
    df = ticker.history(period=period, interval=interval)

    if df.empty:
        print(f"  ❌ No data received for {pair_symbol}")
        return None

    print(f"  ✅ Received {len(df)} candles")
    return df

def save_to_csv(df, pair_name, timeframe, output_dir):
    """Save DataFrame to CSV file"""
    if df is None or df.empty:
        return None

    # Reset index to get timestamp as column
    df = df.reset_index()

    # Rename columns to match our format
    df = df.rename(columns={
        'Datetime': 'timestamp',
        'Date': 'timestamp',
        'Open': 'open',
        'High': 'high',
        'Low': 'low',
        'Close': 'close',
        'Volume': 'volume'
    })

    # Add pair column
    df['pair'] = pair_name
    df['timeframe'] = timeframe
    df['source'] = 'yfinance'

    # Select only needed columns
    df = df[['timestamp', 'open', 'high', 'low', 'close', 'volume', 'pair', 'timeframe', 'source']]

    # Sort by timestamp
    df = df.sort_values('timestamp')

    # Save to CSV
    filename = f"{pair_name.replace('/', '')}_yfinance_{timeframe}.csv"
    filepath = os.path.join(output_dir, filename)
    df.to_csv(filepath, index=False)

    print(f"  💾 Saved to {filepath}")
    return filepath

def main():
    print("=" * 60)
    print("📊 Intraday Forex Data Fetcher (yfinance)")
    print("=" * 60)
    print("")

    # Configuration
    pairs = {
        'EURUSD=X': 'EUR/USD',
        'USDJPY=X': 'USD/JPY'
    }

    timeframes = {
        '1h': ('1h', '60d'),      # (yfinance_interval, period)
        '15min': ('15m', '60d')   # yfinance uses '15m', but we store as '15min'
    }

    output_dir = '/root/AIFX_v2/ml_engine/data/intraday'
    os.makedirs(output_dir, exist_ok=True)

    results = []

    # Fetch data for each combination
    for yf_symbol, pair_name in pairs.items():
        print(f"\n📈 {pair_name}")
        print("-" * 40)

        for timeframe, (yf_interval, period) in timeframes.items():
            try:
                df = fetch_forex_data(yf_symbol, yf_interval, period)
                if df is not None:
                    filepath = save_to_csv(df, pair_name, timeframe, output_dir)
                    results.append({
                        'pair': pair_name,
                        'timeframe': timeframe,
                        'candles': len(df),
                        'file': filepath,
                        'status': 'success'
                    })
            except Exception as e:
                print(f"  ❌ Error: {str(e)}")
                results.append({
                    'pair': pair_name,
                    'timeframe': timeframe,
                    'status': 'failed',
                    'error': str(e)
                })

    # Summary
    print("\n" + "=" * 60)
    print("📊 Summary")
    print("=" * 60)

    successful = [r for r in results if r['status'] == 'success']
    failed = [r for r in results if r['status'] == 'failed']

    if successful:
        print(f"\n✅ Successfully fetched {len(successful)} datasets:")
        for r in successful:
            print(f"   {r['pair']} {r['timeframe']}: {r['candles']} candles")

    if failed:
        print(f"\n❌ Failed {len(failed)} datasets:")
        for r in failed:
            print(f"   {r['pair']} {r['timeframe']}: {r.get('error', 'Unknown error')}")

    print(f"\n📁 Output directory: {output_dir}")
    print("=" * 60)
    print("✅ Done!")

if __name__ == '__main__':
    main()
