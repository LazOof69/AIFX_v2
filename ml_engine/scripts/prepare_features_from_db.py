#!/usr/bin/env python3
"""
Prepare Training Features from Backend API (Phase 5 Refactored)

Purpose: Extract market data from Backend API, calculate technical indicators,
         and prepare feature sets for ML training

Author: Claude Code
Created: 2025-10-20
Updated: 2025-11-21 (Phase 5 Microservices Refactoring)

ARCHITECTURAL CHANGE:
- ❌ OLD: Direct PostgreSQL access via psycopg2
- ✅ NEW: Backend API access via backend_api_client
- Following microservices architecture principles (CLAUDE.md)

Flow:
1. Load OHLCV data from Backend API (was: market_data table)
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
import logging
from datetime import datetime
import json
import os
from dotenv import load_dotenv

# Phase 5: Import Backend API Client instead of psycopg2
from services.backend_api_client import get_client

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env')

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
    """Prepare training features from Backend API market data"""

    def __init__(self, output_dir=None):
        """Initialize preparator with Backend API client"""
        if output_dir is None:
            output_dir = Path(__file__).parent.parent / 'data' / 'training_v3'

        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Phase 5: Initialize Backend API client
        self.api_client = get_client()

        logger.info(f"✅ Feature Preparator initialized (Backend API mode)")
        logger.info(f"   Output directory: {self.output_dir}")
        logger.info(f"   Backend API URL: {self.api_client.base_url}")

    def load_market_data(self, pair, timeframe='1h'):
        """
        Load market data from Backend API (Phase 5 Refactored)

        Args:
            pair (str): Currency pair (e.g., 'EUR/USD')
            timeframe (str): Timeframe ('1h' or '15min')

        Returns:
            pandas.DataFrame: OHLCV data with timestamp index
        """
        logger.info(f"\n{'='*80}")
        logger.info(f"Loading market data via Backend API: {pair} {timeframe}")
        logger.info(f"{'='*80}")

        try:
            # Phase 5: Use Backend API instead of direct database access
            result = self.api_client.get_market_data(
                pair=pair,
                timeframe=timeframe,
                limit=50000  # Get large dataset
            )

            market_data = result['marketData']

            if not market_data or len(market_data) == 0:
                logger.error("❌ No market data returned from API")
                return pd.DataFrame()

            # Convert API response to DataFrame
            df = pd.DataFrame(market_data)

            # Set timestamp as index
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df = df.set_index('timestamp')

            # Convert to numeric
            for col in ['open', 'high', 'low', 'close', 'volume']:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')

            logger.info(f"✅ Loaded {len(df)} candles via Backend API")
            logger.info(f"   Date range: {df.index.min()} to {df.index.max()}")
            logger.info(f"   Missing values: {df.isnull().sum().sum()}")

            return df

        except Exception as e:
            logger.error(f"❌ Failed to load market data from Backend API: {e}")
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
            'source': 'backend_api',  # Phase 5: Changed from yfinance_real_data
            'data_source_type': 'rest_api',
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
        logger.info("FEATURE PREPARATION FROM BACKEND API (Phase 5 Refactored)")
        logger.info("="*80)

        # Load market data via Backend API
        df = self.load_market_data(pair, timeframe)

        if df.empty:
            logger.error("❌ No market data loaded from Backend API")
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
    logger.info("\n🔄 Preparing EUR/USD features via Backend API...")
    preparator.prepare_features(pair='EUR/USD', timeframe='1h')

    logger.info("\n✅ ALL FEATURES PREPARED")
    logger.info("   Next step: Run prepare_reversal_training_data.py to generate labels")


if __name__ == '__main__':
    main()
