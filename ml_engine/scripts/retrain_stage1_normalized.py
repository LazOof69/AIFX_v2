#!/usr/bin/env python3
"""
Retrain Stage 1 with NORMALIZED Features

Key fix: StandardScaler normalization of input features!

This is THE critical fix. Previous training failed because:
- Input features ranged from -336 to +397
- LSTM expects inputs in range -1 to +1
- Large inputs caused numerical instability
- Weights shrunk to 10^-33 to compensate

Usage:
    python scripts/retrain_stage1_normalized.py --epochs 100

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


def load_and_normalize_data(data_dir: Path, sequence_length: int = 20):
    """Load data and normalize features"""

    logger.info("Loading raw data...")

    # Load all splits
    splits = {}
    for split in ['train', 'val', 'test']:
        features_file = data_dir / f'EURUSD_reversal_mode1_{split}_features.csv'
        features = pd.read_csv(features_file, index_col=0, parse_dates=True)

        labels_file = data_dir / f'EURUSD_reversal_mode1_{split}_labels.csv'
        labels = pd.read_csv(labels_file)

        splits[split] = {'features': features, 'labels': labels}

    # Fit scaler on TRAIN data only
    logger.info("\nFitting StandardScaler on training data...")
    scaler = StandardScaler()
    scaler.fit(splits['train']['features'])

    logger.info(f"Scaler statistics:")
    logger.info(f"  Mean: {scaler.mean_[:5]} ...")
    logger.info(f"  Std: {scaler.scale_[:5]} ...")

    # Transform all splits
    data = {}
    for split in ['train', 'val', 'test']:
        logger.info(f"\nProcessing {split.upper()}...")

        features = splits[split]['features']
        labels = splits[split]['labels']

        # Normalize features
        features_normalized = scaler.transform(features)

        logger.info(f"  Before normalization: min={features.min().min():.2f}, max={features.max().max():.2f}")
        logger.info(f"  After normalization: min={features_normalized.min():.2f}, max={features_normalized.max():.2f}")

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

        logger.info(f"  Sequences: {len(X)}")
        logger.info(f"  No reversal: {np.sum(y_has_reversal==0)} ({100*np.mean(y_has_reversal==0):.1f}%)")
        logger.info(f"  Has reversal: {np.sum(y_has_reversal==1)} ({100*np.mean(y_has_reversal==1):.1f}%)")

    return data, scaler


def main():
    parser = argparse.ArgumentParser(description='Retrain Stage 1 with Normalized Features')
    parser.add_argument('--epochs', type=int, default=100, help='Number of epochs')
    parser.add_argument('--batch_size', type=int, default=32, help='Batch size')
    parser.add_argument('--patience', type=int, default=25, help='Early stopping patience')

    args = parser.parse_args()

    logger.info("="*80)
    logger.info("RETRAINING STAGE 1: With Feature Normalization")
    logger.info("="*80)
    logger.info("\n🔧 KEY FIX: StandardScaler normalization!")
    logger.info("  - Transforms features to mean=0, std=1")
    logger.info("  - Prevents numerical instability from large inputs")
    logger.info("  - Allows LSTM weights to train properly")
    logger.info("")

    # Setup paths
    data_dir = Path(__file__).parent.parent / 'data' / 'training_v3_reversal'
    output_dir = Path(__file__).parent.parent / 'models' / 'trained'

    # Load and normalize data
    logger.info("\n" + "="*80)
    logger.info("DATA LOADING & NORMALIZATION")
    logger.info("="*80)

    data, scaler = load_and_normalize_data(data_dir, sequence_length=20)

    X_train, y_train = data['train']['X'], data['train']['y']
    X_val, y_val = data['val']['X'], data['val']['y']
    X_test, y_test = data['test']['X'], data['test']['y']

    # Create model
    logger.info("\n" + "="*80)
    logger.info("CREATING MODEL")
    logger.info("="*80)

    model_builder = ReversalDetector(
        sequence_length=20,
        num_features=X_train.shape[2],
        lstm_units=64,
        dropout_rate=0.2
    )
    model = model_builder.create(
        focal_gamma=1.5,
        focal_alpha=0.25
    )

    logger.info("\nModel architecture:")
    model.summary()

    # Callbacks
    callbacks = get_training_callbacks('reversal_detector_stage1_normalized', patience=args.patience)

    # Train
    logger.info("\n" + "="*80)
    logger.info("TRAINING")
    logger.info("="*80)

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
    logger.info("\n" + "="*80)
    logger.info("EVALUATION")
    logger.info("="*80)

    results = model.evaluate(X_test, y_test, verbose=1)

    logger.info("\n📊 Test Results:")
    for metric_name, value in zip(model.metrics_names, results):
        logger.info(f"  {metric_name}: {value:.4f}")

    # Validate predictions vary
    logger.info("\n📊 Prediction Validation:")
    test_preds = model.predict(X_test, verbose=0)
    logger.info(f"  Min:  {test_preds.min():.6f}")
    logger.info(f"  Max:  {test_preds.max():.6f}")
    logger.info(f"  Mean: {test_preds.mean():.6f}")
    logger.info(f"  Std:  {test_preds.std():.6f}")
    logger.info(f"  Unique: {len(np.unique(test_preds))}")

    if test_preds.std() < 0.01:
        logger.error("\n❌ Predictions still not varying!")
        return

    logger.info("\n✅ Predictions vary properly!")

    # Check weight magnitudes
    logger.info("\n📊 Weight Check:")
    lstm1_weights = model.layers[1].get_weights()[0]
    logger.info(f"  LSTM-1 kernel L2 norm: {np.linalg.norm(lstm1_weights):.6f}")
    logger.info(f"  LSTM-1 kernel mean: {lstm1_weights.mean():.6f}")
    logger.info(f"  LSTM-1 kernel std: {lstm1_weights.std():.6f}")

    if np.linalg.norm(lstm1_weights) < 0.01:
        logger.warning("\n⚠️  Weights still very small!")
    else:
        logger.info("\n✅ Weights have normal magnitude!")

    # Save model
    logger.info("\n" + "="*80)
    logger.info("SAVING")
    logger.info("="*80)

    output_dir.mkdir(parents=True, exist_ok=True)

    model_path = output_dir / 'reversal_detector_stage1.h5'
    model.save(model_path)
    logger.info(f"✅ Model saved: {model_path}")

    # Save scaler
    scaler_path = output_dir / 'feature_scaler.pkl'
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler, f)
    logger.info(f"✅ Scaler saved: {scaler_path}")

    # Save metadata
    metadata = {
        'version': '3.0-two-stage-normalized',
        'stage1': {
            'task': 'reversal_detection',
            'normalization': 'StandardScaler',
            'dropout': 0.2,
            'l2_reg': 0.0001,
            'focal_gamma': 1.5,
            'focal_alpha': 0.25,
            'test_metrics': {
                name: float(value)
                for name, value in zip(model.metrics_names, results)
            }
        },
        'trained_at': datetime.now().isoformat()
    }

    metadata_path = output_dir / 'stage1_metadata.json'
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"✅ Metadata saved: {metadata_path}")

    logger.info("\n" + "="*80)
    logger.info("✅ TRAINING COMPLETE WITH NORMALIZATION!")
    logger.info("="*80)


if __name__ == '__main__':
    main()
