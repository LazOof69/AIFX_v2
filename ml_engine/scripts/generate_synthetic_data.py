#!/usr/bin/env python3
"""
Synthetic Training Data Generator for AIFX v2 ML Engine

Generates synthetic forex data for ML training when real API is unavailable.
Uses realistic price patterns and technical indicators.
"""

import os
import sys
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from utils.indicators import calculate_all_indicators

class SyntheticDataGenerator:
    """Generates synthetic forex data for training"""

    def __init__(self):
        self.data_dir = Path(__file__).parent.parent / 'data'
        self.raw_dir = self.data_dir / 'raw'
        self.processed_dir = self.data_dir / 'processed'
        self.training_dir = self.data_dir / 'training'

        # Ensure directories exist
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        self.training_dir.mkdir(parents=True, exist_ok=True)

    def generate_forex_data(self, pair='EUR/USD', initial_price=1.1000, n_days=365,
                           volatility=0.005, trend=0.0001):
        """
        Generate synthetic forex OHLC data using geometric Brownian motion

        Args:
            pair: Currency pair name
            initial_price: Starting price
            n_days: Number of days to generate
            volatility: Daily volatility (default: 0.5%)
            trend: Daily trend/drift (default: 0.01%)

        Returns:
            pandas.DataFrame: Synthetic OHLC data
        """
        print(f"Generating {n_days} days of synthetic data for {pair}...")

        # Generate dates
        end_date = datetime.now()
        start_date = end_date - timedelta(days=n_days)
        dates = pd.date_range(start=start_date, end=end_date, freq='D')

        # Generate close prices using geometric Brownian motion
        returns = np.random.normal(trend, volatility, n_days)
        prices = initial_price * np.exp(np.cumsum(returns))

        # Generate OHLC from close prices
        data = []
        for i, (date, close) in enumerate(zip(dates, prices)):
            # Generate realistic high/low/open based on close
            daily_range = np.random.uniform(0.0005, 0.002) * close  # 0.05% to 0.2% range

            high = close + np.random.uniform(0, daily_range)
            low = close - np.random.uniform(0, daily_range)

            # Open is close to previous close or within day's range
            if i == 0:
                open_price = close
            else:
                gap = np.random.normal(0, volatility * 0.3) * close
                open_price = prices[i-1] + gap
                open_price = np.clip(open_price, low, high)

            # Ensure high/low are correct
            high = max(high, open_price, close)
            low = min(low, open_price, close)

            data.append({
                'date': date,
                'open': round(open_price, 5),
                'high': round(high, 5),
                'low': round(low, 5),
                'close': round(close, 5),
                'pair': pair
            })

        df = pd.DataFrame(data)
        df.set_index('date', inplace=True)

        print(f"✓ Generated {len(df)} OHLC records")
        return df

    def add_market_patterns(self, df):
        """
        Add realistic market patterns to synthetic data

        Args:
            df: DataFrame with OHLC data

        Returns:
            DataFrame with enhanced patterns
        """
        print("Adding market patterns...")

        df = df.copy()

        # Add trending periods
        trend_starts = np.random.choice(len(df) // 4, size=5, replace=False)
        for start in trend_starts:
            trend_length = np.random.randint(20, 60)
            trend_direction = np.random.choice([1, -1])
            trend_strength = np.random.uniform(0.0001, 0.0003)

            end = min(start + trend_length, len(df))
            for i in range(start, end):
                df.iloc[i, df.columns.get_loc('close')] *= (1 + trend_direction * trend_strength)

        # Add volatility spikes
        spike_indices = np.random.choice(len(df), size=10, replace=False)
        for idx in spike_indices:
            spike_factor = np.random.uniform(1.5, 3.0)
            range_val = df.iloc[idx]['high'] - df.iloc[idx]['low']
            df.iloc[idx, df.columns.get_loc('high')] += range_val * spike_factor * 0.5
            df.iloc[idx, df.columns.get_loc('low')] -= range_val * spike_factor * 0.5

        print("✓ Added trending periods and volatility spikes")
        return df

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
        print(f"✓ Labels - Sell: {label_counts.get(0, 0)}, Hold: {label_counts.get(1, 0)}, Buy: {label_counts.get(2, 0)}")

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
        print(f"Preparing sequences (length: {sequence_length}, test: {test_split})...")

        # Select feature columns
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

        print(f"✓ Train: {X_train.shape}, Test: {X_test.shape}")

        # Save scaler
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
            'n_features': len(training_data['feature_cols']),
            'feature_cols': training_data['feature_cols'],
            'sequence_length': training_data['X_train'].shape[1],
            'train_samples': len(training_data['X_train']),
            'test_samples': len(training_data['X_test']),
            'created_at': datetime.now().isoformat()
        }

        with open(self.training_dir / f'{pair_name}_metadata.json', 'w') as f:
            json.dump(metadata, f, indent=2)

        print(f"✓ Saved to {self.training_dir}")
        print(f"  - Features: {metadata['n_features']}")
        print(f"  - Sequence length: {metadata['sequence_length']}")
        print(f"  - Train samples: {metadata['train_samples']}")
        print(f"  - Test samples: {metadata['test_samples']}")

def main():
    """Main execution"""
    print("=" * 70)
    print("AIFX v2 Synthetic Training Data Generator")
    print("=" * 70)
    print()

    generator = SyntheticDataGenerator()

    # Define pairs to generate
    pairs_config = [
        {'pair': 'EUR/USD', 'initial': 1.1000, 'volatility': 0.005, 'trend': 0.0001},
        {'pair': 'GBP/USD', 'initial': 1.3000, 'volatility': 0.006, 'trend': -0.0001},
        {'pair': 'USD/JPY', 'initial': 110.00, 'volatility': 0.004, 'trend': 0.0002},
    ]

    for config in pairs_config:
        print(f"\n{'='*70}")
        print(f"Processing {config['pair']}")
        print(f"{'='*70}\n")

        # Generate synthetic data
        df = generator.generate_forex_data(
            pair=config['pair'],
            initial_price=config['initial'],
            n_days=500,  # ~1.5 years
            volatility=config['volatility'],
            trend=config['trend']
        )

        # Add market patterns
        df = generator.add_market_patterns(df)

        # Save raw data
        pair_name = config['pair'].replace('/', '')
        raw_file = generator.raw_dir / f"{pair_name}_synthetic.csv"
        df.to_csv(raw_file)
        print(f"✓ Saved raw data to {raw_file}")

        # Add technical indicators
        df_indicators = calculate_all_indicators(df)
        print(f"✓ Added {len(df_indicators.columns) - len(df.columns)} technical indicators")

        # Create labels
        df_labeled = generator.create_labels(df_indicators, forecast_horizon=1, profit_threshold=0.001)

        # Save processed data
        processed_file = generator.processed_dir / f"{pair_name}_processed.csv"
        df_labeled.to_csv(processed_file)
        print(f"✓ Saved processed data to {processed_file}")

        # Prepare training data
        training_data = generator.prepare_training_data(df_labeled, sequence_length=60, test_split=0.2)

        # Save training data
        generator.save_training_data(training_data, pair_name)

        print(f"\n✓ Completed {config['pair']}")

    print(f"\n{'='*70}")
    print("Synthetic Training Data Generation Complete!")
    print(f"{'='*70}")
    print(f"\nData saved to: {generator.data_dir}")
    print("\nNext steps:")
    print("1. Review generated data in ml_engine/data/")
    print("2. Train model: curl -X POST http://localhost:8000/train")
    print("3. Test predictions: curl -X POST http://localhost:8000/predict -d '{...}'")

if __name__ == '__main__':
    main()
