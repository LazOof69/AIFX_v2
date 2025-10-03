#!/usr/bin/env python3
"""
Training Data Preparation Script for AIFX v2 ML Engine

This script fetches historical forex data and prepares it for ML model training.
It collects OHLCV data, calculates technical indicators, and formats data for LSTM training.
"""

import os
import sys
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import requests
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from utils.indicators import calculate_all_indicators
from utils.data_processing import normalize_data, create_sequences

class TrainingDataCollector:
    """Collects and prepares training data for ML models"""

    def __init__(self):
        self.alpha_vantage_key = os.getenv('ALPHA_VANTAGE_KEY', 'demo')
        self.base_url = 'https://www.alphavantage.co/query'
        self.data_dir = Path(__file__).parent.parent / 'data'
        self.raw_dir = self.data_dir / 'raw'
        self.processed_dir = self.data_dir / 'processed'
        self.training_dir = self.data_dir / 'training'

        # Ensure directories exist
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        self.training_dir.mkdir(parents=True, exist_ok=True)

    def fetch_forex_daily(self, from_symbol='EUR', to_symbol='USD', outputsize='full'):
        """
        Fetch daily forex data from Alpha Vantage

        Args:
            from_symbol: Base currency (default: EUR)
            to_symbol: Quote currency (default: USD)
            outputsize: 'compact' (100 data points) or 'full' (20+ years)

        Returns:
            pandas.DataFrame: Historical OHLCV data
        """
        print(f"Fetching {from_symbol}/{to_symbol} daily data...")

        params = {
            'function': 'FX_DAILY',
            'from_symbol': from_symbol,
            'to_symbol': to_symbol,
            'outputsize': outputsize,
            'apikey': self.alpha_vantage_key
        }

        try:
            response = requests.get(self.base_url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            if 'Time Series FX (Daily)' not in data:
                print(f"Error: {data.get('Note', data.get('Error Message', 'Unknown error'))}")
                return None

            # Convert to DataFrame
            time_series = data['Time Series FX (Daily)']
            df = pd.DataFrame.from_dict(time_series, orient='index')
            df.index = pd.to_datetime(df.index)
            df.sort_index(inplace=True)

            # Rename columns
            df.columns = ['open', 'high', 'low', 'close']
            df = df.astype(float)

            # Add pair column
            df['pair'] = f"{from_symbol}/{to_symbol}"

            # Save raw data
            pair_name = f"{from_symbol}{to_symbol}"
            raw_file = self.raw_dir / f"{pair_name}_daily.csv"
            df.to_csv(raw_file)
            print(f"✓ Saved raw data to {raw_file} ({len(df)} rows)")

            return df

        except Exception as e:
            print(f"✗ Error fetching data: {str(e)}")
            return None

    def fetch_forex_intraday(self, from_symbol='EUR', to_symbol='USD', interval='60min'):
        """
        Fetch intraday forex data from Alpha Vantage

        Args:
            from_symbol: Base currency
            to_symbol: Quote currency
            interval: '1min', '5min', '15min', '30min', '60min'

        Returns:
            pandas.DataFrame: Historical OHLCV data
        """
        print(f"Fetching {from_symbol}/{to_symbol} {interval} data...")

        params = {
            'function': 'FX_INTRADAY',
            'from_symbol': from_symbol,
            'to_symbol': to_symbol,
            'interval': interval,
            'outputsize': 'full',
            'apikey': self.alpha_vantage_key
        }

        try:
            response = requests.get(self.base_url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            key = f'Time Series FX ({interval})'
            if key not in data:
                print(f"Error: {data.get('Note', data.get('Error Message', 'Unknown error'))}")
                return None

            # Convert to DataFrame
            time_series = data[key]
            df = pd.DataFrame.from_dict(time_series, orient='index')
            df.index = pd.to_datetime(df.index)
            df.sort_index(inplace=True)

            # Rename columns
            df.columns = ['open', 'high', 'low', 'close']
            df = df.astype(float)

            # Add pair column
            df['pair'] = f"{from_symbol}/{to_symbol}"

            # Save raw data
            pair_name = f"{from_symbol}{to_symbol}"
            raw_file = self.raw_dir / f"{pair_name}_{interval}.csv"
            df.to_csv(raw_file)
            print(f"✓ Saved raw data to {raw_file} ({len(df)} rows)")

            return df

        except Exception as e:
            print(f"✗ Error fetching data: {str(e)}")
            return None

    def add_technical_indicators(self, df):
        """
        Add technical indicators to the dataframe

        Args:
            df: DataFrame with OHLC data

        Returns:
            pandas.DataFrame: DataFrame with technical indicators
        """
        print("Calculating technical indicators...")

        # Calculate indicators using our utility function
        df_with_indicators = calculate_all_indicators(df)

        print(f"✓ Added {len(df_with_indicators.columns) - len(df.columns)} indicators")
        return df_with_indicators

    def create_labels(self, df, forecast_horizon=24, profit_threshold=0.001):
        """
        Create labels for supervised learning

        Args:
            df: DataFrame with price data
            forecast_horizon: Number of periods to look ahead (default: 24 hours)
            profit_threshold: Minimum price change to classify as buy/sell (default: 0.1%)

        Returns:
            pandas.DataFrame: DataFrame with labels
        """
        print(f"Creating labels (horizon: {forecast_horizon}, threshold: {profit_threshold*100}%)...")

        # Calculate future returns
        df['future_close'] = df['close'].shift(-forecast_horizon)
        df['future_return'] = (df['future_close'] - df['close']) / df['close']

        # Create labels: 0=sell, 1=hold, 2=buy
        conditions = [
            df['future_return'] <= -profit_threshold,  # Sell
            (df['future_return'] > -profit_threshold) & (df['future_return'] < profit_threshold),  # Hold
            df['future_return'] >= profit_threshold  # Buy
        ]
        choices = [0, 1, 2]
        df['label'] = np.select(conditions, choices, default=1)

        # Drop rows with NaN labels (last forecast_horizon rows)
        df_labeled = df[:-forecast_horizon].copy()

        # Count labels
        label_counts = df_labeled['label'].value_counts().to_dict()
        print(f"✓ Labels created - Sell: {label_counts.get(0, 0)}, Hold: {label_counts.get(1, 0)}, Buy: {label_counts.get(2, 0)}")

        return df_labeled

    def prepare_training_data(self, df, sequence_length=60, test_split=0.2):
        """
        Prepare data for LSTM training

        Args:
            df: DataFrame with indicators and labels
            sequence_length: Number of time steps in each sequence
            test_split: Proportion of data for testing

        Returns:
            dict: Training and testing data
        """
        print(f"Preparing training sequences (length: {sequence_length}, test split: {test_split})...")

        # Select feature columns (exclude non-numeric and label columns)
        exclude_cols = ['pair', 'future_close', 'future_return', 'label']
        feature_cols = [col for col in df.columns if col not in exclude_cols]

        # Extract features and labels
        features = df[feature_cols].values
        labels = df['label'].values

        # Normalize features
        from sklearn.preprocessing import StandardScaler
        scaler = StandardScaler()
        features_normalized = scaler.fit_transform(features)

        # Create sequences
        X, y = [], []
        for i in range(sequence_length, len(features_normalized)):
            X.append(features_normalized[i-sequence_length:i])
            y.append(labels[i])

        X = np.array(X)
        y = np.array(y)

        # Train/test split
        split_idx = int(len(X) * (1 - test_split))
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]

        print(f"✓ Training data: {X_train.shape}, Testing data: {X_test.shape}")

        # Save scaler for later use
        import joblib
        scaler_file = self.processed_dir / 'scaler.pkl'
        joblib.dump(scaler, scaler_file)
        print(f"✓ Saved scaler to {scaler_file}")

        return {
            'X_train': X_train,
            'y_train': y_train,
            'X_test': X_test,
            'y_test': y_test,
            'feature_cols': feature_cols,
            'scaler': scaler
        }

    def save_training_data(self, training_data, pair_name='EURUSD'):
        """
        Save training data to files

        Args:
            training_data: Dictionary with training/testing data
            pair_name: Currency pair name for file naming
        """
        print(f"Saving training data for {pair_name}...")

        # Save numpy arrays
        np.save(self.training_dir / f'{pair_name}_X_train.npy', training_data['X_train'])
        np.save(self.training_dir / f'{pair_name}_y_train.npy', training_data['y_train'])
        np.save(self.training_dir / f'{pair_name}_X_test.npy', training_data['X_test'])
        np.save(self.training_dir / f'{pair_name}_y_test.npy', training_data['y_test'])

        # Save metadata
        metadata = {
            'pair': pair_name,
            'n_features': len(training_data['feature_cols']),
            'feature_cols': training_data['feature_cols'],
            'sequence_length': training_data['X_train'].shape[1],
            'train_samples': len(training_data['X_train']),
            'test_samples': len(training_data['X_test']),
            'created_at': datetime.now().isoformat()
        }

        with open(self.training_dir / f'{pair_name}_metadata.json', 'w') as f:
            json.dump(metadata, f, indent=2)

        print(f"✓ Saved training data to {self.training_dir}")
        print(f"  - Features: {metadata['n_features']}")
        print(f"  - Sequence length: {metadata['sequence_length']}")
        print(f"  - Training samples: {metadata['train_samples']}")
        print(f"  - Testing samples: {metadata['test_samples']}")

def main():
    """Main execution function"""
    print("=" * 60)
    print("AIFX v2 ML Training Data Preparation")
    print("=" * 60)
    print()

    collector = TrainingDataCollector()

    # Define currency pairs to collect
    pairs = [
        ('EUR', 'USD'),
        ('GBP', 'USD'),
        ('USD', 'JPY'),
    ]

    for from_symbol, to_symbol in pairs:
        print(f"\n{'='*60}")
        print(f"Processing {from_symbol}/{to_symbol}")
        print(f"{'='*60}\n")

        # Fetch daily data (more historical data for better training)
        df = collector.fetch_forex_daily(from_symbol, to_symbol, outputsize='full')

        if df is None:
            print(f"✗ Skipping {from_symbol}/{to_symbol} due to fetch error")
            continue

        # Add technical indicators
        df_indicators = collector.add_technical_indicators(df)

        # Create labels
        df_labeled = collector.create_labels(df_indicators, forecast_horizon=24, profit_threshold=0.001)

        # Save processed data
        pair_name = f"{from_symbol}{to_symbol}"
        processed_file = collector.processed_dir / f"{pair_name}_processed.csv"
        df_labeled.to_csv(processed_file)
        print(f"✓ Saved processed data to {processed_file}")

        # Prepare training data
        training_data = collector.prepare_training_data(df_labeled, sequence_length=60, test_split=0.2)

        # Save training data
        collector.save_training_data(training_data, pair_name)

        print(f"\n✓ Completed {from_symbol}/{to_symbol}")

    print(f"\n{'='*60}")
    print("Training Data Preparation Complete!")
    print(f"{'='*60}")
    print(f"\nData saved to: {collector.data_dir}")
    print("Next step: Train the LSTM model using /ml/train endpoint")

if __name__ == '__main__':
    main()
