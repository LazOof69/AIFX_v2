#!/usr/bin/env python3
"""
YFinance Historical Data Collector for AIFX v2

Collects real historical forex data from Yahoo Finance (FREE, unlimited)
No API key required!
"""

import os
import sys
import json
import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path
import yfinance as yf

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from utils.indicators import calculate_all_indicators

class YFinanceDataCollector:
    """Collects forex data from Yahoo Finance"""

    def __init__(self):
        self.data_dir = Path(__file__).parent.parent / 'data'
        self.raw_dir = self.data_dir / 'raw'
        self.processed_dir = self.data_dir / 'processed'
        self.training_dir = self.data_dir / 'training'

        # Ensure directories exist
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        self.training_dir.mkdir(parents=True, exist_ok=True)

    def fetch_forex_data(self, pair_symbol, from_currency, to_currency, start_date='2000-01-01'):
        """
        Fetch forex data from Yahoo Finance

        Args:
            pair_symbol: Yahoo Finance symbol (e.g., 'EURUSD=X')
            from_currency: Base currency (e.g., 'EUR')
            to_currency: Quote currency (e.g., 'USD')
            start_date: Start date for historical data

        Returns:
            pandas.DataFrame: Historical OHLC data
        """
        print(f"Fetching {from_currency}/{to_currency} data from Yahoo Finance...")
        print(f"  Symbol: {pair_symbol}")
        print(f"  Start date: {start_date}")

        try:
            # Download data
            data = yf.download(
                pair_symbol,
                start=start_date,
                end=datetime.now().strftime('%Y-%m-%d'),
                progress=False,
                auto_adjust=True  # Suppress warning
            )

            if data.empty:
                print(f"  ✗ No data available for {pair_symbol}")
                return None

            # Handle MultiIndex columns from yfinance
            df = data.copy()

            # If columns are MultiIndex, flatten them
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            # Rename columns to lowercase
            df.columns = [col.lower() if isinstance(col, str) else str(col).lower() for col in df.columns]

            # Keep only OHLC columns
            df = df[['open', 'high', 'low', 'close']].copy()

            # Add pair column
            df['pair'] = f"{from_currency}/{to_currency}"

            # Remove any NaN rows
            df = df.dropna()

            print(f"  ✓ Downloaded {len(df)} rows")
            print(f"  ✓ Date range: {df.index[0]} to {df.index[-1]}")
            print(f"  ✓ Years: {(df.index[-1] - df.index[0]).days / 365:.1f}")

            # Save raw data
            pair_name = f"{from_currency}{to_currency}"
            raw_file = self.raw_dir / f"{pair_name}_yfinance.csv"
            df.to_csv(raw_file)
            print(f"  ✓ Saved to {raw_file}")

            return df

        except Exception as e:
            print(f"  ✗ Error fetching data: {str(e)}")
            return None

    def create_labels(self, df, forecast_horizon=1, profit_threshold=0.001):
        """
        Create labels for supervised learning

        Args:
            df: DataFrame with price data
            forecast_horizon: Days to look ahead (default: 1)
            profit_threshold: Minimum price change for buy/sell (default: 0.1%)

        Returns:
            DataFrame with labels
        """
        print(f"Creating labels (horizon: {forecast_horizon}, threshold: {profit_threshold*100}%)...")

        df = df.copy()

        # Calculate future returns
        df['future_close'] = df['close'].shift(-forecast_horizon)
        df['future_return'] = (df['future_close'] - df['close']) / df['close']

        # Create labels: 0=sell, 1=hold, 2=buy
        conditions = [
            df['future_return'] <= -profit_threshold,
            (df['future_return'] > -profit_threshold) & (df['future_return'] < profit_threshold),
            df['future_return'] >= profit_threshold
        ]
        choices = [0, 1, 2]
        df['label'] = np.select(conditions, choices, default=1)

        # Drop rows with NaN labels
        df_labeled = df[:-forecast_horizon].copy()

        # Count labels
        label_counts = df_labeled['label'].value_counts().to_dict()
        total = len(df_labeled)
        print(f"  ✓ Labels created:")
        print(f"    - Sell: {label_counts.get(0, 0)} ({label_counts.get(0, 0)/total*100:.1f}%)")
        print(f"    - Hold: {label_counts.get(1, 0)} ({label_counts.get(1, 0)/total*100:.1f}%)")
        print(f"    - Buy: {label_counts.get(2, 0)} ({label_counts.get(2, 0)/total*100:.1f}%)")

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
        print(f"Preparing training sequences (length: {sequence_length}, test: {test_split})...")

        # Select feature columns
        exclude_cols = ['pair', 'future_close', 'future_return', 'label']
        feature_cols = [col for col in df.columns if col not in exclude_cols]

        # Extract features and labels
        features = df[feature_cols].values
        labels = df['label'].values

        print(f"  Features: {len(feature_cols)} columns")
        print(f"  Samples: {len(features)} rows")

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

        print(f"  ✓ Train: {X_train.shape}, Test: {X_test.shape}")

        # Save scaler
        import joblib
        scaler_file = self.processed_dir / 'scaler_yfinance.pkl'
        joblib.dump(scaler, scaler_file)
        print(f"  ✓ Saved scaler to {scaler_file}")

        return {
            'X_train': X_train,
            'y_train': y_train,
            'X_test': X_test,
            'y_test': y_test,
            'feature_cols': feature_cols,
            'scaler': scaler
        }

    def save_training_data(self, training_data, pair_name='EURUSD'):
        """Save training data to files"""
        print(f"Saving training data for {pair_name}...")

        # Save numpy arrays
        np.save(self.training_dir / f'{pair_name}_X_train.npy', training_data['X_train'])
        np.save(self.training_dir / f'{pair_name}_y_train.npy', training_data['y_train'])
        np.save(self.training_dir / f'{pair_name}_X_test.npy', training_data['X_test'])
        np.save(self.training_dir / f'{pair_name}_y_test.npy', training_data['y_test'])

        # Save metadata
        metadata = {
            'pair': pair_name,
            'data_source': 'Yahoo Finance (yfinance)',
            'n_features': len(training_data['feature_cols']),
            'feature_cols': training_data['feature_cols'],
            'sequence_length': training_data['X_train'].shape[1],
            'train_samples': len(training_data['X_train']),
            'test_samples': len(training_data['X_test']),
            'created_at': datetime.now().isoformat()
        }

        with open(self.training_dir / f'{pair_name}_metadata.json', 'w') as f:
            json.dump(metadata, f, indent=2)

        print(f"  ✓ Saved to {self.training_dir}")
        print(f"    - Features: {metadata['n_features']}")
        print(f"    - Sequence length: {metadata['sequence_length']}")
        print(f"    - Train samples: {metadata['train_samples']}")
        print(f"    - Test samples: {metadata['test_samples']}")


def main():
    """Main execution"""
    print("="*70)
    print("AIFX v2 YFinance Data Collection")
    print("FREE - No API Key Required!")
    print("="*70)
    print()

    collector = YFinanceDataCollector()

    # Define currency pairs to collect
    pairs = [
        {'symbol': 'EURUSD=X', 'from': 'EUR', 'to': 'USD'},
        {'symbol': 'GBPUSD=X', 'from': 'GBP', 'to': 'USD'},
        {'symbol': 'USDJPY=X', 'from': 'USD', 'to': 'JPY'},
    ]

    for pair_config in pairs:
        print(f"\n{'='*70}")
        print(f"Processing {pair_config['from']}/{pair_config['to']}")
        print(f"{'='*70}\n")

        # Fetch data from Yahoo Finance
        df = collector.fetch_forex_data(
            pair_symbol=pair_config['symbol'],
            from_currency=pair_config['from'],
            to_currency=pair_config['to'],
            start_date='2000-01-01'  # Get max historical data
        )

        if df is None:
            print(f"✗ Skipping {pair_config['from']}/{pair_config['to']} due to fetch error")
            continue

        # Add technical indicators
        print(f"\nCalculating technical indicators...")
        df_indicators = calculate_all_indicators(df)
        print(f"  ✓ Added {len(df_indicators.columns) - len(df.columns)} indicators")
        print(f"  ✓ Total features: {len(df_indicators.columns)}")

        # Create labels
        df_labeled = collector.create_labels(df_indicators, forecast_horizon=1, profit_threshold=0.001)

        # Save processed data
        pair_name = f"{pair_config['from']}{pair_config['to']}"
        processed_file = collector.processed_dir / f"{pair_name}_yfinance_processed.csv"
        df_labeled.to_csv(processed_file)
        print(f"\n  ✓ Saved processed data to {processed_file}")

        # Prepare training data
        training_data = collector.prepare_training_data(df_labeled, sequence_length=60, test_split=0.2)

        # Save training data
        collector.save_training_data(training_data, pair_name)

        print(f"\n✓ Completed {pair_config['from']}/{pair_config['to']}")

    print(f"\n\n{'='*70}")
    print("Data Collection Complete!")
    print(f"{'='*70}")
    print(f"\nData saved to: {collector.data_dir}")
    print("\nNext steps:")
    print("1. Review data quality in ml_engine/data/")
    print("2. Train model: python scripts/train_classifier.py")
    print("3. Test predictions with real market data!")
    print("\nExpected improvement:")
    print("  - Previous: 192 samples/pair (synthetic)")
    print("  - Now: 5,000+ samples/pair (real market data)")
    print("  - Accuracy: 43-47% → Expected 60-75%")


if __name__ == '__main__':
    main()
