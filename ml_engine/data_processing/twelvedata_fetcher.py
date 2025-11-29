"""
Twelve Data API Fetcher
Fetches forex data using Twelve Data API
Free tier: 800 requests/day, more stable than Yahoo Finance
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


class TwelveDataFetcher:
    """Fetch forex data from Twelve Data API"""

    # Get API key from environment
    API_KEY = os.getenv('TWELVE_DATA_KEY', '')
    BASE_URL = 'https://api.twelvedata.com'

    # Mapping of currency pairs to Twelve Data format
    PAIR_MAPPING = {
        'EUR/USD': 'EUR/USD',
        'GBP/USD': 'GBP/USD',
        'USD/JPY': 'USD/JPY',
        'USD/CHF': 'USD/CHF',
        'AUD/USD': 'AUD/USD',
        'USD/CAD': 'USD/CAD',
        'NZD/USD': 'NZD/USD',
        'EUR/GBP': 'EUR/GBP',
        'EUR/AUD': 'EUR/AUD',
        'EUR/JPY': 'EUR/JPY',
        'GBP/JPY': 'GBP/JPY',
        'CHF/JPY': 'CHF/JPY',
        'AUD/JPY': 'AUD/JPY',
        'AUD/NZD': 'AUD/NZD',
    }

    # Timeframe mapping to Twelve Data intervals
    TIMEFRAME_MAPPING = {
        '1min': '1min',
        '5min': '5min',
        '15min': '15min',
        '30min': '30min',
        '1h': '1h',
        '4h': '4h',
        '1d': '1day',
        '1w': '1week',
        '1M': '1month',
    }

    @classmethod
    def get_pair_symbol(cls, pair: str) -> str:
        """Convert currency pair to Twelve Data format"""
        # Try exact match first
        if pair in cls.PAIR_MAPPING:
            return cls.PAIR_MAPPING[pair]

        # If no slash, try adding one (e.g., EURUSD -> EUR/USD)
        if '/' not in pair and len(pair) == 6:
            formatted_pair = f"{pair[:3]}/{pair[3:]}"
            if formatted_pair in cls.PAIR_MAPPING:
                return cls.PAIR_MAPPING[formatted_pair]

        # Fallback: assume format is XXXYYY and add slash
        if len(pair) == 6:
            return f"{pair[:3]}/{pair[3:]}"

        return pair

    @classmethod
    def fetch_historical_data(
        cls,
        pair: str,
        timeframe: str = '1h',
        limit: int = 100
    ) -> Dict:
        """
        Fetch historical forex data from Twelve Data

        Args:
            pair: Currency pair (e.g., 'EUR/USD', 'EURUSD')
            timeframe: Timeframe (e.g., '1h', '15min', '1d')
            limit: Number of candles to fetch (max 5000)

        Returns:
            Dict with timeSeries, metadata, and status
        """
        try:
            if not cls.API_KEY:
                logger.error("TWELVE_DATA_KEY not set in environment")
                return {
                    'success': False,
                    'error': 'API key not configured',
                    'timeSeries': [],
                    'metadata': {'pair': pair, 'timeframe': timeframe}
                }

            symbol = cls.get_pair_symbol(pair)
            interval = cls.TIMEFRAME_MAPPING.get(timeframe, '1h')

            logger.info(f"Fetching {pair} ({symbol}) data: timeframe={timeframe}, interval={interval}, limit={limit}")

            # Build request parameters
            params = {
                'symbol': symbol,
                'interval': interval,
                'outputsize': min(limit, 5000),  # Twelve Data max is 5000
                'apikey': cls.API_KEY,
                'format': 'JSON',
                'type': 'forex'
            }

            # Make request with retry logic
            max_retries = 3
            data = None

            for attempt in range(max_retries):
                try:
                    response = requests.get(
                        f"{cls.BASE_URL}/time_series",
                        params=params,
                        timeout=10
                    )
                    response.raise_for_status()
                    data = response.json()

                    # Check for API error messages
                    if 'status' in data and data['status'] == 'error':
                        error_msg = data.get('message', 'Unknown error')
                        logger.error(f"Twelve Data API error: {error_msg}")

                        # Check if it's a rate limit error
                        if 'limit' in error_msg.lower() or 'quota' in error_msg.lower():
                            if attempt < max_retries - 1:
                                wait_time = 60  # Wait 1 minute for rate limit
                                logger.warning(f"Rate limit hit, waiting {wait_time}s...")
                                time.sleep(wait_time)
                                continue

                        raise ValueError(error_msg)

                    break

                except requests.RequestException as e:
                    logger.warning(f"Attempt {attempt + 1}/{max_retries} failed: {str(e)}")
                    if attempt < max_retries - 1:
                        time.sleep(2 ** attempt)  # Exponential backoff
                    else:
                        raise

            if not data or 'values' not in data:
                logger.error(f"Unexpected response format: {list(data.keys()) if data else 'None'}")
                return {
                    'success': False,
                    'error': f'No time series data in response. Available keys: {list(data.keys()) if data else "None"}',
                    'timeSeries': [],
                    'metadata': {
                        'pair': pair,
                        'timeframe': timeframe,
                    }
                }

            # Parse response
            values = data['values']

            # Convert to our format
            time_series = []
            for candle in values[:limit]:  # Limit to requested number
                try:
                    time_series.append({
                        'timestamp': candle['datetime'],
                        'open': float(candle['open']),
                        'high': float(candle['high']),
                        'low': float(candle['low']),
                        'close': float(candle['close']),
                        'volume': 0.0,  # Forex doesn't have volume in Twelve Data
                    })
                except (KeyError, ValueError) as e:
                    logger.warning(f"Skipping invalid candle: {e}")
                    continue

            logger.info(f"Successfully fetched {len(time_series)} candles for {pair}")

            metadata = data.get('meta', {})
            return {
                'success': True,
                'timeSeries': time_series,
                'metadata': {
                    'pair': pair,
                    'symbol': symbol,
                    'timeframe': timeframe,
                    'interval': interval,
                    'candlesCount': len(time_series),
                    'dataSource': 'twelvedata',
                    'fetchedAt': datetime.now().isoformat(),
                    'currency_base': metadata.get('currency_base', ''),
                    'currency_quote': metadata.get('currency_quote', ''),
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
            if not cls.API_KEY:
                logger.error("TWELVE_DATA_KEY not set")
                return None

            symbol = cls.get_pair_symbol(pair)

            params = {
                'symbol': symbol,
                'apikey': cls.API_KEY,
                'type': 'forex'
            }

            response = requests.get(
                f"{cls.BASE_URL}/price",
                params=params,
                timeout=10
            )
            response.raise_for_status()
            data = response.json()

            if 'price' in data:
                return float(data['price'])

            return None

        except Exception as e:
            logger.error(f"Error getting current price for {pair}: {str(e)}")
            return None
