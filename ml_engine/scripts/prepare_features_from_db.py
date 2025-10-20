#!/usr/bin/env python3
"""
Prepare Training Features from PostgreSQL Real Market Data

Purpose: Extract market data from PostgreSQL, calculate technical indicators,
         and prepare feature sets for ML training

Author: Claude Code
Created: 2025-10-20

Flow:
1. Load OHLCV data from market_data table (yfinance source)
2. Calculate technical indicators
3. Split into train/val/test sets (time-based)
4. Save features to CSV for training pipeline

Data Splits:
- Train: 2023-01-01 to 2024-08-31 (80%)
- Val:   2024-09-01 to 2024-12-31 (10%)
- Test:  2025-01-01 to present     (10%)
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import pandas as pd
import numpy as np
import psycopg2
import logging
from datetime import datetime
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent.parent / 'backend' / '.env')

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'aifx_v2_dev'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}

# Data splits (time-based for time series)
SPLIT_DATES = {
    'train': {
        'start': '2023-01-01',
        'end': '2024-08-31'
    },
    'val': {
        'start': '2024-09-01',
        'end': '2024-12-31'
    },
    'test': {
        'start': '2025-01-01',
        'end': '2025-12-31'  # Will use actual latest date
    }
}


class FeaturePreparator:
    """Prepare training features from PostgreSQL market data"""

    def __init__(self, output_dir=None):
        """Initialize preparator"""
        if output_dir is None:
            output_dir = Path(__file__).parent.parent / 'data' / 'training_v3'

        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"Output directory: {self.output_dir}")

    def load_market_data(self, pair, timeframe='1h'):
        """
        Load market data from PostgreSQL

        Args:
            pair (str): Currency pair (e.g., 'EUR/USD')
            timeframe (str): Timeframe ('1h' or '15min')

        Returns:
            pandas.DataFrame: OHLCV data with timestamp index
        """
        logger.info(f"\n{'='*80}")
        logger.info(f"Loading market data: {pair} {timeframe}")
        logger.info(f"{'='*80}")

        try:
            conn = psycopg2.connect(**DB_CONFIG)

            query = """
                SELECT timestamp, open, high, low, close, volume
                FROM market_data
                WHERE pair = %s
                  AND timeframe = %s
                  AND source = 'yfinance'
                ORDER BY timestamp ASC
            """

            df = pd.read_sql_query(
                query,
                conn,
                params=(pair, timeframe),
                index_col='timestamp',
                parse_dates=['timestamp']
            )

            conn.close()

            # Convert to numeric
            for col in ['open', 'high', 'low', 'close', 'volume']:
                df[col] = pd.to_numeric(df[col], errors='coerce')

            logger.info(f"✅ Loaded {len(df)} candles")
            logger.info(f"   Date range: {df.index.min()} to {df.index.max()}")
            logger.info(f"   Missing values: {df.isnull().sum().sum()}")

            return df

        except Exception as e:
            logger.error(f"❌ Failed to load market data: {e}")
            raise

    def calculate_technical_indicators(self, df):
        """
        Calculate technical indicators

        Args:
            df (DataFrame): OHLCV data

        Returns:
            DataFrame: Data with technical indicators
        """
        logger.info("\n📊 Calculating technical indicators...")

        # Price-based features
        df['returns'] = df['close'].pct_change()
        df['log_returns'] = np.log(df['close'] / df['close'].shift(1))

        # Moving Averages
        for period in [5, 10, 20, 50, 100, 200]:
            df[f'sma_{period}'] = df['close'].rolling(window=period).mean()
            df[f'ema_{period}'] = df['close'].ewm(span=period, adjust=False).mean()

        # Bollinger Bands
        for period in [20]:
            sma = df['close'].rolling(window=period).mean()
            std = df['close'].rolling(window=period).std()
            df[f'bb_upper_{period}'] = sma + (2 * std)
            df[f'bb_lower_{period}'] = sma - (2 * std)
            df[f'bb_width_{period}'] = (df[f'bb_upper_{period}'] - df[f'bb_lower_{period}']) / sma

        # RSI
        for period in [14, 28]:
            delta = df['close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
            rs = gain / loss
            df[f'rsi_{period}'] = 100 - (100 / (1 + rs))

        # MACD
        exp1 = df['close'].ewm(span=12, adjust=False).mean()
        exp2 = df['close'].ewm(span=26, adjust=False).mean()
        df['macd'] = exp1 - exp2
        df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
        df['macd_hist'] = df['macd'] - df['macd_signal']

        # ATR (Average True Range)
        high_low = df['high'] - df['low']
        high_close = np.abs(df['high'] - df['close'].shift())
        low_close = np.abs(df['low'] - df['close'].shift())
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        df['atr_14'] = tr.rolling(window=14).mean()

        # Stochastic Oscillator
        period = 14
        low_min = df['low'].rolling(window=period).min()
        high_max = df['high'].rolling(window=period).max()
        df['stoch_k'] = 100 * (df['close'] - low_min) / (high_max - low_min)
        df['stoch_d'] = df['stoch_k'].rolling(window=3).mean()

        # Volume indicators
        df['volume_sma_20'] = df['volume'].rolling(window=20).mean()
        df['volume_ratio'] = df['volume'] / (df['volume_sma_20'] + 1e-10)

        # Price momentum
        for period in [5, 10, 20]:
            df[f'momentum_{period}'] = df['close'] / df['close'].shift(period) - 1

        # Volatility
        for period in [10, 20, 30]:
            df[f'volatility_{period}'] = df['returns'].rolling(window=period).std()

        logger.info(f"✅ Calculated {len(df.columns)} total features")

        # Drop rows with NaN (from indicator calculation)
        initial_rows = len(df)
        df = df.dropna()
        dropped_rows = initial_rows - len(df)

        logger.info(f"   Dropped {dropped_rows} rows with NaN values")
        logger.info(f"   Final shape: {df.shape}")

        return df

    def split_data(self, df):
        """
        Split data into train/val/test sets based on time

        Args:
            df (DataFrame): Full dataset with features

        Returns:
            dict: Dictionary with train/val/test DataFrames
        """
        logger.info("\n📋 Splitting data into train/val/test...")

        splits = {}

        for split_name, dates in SPLIT_DATES.items():
            start = pd.to_datetime(dates['start'], utc=True)
            end = pd.to_datetime(dates['end'], utc=True)

            # For test set, use actual max date if it's less than specified end
            if split_name == 'test':
                end = min(end, df.index.max())

            split_df = df[(df.index >= start) & (df.index <= end)]

            splits[split_name] = split_df

            logger.info(f"   {split_name.upper()}: {len(split_df)} samples ({start.date()} to {end.date()})")

        # Print split percentages
        total = sum(len(s) for s in splits.values())
        logger.info(f"\n   Split distribution:")
        for name, split_df in splits.items():
            pct = len(split_df) / total * 100 if total > 0 else 0
            logger.info(f"     {name}: {pct:.1f}%")

        return splits

    def save_features(self, splits, pair):
        """
        Save feature data to CSV files

        Args:
            splits (dict): Dictionary with train/val/test DataFrames
            pair (str): Currency pair (e.g., 'EUR/USD')
        """
        logger.info(f"\n💾 Saving features to {self.output_dir}...")

        pair_formatted = pair.replace('/', '')  # EUR/USD -> EURUSD

        for split_name, df in splits.items():
            # Save features
            features_file = self.output_dir / f'{pair_formatted}_mode1_{split_name}_features.csv'
            df.to_csv(features_file)
            logger.info(f"   ✅ {split_name}: {features_file}")

        # Save metadata
        metadata = {
            'pair': pair,
            'version': '3.0',
            'source': 'yfinance_real_data',
            'generated_at': datetime.now().isoformat(),
            'splits': {
                split_name: {
                    'samples': len(df),
                    'date_range': {
                        'start': str(df.index.min().date()),
                        'end': str(df.index.max().date())
                    },
                    'features': {
                        'count': len(df.columns),
                        'columns': list(df.columns)
                    }
                }
                for split_name, df in splits.items()
            }
        }

        metadata_file = self.output_dir / f'{pair_formatted}_mode1_metadata.json'
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"   ✅ metadata: {metadata_file}")

    def prepare_features(self, pair='EUR/USD', timeframe='1h'):
        """
        Main function to prepare features

        Args:
            pair (str): Currency pair
            timeframe (str): Timeframe
        """
        logger.info("="*80)
        logger.info("FEATURE PREPARATION FROM POSTGRESQL")
        logger.info("="*80)

        # Load market data
        df = self.load_market_data(pair, timeframe)

        if df.empty:
            logger.error("❌ No market data loaded")
            return

        # Calculate technical indicators
        df = self.calculate_technical_indicators(df)

        # Split data
        splits = self.split_data(df)

        # Save features
        self.save_features(splits, pair)

        logger.info("\n" + "="*80)
        logger.info("✅ FEATURE PREPARATION COMPLETE")
        logger.info("="*80)


def main():
    """Entry point"""
    preparator = FeaturePreparator()

    # Prepare features for EUR/USD (1h timeframe)
    logger.info("\n🔄 Preparing EUR/USD features...")
    preparator.prepare_features(pair='EUR/USD', timeframe='1h')

    logger.info("\n✅ ALL FEATURES PREPARED")
    logger.info("   Next step: Run prepare_reversal_training_data.py to generate labels")


if __name__ == '__main__':
    main()
