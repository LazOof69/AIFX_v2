#!/usr/bin/env python3
"""
Simple YFinance Market Data Fetcher
Returns JSON format data for Backend consumption
"""

import sys
import json
import yfinance as yf
from datetime import datetime, timedelta
import pandas as pd

# Mapping of currency pairs to yfinance tickers
PAIR_MAPPING = {
    'EUR/USD': 'EURUSD=X',
    'GBP/USD': 'GBPUSD=X',
    'USD/JPY': 'USDJPY=X',
    'USD/CHF': 'USDCHF=X',
    'AUD/USD': 'AUDUSD=X',
    'USD/CAD': 'USDCAD=X',
    'NZD/USD': 'NZDUSD=X',
}

#Timeframe mapping
TIMEFRAME_MAPPING = {
    '1min': '1m',
    '5min': '5m',
    '15min': '15m',
    '30min': '30m',
    '1h': '1h',
    '4h': '1h',  # Will aggregate
    '1d': '1d',
    '1w': '1wk',
    '1M': '1mo',
}

def fetch_data(pair, timeframe='1h', limit=100):
    """Fetch market data and return as JSON"""
    try:
        # Get ticker
        ticker = PAIR_MAPPING.get(pair, f"{pair.replace('/', '')}=X")
        interval = TIMEFRAME_MAPPING.get(timeframe, '1h')

        # Calculate period
        period_days = {
            '1min': 7, '5min': 30, '15min': 30, '30min': 30,
            '1h': 60, '4h': 120, '1d': 365, '1w': 730, '1M': 1825
        }.get(timeframe, 60)

        end_date = datetime.now()
        start_date = end_date - timedelta(days=period_days)

        # Fetch data
        ticker_obj = yf.Ticker(ticker)
        df = ticker_obj.history(start=start_date, end=end_date, interval=interval)

        if df.empty:
            return {'success': False, 'error': f'No data for {pair}', 'timeSeries': []}

        # Aggregate to 4h if needed
        if timeframe == '4h':
            df = df.resample('4H').agg({
                'Open': 'first', 'High': 'max', 'Low': 'min',
                'Close': 'last', 'Volume': 'sum'
            }).dropna()

        # Limit candles
        df = df.tail(limit)

        # Convert to format expected by backend
        time_series = []
        for timestamp, row in df.iterrows():
            time_series.append({
                'timestamp': timestamp.isoformat(),
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close']),
                'volume': float(row.get('Volume', 0)),
            })

        # Reverse to have most recent first
        time_series.reverse()

        return {
            'success': True,
            'timeSeries': time_series,
            'metadata': {
                'pair': pair,
                'ticker': ticker,
                'timeframe': timeframe,
                'candlesCount': len(time_series),
                'dataSource': 'yfinance'
            }
        }

    except Exception as e:
        return {'success': False, 'error': str(e), 'timeSeries': []}

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'Usage: fetch_market_data.py PAIR [TIMEFRAME] [LIMIT]'}))
        sys.exit(1)

    pair = sys.argv[1]
    timeframe = sys.argv[2] if len(sys.argv) > 2 else '1h'
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 100

    result = fetch_data(pair, timeframe, limit)
    print(json.dumps(result))
