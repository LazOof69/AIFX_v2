#!/usr/bin/env python3
"""
Retrain Stage 1 with Fixed Hyperparameters

This script retrains ONLY Stage 1 (Reversal Detector) with reduced
regularization to fix the zero-weight issue.

Key changes from original training:
- Dropout: 0.4 → 0.2
- L2 regularization: 0.01 → 0.0001
- Focal Loss gamma: 2.0 → 1.5

Usage:
    python scripts/retrain_stage1.py --epochs 100

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

import tensorflow as tf
from tensorflow import keras

from models.two_stage_reversal_predictor import (
    ReversalDetector,
    get_training_callbacks
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_data(data_dir: Path, split: str, sequence_length: int = 20):
    """Load and prepare data for Stage 1"""
    data_dir = Path(data_dir)

    # Load features
    features_file = data_dir / f'EURUSD_reversal_mode1_{split}_features.csv'
    features = pd.read_csv(features_file, index_col=0, parse_dates=True)

    # Load labels
    labels_file = data_dir / f'EURUSD_reversal_mode1_{split}_labels.csv'
    labels = pd.read_csv(labels_file)

    logger.info(f"{split.upper()}: loaded {len(features)} rows")

    # Create sequences
    X = []
    y_signal = []

    for i in range(sequence_length, len(features)):
        sequence = features.iloc[i-sequence_length:i].values
        X.append(sequence)

        label = labels.iloc[i]
        y_signal.append(int(label['signal']))

    X = np.array(X)
    y_signal = np.array(y_signal)

    # Convert to binary: has_reversal
    y_has_reversal = (y_signal > 0).astype(np.float32)

    logger.info(f"  Sequences: {len(X)}")
    logger.info(f"  No reversal (0): {np.sum(y_has_reversal==0)} ({100*np.mean(y_has_reversal==0):.1f}%)")
    logger.info(f"  Has reversal (1): {np.sum(y_has_reversal==1)} ({100*np.mean(y_has_reversal==1):.1f}%)")

    return X, y_has_reversal


def main():
    parser = argparse.ArgumentParser(description='Retrain Stage 1 Reversal Detector')
    parser.add_argument('--epochs', type=int, default=100, help='Number of epochs')
    parser.add_argument('--batch_size', type=int, default=32, help='Batch size')
    parser.add_argument('--patience', type=int, default=20, help='Early stopping patience')

    args = parser.parse_args()

    logger.info("="*80)
    logger.info("RETRAINING STAGE 1: Reversal Detector")
    logger.info("="*80)
    logger.info("\n⚠️  USING FIXED HYPERPARAMETERS:")
    logger.info("  - Dropout: 0.2 (was 0.4)")
    logger.info("  - L2 regularization: 0.0001 (was 0.01)")
    logger.info("  - Focal Loss gamma: 1.5 (was 2.0)")
    logger.info("")

    # Setup paths
    data_dir = Path(__file__).parent.parent / 'data' / 'training_v3_reversal'
    output_dir = Path(__file__).parent.parent / 'models' / 'trained'

    # Load data
    logger.info("\n" + "="*80)
    logger.info("LOADING DATA")
    logger.info("="*80 + "\n")

    X_train, y_train = load_data(data_dir, 'train', sequence_length=20)
    X_val, y_val = load_data(data_dir, 'val', sequence_length=20)
    X_test, y_test = load_data(data_dir, 'test', sequence_length=20)

    # Create model
    logger.info("\n" + "="*80)
    logger.info("CREATING MODEL")
    logger.info("="*80)

    model_builder = ReversalDetector(
        sequence_length=20,
        num_features=X_train.shape[2],
        lstm_units=64,
        dropout_rate=0.2  # ✓ Fixed
    )
    model = model_builder.create(
        focal_gamma=1.5,   # ✓ Fixed
        focal_alpha=0.25
    )

    logger.info("\nModel architecture:")
    model.summary()

    logger.info(f"\n📊 Model parameters: {model.count_params():,}")

    # Callbacks
    logger.info("\n" + "="*80)
    logger.info("SETTING UP TRAINING")
    logger.info("="*80)

    callbacks = get_training_callbacks('reversal_detector_stage1_v2', patience=args.patience)

    logger.info(f"\nTraining configuration:")
    logger.info(f"  Epochs: {args.epochs}")
    logger.info(f"  Batch size: {args.batch_size}")
    logger.info(f"  Early stopping patience: {args.patience}")
    logger.info(f"  Optimizer: Adam (lr=0.001)")
    logger.info(f"  Loss: Focal Loss (gamma=1.5, alpha=0.25)")

    # Train
    logger.info("\n" + "="*80)
    logger.info("TRAINING")
    logger.info("="*80 + "\n")

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch_size,
        callbacks=callbacks,
        verbose=1
    )

    logger.info("\n✅ Training complete!")

    # Evaluate on test set
    logger.info("\n" + "="*80)
    logger.info("EVALUATING ON TEST SET")
    logger.info("="*80)

    results = model.evaluate(X_test, y_test, verbose=1)

    logger.info("\n📊 Test Results:")
    for metric_name, value in zip(model.metrics_names, results):
        logger.info(f"  {metric_name}: {value:.4f}")

    # Check predictions vary
    logger.info("\n" + "="*80)
    logger.info("VALIDATING PREDICTIONS")
    logger.info("="*80)

    # Test on 10 random samples
    test_indices = np.random.choice(len(X_test), 10, replace=False)
    test_samples = X_test[test_indices]
    test_preds = model.predict(test_samples, verbose=0)

    logger.info("\nSample predictions (should vary!):")
    for i, pred in enumerate(test_preds):
        true_label = y_test[test_indices[i]]
        logger.info(f"  Sample {i+1}: pred={pred[0]:.6f}, true={true_label}")

    logger.info(f"\n📊 Prediction statistics:")
    all_preds = model.predict(X_test, verbose=0)
    logger.info(f"  Min:  {all_preds.min():.6f}")
    logger.info(f"  Max:  {all_preds.max():.6f}")
    logger.info(f"  Mean: {all_preds.mean():.6f}")
    logger.info(f"  Std:  {all_preds.std():.6f}")
    logger.info(f"  Unique values: {len(np.unique(all_preds))}")

    if all_preds.std() < 0.01:
        logger.error("\n❌ ERROR: Predictions still not varying!")
        logger.error("   Model may still have zero weights or other issues.")
        return
    else:
        logger.info("\n✅ SUCCESS: Predictions vary by input!")

    # Save model
    logger.info("\n" + "="*80)
    logger.info("SAVING MODEL")
    logger.info("="*80)

    output_dir.mkdir(parents=True, exist_ok=True)

    model_path = output_dir / 'reversal_detector_stage1.h5'
    model.save(model_path)
    logger.info(f"✅ Model saved to: {model_path}")

    # Save metadata
    metadata = {
        'version': '3.0-two-stage-fixed',
        'stage1': {
            'task': 'reversal_detection',
            'output': 'has_reversal (binary)',
            'loss': 'focal_loss',
            'focal_gamma': 1.5,
            'focal_alpha': 0.25,
            'dropout_rate': 0.2,
            'l2_regularization': 0.0001,
            'parameters': int(model.count_params()),
            'test_metrics': {
                name: float(value)
                for name, value in zip(model.metrics_names, results)
            }
        },
        'training': {
            'epochs': args.epochs,
            'batch_size': args.batch_size,
            'patience': args.patience
        },
        'trained_at': datetime.now().isoformat(),
        'notes': 'Retrained with reduced regularization to fix zero-weight issue'
    }

    metadata_path = output_dir / 'stage1_metadata.json'
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    logger.info(f"✅ Metadata saved to: {metadata_path}")

    logger.info("\n" + "="*80)
    logger.info("✅ STAGE 1 RETRAINING COMPLETE!")
    logger.info("="*80)
    logger.info("\nNext steps:")
    logger.info("  1. Run evaluation script to test full two-stage system")
    logger.info("  2. python scripts/evaluate_reversal_mode1.py")


if __name__ == '__main__':
    main()
