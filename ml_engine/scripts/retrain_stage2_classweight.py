#!/usr/bin/env python3
"""
Retrain Stage 2 with 12 Core Features

Quick script to retrain Stage 2 (Direction Classifier) using the same
12 core features as the fixed Stage 1.

Usage:
    python scripts/retrain_stage2_classweight.py --epochs 50

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
import pickle

from tensorflow import keras
from tensorflow.keras import layers, regularizers
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Core features (same as Stage 1)
CORE_FEATURES = [
    'close', 'high', 'low', 'sma_20', 'ema_12', 'rsi_14',
    'macd', 'macd_signal', 'bb_middle', 'bb_width', 'atr_14', 'adx_14'
]

def load_and_prepare_stage2_data(data_dir: Path):
    """Load data for Stage 2 (only reversal points)"""

    logger.info("Loading Stage 2 training data (reversal points only)...")

    # Load scaler from Stage 1
    models_dir = Path(__file__).parent.parent / 'models' / 'trained'
    scaler_file = models_dir / 'feature_scaler.pkl'
    with open(scaler_file, 'rb') as f:
        scaler = pickle.load(f)
    logger.info("Loaded scaler from Stage 1")

    data = {}
    for split in ['train', 'val', 'test']:
        # Load features
        features_file = data_dir / f'EURUSD_reversal_mode1_{split}_features.csv'
        features = pd.read_csv(features_file, index_col=0, parse_dates=True)[CORE_FEATURES]

        # Load labels
        labels_file = data_dir / f'EURUSD_reversal_mode1_{split}_labels.csv'
        labels = pd.read_csv(labels_file)

        # Normalize
        features_normalized = scaler.transform(features)

        # Create sequences
        X = []
        y_signal = []

        for i in range(20, len(features)):
            sequence = features_normalized[i-20:i]
            signal = int(labels.iloc[i]['signal'])

            # Only keep reversal points (signal > 0)
            if signal > 0:
                X.append(sequence)
                y_signal.append(signal)

        X = np.array(X)
        y_signal = np.array(y_signal)

        # Convert to binary: 0=long (signal=1), 1=short (signal=2)
        y_direction = (y_signal == 2).astype(np.float32)

        data[split] = {'X': X, 'y': y_direction}

        logger.info(f"{split.upper()}: {len(X)} reversal sequences")
        logger.info(f"  Long (0): {np.sum(y_direction==0)}")
        logger.info(f"  Short (1): {np.sum(y_direction==1)}")

    return data

def create_stage2_model():
    """Create Stage 2 (Direction Classifier) model"""

    inputs = layers.Input(shape=(20, 12), name='market_data')

    x = layers.LSTM(48, return_sequences=True, kernel_regularizer=regularizers.l2(0.0001))(inputs)
    x = layers.Dropout(0.3)(x)

    x = layers.LSTM(24, return_sequences=False, kernel_regularizer=regularizers.l2(0.0001))(x)
    x = layers.Dropout(0.3)(x)

    x = layers.Dense(16, activation='relu', kernel_regularizer=regularizers.l2(0.0001))(x)
    x = layers.Dropout(0.3)(x)

    outputs = layers.Dense(1, activation='sigmoid', name='direction')(x)

    model = keras.Model(inputs=inputs, outputs=outputs, name='DirectionClassifier')

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=['accuracy', keras.metrics.Precision(), keras.metrics.Recall(), keras.metrics.AUC()]
    )

    return model

def main():
    logger.info("="*80)
    logger.info("RETRAINING STAGE 2: Direction Classifier (12 features)")
    logger.info("="*80)

    data_dir = Path(__file__).parent.parent / 'data' / 'training_v3_reversal'
    output_dir = Path(__file__).parent.parent / 'models' / 'trained'

    # Load data
    data = load_and_prepare_stage2_data(data_dir)

    X_train, y_train = data['train']['X'], data['train']['y']
    X_val, y_val = data['val']['X'], data['val']['y']
    X_test, y_test = data['test']['X'], data['test']['y']

    logger.info(f"\nTraining data: {X_train.shape}")
    logger.info(f"Validation data: {X_val.shape}")
    logger.info(f"Test data: {X_test.shape}")

    # Create model
    model = create_stage2_model()
    logger.info(f"\nModel parameters: {model.count_params():,}")
    model.summary()

    # Callbacks
    callbacks = [
        keras.callbacks.EarlyStopping(monitor='val_loss', patience=20, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=10, min_lr=1e-6)
    ]

    # Train
    logger.info("\n" + "="*80)
    logger.info("TRAINING")
    logger.info("="*80)

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=50,
        batch_size=16,
        callbacks=callbacks,
        verbose=1
    )

    # Evaluate
    logger.info("\n" + "="*80)
    logger.info("EVALUATION")
    logger.info("="*80)

    results = model.evaluate(X_test, y_test, verbose=1)

    logger.info("\n📊 Test Metrics:")
    for metric_name, value in zip(model.metrics_names, results):
        logger.info(f"  {metric_name}: {value:.4f}")

    # Save
    logger.info("\n" + "="*80)
    logger.info("SAVING")
    logger.info("="*80)

    model_path = output_dir / 'direction_classifier_stage2.h5'
    model.save(model_path)
    logger.info(f"✅ Model saved: {model_path}")

    logger.info("\n✅ Stage 2 retraining complete!")

if __name__ == '__main__':
    main()
