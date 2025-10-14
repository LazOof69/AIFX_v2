#!/usr/bin/env python3
"""
v3.0 Training Data Preparation Script

Prepares training data for the v3.0 Dual-Mode Predictor by:
1. Loading historical data (2015-2024)
2. Labeling entry opportunities (Mode 1)
3. Labeling monitoring checkpoints (Mode 2)
4. Adding fundamental and event features
5. Creating train/val/test splits
6. Saving processed data

Author: AI-assisted
Created: 2025-10-13
"""

import os
import sys
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import argparse
import logging

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from data_processing.v3_labeler_mode1 import label_entry_opportunities
from data_processing.v3_labeler_mode2 import label_monitoring_checkpoints
from data_processing.fundamental_features import FundamentalFeatureEngineer

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class V3DataPreparator:
    """Prepares v3.0 training data for dual-mode predictor"""

    def __init__(self, start_date='2015-01-01', end_date='2024-12-31'):
        """
        Initialize v3 data preparator

        Args:
            start_date: Start date for data (YYYY-MM-DD)
            end_date: End date for data (YYYY-MM-DD)
        """
        self.start_date = pd.to_datetime(start_date)
        self.end_date = pd.to_datetime(end_date)

        self.data_dir = Path(__file__).parent.parent / 'data'
        self.processed_dir = self.data_dir / 'processed'
        self.training_dir_v3 = self.data_dir / 'training_v3'

        # Create output directory
        self.training_dir_v3.mkdir(parents=True, exist_ok=True)

        logger.info(f"v3.0 Data Preparator initialized")
        logger.info(f"  Date range: {start_date} to {end_date}")
        logger.info(f"  Output dir: {self.training_dir_v3}")

    def load_technical_data(self, pair='EURUSD'):
        """
        Load and filter technical data

        Args:
            pair: Currency pair

        Returns:
            pd.DataFrame: DataFrame with OHLC and technical indicators
        """
        logger.info(f"\n{'='*70}")
        logger.info(f"Step 1: Loading Technical Data for {pair}")
        logger.info(f"{'='*70}")

        # Try yfinance processed file first (has most history)
        yf_file = self.processed_dir / f'{pair}_yfinance_processed.csv'

        if not yf_file.exists():
            raise FileNotFoundError(f"Technical data file not found: {yf_file}")

        df = pd.read_csv(yf_file, index_col=0, parse_dates=True)

        logger.info(f"✓ Loaded {len(df)} rows from {yf_file}")
        logger.info(f"  Original date range: {df.index.min()} to {df.index.max()}")

        # Filter to desired date range
        df = df[(df.index >= self.start_date) & (df.index <= self.end_date)]

        logger.info(f"✓ Filtered to {len(df)} rows ({self.start_date.date()} to {self.end_date.date()})")
        logger.info(f"  Columns: {len(df.columns)}")

        # Verify required columns
        required_cols = ['open', 'high', 'low', 'close', 'atr_14', 'adx_14', 'rsi_14']
        missing = [col for col in required_cols if col not in df.columns]
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        logger.info(f"✓ All required technical indicators present")

        return df

    def add_fundamental_features(self, df, pair='EURUSD'):
        """
        Add fundamental features from database

        Args:
            df: DataFrame with technical data
            pair: Currency pair

        Returns:
            pd.DataFrame: DataFrame with fundamental features added
        """
        logger.info(f"\n{'='*70}")
        logger.info(f"Step 2: Adding Fundamental Features")
        logger.info(f"{'='*70}")

        try:
            # Initialize fundamental feature engineer
            db_config = {
                'host': os.getenv('DB_HOST', 'localhost'),
                'port': int(os.getenv('DB_PORT', 5432)),
                'database': os.getenv('DB_NAME', 'aifx_v2_dev'),
                'user': os.getenv('DB_USER', 'postgres'),
                'password': os.getenv('DB_PASSWORD', 'postgres')
            }

            fundamental_engineer = FundamentalFeatureEngineer(db_config)

            # Extract fundamental features
            fund_df = fundamental_engineer.extract_features(
                df.index.min(),
                df.index.max(),
                pair=pair
            )

            logger.info(f"✓ Extracted {len(fund_df)} fundamental data rows")
            logger.info(f"  Fundamental columns: {list(fund_df.columns)}")

            # Merge with technical data
            df = df.join(fund_df, how='left')

            # Forward fill fundamental data (daily frequency)
            fund_cols = fund_df.columns.tolist()
            df[fund_cols] = df[fund_cols].fillna(method='ffill')

            # Check for remaining NaN
            nan_counts = df[fund_cols].isna().sum()
            if nan_counts.any():
                logger.warning(f"  Some fundamental features still have NaN:")
                for col, count in nan_counts[nan_counts > 0].items():
                    logger.warning(f"    {col}: {count} NaN values")
                logger.warning(f"  Filling remaining NaN with 0")
                df[fund_cols] = df[fund_cols].fillna(0)

            logger.info(f"✓ Fundamental features merged successfully")

        except Exception as e:
            logger.error(f"Failed to add fundamental features: {e}")
            logger.warning(f"Continuing without fundamental features...")

            # Add dummy fundamental features
            fund_cols = [
                'interest_rate_diff_us_eu',
                'gdp_growth_us_yoy',
                'gdp_growth_eu_yoy',
                'inflation_diff_us_eu',
                'days_to_next_high_event',
                'next_event_impact_score',
                'high_events_next_7d'
            ]
            for col in fund_cols:
                df[col] = 0.0

        return df

    def label_mode1_data(self, df):
        """
        Label Mode 1: Entry Evaluation

        Args:
            df: DataFrame with all features

        Returns:
            pd.DataFrame: DataFrame with mode1_* label columns
        """
        logger.info(f"\n{'='*70}")
        logger.info(f"Step 3: Labeling Mode 1 (Entry Evaluation)")
        logger.info(f"{'='*70}")

        mode1_labels = label_entry_opportunities(
            df,
            lookforward_days=10,  # Increased from 5 to 10
            min_rr=1.5,  # Reduced from 2.0 to 1.5
            adaptive=True,  # Use adaptive RR targets
            verbose=True
        )

        # Merge labels with df
        df = df.join(mode1_labels, how='left')

        return df

    def label_mode2_data(self, df):
        """
        Label Mode 2: Position Monitoring

        Args:
            df: DataFrame with Mode 1 labels

        Returns:
            Tuple[pd.DataFrame, List[Dict]]: (df, monitoring_checkpoints)
        """
        logger.info(f"\n{'='*70}")
        logger.info(f"Step 4: Labeling Mode 2 (Position Monitoring)")
        logger.info(f"{'='*70}")

        # Extract Mode 1 labels
        mode1_cols = [col for col in df.columns if col.startswith('mode1_')]
        mode1_labels = df[mode1_cols]

        # Create monitoring dataset
        from data_processing.v3_labeler_mode2 import PositionMonitoringLabeler

        labeler = PositionMonitoringLabeler(
            checkpoint_interval=1,  # Every candle
            lookforward=4
        )

        monitoring_data = labeler.create_monitoring_dataset(
            df, mode1_labels, verbose=True
        )

        return df, monitoring_data

    def create_train_val_test_split(self, df, train_end='2022-12-31',
                                     val_end='2023-12-31'):
        """
        Split data into train/validation/test sets

        Args:
            df: DataFrame with all data
            train_end: End date for training set
            val_end: End date for validation set

        Returns:
            Dict: {'train': df_train, 'val': df_val, 'test': df_test}
        """
        logger.info(f"\n{'='*70}")
        logger.info(f"Step 5: Creating Train/Val/Test Splits")
        logger.info(f"{'='*70}")

        train_end_date = pd.to_datetime(train_end)
        val_end_date = pd.to_datetime(val_end)

        df_train = df[df.index <= train_end_date]
        df_val = df[(df.index > train_end_date) & (df.index <= val_end_date)]
        df_test = df[df.index > val_end_date]

        logger.info(f"  Train: {len(df_train)} samples ({df_train.index.min().date()} to {df_train.index.max().date()})")
        logger.info(f"  Val:   {len(df_val)} samples ({df_val.index.min().date()} to {df_val.index.max().date()})")
        logger.info(f"  Test:  {len(df_test)} samples ({df_test.index.min().date()} to {df_test.index.max().date()})")

        return {
            'train': df_train,
            'val': df_val,
            'test': df_test
        }

    def save_mode1_data(self, splits, pair='EURUSD'):
        """
        Save Mode 1 training data

        Args:
            splits: Dict with train/val/test DataFrames
            pair: Currency pair
        """
        logger.info(f"\n{'='*70}")
        logger.info(f"Step 6a: Saving Mode 1 Data")
        logger.info(f"{'='*70}")

        # Define feature columns
        technical_cols = [col for col in splits['train'].columns
                         if col not in ['pair'] and not col.startswith('mode1_')
                         and not col.startswith('mode2_')]

        mode1_label_cols = [col for col in splits['train'].columns if col.startswith('mode1_')]

        for split_name, df_split in splits.items():
            # Save features
            features_file = self.training_dir_v3 / f'{pair}_mode1_{split_name}_features.csv'
            df_split[technical_cols].to_csv(features_file)
            logger.info(f"✓ Saved {split_name} features: {features_file} ({len(df_split)} samples, {len(technical_cols)} features)")

            # Save labels
            labels_file = self.training_dir_v3 / f'{pair}_mode1_{split_name}_labels.csv'
            df_split[mode1_label_cols].to_csv(labels_file)
            logger.info(f"✓ Saved {split_name} labels: {labels_file} ({len(mode1_label_cols)} label columns)")

        # Save metadata
        metadata = {
            'pair': pair,
            'version': '3.0.0',
            'mode': 'entry_evaluation',
            'created_at': datetime.now().isoformat(),
            'date_range': {
                'start': str(splits['train'].index.min().date()),
                'end': str(splits['test'].index.max().date())
            },
            'splits': {
                'train': len(splits['train']),
                'val': len(splits['val']),
                'test': len(splits['test'])
            },
            'features': {
                'count': len(technical_cols),
                'columns': technical_cols
            },
            'labels': {
                'count': len(mode1_label_cols),
                'columns': mode1_label_cols
            }
        }

        metadata_file = self.training_dir_v3 / f'{pair}_mode1_metadata.json'
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"✓ Saved metadata: {metadata_file}")

    def save_mode2_data(self, monitoring_data, pair='EURUSD'):
        """
        Save Mode 2 monitoring data

        Args:
            monitoring_data: List of monitoring checkpoints
            pair: Currency pair
        """
        logger.info(f"\n{'='*70}")
        logger.info(f"Step 6b: Saving Mode 2 Data")
        logger.info(f"{'='*70}")

        # Convert to DataFrame
        mode2_df = pd.DataFrame(monitoring_data)

        # Save full monitoring data
        mode2_file = self.training_dir_v3 / f'{pair}_mode2_monitoring_data.csv'
        mode2_df.to_csv(mode2_file, index=False)
        logger.info(f"✓ Saved Mode 2 data: {mode2_file} ({len(mode2_df)} checkpoints)")

        # Save metadata
        metadata = {
            'pair': pair,
            'version': '3.0.0',
            'mode': 'position_monitoring',
            'created_at': datetime.now().isoformat(),
            'total_checkpoints': len(monitoring_data),
            'action_distribution': {
                'hold': int((mode2_df['action'] == 0).sum()),
                'exit': int((mode2_df['action'] == 1).sum()),
                'take_partial': int((mode2_df['action'] == 2).sum()),
                'adjust_sl': int((mode2_df['action'] == 3).sum())
            },
            'columns': list(mode2_df.columns)
        }

        metadata_file = self.training_dir_v3 / f'{pair}_mode2_metadata.json'
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"✓ Saved metadata: {metadata_file}")

    def run(self, pair='EURUSD'):
        """
        Run complete v3 data preparation pipeline

        Args:
            pair: Currency pair to process
        """
        logger.info(f"\n{'='*70}")
        logger.info(f"v3.0 Data Preparation Pipeline")
        logger.info(f"{'='*70}")
        logger.info(f"Pair: {pair}")
        logger.info(f"Date range: {self.start_date.date()} to {self.end_date.date()}")
        logger.info(f"{'='*70}\n")

        start_time = datetime.now()

        # Step 1: Load technical data
        df = self.load_technical_data(pair)

        # Step 2: Add fundamental features
        df = self.add_fundamental_features(df, pair)

        # Step 3: Label Mode 1 (Entry Evaluation)
        df = self.label_mode1_data(df)

        # Step 4: Label Mode 2 (Position Monitoring)
        df, monitoring_data = self.label_mode2_data(df)

        # Step 5: Create splits
        splits = self.create_train_val_test_split(df)

        # Step 6a: Save Mode 1 data
        self.save_mode1_data(splits, pair)

        # Step 6b: Save Mode 2 data
        self.save_mode2_data(monitoring_data, pair)

        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        logger.info(f"\n{'='*70}")
        logger.info(f"v3.0 Data Preparation Complete!")
        logger.info(f"{'='*70}")
        logger.info(f"Duration: {duration:.1f} seconds")
        logger.info(f"Output directory: {self.training_dir_v3}")
        logger.info(f"\nNext steps:")
        logger.info(f"  1. Review label distributions in metadata files")
        logger.info(f"  2. Train Mode 1 model: python scripts/train_v3_mode1.py")
        logger.info(f"  3. Train Mode 2 model: python scripts/train_v3_mode2.py")
        logger.info(f"{'='*70}\n")


def main():
    parser = argparse.ArgumentParser(description='Prepare v3.0 training data')
    parser.add_argument('--pair', type=str, default='EURUSD',
                       help='Currency pair (default: EURUSD)')
    parser.add_argument('--start-date', type=str, default='2015-01-01',
                       help='Start date YYYY-MM-DD (default: 2015-01-01)')
    parser.add_argument('--end-date', type=str, default='2024-12-31',
                       help='End date YYYY-MM-DD (default: 2024-12-31)')

    args = parser.parse_args()

    try:
        preparator = V3DataPreparator(
            start_date=args.start_date,
            end_date=args.end_date
        )

        preparator.run(pair=args.pair)

        sys.exit(0)

    except Exception as e:
        logger.error(f"\n{'='*70}")
        logger.error(f"ERROR: Data preparation failed")
        logger.error(f"{'='*70}")
        logger.error(f"{str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
