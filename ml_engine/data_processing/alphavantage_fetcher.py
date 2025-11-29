"""
Alpha Vantage Data Fetcher
Fetches forex data using Alpha Vantage API
Free tier: 25 requests/day, 5 requests/minute
"""

import requests
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging
import time
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AlphaVantageFetcher:
    """Fetch forex data from Alpha Vantage"""

    # Default API key (demo) - should be replaced with real key
    API_KEY = os.getenv('ALPHA_VANTAGE_KEY', 'demo')
    BASE_URL = 'https://www.alphavantage.co/query'

    # Mapping of currency pairs to from/to symbols
    PAIR_MAPPING = {
        'EUR/USD': ('EUR', 'USD'),
        'GBP/USD': ('GBP', 'USD'),
        'USD/JPY': ('USD', 'JPY'),
        'USD/CHF': ('USD', 'CHF'),
        'AUD/USD': ('AUD', 'USD'),
        'USD/CAD': ('USD', 'CAD'),
        'NZD/USD': ('NZD', 'USD'),
        'EUR/GBP': ('EUR', 'GBP'),
        'EUR/AUD': ('EUR', 'AUD'),
        'EUR/JPY': ('EUR', 'JPY'),
        'GBP/JPY': ('GBP', 'JPY'),
        'CHF/JPY': ('CHF', 'JPY'),
        'AUD/JPY': ('AUD', 'JPY'),
        'AUD/NZD': ('AUD', 'NZD'),
    }

    # Timeframe mapping to Alpha Vantage intervals
    TIMEFRAME_MAPPING = {
        '1min': '1min',
        '5min': '5min',
        '15min': '15min',
        '30min': '30min',
        '1h': '60min',
        '4h': 'daily',  # Alpha Vantage doesn't have 4h, use daily + aggregation
        '1d': 'daily',
        '1w': 'weekly',
        '1M': 'monthly',
    }

    @classmethod
    def get_pair_symbols(cls, pair: str) -> tuple:
        """Convert currency pair to from/to symbols"""
        # Try exact match first
        if pair in cls.PAIR_MAPPING:
            return cls.PAIR_MAPPING[pair]

        # If no slash, try adding one (e.g., EURUSD -> EUR/USD)
        if '/' not in pair and len(pair) == 6:
            formatted_pair = f"{pair[:3]}/{pair[3:]}"
            if formatted_pair in cls.PAIR_MAPPING:
                return cls.PAIR_MAPPING[formatted_pair]

        # Fallback: assume format is XXXYYY
        if len(pair) == 6:
            return (pair[:3], pair[3:])

        raise ValueError(f"Invalid currency pair format: {pair}")

    @classmethod
    def fetch_historical_data(
        cls,
        pair: str,
        timeframe: str = '1h',
        limit: int = 100
    ) -> Dict:
        """
        Fetch historical forex data from Alpha Vantage

        Args:
            pair: Currency pair (e.g., 'EUR/USD')
            timeframe: Timeframe (e.g., '1h', '1d')
            limit: Number of candles to fetch

        Returns:
            Dict with timeSeries, metadata, and status
        """
        try:
            from_symbol, to_symbol = cls.get_pair_symbols(pair)
            interval = cls.TIMEFRAME_MAPPING.get(timeframe, '60min')

            logger.info(f"Fetching {pair} ({from_symbol}/{to_symbol}) data: timeframe={timeframe}, interval={interval}")

            # Determine function based on timeframe
            if timeframe in ['1d', '1w', '1M']:
                function = 'FX_DAILY'
                if timeframe == '1w':
                    function = 'FX_WEEKLY'
                elif timeframe == '1M':
                    function = 'FX_MONTHLY'

                params = {
                    'function': function,
                    'from_symbol': from_symbol,
                    'to_symbol': to_symbol,
                    'apikey': cls.API_KEY,
                    'outputsize': 'full' if limit > 100 else 'compact'
                }
            else:
                # Intraday data
                function = 'FX_INTRADAY'
                params = {
                    'function': function,
                    'from_symbol': from_symbol,
                    'to_symbol': to_symbol,
                    'interval': interval,
                    'apikey': cls.API_KEY,
                    'outputsize': 'full' if limit > 100 else 'compact'
                }

            # Make request with retry logic
            max_retries = 3
            data = None

            for attempt in range(max_retries):
                try:
                    response = requests.get(cls.BASE_URL, params=params, timeout=10)
                    response.raise_for_status()
                    data = response.json()

                    # Check for API error messages
                    if 'Error Message' in data:
                        raise ValueError(data['Error Message'])
                    if 'Note' in data:
                        # Rate limit message
                        logger.warning(f"API rate limit: {data['Note']}")
                        if attempt < max_retries - 1:
                            time.sleep(60)  # Wait 1 minute
                            continue
                        raise ValueError("API rate limit exceeded")
                    if 'Information' in data and 'demo' in data['Information'].lower():
                        logger.warning("Using demo API key - limited functionality")

                    break

                except requests.RequestException as e:
                    logger.warning(f"Attempt {attempt + 1}/{max_retries} failed: {str(e)}")
                    if attempt < max_retries - 1:
                        time.sleep(2 ** attempt)
                    else:
                        raise

            if not data:
                raise ValueError("No data returned from API")

            # Parse response based on function type
            if function == 'FX_DAILY':
                time_series_key = 'Time Series FX (Daily)'
            elif function == 'FX_WEEKLY':
                time_series_key = 'Time Series FX (Weekly)'
            elif function == 'FX_MONTHLY':
                time_series_key = 'Time Series FX (Monthly)'
            else:
                time_series_key = f'Time Series FX ({interval})'

            if time_series_key not in data:
                logger.error(f"Unexpected response format: {list(data.keys())}")
                return {
                    'success': False,
                    'error': f'No time series data in response. Available keys: {list(data.keys())}',
                    'timeSeries': [],
                    'metadata': {
                        'pair': pair,
                        'timeframe': timeframe,
                    }
                }

            time_series_data = data[time_series_key]

            # Convert to our format
            time_series = []
            for timestamp_str, values in sorted(time_series_data.items(), reverse=True)[:limit]:
                time_series.append({
                    'timestamp': timestamp_str,
                    'open': float(values['1. open']),
                    'high': float(values['2. high']),
                    'low': float(values['3. low']),
                    'close': float(values['4. close']),
                    'volume': 0.0,  # Forex doesn't have volume in Alpha Vantage
                })

            logger.info(f"Successfully fetched {len(time_series)} candles for {pair}")

            metadata = data.get('Meta Data', {})
            return {
                'success': True,
                'timeSeries': time_series,
                'metadata': {
                    'pair': pair,
                    'from_symbol': from_symbol,
                    'to_symbol': to_symbol,
                    'timeframe': timeframe,
                    'interval': interval,
                    'candlesCount': len(time_series),
                    'dataSource': 'alphavantage',
                    'fetchedAt': datetime.now().isoformat(),
                    'lastRefreshed': metadata.get('5. Last Refreshed', ''),
                },
                'cached': False,
            }

        except Exception as e:
            logger.error(f"Error fetching {pair} data: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'timeSeries': [],
                'metadata': {
                    'pair': pair,
                    'timeframe': timeframe,
                }
            }

    @classmethod
    def get_current_price(cls, pair: str) -> Optional[float]:
        """Get current price for a currency pair"""
        try:
            from_symbol, to_symbol = cls.get_pair_symbols(pair)

            params = {
                'function': 'CURRENCY_EXCHANGE_RATE',
                'from_currency': from_symbol,
                'to_currency': to_symbol,
                'apikey': cls.API_KEY
            }

            response = requests.get(cls.BASE_URL, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            if 'Realtime Currency Exchange Rate' in data:
                rate_data = data['Realtime Currency Exchange Rate']
                return float(rate_data['5. Exchange Rate'])

            return None

        except Exception as e:
            logger.error(f"Error getting current price for {pair}: {str(e)}")
            return None
