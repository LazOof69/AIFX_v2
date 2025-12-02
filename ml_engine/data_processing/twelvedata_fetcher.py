"""
Twelve Data API Fetcher
Fetches forex data using Twelve Data API with yfinance fallback
Free tier: 800 requests/day
Fallback: yfinance (unlimited, free)
"""

import requests
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging
import time
import os

# Direct Yahoo Finance API fallback (bypasses yfinance and curl-cffi issues)
# This is more reliable in systemd environments
YAHOO_FINANCE_AVAILABLE = True

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TwelveDataFetcher:
    """Fetch forex data from Twelve Data API with yfinance fallback"""

    # Get API key from environment
    API_KEY = os.getenv('TWELVE_DATA_KEY', '')
    BASE_URL = 'https://api.twelvedata.com'

    # Track if daily quota is exhausted (reset at midnight UTC)
    _quota_exhausted = False
    _quota_exhausted_time = None

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

    # yfinance symbol mapping (uses =X suffix for forex)
    YFINANCE_PAIR_MAPPING = {
        'EUR/USD': 'EURUSD=X',
        'GBP/USD': 'GBPUSD=X',
        'USD/JPY': 'JPY=X',  # JPY=X returns USD/JPY directly (no inversion needed)
        'USD/CHF': 'CHF=X',  # Note: yfinance inverts USD/CHF
        'AUD/USD': 'AUDUSD=X',
        'USD/CAD': 'CAD=X',  # Note: yfinance inverts USD/CAD
        'NZD/USD': 'NZDUSD=X',
        'EUR/GBP': 'EURGBP=X',
        'EUR/AUD': 'EURAUD=X',
        'EUR/JPY': 'EURJPY=X',
        'GBP/JPY': 'GBPJPY=X',
        'CHF/JPY': 'CHFJPY=X',
        'AUD/JPY': 'AUDJPY=X',
        'AUD/NZD': 'AUDNZD=X',
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

    # yfinance timeframe mapping
    YFINANCE_TIMEFRAME_MAPPING = {
        '1min': '1m',
        '5min': '5m',
        '15min': '15m',
        '30min': '30m',
        '1h': '1h',
        '4h': '1h',  # yfinance doesn't support 4h, we'll resample
        '1d': '1d',
        '1w': '1wk',
        '1M': '1mo',
    }

    # yfinance period mapping (how much historical data to fetch)
    # Note: For forex, yfinance has limited history for intraday data
    YFINANCE_PERIOD_MAPPING = {
        '1min': '5d',     # 1-minute data available for ~5-7 days
        '5min': '60d',
        '15min': '60d',
        '30min': '60d',
        '1h': '60d',      # 1h data works with 60d (not 730d)
        '4h': '60d',
        '1d': '1y',       # Daily data available for 1 year
        '1w': '5y',
        '1M': '5y',
    }

    @classmethod
    def _check_quota_reset(cls):
        """Check if quota should be reset (at midnight UTC)"""
        if cls._quota_exhausted and cls._quota_exhausted_time:
            now = datetime.utcnow()
            # Reset if it's a new day
            if now.date() > cls._quota_exhausted_time.date():
                cls._quota_exhausted = False
                cls._quota_exhausted_time = None
                logger.info("Twelve Data quota reset for new day")

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
    def _normalize_pair(cls, pair: str) -> str:
        """Normalize pair format to XXX/YYY"""
        if '/' in pair:
            return pair.upper()
        if len(pair) == 6:
            return f"{pair[:3]}/{pair[3:]}".upper()
        return pair.upper()

    @classmethod
    def _fetch_from_yahoo_finance(
        cls,
        pair: str,
        timeframe: str = '1h',
        limit: int = 100
    ) -> Dict:
        """
        Fallback: Fetch data directly from Yahoo Finance API using requests
        This bypasses yfinance and curl-cffi to avoid impersonation issues in systemd

        Returns data in the SAME FORMAT as fetch_historical_data for compatibility
        """
        if not YAHOO_FINANCE_AVAILABLE:
            logger.error("Yahoo Finance fallback not available")
            return {
                'success': False,
                'error': 'Yahoo Finance not available',
                'timeSeries': [],
                'metadata': {'pair': pair, 'timeframe': timeframe}
            }

        try:
            normalized_pair = cls._normalize_pair(pair)

            # Get Yahoo Finance symbol
            yf_symbol = cls.YFINANCE_PAIR_MAPPING.get(normalized_pair)
            if not yf_symbol:
                # Try generic format
                clean_pair = normalized_pair.replace('/', '')
                yf_symbol = f"{clean_pair}=X"

            yf_interval = cls.YFINANCE_TIMEFRAME_MAPPING.get(timeframe, '1h')

            # Calculate period timestamps
            period_days = {
                '5d': 5, '60d': 60, '1y': 365, '5y': 1825
            }
            period_str = cls.YFINANCE_PERIOD_MAPPING.get(timeframe, '60d')
            days = period_days.get(period_str, 60)

            end_time = int(datetime.now().timestamp())
            start_time = int((datetime.now() - timedelta(days=days)).timestamp())

            logger.info(f"📊 Yahoo Finance fallback: Fetching {normalized_pair} ({yf_symbol}), interval={yf_interval}")

            # Direct Yahoo Finance API call
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yf_symbol}"
            params = {
                'period1': start_time,
                'period2': end_time,
                'interval': yf_interval,
                'includePrePost': 'false',
                'events': 'div,splits'
            }

            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }

            response = requests.get(url, params=params, headers=headers, timeout=15)
            response.raise_for_status()
            data = response.json()

            # Parse response
            if 'chart' not in data or 'result' not in data['chart'] or not data['chart']['result']:
                error_msg = data.get('chart', {}).get('error', {}).get('description', 'No data')
                logger.warning(f"Yahoo Finance returned no data for {yf_symbol}: {error_msg}")
                return {
                    'success': False,
                    'error': f'No data available from Yahoo Finance for {normalized_pair}',
                    'timeSeries': [],
                    'metadata': {'pair': normalized_pair, 'timeframe': timeframe}
                }

            result = data['chart']['result'][0]
            timestamps = result.get('timestamp', [])
            quotes = result.get('indicators', {}).get('quote', [{}])[0]

            if not timestamps:
                logger.warning(f"Yahoo Finance returned empty timestamps for {yf_symbol}")
                return {
                    'success': False,
                    'error': f'No timestamp data from Yahoo Finance for {normalized_pair}',
                    'timeSeries': [],
                    'metadata': {'pair': normalized_pair, 'timeframe': timeframe}
                }

            opens = quotes.get('open', [])
            highs = quotes.get('high', [])
            lows = quotes.get('low', [])
            closes = quotes.get('close', [])
            volumes = quotes.get('volume', [])

            # Handle inverted pairs (USD/CHF, USD/CAD)
            # Note: JPY=X returns USD/JPY directly, no inversion needed
            inverted_pairs = ['USD/CHF', 'USD/CAD']
            needs_inversion = normalized_pair in inverted_pairs

            # Convert to time series format (SAME format as Twelve Data)
            time_series = []

            # Process data in reverse order (most recent first)
            for i in range(len(timestamps) - 1, max(len(timestamps) - limit - 1, -1), -1):
                try:
                    ts = timestamps[i]
                    open_val = opens[i] if i < len(opens) and opens[i] is not None else None
                    high_val = highs[i] if i < len(highs) and highs[i] is not None else None
                    low_val = lows[i] if i < len(lows) and lows[i] is not None else None
                    close_val = closes[i] if i < len(closes) and closes[i] is not None else None
                    volume_val = volumes[i] if i < len(volumes) and volumes[i] is not None else 0

                    if None in [open_val, high_val, low_val, close_val]:
                        continue

                    # Invert if needed (for USD/JPY etc)
                    if needs_inversion and open_val != 0:
                        open_val = 1.0 / open_val
                        close_val = 1.0 / close_val
                        high_val_temp = 1.0 / low_val if low_val != 0 else 0
                        low_val = 1.0 / high_val if high_val != 0 else 0
                        high_val = high_val_temp

                    # Format timestamp to match Twelve Data format
                    timestamp_str = datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S')

                    time_series.append({
                        'timestamp': timestamp_str,
                        'open': round(float(open_val), 5),
                        'high': round(float(high_val), 5),
                        'low': round(float(low_val), 5),
                        'close': round(float(close_val), 5),
                        'volume': float(volume_val),
                    })
                except (IndexError, TypeError, ZeroDivisionError) as e:
                    continue

            if not time_series:
                return {
                    'success': False,
                    'error': 'Failed to parse Yahoo Finance data',
                    'timeSeries': [],
                    'metadata': {'pair': normalized_pair, 'timeframe': timeframe}
                }

            logger.info(f"✅ Yahoo Finance: Successfully fetched {len(time_series)} candles for {normalized_pair}")

            # Return in EXACT same format as Twelve Data
            return {
                'success': True,
                'timeSeries': time_series,
                'metadata': {
                    'pair': normalized_pair,
                    'symbol': yf_symbol,
                    'timeframe': timeframe,
                    'interval': yf_interval,
                    'candlesCount': len(time_series),
                    'dataSource': 'yahoo_finance',  # Mark as yahoo_finance source
                    'fetchedAt': datetime.now().isoformat(),
                    'currency_base': normalized_pair.split('/')[0],
                    'currency_quote': normalized_pair.split('/')[1],
                },
                'cached': False,
            }

        except requests.RequestException as e:
            logger.error(f"Yahoo Finance request error for {pair}: {str(e)}")
            return {
                'success': False,
                'error': f'Yahoo Finance request error: {str(e)}',
                'timeSeries': [],
                'metadata': {'pair': pair, 'timeframe': timeframe}
            }
        except Exception as e:
            logger.error(f"Yahoo Finance fallback error for {pair}: {str(e)}")
            return {
                'success': False,
                'error': f'Yahoo Finance error: {str(e)}',
                'timeSeries': [],
                'metadata': {'pair': pair, 'timeframe': timeframe}
            }

    # Alias for backward compatibility
    _fetch_from_yfinance = _fetch_from_yahoo_finance

    @classmethod
    def fetch_historical_data(
        cls,
        pair: str,
        timeframe: str = '1h',
        limit: int = 100
    ) -> Dict:
        """
        Fetch historical forex data from Twelve Data with yfinance fallback

        Strategy:
        1. Try Twelve Data API first (800/day limit)
        2. If quota exhausted or error, fallback to yfinance (unlimited)

        Args:
            pair: Currency pair (e.g., 'EUR/USD', 'EURUSD')
            timeframe: Timeframe (e.g., '1h', '15min', '1d')
            limit: Number of candles to fetch (max 5000)

        Returns:
            Dict with timeSeries, metadata, and status
        """
        # Check if quota was reset (new day)
        cls._check_quota_reset()

        # If quota is exhausted, skip directly to yfinance
        if cls._quota_exhausted:
            logger.info(f"⚡ Twelve Data quota exhausted, using yfinance directly for {pair}")
            return cls._fetch_from_yfinance(pair, timeframe, limit)

        try:
            if not cls.API_KEY:
                logger.warning("TWELVE_DATA_KEY not set, using yfinance fallback")
                return cls._fetch_from_yfinance(pair, timeframe, limit)

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

                        # Check if it's a daily limit exhausted error - switch to yfinance
                        if 'run out of API credits' in error_msg or 'daily' in error_msg.lower():
                            logger.warning("⚠️ Daily API quota exhausted - switching to yfinance fallback")
                            cls._quota_exhausted = True
                            cls._quota_exhausted_time = datetime.utcnow()
                            return cls._fetch_from_yfinance(pair, timeframe, limit)

                        # Check if it's a rate limit error (per minute)
                        if 'limit' in error_msg.lower() or 'quota' in error_msg.lower():
                            if attempt < max_retries - 1:
                                wait_time = 5  # Wait only 5 seconds for rate limit
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
            logger.error(f"Twelve Data error for {pair}: {str(e)}")
            logger.info(f"🔄 Attempting yfinance fallback for {pair}")
            return cls._fetch_from_yfinance(pair, timeframe, limit)

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
