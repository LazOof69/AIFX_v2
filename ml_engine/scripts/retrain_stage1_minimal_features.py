#!/usr/bin/env python3
"""
Retrain Stage 1 with MINIMAL FEATURES (Noise Reduction)

Key strategy: Reduce from 38 to 12 core features
- Remove high-noise indicators (CCI, Williams %R, Stochastic)
- Remove redundant indicators (multiple SMAs/EMAs)
- Remove zero-value fundamental features
- Focus on proven technical indicators

Selected features (12):
1. close - Price level
2. high, low - Price range
3. sma_20 - Trend
4. ema_12 - Short-term momentum
5. rsi_14 - Overbought/oversold
6. macd, macd_signal - Trend strength
7. bb_middle, bb_width - Volatility
8. atr_14 - True volatility
9. adx_14 - Trend strength

Removed noisy features:
- cci_20 (range: -336 to +397) ← MAJOR NOISE SOURCE
- williams_r, stoch_k, stoch_d
- redundant MAs (sma_50, sma_200, ema_26)
- zero-value fundamentals

Usage:
    python scripts/retrain_stage1_minimal_features.py --epochs 100

Author: AI-assisted
Created: 2025-10-14
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import pandas as pd
import numpy as np
import json
import logging
from datetime import datetime
import argparse
import pickle

import tensorflow as tf
from tensorflow import keras
from sklearn.preprocessing import StandardScaler

from models.two_stage_reversal_predictor import (
    ReversalDetector,
    get_training_callbacks
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Core feature set (12 features)
CORE_FEATURES = [
    'close',
    'high',
    'low',
    'sma_20',
    'ema_12',
    'rsi_14',
    'macd',
    'macd_signal',
    'bb_middle',
    'bb_width',
    'atr_14',
    'adx_14'
]


def load_and_prepare_data(data_dir: Path, sequence_length: int = 20):
    """Load data with minimal feature set"""

    logger.info("=" * 80)
    logger.info("LOADING DATA WITH MINIMAL FEATURES")
    logger.info("=" * 80)

    # Load all splits
    splits = {}
    for split in ['train', 'val', 'test']:
        features_file = data_dir / f'EURUSD_reversal_mode1_{split}_features.csv'
        features = pd.read_csv(features_file, index_col=0, parse_dates=True)

        # Select only core features
        features = features[CORE_FEATURES]

        labels_file = data_dir / f'EURUSD_reversal_mode1_{split}_labels.csv'
        labels = pd.read_csv(labels_file)

        splits[split] = {'features': features, 'labels': labels}

    logger.info(f"\n✓ Feature reduction: 38 → {len(CORE_FEATURES)} features")
    logger.info(f"\nSelected features:")
    for i, feat in enumerate(CORE_FEATURES, 1):
        logger.info(f"  {i:2d}. {feat}")

    # Analyze feature ranges BEFORE normalization
    logger.info("\n" + "=" * 80)
    logger.info("FEATURE RANGE ANALYSIS (Before Normalization)")
    logger.info("=" * 80)

    train_features = splits['train']['features']
    logger.info(f"\n{'Feature':<15} {'Min':>12} {'Max':>12} {'Range':>12}")
    logger.info("-" * 55)
    for col in CORE_FEATURES:
        min_val = train_features[col].min()
        max_val = train_features[col].max()
        range_val = max_val - min_val
        logger.info(f"{col:<15} {min_val:>12.4f} {max_val:>12.4f} {range_val:>12.4f}")

    # Fit scaler on TRAIN data only
    logger.info("\n" + "=" * 80)
    logger.info("FEATURE NORMALIZATION")
    logger.info("=" * 80)

    scaler = StandardScaler()
    scaler.fit(splits['train']['features'])

    logger.info(f"\nStandardScaler fitted on training data:")
    logger.info(f"  Features: {len(CORE_FEATURES)}")
    logger.info(f"  Samples: {len(splits['train']['features'])}")

    # Transform all splits and create sequences
    data = {}
    for split in ['train', 'val', 'test']:
        logger.info(f"\n{'=' * 80}")
        logger.info(f"Processing {split.upper()}")
        logger.info(f"{'=' * 80}")

        features = splits[split]['features']
        labels = splits[split]['labels']

        # Normalize
        features_normalized = scaler.transform(features)

        logger.info(f"\nNormalization results:")
        logger.info(f"  Before: min={features.min().min():.2f}, max={features.max().max():.2f}")
        logger.info(f"  After:  min={features_normalized.min():.2f}, max={features_normalized.max():.2f}")
        logger.info(f"  Mean:   {features_normalized.mean():.6f}")
        logger.info(f"  Std:    {features_normalized.std():.6f}")

        # Create sequences
        X = []
        y_signal = []

        for i in range(sequence_length, len(features)):
            sequence = features_normalized[i-sequence_length:i]
            X.append(sequence)
            y_signal.append(int(labels.iloc[i]['signal']))

        X = np.array(X)
        y_signal = np.array(y_signal)
        y_has_reversal = (y_signal > 0).astype(np.float32)

        data[split] = {
            'X': X,
            'y': y_has_reversal,
            'y_raw': y_signal
        }

        logger.info(f"\nSequence creation:")
        logger.info(f"  Total sequences: {len(X)}")
        logger.info(f"  Sequence shape: {X.shape}")
        logger.info(f"  No reversal (0): {np.sum(y_has_reversal==0)} ({100*np.mean(y_has_reversal==0):.1f}%)")
        logger.info(f"  Has reversal (1): {np.sum(y_has_reversal==1)} ({100*np.mean(y_has_reversal==1):.1f}%)")

    return data, scaler


def main():
    parser = argparse.ArgumentParser(description='Retrain Stage 1 with Minimal Features')
    parser.add_argument('--epochs', type=int, default=100, help='Number of epochs')
    parser.add_argument('--batch_size', type=int, default=32, help='Batch size')
    parser.add_argument('--patience', type=int, default=25, help='Early stopping patience')

    args = parser.parse_args()

    logger.info("=" * 80)
    logger.info("STAGE 1 RETRAINING: MINIMAL FEATURES STRATEGY")
    logger.info("=" * 80)
    logger.info("\n🎯 NOISE REDUCTION APPROACH:")
    logger.info("  - Remove high-noise indicators (CCI, Williams %R, Stochastic)")
    logger.info("  - Remove redundant indicators (multiple MAs)")
    logger.info("  - Remove zero-value fundamental features")
    logger.info("  - Reduce: 38 → 12 core features")
    logger.info("")

    # Setup paths
    data_dir = Path(__file__).parent.parent / 'data' / 'training_v3_reversal'
    output_dir = Path(__file__).parent.parent / 'models' / 'trained'

    # Load and prepare data
    data, scaler = load_and_prepare_data(data_dir, sequence_length=20)

    X_train, y_train = data['train']['X'], data['train']['y']
    X_val, y_val = data['val']['X'], data['val']['y']
    X_test, y_test = data['test']['X'], data['test']['y']

    # Create model
    logger.info("\n" + "=" * 80)
    logger.info("MODEL ARCHITECTURE")
    logger.info("=" * 80)

    model_builder = ReversalDetector(
        sequence_length=20,
        num_features=X_train.shape[2],  # Should be 12
        lstm_units=64,
        dropout_rate=0.2
    )
    model = model_builder.create(
        focal_gamma=1.5,
        focal_alpha=0.25
    )

    logger.info(f"\nModel configuration:")
    logger.info(f"  Input shape: (20, {X_train.shape[2]})")
    logger.info(f"  LSTM units: 64 → 32")
    logger.info(f"  Dropout: 0.2")
    logger.info(f"  L2 regularization: 0.0001")
    logger.info(f"  Loss: Focal Loss (γ=1.5, α=0.25)")
    logger.info(f"  Total parameters: {model.count_params():,}")

    model.summary()

    # Callbacks
    callbacks = get_training_callbacks('reversal_detector_minimal_features', patience=args.patience)

    # Train
    logger.info("\n" + "=" * 80)
    logger.info("TRAINING")
    logger.info("=" * 80)
    logger.info(f"\nTraining parameters:")
    logger.info(f"  Epochs: {args.epochs}")
    logger.info(f"  Batch size: {args.batch_size}")
    logger.info(f"  Patience: {args.patience}")
    logger.info("")

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch_size,
        callbacks=callbacks,
        verbose=1
    )

    logger.info("\n✅ Training complete!")

    # Evaluate
    logger.info("\n" + "=" * 80)
    logger.info("EVALUATION")
    logger.info("=" * 80)

    results = model.evaluate(X_test, y_test, verbose=1)

    logger.info("\n📊 Test Metrics:")
    for metric_name, value in zip(model.metrics_names, results):
        logger.info(f"  {metric_name}: {value:.4f}")

    # Validate predictions
    logger.info("\n" + "=" * 80)
    logger.info("PREDICTION VALIDATION")
    logger.info("=" * 80)

    test_preds = model.predict(X_test, verbose=0)

    logger.info(f"\nPrediction statistics:")
    logger.info(f"  Min:    {test_preds.min():.6f}")
    logger.info(f"  Max:    {test_preds.max():.6f}")
    logger.info(f"  Mean:   {test_preds.mean():.6f}")
    logger.info(f"  Median: {np.median(test_preds):.6f}")
    logger.info(f"  Std:    {test_preds.std():.6f}")
    logger.info(f"  Unique: {len(np.unique(test_preds))}")

    # Check if predictions vary
    if test_preds.std() < 0.01:
        logger.error("\n❌ ERROR: Predictions still not varying!")
        logger.error("   Standard deviation < 0.01")

        # Check weights
        logger.info("\n📊 Weight inspection:")
        lstm1_weights = model.layers[1].get_weights()[0]
        logger.info(f"  LSTM-1 kernel L2 norm: {np.linalg.norm(lstm1_weights):.6f}")
        logger.info(f"  LSTM-1 kernel mean: {lstm1_weights.mean():.6e}")
        logger.info(f"  LSTM-1 kernel std: {lstm1_weights.std():.6e}")

        if np.linalg.norm(lstm1_weights) < 0.01:
            logger.error("  ❌ Weights are still near zero!")

        return

    logger.info("\n✅ SUCCESS: Predictions vary by input!")

    # Weight check
    logger.info("\n" + "=" * 80)
    logger.info("WEIGHT ANALYSIS")
    logger.info("=" * 80)

    lstm1_weights = model.layers[1].get_weights()[0]
    lstm2_weights = model.layers[3].get_weights()[0]

    logger.info(f"\nLSTM-1 (input) weights:")
    logger.info(f"  Shape: {lstm1_weights.shape}")
    logger.info(f"  L2 norm: {np.linalg.norm(lstm1_weights):.6f}")
    logger.info(f"  Mean: {lstm1_weights.mean():.6e}")
    logger.info(f"  Std: {lstm1_weights.std():.6e}")
    logger.info(f"  Max abs: {np.abs(lstm1_weights).max():.6e}")

    logger.info(f"\nLSTM-2 (hidden) weights:")
    logger.info(f"  Shape: {lstm2_weights.shape}")
    logger.info(f"  L2 norm: {np.linalg.norm(lstm2_weights):.6f}")
    logger.info(f"  Mean: {lstm2_weights.mean():.6e}")
    logger.info(f"  Std: {lstm2_weights.std():.6e}")

    if np.linalg.norm(lstm1_weights) < 0.1:
        logger.warning("\n⚠️  WARNING: Input weights still very small!")
    else:
        logger.info("\n✅ Input weights have healthy magnitude!")

    # Save model
    logger.info("\n" + "=" * 80)
    logger.info("SAVING MODEL")
    logger.info("=" * 80)

    output_dir.mkdir(parents=True, exist_ok=True)

    model_path = output_dir / 'reversal_detector_stage1.h5'
    model.save(model_path)
    logger.info(f"✅ Model saved: {model_path}")

    # Save scaler
    scaler_path = output_dir / 'feature_scaler.pkl'
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler, f)
    logger.info(f"✅ Scaler saved: {scaler_path}")

    # Save feature list
    features_path = output_dir / 'selected_features.json'
    with open(features_path, 'w') as f:
        json.dump({'features': CORE_FEATURES, 'count': len(CORE_FEATURES)}, f, indent=2)
    logger.info(f"✅ Feature list saved: {features_path}")

    # Save metadata
    metadata = {
        'version': '3.0-two-stage-minimal-features',
        'stage1': {
            'task': 'reversal_detection',
            'features': {
                'count': len(CORE_FEATURES),
                'list': CORE_FEATURES,
                'strategy': 'noise_reduction'
            },
            'normalization': 'StandardScaler',
            'architecture': {
                'lstm_units': [64, 32],
                'dropout': 0.2,
                'l2_reg': 0.0001
            },
            'loss': {
                'type': 'focal_loss',
                'gamma': 1.5,
                'alpha': 0.25
            },
            'test_metrics': {
                name: float(value)
                for name, value in zip(model.metrics_names, results)
            },
            'prediction_stats': {
                'min': float(test_preds.min()),
                'max': float(test_preds.max()),
                'mean': float(test_preds.mean()),
                'std': float(test_preds.std()),
                'unique_count': int(len(np.unique(test_preds)))
            }
        },
        'trained_at': datetime.now().isoformat()
    }

    metadata_path = output_dir / 'stage1_metadata.json'
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"✅ Metadata saved: {metadata_path}")

    logger.info("\n" + "=" * 80)
    logger.info("✅ TRAINING COMPLETE WITH MINIMAL FEATURES!")
    logger.info("=" * 80)
    logger.info(f"\nNext steps:")
    logger.info(f"  1. Evaluate full two-stage system")
    logger.info(f"  2. python scripts/evaluate_reversal_mode1.py")
    logger.info(f"")


if __name__ == '__main__':
    main()
