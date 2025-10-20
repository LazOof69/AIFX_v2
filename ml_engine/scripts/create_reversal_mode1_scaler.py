#!/usr/bin/env python3
"""
Create StandardScaler for reversal_mode1 model (38 features)

This script loads the training features and creates a fitted StandardScaler
that will be used for preprocessing during prediction.

Author: Claude Code
Created: 2025-10-20
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import pandas as pd
import pickle
import logging
from sklearn.preprocessing import StandardScaler

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    logger.info("="*80)
    logger.info("Creating StandardScaler for reversal_mode1 (38 features)")
    logger.info("="*80)

    # Paths
    data_dir = Path(__file__).parent.parent / 'data' / 'training_v3'
    models_dir = Path(__file__).parent.parent / 'models' / 'trained'

    train_features_file = data_dir / 'EURUSD_mode1_train_features.csv'
    scaler_output_file = models_dir / 'reversal_mode1_scaler.pkl'

    # Check if file exists
    if not train_features_file.exists():
        logger.error(f"❌ Training features not found: {train_features_file}")
        return False

    # Load training features
    logger.info(f"\n📂 Loading training features from: {train_features_file}")
    df_train = pd.read_csv(train_features_file, index_col=0, parse_dates=True)

    logger.info(f"✅ Loaded {len(df_train)} training samples")
    logger.info(f"   Features: {len(df_train.columns)} columns")
    logger.info(f"   Date range: {df_train.index.min()} to {df_train.index.max()}")

    # Check for NaN values
    nan_count = df_train.isnull().sum().sum()
    if nan_count > 0:
        logger.warning(f"⚠️  Found {nan_count} NaN values, filling with forward fill")
        df_train = df_train.fillna(method='ffill').fillna(method='bfill')

    # Create and fit scaler
    logger.info(f"\n🔧 Creating StandardScaler...")
    scaler = StandardScaler()
    scaler.fit(df_train.values)

    logger.info(f"✅ Scaler fitted on {len(df_train)} samples with {len(df_train.columns)} features")
    logger.info(f"   Mean shape: {scaler.mean_.shape}")
    logger.info(f"   Scale shape: {scaler.scale_.shape}")

    # Display some statistics
    logger.info(f"\n📊 Feature statistics (first 5 features):")
    for i, col in enumerate(df_train.columns[:5]):
        logger.info(f"   {col:20s} - mean: {scaler.mean_[i]:10.6f}, scale: {scaler.scale_[i]:10.6f}")
    logger.info(f"   ... ({len(df_train.columns) - 5} more features)")

    # Save scaler
    logger.info(f"\n💾 Saving scaler to: {scaler_output_file}")
    models_dir.mkdir(parents=True, exist_ok=True)

    with open(scaler_output_file, 'wb') as f:
        pickle.dump(scaler, f)

    logger.info(f"✅ Scaler saved successfully")

    # Verify by loading
    logger.info(f"\n🔍 Verifying saved scaler...")
    with open(scaler_output_file, 'rb') as f:
        loaded_scaler = pickle.load(f)

    logger.info(f"✅ Scaler loaded and verified")
    logger.info(f"   Mean shape: {loaded_scaler.mean_.shape}")
    logger.info(f"   Scale shape: {loaded_scaler.scale_.shape}")

    # Test transformation
    logger.info(f"\n🧪 Testing transformation on first sample...")
    sample = df_train.iloc[0:1].values
    transformed = loaded_scaler.transform(sample)

    logger.info(f"✅ Transformation successful")
    logger.info(f"   Original shape: {sample.shape}")
    logger.info(f"   Transformed shape: {transformed.shape}")
    logger.info(f"   Sample values (first 5): {sample[0, :5]}")
    logger.info(f"   Transformed values (first 5): {transformed[0, :5]}")

    logger.info(f"\n" + "="*80)
    logger.info(f"✅ SCALER CREATION COMPLETE!")
    logger.info(f"="*80)
    logger.info(f"\nScaler file: {scaler_output_file}")
    logger.info(f"Features: {len(df_train.columns)}")
    logger.info(f"Trained on: {len(df_train)} samples")

    return True


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
