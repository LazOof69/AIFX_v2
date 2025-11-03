"""
YFinance Data Fetcher
Fetches forex data using yfinance for real-time market data
Enhanced with rate limit handling and better error recovery
"""

import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Note: yfinance 0.2.66+ uses curl_cffi internally for better rate limit handling
# No custom session needed - let yfinance handle it


class YFinanceFetcher:
    """Fetch forex data from Yahoo Finance"""

    # Mapping of currency pairs to yfinance tickers
    PAIR_MAPPING = {
        'EUR/USD': 'EURUSD=X',
        'GBP/USD': 'GBPUSD=X',
        'USD/JPY': 'USDJPY=X',
        'USD/CHF': 'USDCHF=X',
        'AUD/USD': 'AUDUSD=X',
        'USD/CAD': 'USDCAD=X',
        'NZD/USD': 'NZDUSD=X',
        'EUR/GBP': 'EURGBP=X',
        'EUR/AUD': 'EURAUD=X',
        'EUR/JPY': 'EURJPY=X',
        'GBP/JPY': 'GBPJPY=X',
        'CHF/JPY': 'CHFJPY=X',
        'AUD/JPY': 'AUDJPY=X',
        'AUD/NZD': 'AUDNZD=X',
    }

    # Timeframe mapping to yfinance intervals
    TIMEFRAME_MAPPING = {
        '1min': '1m',
        '5min': '5m',
        '15min': '15m',
        '30min': '30m',
        '1h': '1h',
        '4h': '1h',  # Will aggregate to 4h
        '1d': '1d',
        '1w': '1wk',
        '1M': '1mo',
    }

    @classmethod
    def get_ticker(cls, pair: str) -> str:
        """Convert currency pair to yfinance ticker"""
        return cls.PAIR_MAPPING.get(pair, f"{pair.replace('/', '')}=X")

    @classmethod
    def get_interval(cls, timeframe: str) -> str:
        """Convert timeframe to yfinance interval"""
        return cls.TIMEFRAME_MAPPING.get(timeframe, '1h')

    @classmethod
    def get_period_days(cls, timeframe: str, limit: int = 100) -> int:
        """Calculate how many days of data to fetch"""
        days_mapping = {
            '1min': 7,    # max 7 days for 1min data
            '5min': 30,   # max 30 days for 5min data
            '15min': 30,
            '30min': 30,
            '1h': 60,
            '4h': 120,
            '1d': 365,
            '1w': 730,
            '1M': 1825,
        }
        return days_mapping.get(timeframe, 60)

    @classmethod
    def fetch_historical_data(
        cls,
        pair: str,
        timeframe: str = '1h',
        limit: int = 100
    ) -> Dict:
        """
        Fetch historical forex data from yfinance

        Args:
            pair: Currency pair (e.g., 'EUR/USD')
            timeframe: Timeframe (e.g., '1h', '1d')
            limit: Number of candles to fetch

        Returns:
            Dict with timeSeries, metadata, and status
        """
        try:
            ticker = cls.get_ticker(pair)
            interval = cls.get_interval(timeframe)
            period_days = cls.get_period_days(timeframe, limit)

            logger.info(f"Fetching {pair} ({ticker}) data: timeframe={timeframe}, interval={interval}, days={period_days}")

            # Fetch data with retry logic
            end_date = datetime.now()
            start_date = end_date - timedelta(days=period_days)

            # Let yfinance use its internal curl_cffi session for better rate limit handling
            ticker_obj = yf.Ticker(ticker)

            # Try up to 3 times with delays
            max_retries = 3
            df = pd.DataFrame()

            for attempt in range(max_retries):
                try:
                    df = ticker_obj.history(
                        start=start_date,
                        end=end_date,
                        interval=interval,
                        raise_errors=True
                    )
                    if not df.empty:
                        logger.info(f"✅ Successfully fetched data on attempt {attempt + 1}")
                        break
                    logger.warning(f"Empty data on attempt {attempt + 1}/{max_retries}")
                    if attempt < max_retries - 1:
                        time.sleep(2 ** attempt)  # Exponential backoff: 1s, 2s, 4s
                except Exception as e:
                    logger.warning(f"Attempt {attempt + 1}/{max_retries} failed: {str(e)}")
                    if attempt < max_retries - 1:
                        time.sleep(2 ** attempt)
                    else:
                        raise  # Re-raise on last attempt

            if df.empty:
                logger.warning(f"No data returned for {pair}")
                return {
                    'success': False,
                    'error': f'No data available for {pair}',
                    'timeSeries': [],
                    'metadata': {
                        'pair': pair,
                        'ticker': ticker,
                        'timeframe': timeframe,
                        'interval': interval,
                    }
                }

            # Aggregate to 4h if needed
            if timeframe == '4h':
                df = df.resample('4H').agg({
                    'Open': 'first',
                    'High': 'max',
                    'Low': 'min',
                    'Close': 'last',
                    'Volume': 'sum'
                }).dropna()

            # Limit to requested number of candles
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
                    'volume': float(row['Volume']) if 'Volume' in row else 0.0,
                })

            # Reverse to have most recent first (like Alpha Vantage format)
            time_series.reverse()

            logger.info(f"Successfully fetched {len(time_series)} candles for {pair}")

            return {
                'success': True,
                'timeSeries': time_series,
                'metadata': {
                    'pair': pair,
                    'ticker': ticker,
                    'timeframe': timeframe,
                    'interval': interval,
                    'candlesCount': len(time_series),
                    'dataSource': 'yfinance',
                    'fetchedAt': datetime.now().isoformat(),
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
            ticker = cls.get_ticker(pair)
            ticker_obj = yf.Ticker(ticker)  # Let yfinance use curl_cffi internally

            # Try to get fast info first
            try:
                info = ticker_obj.fast_info
                return float(info.last_price)
            except:
                # Fallback to history with retry
                for attempt in range(2):
                    try:
                        df = ticker_obj.history(period='1d', interval='1m')
                        if not df.empty:
                            return float(df['Close'].iloc[-1])
                    except Exception as e:
                        if attempt == 0:
                            time.sleep(1)
                        else:
                            logger.error(f"Failed to get price after retries: {e}")
                return None

        except Exception as e:
            logger.error(f"Error getting current price for {pair}: {str(e)}")
            return None
