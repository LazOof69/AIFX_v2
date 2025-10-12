#!/usr/bin/env python3
"""
Multi-Input Training Data Preparation Script for AIFX v2 ML Engine v2.0

This script prepares training data for the Multi-Input LSTM model by combining:
1. Technical indicators (from v1.0)
2. Fundamental features (interest rates, GDP, CPI, inflation)
3. Economic event features (event proximity, impact scores)

Architecture: v2.0 Multi-Input LSTM
Created: 2025-10-08
"""

import os
import sys
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import argparse

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from data_processing.fundamental_features import FundamentalFeatureEngineer
from utils.indicators import calculate_all_indicators

class MultiInputDataPreparator:
    """Prepares multi-input training data for v2.0 LSTM model"""

    def __init__(self, db_config=None, output_dir=None):
        """
        Initialize data preparator

        Args:
            db_config: Database configuration dict (optional)
            output_dir: Custom output directory for training data (optional)
        """
        self.data_dir = Path(__file__).parent.parent / 'data'
        self.raw_dir = self.data_dir / 'raw'
        self.processed_dir = self.data_dir / 'processed'
        self.training_dir_v1 = self.data_dir / 'training'

        # Set output directory
        if output_dir:
            self.training_dir_v2 = Path(output_dir)
        else:
            self.training_dir_v2 = self.data_dir / 'training_v2'

        # Ensure v2 training directory exists
        self.training_dir_v2.mkdir(parents=True, exist_ok=True)

        # Initialize fundamental feature engineer
        if db_config is None:
            db_config = {
                'host': os.getenv('DB_HOST', 'localhost'),
                'port': int(os.getenv('DB_PORT', 5432)),
                'database': os.getenv('DB_NAME', 'aifx_v2_dev'),
                'user': os.getenv('DB_USER', 'postgres'),
                'password': os.getenv('DB_PASSWORD', 'postgres')
            }

        self.fundamental_engineer = FundamentalFeatureEngineer(db_config)

    def load_v1_technical_data(self, pair='EURUSD', use_extended=False):
        """
        Load technical indicator data from v1.0

        Args:
            pair: Currency pair (e.g., 'EURUSD')
            use_extended: Use extended 2020-2024 dataset if available

        Returns:
            pandas.DataFrame: DataFrame with OHLC and technical indicators
        """
        print(f"\n{'='*60}")
        print(f"Loading v1.0 Technical Data for {pair}")
        print(f"{'='*60}")

        # Try extended dataset first if requested
        if use_extended:
            extended_file = self.processed_dir / f'{pair}_processed_2020_2024.csv'
            if extended_file.exists():
                df = pd.read_csv(extended_file, index_col=0, parse_dates=True)
                print(f"✓ Loaded {len(df)} rows from {extended_file}")
                print(f"  Date range: {df.index.min()} to {df.index.max()}")
                print(f"  Columns: {len(df.columns)}")
                return df

        # Load processed data (contains OHLC + indicators)
        processed_file = self.processed_dir / f'{pair}_processed.csv'

        if not processed_file.exists():
            print(f"✗ Processed file not found: {processed_file}")
            print(f"  Please run v1.0 data preparation first:")
            print(f"  python scripts/collect_yfinance_data.py --pair {pair}")
            return None

        df = pd.read_csv(processed_file, index_col=0, parse_dates=True)
        print(f"✓ Loaded {len(df)} rows from {processed_file}")
        print(f"  Date range: {df.index.min()} to {df.index.max()}")
        print(f"  Columns: {len(df.columns)}")

        return df

    def extract_fundamental_features(self, pair, start_date, end_date):
        """
        Extract fundamental features using FundamentalFeatureEngineer

        Args:
            pair: Currency pair (e.g., 'EURUSD')
            start_date: Start date (datetime or str)
            end_date: End date (datetime or str)

        Returns:
            pandas.DataFrame: DataFrame with fundamental features
        """
        print(f"\n{'='*60}")
        print(f"Extracting Fundamental Features for {pair}")
        print(f"{'='*60}")

        try:
            # Get all fundamental features
            fundamental_df = self.fundamental_engineer.get_all_features(
                pair=pair,
                start_date=start_date,
                end_date=end_date
            )

            if fundamental_df is None or fundamental_df.empty:
                print(f"✗ No fundamental features extracted")
                return None

            # Set date as index if it's a column
            if 'date' in fundamental_df.columns:
                fundamental_df = fundamental_df.set_index('date')
                fundamental_df.index = pd.to_datetime(fundamental_df.index)

            print(f"✓ Extracted {len(fundamental_df)} rows")
            print(f"  Features ({len(fundamental_df.columns)}): {list(fundamental_df.columns)}")
            print(f"  Date range: {fundamental_df.index.min()} to {fundamental_df.index.max()}")

            # Check for missing values
            missing = fundamental_df.isnull().sum()
            if missing.sum() > 0:
                print(f"⚠ Missing values detected:")
                for col, count in missing[missing > 0].items():
                    print(f"    {col}: {count} ({count/len(fundamental_df)*100:.1f}%)")
            else:
                print(f"✓ No missing values")

            return fundamental_df

        except Exception as e:
            print(f"✗ Error extracting fundamental features: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    def create_event_features(self, pair, dates):
        """
        Create event window features from economic events

        Args:
            pair: Currency pair (e.g., 'EURUSD')
            dates: DatetimeIndex of dates to create features for

        Returns:
            pandas.DataFrame: DataFrame with event features
        """
        print(f"\n{'='*60}")
        print(f"Creating Event Window Features for {pair}")
        print(f"{'='*60}")

        # Map pair to currencies
        pair_currency_map = {
            'EURUSD': ['USD', 'EUR'],
            'GBPUSD': ['USD', 'GBP'],
            'USDJPY': ['USD', 'JPY']
        }

        if pair not in pair_currency_map:
            print(f"✗ Unsupported pair: {pair}")
            return None

        currencies = pair_currency_map[pair]

        try:
            # Query economic events from database
            import psycopg2

            query = """
                SELECT event_date, currency, event_name, impact_level
                FROM economic_events
                WHERE currency = ANY(%s)
                  AND impact_level IN ('high', 'medium')
                  AND event_date BETWEEN %s AND %s
                ORDER BY event_date
            """

            # Extend date range to capture future events
            start_date = dates.min() - timedelta(days=30)
            end_date = dates.max() + timedelta(days=30)

            # Get database connection
            conn = psycopg2.connect(
                host=os.getenv('DB_HOST', 'localhost'),
                port=int(os.getenv('DB_PORT', 5432)),
                database=os.getenv('DB_NAME', 'aifx_v2_dev'),
                user=os.getenv('DB_USER', 'postgres'),
                password=os.getenv('DB_PASSWORD', 'postgres')
            )

            events_df = pd.read_sql_query(
                query,
                conn,
                params=(currencies, start_date, end_date)
            )
            conn.close()

            print(f"✓ Loaded {len(events_df)} events")
            print(f"  High impact: {len(events_df[events_df['impact_level']=='high'])}")
            print(f"  Medium impact: {len(events_df[events_df['impact_level']=='medium'])}")

            # Create event features for each date
            event_features = []

            for date in dates:
                # Calculate event features

                # 1. Event within 24h (binary)
                events_24h = events_df[
                    (events_df['event_date'] >= date - timedelta(hours=24)) &
                    (events_df['event_date'] <= date + timedelta(hours=24)) &
                    (events_df['impact_level'] == 'high')
                ]
                event_within_24h = 1 if len(events_24h) > 0 else 0

                # 2. Event within 48h (binary)
                events_48h = events_df[
                    (events_df['event_date'] >= date - timedelta(hours=48)) &
                    (events_df['event_date'] <= date + timedelta(hours=48)) &
                    (events_df['impact_level'] == 'high')
                ]
                event_within_48h = 1 if len(events_48h) > 0 else 0

                # 3. Cumulative event score (7 days lookforward)
                events_7d = events_df[
                    (events_df['event_date'] >= date) &
                    (events_df['event_date'] <= date + timedelta(days=7))
                ]

                # Impact scores: high=3, medium=2, low=1
                impact_map = {'high': 3, 'medium': 2, 'low': 1}
                cumulative_score = events_7d['impact_level'].map(impact_map).sum()

                # 4. Days since last high-impact event
                past_high_events = events_df[
                    (events_df['event_date'] < date) &
                    (events_df['impact_level'] == 'high')
                ]

                if len(past_high_events) > 0:
                    last_event_date = past_high_events['event_date'].max()
                    days_since_last = (date - last_event_date).days
                else:
                    days_since_last = 999  # Large number if no past events

                # 5. Event density (7-day window)
                events_density_window = events_df[
                    (events_df['event_date'] >= date - timedelta(days=3)) &
                    (events_df['event_date'] <= date + timedelta(days=4))
                ]
                event_density_7d = len(events_density_window)

                event_features.append({
                    'event_within_24h': event_within_24h,
                    'event_within_48h': event_within_48h,
                    'cumulative_event_score': cumulative_score,
                    'days_since_last_event': days_since_last,
                    'event_density_7d': event_density_7d
                })

            # Create DataFrame
            event_df = pd.DataFrame(event_features, index=dates)

            print(f"✓ Created {len(event_df.columns)} event features")
            print(f"  Features: {list(event_df.columns)}")
            print(f"  Date range: {event_df.index.min()} to {event_df.index.max()}")

            # Print statistics
            print(f"\n  Event Feature Statistics:")
            print(f"    Days with event within 24h: {event_df['event_within_24h'].sum()} ({event_df['event_within_24h'].sum()/len(event_df)*100:.1f}%)")
            print(f"    Days with event within 48h: {event_df['event_within_48h'].sum()} ({event_df['event_within_48h'].sum()/len(event_df)*100:.1f}%)")
            print(f"    Avg cumulative score: {event_df['cumulative_event_score'].mean():.2f}")
            print(f"    Avg days since last event: {event_df['days_since_last_event'].mean():.1f}")
            print(f"    Avg event density: {event_df['event_density_7d'].mean():.2f}")

            return event_df

        except Exception as e:
            print(f"✗ Error creating event features: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    def align_all_features(self, technical_df, fundamental_df, event_df):
        """
        Align all features to common dates

        Args:
            technical_df: Technical indicators DataFrame
            fundamental_df: Fundamental features DataFrame
            event_df: Event features DataFrame

        Returns:
            tuple: (aligned_technical, aligned_fundamental, aligned_event, common_dates)
        """
        print(f"\n{'='*60}")
        print(f"Aligning All Features")
        print(f"{'='*60}")

        # Find common dates (intersection of all three)
        common_dates = technical_df.index.intersection(fundamental_df.index)
        common_dates = common_dates.intersection(event_df.index)

        print(f"  Technical dates: {len(technical_df)}")
        print(f"  Fundamental dates: {len(fundamental_df)}")
        print(f"  Event dates: {len(event_df)}")
        print(f"  Common dates: {len(common_dates)}")

        if len(common_dates) == 0:
            print(f"✗ No common dates found!")
            return None, None, None, None

        # Align DataFrames
        technical_aligned = technical_df.loc[common_dates]
        fundamental_aligned = fundamental_df.loc[common_dates]
        event_aligned = event_df.loc[common_dates]

        print(f"✓ Aligned to {len(common_dates)} common dates")
        print(f"  Date range: {common_dates.min()} to {common_dates.max()}")

        return technical_aligned, fundamental_aligned, event_aligned, common_dates

    def create_sequences(self, technical_df, fundamental_df, event_df, sequence_length=60, target_horizon=1):
        """
        Create sequences for LSTM training

        Args:
            technical_df: Technical indicators DataFrame (needs sequences)
            fundamental_df: Fundamental features DataFrame (current value only)
            event_df: Event features DataFrame (current value only)
            sequence_length: Length of technical indicator sequence
            target_horizon: Periods ahead to predict (1 = next period)

        Returns:
            dict: Training data with X_technical, X_fundamental, X_event, y
        """
        print(f"\n{'='*60}")
        print(f"Creating Sequences (length={sequence_length})")
        print(f"{'='*60}")

        # Select technical indicator columns (exclude non-numeric)
        exclude_cols = ['pair', 'future_close', 'future_return', 'label']
        technical_cols = [col for col in technical_df.columns if col not in exclude_cols]

        # Get close price for target
        close_prices = technical_df['close'].values

        # Create sequences
        X_technical_seq = []
        X_fundamental_seq = []
        X_event_seq = []
        y_seq = []

        for i in range(sequence_length, len(technical_df) - target_horizon):
            # Technical: sequence of last 60 timesteps
            X_technical_seq.append(technical_df[technical_cols].iloc[i-sequence_length:i].values)

            # Fundamental: current values only (not sequence)
            X_fundamental_seq.append(fundamental_df.iloc[i].values)

            # Event: current values only (not sequence)
            X_event_seq.append(event_df.iloc[i].values)

            # Target: next period's price
            y_seq.append(close_prices[i + target_horizon])

        X_technical = np.array(X_technical_seq)
        X_fundamental = np.array(X_fundamental_seq)
        X_event = np.array(X_event_seq)
        y = np.array(y_seq)

        print(f"✓ Created sequences:")
        print(f"  X_technical: {X_technical.shape} (samples, timesteps, features)")
        print(f"  X_fundamental: {X_fundamental.shape} (samples, features)")
        print(f"  X_event: {X_event.shape} (samples, features)")
        print(f"  y: {y.shape} (samples,)")

        return {
            'X_technical': X_technical,
            'X_fundamental': X_fundamental,
            'X_event': X_event,
            'y': y,
            'technical_cols': technical_cols,
            'fundamental_cols': list(fundamental_df.columns),
            'event_cols': list(event_df.columns)
        }

    def normalize_features(self, sequences_dict, test_split=0.2):
        """
        Normalize features using appropriate scalers

        Args:
            sequences_dict: Dictionary with sequences from create_sequences()
            test_split: Proportion of data for testing

        Returns:
            dict: Normalized training and testing data with scalers
        """
        print(f"\n{'='*60}")
        print(f"Normalizing Features (test_split={test_split})")
        print(f"{'='*60}")

        from sklearn.preprocessing import StandardScaler, MinMaxScaler

        X_technical = sequences_dict['X_technical']
        X_fundamental = sequences_dict['X_fundamental']
        X_event = sequences_dict['X_event']
        y = sequences_dict['y']

        # Train/test split
        split_idx = int(len(X_technical) * (1 - test_split))

        # Technical indicators: StandardScaler (applied to each feature across all timesteps)
        print(f"\n  Normalizing technical indicators (StandardScaler)...")
        scaler_technical = StandardScaler()

        # Reshape to (samples * timesteps, features)
        n_samples, n_timesteps, n_features_tech = X_technical.shape
        X_tech_reshaped = X_technical.reshape(-1, n_features_tech)

        # Fit on training data only
        train_samples = split_idx * n_timesteps
        scaler_technical.fit(X_tech_reshaped[:train_samples])

        # Transform all data
        X_tech_normalized = scaler_technical.transform(X_tech_reshaped)
        X_technical_norm = X_tech_normalized.reshape(n_samples, n_timesteps, n_features_tech)

        print(f"    ✓ Technical normalized: {X_technical_norm.shape}")

        # Fundamental features: MinMaxScaler (0-1 range)
        print(f"\n  Normalizing fundamental features (MinMaxScaler)...")
        scaler_fundamental = MinMaxScaler()
        scaler_fundamental.fit(X_fundamental[:split_idx])
        X_fundamental_norm = scaler_fundamental.transform(X_fundamental)

        print(f"    ✓ Fundamental normalized: {X_fundamental_norm.shape}")

        # Event features: StandardScaler
        print(f"\n  Normalizing event features (StandardScaler)...")
        scaler_event = StandardScaler()
        scaler_event.fit(X_event[:split_idx])
        X_event_norm = scaler_event.transform(X_event)

        print(f"    ✓ Event normalized: {X_event_norm.shape}")

        # Split into train/test
        X_technical_train = X_technical_norm[:split_idx]
        X_technical_test = X_technical_norm[split_idx:]

        X_fundamental_train = X_fundamental_norm[:split_idx]
        X_fundamental_test = X_fundamental_norm[split_idx:]

        X_event_train = X_event_norm[:split_idx]
        X_event_test = X_event_norm[split_idx:]

        y_train = y[:split_idx]
        y_test = y[split_idx:]

        print(f"\n✓ Train/test split complete:")
        print(f"  Training samples: {len(X_technical_train)}")
        print(f"  Testing samples: {len(X_technical_test)}")

        return {
            'X_technical_train': X_technical_train,
            'X_technical_test': X_technical_test,
            'X_fundamental_train': X_fundamental_train,
            'X_fundamental_test': X_fundamental_test,
            'X_event_train': X_event_train,
            'X_event_test': X_event_test,
            'y_train': y_train,
            'y_test': y_test,
            'scaler_technical': scaler_technical,
            'scaler_fundamental': scaler_fundamental,
            'scaler_event': scaler_event,
            'technical_cols': sequences_dict['technical_cols'],
            'fundamental_cols': sequences_dict['fundamental_cols'],
            'event_cols': sequences_dict['event_cols']
        }

    def save_v2_training_data(self, training_data, pair='EURUSD'):
        """
        Save v2.0 training data to files

        Args:
            training_data: Dictionary with normalized training data
            pair: Currency pair name
        """
        print(f"\n{'='*60}")
        print(f"Saving v2.0 Training Data for {pair}")
        print(f"{'='*60}")

        # Save training data
        np.save(self.training_dir_v2 / f'{pair}_technical_X_train.npy', training_data['X_technical_train'])
        np.save(self.training_dir_v2 / f'{pair}_technical_X_test.npy', training_data['X_technical_test'])

        np.save(self.training_dir_v2 / f'{pair}_fundamental_X_train.npy', training_data['X_fundamental_train'])
        np.save(self.training_dir_v2 / f'{pair}_fundamental_X_test.npy', training_data['X_fundamental_test'])

        np.save(self.training_dir_v2 / f'{pair}_event_X_train.npy', training_data['X_event_train'])
        np.save(self.training_dir_v2 / f'{pair}_event_X_test.npy', training_data['X_event_test'])

        np.save(self.training_dir_v2 / f'{pair}_y_train.npy', training_data['y_train'])
        np.save(self.training_dir_v2 / f'{pair}_y_test.npy', training_data['y_test'])

        # Save scalers
        import joblib
        joblib.dump(training_data['scaler_technical'], self.training_dir_v2 / f'{pair}_scaler_technical.pkl')
        joblib.dump(training_data['scaler_fundamental'], self.training_dir_v2 / f'{pair}_scaler_fundamental.pkl')
        joblib.dump(training_data['scaler_event'], self.training_dir_v2 / f'{pair}_scaler_event.pkl')

        # Save metadata
        metadata = {
            'pair': pair,
            'version': '2.0.0',
            'created_at': datetime.now().isoformat(),
            'technical_features': {
                'count': len(training_data['technical_cols']),
                'columns': training_data['technical_cols'],
                'shape': list(training_data['X_technical_train'].shape)
            },
            'fundamental_features': {
                'count': len(training_data['fundamental_cols']),
                'columns': training_data['fundamental_cols'],
                'shape': list(training_data['X_fundamental_train'].shape)
            },
            'event_features': {
                'count': len(training_data['event_cols']),
                'columns': training_data['event_cols'],
                'shape': list(training_data['X_event_train'].shape)
            },
            'samples': {
                'train': int(len(training_data['y_train'])),
                'test': int(len(training_data['y_test']))
            }
        }

        with open(self.training_dir_v2 / f'{pair}_metadata.json', 'w') as f:
            json.dump(metadata, f, indent=2)

        print(f"\n✓ Saved all files to {self.training_dir_v2}")
        print(f"\n  Technical features: {metadata['technical_features']['count']}")
        print(f"  Fundamental features: {metadata['fundamental_features']['count']}")
        print(f"  Event features: {metadata['event_features']['count']}")
        print(f"  Training samples: {metadata['samples']['train']}")
        print(f"  Testing samples: {metadata['samples']['test']}")

    def prepare_pair(self, pair='EURUSD', sequence_length=60, test_split=0.2,
                     start_date=None, end_date=None):
        """
        Prepare v2.0 training data for a currency pair

        Args:
            pair: Currency pair (e.g., 'EURUSD')
            sequence_length: LSTM sequence length
            test_split: Test data proportion
            start_date: Start date for data (default: 2024-01-01)
            end_date: End date for data (default: 2024-12-31)

        Returns:
            dict: Training data dictionary
        """
        print(f"\n{'='*70}")
        print(f"PREPARING v2.0 TRAINING DATA FOR {pair}")
        print(f"{'='*70}")

        # Determine if using extended dataset (2020-2024)
        use_extended = False
        if start_date:
            start_year = pd.to_datetime(start_date).year
            if start_year <= 2020:
                use_extended = True

        # Step 1: Load v1.0 technical data
        technical_df = self.load_v1_technical_data(pair, use_extended=use_extended)
        if technical_df is None:
            return None

        # Get date range (normalize to date only, remove time)
        if start_date is None:
            start_date = pd.to_datetime('2024-01-01')
        else:
            start_date = pd.to_datetime(start_date).normalize()

        if end_date is None:
            end_date = pd.to_datetime('2024-12-31')
        else:
            end_date = pd.to_datetime(end_date).normalize()

        print(f"\n📅 Using date range: {start_date.date()} to {end_date.date()}")

        # Step 2: Extract fundamental features
        fundamental_df = self.extract_fundamental_features(pair, start_date, end_date)
        if fundamental_df is None:
            return None

        # Step 3: Create event features
        event_df = self.create_event_features(pair, technical_df.index)
        if event_df is None:
            return None

        # Step 4: Align all features
        technical_aligned, fundamental_aligned, event_aligned, common_dates = self.align_all_features(
            technical_df, fundamental_df, event_df
        )

        if technical_aligned is None:
            return None

        # Step 5: Create sequences
        sequences_dict = self.create_sequences(
            technical_aligned, fundamental_aligned, event_aligned,
            sequence_length=sequence_length
        )

        # Step 6: Normalize features
        training_data = self.normalize_features(sequences_dict, test_split=test_split)

        # Step 7: Save training data
        self.save_v2_training_data(training_data, pair)

        print(f"\n{'='*70}")
        print(f"✓ COMPLETED v2.0 DATA PREPARATION FOR {pair}")
        print(f"{'='*70}")

        return training_data


def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(description='Prepare v2.0 Multi-Input Training Data')
    parser.add_argument('--pair', type=str, default='EURUSD',
                        help='Currency pair to prepare (default: EURUSD)')
    parser.add_argument('--sequence-length', type=int, default=60,
                        help='LSTM sequence length (default: 60)')
    parser.add_argument('--test-split', type=float, default=0.2,
                        help='Test data split ratio (default: 0.2)')
    parser.add_argument('--start-date', type=str, default=None,
                        help='Start date (YYYY-MM-DD, default: 2024-01-01)')
    parser.add_argument('--end-date', type=str, default=None,
                        help='End date (YYYY-MM-DD, default: 2024-12-31)')
    parser.add_argument('--output-dir', type=str, default=None,
                        help='Output directory for training data (default: data/training_v2)')

    args = parser.parse_args()

    print("=" * 70)
    print("AIFX v2 ML Engine - Multi-Input Training Data Preparation")
    print("Version: 2.0.0")
    print("=" * 70)
    print()

    # Initialize preparator
    preparator = MultiInputDataPreparator(output_dir=args.output_dir)

    # Prepare data
    training_data = preparator.prepare_pair(
        pair=args.pair,
        sequence_length=args.sequence_length,
        test_split=args.test_split,
        start_date=args.start_date,
        end_date=args.end_date
    )

    if training_data:
        print("\n✅ SUCCESS - v2.0 training data ready!")
        print(f"\nNext step: Train v2.0 model")
        print(f"  python train_v2_pair.py {args.pair}")
    else:
        print("\n❌ FAILED - Could not prepare training data")
        sys.exit(1)


if __name__ == '__main__':
    main()
