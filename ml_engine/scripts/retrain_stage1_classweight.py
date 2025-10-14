#!/usr/bin/env python3
"""
Retrain Stage 1 with CLASS WEIGHTS (No Focal Loss)

ROOT CAUSE SOLUTION:
- Focal Loss + extreme imbalance → numerical instability → zero LSTM weights
- Solution: Standard Binary Crossentropy + class_weight parameter
- This is the SIMPLEST and most stable approach for imbalanced data

Key changes:
- ✗ Remove Focal Loss
- ✓ Use Binary Crossentropy with class_weight
- ✓ 12 minimal features (noise reduction)
- ✓ StandardScaler normalization
- ✓ Same LSTM architecture

Usage:
    python scripts/retrain_stage1_classweight.py --epochs 100

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
from tensorflow.keras import layers, regularizers
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_class_weight

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Core feature set (12 features)
CORE_FEATURES = [
    'close', 'high', 'low', 'sma_20', 'ema_12', 'rsi_14',
    'macd', 'macd_signal', 'bb_middle', 'bb_width', 'atr_14', 'adx_14'
]


def create_model_with_bce(sequence_length: int, num_features: int):
    """Create LSTM model with Binary Crossentropy (no Focal Loss)"""

    inputs = layers.Input(shape=(sequence_length, num_features), name='market_data')

    # LSTM layers
    x = layers.LSTM(
        64,
        return_sequences=True,
        kernel_regularizer=regularizers.l2(0.0001),
        name='lstm_1'
    )(inputs)
    x = layers.Dropout(0.2, name='dropout_1')(x)

    x = layers.LSTM(
        32,
        return_sequences=False,
        kernel_regularizer=regularizers.l2(0.0001),
        name='lstm_2'
    )(x)
    x = layers.Dropout(0.2, name='dropout_2')(x)

    # Dense layers
    x = layers.Dense(
        32,
        activation='relu',
        kernel_regularizer=regularizers.l2(0.0001),
        name='dense_1'
    )(x)
    x = layers.Dropout(0.2, name='dropout_3')(x)

    x = layers.Dense(
        16,
        activation='relu',
        kernel_regularizer=regularizers.l2(0.0001),
        name='dense_2'
    )(x)

    # Output layer
    outputs = layers.Dense(1, activation='sigmoid', name='has_reversal')(x)

    model = keras.Model(inputs=inputs, outputs=outputs, name='ReversalDetector_BCE')

    # ✓ USE STANDARD BINARY CROSSENTROPY (not Focal Loss)
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy',  # ← KEY CHANGE
        metrics=[
            'accuracy',
            keras.metrics.Precision(name='precision'),
            keras.metrics.Recall(name='recall'),
            keras.metrics.AUC(name='auc')
        ]
    )

    return model


def load_and_prepare_data(data_dir: Path, sequence_length: int = 20):
    """Load data with minimal features and normalization"""

    logger.info("=" * 80)
    logger.info("DATA PREPARATION")
    logger.info("=" * 80)

    # Load all splits
    splits = {}
    for split in ['train', 'val', 'test']:
        features_file = data_dir / f'EURUSD_reversal_mode1_{split}_features.csv'
        features = pd.read_csv(features_file, index_col=0, parse_dates=True)
        features = features[CORE_FEATURES]

        labels_file = data_dir / f'EURUSD_reversal_mode1_{split}_labels.csv'
        labels = pd.read_csv(labels_file)

        splits[split] = {'features': features, 'labels': labels}

    logger.info(f"\n✓ Using {len(CORE_FEATURES)} core features (noise reduction)")

    # Fit scaler on TRAIN data only
    logger.info("\nFitting StandardScaler...")
    scaler = StandardScaler()
    scaler.fit(splits['train']['features'])

    # Transform and create sequences
    data = {}
    for split in ['train', 'val', 'test']:
        features = splits[split]['features']
        labels = splits[split]['labels']

        # Normalize
        features_normalized = scaler.transform(features)

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

        logger.info(f"\n{split.upper()}:")
        logger.info(f"  Sequences: {len(X)}")
        logger.info(f"  No reversal (0): {np.sum(y_has_reversal==0)} ({100*np.mean(y_has_reversal==0):.1f}%)")
        logger.info(f"  Has reversal (1): {np.sum(y_has_reversal==1)} ({100*np.mean(y_has_reversal==1):.1f}%)")

    return data, scaler


def get_callbacks(model_name: str, patience: int = 25):
    """Training callbacks"""

    checkpoint_dir = Path('models/checkpoints')
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=patience,
            restore_best_weights=True,
            verbose=1
        ),
        keras.callbacks.ModelCheckpoint(
            str(checkpoint_dir / f'{model_name}_best.h5'),
            monitor='val_loss',
            save_best_only=True,
            verbose=1
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=10,
            min_lr=1e-6,
            verbose=1
        )
    ]

    return callbacks


def main():
    parser = argparse.ArgumentParser(description='Retrain Stage 1 with Class Weights (No Focal Loss)')
    parser.add_argument('--epochs', type=int, default=100, help='Number of epochs')
    parser.add_argument('--batch_size', type=int, default=32, help='Batch size')
    parser.add_argument('--patience', type=int, default=25, help='Early stopping patience')

    args = parser.parse_args()

    logger.info("=" * 80)
    logger.info("STAGE 1 RETRAINING: BINARY CROSSENTROPY + CLASS WEIGHT")
    logger.info("=" * 80)
    logger.info("\n🎯 ROOT CAUSE FIX:")
    logger.info("  ✗ Focal Loss → caused zero LSTM weights with extreme imbalance")
    logger.info("  ✓ Binary Crossentropy + class_weight → standard, stable solution")
    logger.info("")
    logger.info("Additional improvements:")
    logger.info("  ✓ 12 core features (removed noise)")
    logger.info("  ✓ StandardScaler normalization")
    logger.info("")

    # Setup paths
    data_dir = Path(__file__).parent.parent / 'data' / 'training_v3_reversal'
    output_dir = Path(__file__).parent.parent / 'models' / 'trained'

    # Load data
    data, scaler = load_and_prepare_data(data_dir, sequence_length=20)

    X_train, y_train = data['train']['X'], data['train']['y']
    X_val, y_val = data['val']['X'], data['val']['y']
    X_test, y_test = data['test']['X'], data['test']['y']

    # Compute class weights
    logger.info("\n" + "=" * 80)
    logger.info("COMPUTING CLASS WEIGHTS")
    logger.info("=" * 80)

    class_weights_array = compute_class_weight(
        class_weight='balanced',
        classes=np.array([0, 1]),
        y=y_train
    )
    class_weights = {0: class_weights_array[0], 1: class_weights_array[1]}

    logger.info(f"\nClass distribution (train):")
    logger.info(f"  Class 0 (no reversal): {np.sum(y_train==0)} samples")
    logger.info(f"  Class 1 (has reversal): {np.sum(y_train==1)} samples")
    logger.info(f"\nComputed class weights:")
    logger.info(f"  Class 0: {class_weights[0]:.4f}")
    logger.info(f"  Class 1: {class_weights[1]:.4f}")
    logger.info(f"  Ratio: {class_weights[1] / class_weights[0]:.2f}x")

    # Create model
    logger.info("\n" + "=" * 80)
    logger.info("MODEL ARCHITECTURE")
    logger.info("=" * 80)

    model = create_model_with_bce(
        sequence_length=20,
        num_features=X_train.shape[2]
    )

    logger.info(f"\nModel configuration:")
    logger.info(f"  Loss: Binary Crossentropy (NOT Focal Loss)")
    logger.info(f"  Class weights: {class_weights}")
    logger.info(f"  Input shape: (20, {X_train.shape[2]})")
    logger.info(f"  Total parameters: {model.count_params():,}")

    model.summary()

    # Callbacks
    callbacks = get_callbacks('reversal_detector_classweight', patience=args.patience)

    # Train
    logger.info("\n" + "=" * 80)
    logger.info("TRAINING")
    logger.info("=" * 80)

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch_size,
        class_weight=class_weights,  # ← KEY: Use class_weight instead of Focal Loss
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

    # Validate predictions VARY
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

    logger.info(f"\nFirst 20 predictions:")
    for i in range(min(20, len(test_preds))):
        logger.info(f"  Sample {i+1:2d}: {test_preds[i][0]:.6f} (true={int(y_test[i])})")

    # Check if fixed
    if test_preds.std() < 0.01:
        logger.error("\n❌ ERROR: Predictions STILL not varying!")

        # Check weights
        lstm1_weights = model.layers[1].get_weights()[0]
        logger.error(f"\nLSTM-1 weights L2 norm: {np.linalg.norm(lstm1_weights):.6e}")

        return

    logger.info("\n✅ SUCCESS: Predictions vary by input!")

    # Weight inspection
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

    logger.info(f"\nLSTM-2 (hidden) weights:")
    logger.info(f"  L2 norm: {np.linalg.norm(lstm2_weights):.6f}")

    if np.linalg.norm(lstm1_weights) > 0.1:
        logger.info("\n✅ SUCCESS: Input weights have HEALTHY magnitude!")
    else:
        logger.warning("\n⚠️  WARNING: Input weights still small")

    # Save model
    logger.info("\n" + "=" * 80)
    logger.info("SAVING MODEL")
    logger.info("=" * 80)

    output_dir.mkdir(parents=True, exist_ok=True)

    model_path = output_dir / 'reversal_detector_stage1.h5'
    model.save(model_path)
    logger.info(f"✅ Model: {model_path}")

    # Save scaler
    scaler_path = output_dir / 'feature_scaler.pkl'
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler, f)
    logger.info(f"✅ Scaler: {scaler_path}")

    # Save features
    features_path = output_dir / 'selected_features.json'
    with open(features_path, 'w') as f:
        json.dump({'features': CORE_FEATURES, 'count': len(CORE_FEATURES)}, f, indent=2)
    logger.info(f"✅ Features: {features_path}")

    # Save metadata
    metadata = {
        'version': '3.0-two-stage-classweight',
        'stage1': {
            'task': 'reversal_detection',
            'loss': 'binary_crossentropy',
            'class_weights': class_weights,
            'features': {
                'count': len(CORE_FEATURES),
                'list': CORE_FEATURES
            },
            'normalization': 'StandardScaler',
            'architecture': {
                'lstm_units': [64, 32],
                'dropout': 0.2,
                'l2_reg': 0.0001
            },
            'test_metrics': {
                name: float(value)
                for name, value in zip(model.metrics_names, results)
            },
            'prediction_stats': {
                'min': float(test_preds.min()),
                'max': float(test_preds.max()),
                'mean': float(test_preds.mean()),
                'std': float(test_preds.std())
            }
        },
        'trained_at': datetime.now().isoformat(),
        'notes': 'Fixed zero-weight issue by replacing Focal Loss with Binary Crossentropy + class_weight'
    }

    metadata_path = output_dir / 'stage1_metadata.json'
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"✅ Metadata: {metadata_path}")

    logger.info("\n" + "=" * 80)
    logger.info("✅ TRAINING COMPLETE - BINARY CROSSENTROPY + CLASS WEIGHT!")
    logger.info("=" * 80)


if __name__ == '__main__':
    main()
