#!/usr/bin/env python3
"""
Retrain Stage 2 with Profitable Logic Labels

Train Direction Classifier (Stage 2) using the new profit-based reversal labels.
Uses the same 12 core features and architecture as Stage 1.

Signal mapping:
- 0: no_signal (filtered out)
- 1: short signal → label 0
- 2: long signal → label 1

Usage:
    python scripts/retrain_stage2_profitable.py --epochs 50

Author: AI-assisted
Created: 2025-10-20
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import pandas as pd
import numpy as np
import json
import logging
import pickle
import argparse
from datetime import datetime

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

SEQUENCE_LENGTH = 20  # 20 timesteps lookback


def load_and_prepare_stage2_data(data_dir: Path):
    """Load data for Stage 2 (only reversal points from profitable logic)"""

    logger.info("Loading Stage 2 training data (profitable reversal points only)...")
    logger.info(f"Data directory: {data_dir}")

    # Create a new scaler specifically for the 12 core features
    # (The profitable scaler was trained on all 38 features)
    logger.info("Creating new scaler for 12 core features...")

    scaler = None  # Will be created on train split
    data = {}
    for split in ['train', 'val', 'test']:
        logger.info(f"\n{'='*60}")
        logger.info(f"Processing {split.upper()} split")
        logger.info(f"{'='*60}")

        # Load features
        features_file = data_dir / f'EURUSD_profitable_{split}_features.csv'
        if not features_file.exists():
            raise FileNotFoundError(f"Features file not found: {features_file}")

        features = pd.read_csv(features_file, index_col=0, parse_dates=True)
        logger.info(f"Loaded features: {features.shape}")
        logger.info(f"Available columns: {features.columns.tolist()}")

        # Check if all core features exist
        missing_features = [f for f in CORE_FEATURES if f not in features.columns]
        if missing_features:
            raise ValueError(f"Missing core features: {missing_features}")

        features = features[CORE_FEATURES]

        # Load labels
        labels_file = data_dir / f'EURUSD_profitable_{split}_labels.csv'
        if not labels_file.exists():
            raise FileNotFoundError(f"Labels file not found: {labels_file}")

        labels = pd.read_csv(labels_file)
        logger.info(f"Loaded labels: {labels.shape}")
        logger.info(f"Label columns: {labels.columns.tolist()}")

        # Check signal distribution
        signal_counts = labels['signal'].value_counts()
        logger.info(f"Signal distribution:")
        logger.info(f"  0 (no_signal): {signal_counts.get(0, 0)}")
        logger.info(f"  1 (short): {signal_counts.get(1, 0)}")
        logger.info(f"  2 (long): {signal_counts.get(2, 0)}")

        # Normalize features
        # Create scaler on first split (train) and reuse for val/test
        if split == 'train':
            scaler = StandardScaler()
            features_normalized = scaler.fit_transform(features)
            logger.info(f"✅ Created and fitted new scaler on train data")
        else:
            features_normalized = scaler.transform(features)
            logger.info(f"✅ Transformed {split} data using train scaler")

        # Create sequences
        X = []
        y_signal = []
        timestamps = []

        for i in range(SEQUENCE_LENGTH, len(features)):
            sequence = features_normalized[i-SEQUENCE_LENGTH:i]
            signal = int(labels.iloc[i]['signal'])

            # Only keep reversal points (signal > 0)
            if signal > 0:
                X.append(sequence)
                y_signal.append(signal)
                timestamps.append(features.index[i])

        X = np.array(X)
        y_signal = np.array(y_signal)

        # Convert to binary classification
        # signal=1 (short) → 0
        # signal=2 (long) → 1
        y_direction = (y_signal == 2).astype(np.float32)

        data[split] = {
            'X': X,
            'y': y_direction,
            'timestamps': timestamps,
            'raw_signals': y_signal
        }

        logger.info(f"\n{split.upper()} sequences prepared:")
        logger.info(f"  Total: {len(X)} reversal sequences")
        logger.info(f"  Short (0): {np.sum(y_direction==0)} ({np.sum(y_direction==0)/len(y_direction)*100:.1f}%)")
        logger.info(f"  Long (1): {np.sum(y_direction==1)} ({np.sum(y_direction==1)/len(y_direction)*100:.1f}%)")

    # Save the scaler for future use
    models_dir = Path(__file__).parent.parent / 'models' / 'trained'
    scaler_path = models_dir / 'profitable_stage2_feature_scaler.pkl'
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler, f)
    logger.info(f"\n✅ Scaler saved to: {scaler_path}")

    return data


def create_stage2_model():
    """Create Stage 2 (Direction Classifier) model with same architecture as Stage 1"""

    inputs = layers.Input(shape=(SEQUENCE_LENGTH, len(CORE_FEATURES)), name='market_data')

    # LSTM layers (matching Stage 1 complexity)
    x = layers.LSTM(48, return_sequences=True, kernel_regularizer=regularizers.l2(0.0001))(inputs)
    x = layers.Dropout(0.3)(x)

    x = layers.LSTM(24, return_sequences=False, kernel_regularizer=regularizers.l2(0.0001))(x)
    x = layers.Dropout(0.3)(x)

    # Dense layers
    x = layers.Dense(16, activation='relu', kernel_regularizer=regularizers.l2(0.0001))(x)
    x = layers.Dropout(0.3)(x)

    # Binary classification output
    outputs = layers.Dense(1, activation='sigmoid', name='direction')(x)

    model = keras.Model(inputs=inputs, outputs=outputs, name='DirectionClassifier_Profitable')

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=[
            'accuracy',
            keras.metrics.Precision(name='precision'),
            keras.metrics.Recall(name='recall'),
            keras.metrics.AUC(name='auc')
        ]
    )

    return model


def main():
    parser = argparse.ArgumentParser(description='Train Stage 2 with Profitable Logic')
    parser.add_argument('--epochs', type=int, default=50, help='Number of epochs')
    parser.add_argument('--batch-size', type=int, default=16, help='Batch size')
    args = parser.parse_args()

    logger.info("="*80)
    logger.info("STAGE 2: Direction Classifier with Profitable Logic")
    logger.info("="*80)
    logger.info(f"Epochs: {args.epochs}")
    logger.info(f"Batch size: {args.batch_size}")
    logger.info(f"Sequence length: {SEQUENCE_LENGTH}")
    logger.info(f"Features: {len(CORE_FEATURES)}")

    data_dir = Path(__file__).parent.parent / 'data' / 'training_v3_profitable'
    output_dir = Path(__file__).parent.parent / 'models' / 'trained'
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load data
    data = load_and_prepare_stage2_data(data_dir)

    X_train, y_train = data['train']['X'], data['train']['y']
    X_val, y_val = data['val']['X'], data['val']['y']
    X_test, y_test = data['test']['X'], data['test']['y']

    logger.info(f"\n{'='*80}")
    logger.info("DATA SUMMARY")
    logger.info(f"{'='*80}")
    logger.info(f"Training data: {X_train.shape}")
    logger.info(f"Validation data: {X_val.shape}")
    logger.info(f"Test data: {X_test.shape}")

    # Create model
    model = create_stage2_model()
    logger.info(f"\n{'='*80}")
    logger.info("MODEL ARCHITECTURE")
    logger.info(f"{'='*80}")
    logger.info(f"Total parameters: {model.count_params():,}")
    model.summary()

    # Callbacks
    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=20,
            restore_best_weights=True,
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

    # Train
    logger.info(f"\n{'='*80}")
    logger.info("TRAINING")
    logger.info(f"{'='*80}")

    start_time = datetime.now()
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch_size,
        callbacks=callbacks,
        verbose=1
    )
    training_duration = (datetime.now() - start_time).total_seconds()

    # Evaluate
    logger.info(f"\n{'='*80}")
    logger.info("EVALUATION")
    logger.info(f"{'='*80}")

    results = model.evaluate(X_test, y_test, verbose=1)

    logger.info(f"\n📊 Test Metrics:")
    for metric_name, value in zip(model.metrics_names, results):
        logger.info(f"  {metric_name}: {value:.4f}")

    # Make predictions for detailed analysis
    y_pred_proba = model.predict(X_test, verbose=0)
    y_pred = (y_pred_proba > 0.5).astype(int).flatten()
    y_test_int = y_test.astype(int)

    from sklearn.metrics import classification_report, confusion_matrix
    logger.info(f"\n📊 Classification Report:")
    logger.info("\n" + classification_report(
        y_test_int,
        y_pred,
        target_names=['Short', 'Long'],
        digits=4
    ))

    logger.info(f"\n📊 Confusion Matrix:")
    cm = confusion_matrix(y_test_int, y_pred)
    logger.info(f"              Predicted")
    logger.info(f"              Short  Long")
    logger.info(f"Actual Short  {cm[0][0]:5d}  {cm[0][1]:4d}")
    logger.info(f"       Long   {cm[1][0]:5d}  {cm[1][1]:4d}")

    # Save model
    logger.info(f"\n{'='*80}")
    logger.info("SAVING MODEL")
    logger.info(f"{'='*80}")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_path = output_dir / f'profitable_direction_classifier_stage2_{timestamp}.h5'
    model.save(model_path)
    logger.info(f"✅ Model saved: {model_path}")

    # Save metadata
    metadata = {
        'model_name': 'Direction Classifier Stage 2 (Profitable Logic)',
        'version': '3.1',
        'created_at': datetime.now().isoformat(),
        'training_duration_seconds': training_duration,
        'architecture': {
            'sequence_length': SEQUENCE_LENGTH,
            'features': CORE_FEATURES,
            'num_features': len(CORE_FEATURES),
            'lstm_units': [48, 24],
            'dense_units': [16],
            'dropout_rate': 0.3,
            'l2_regularization': 0.0001
        },
        'training': {
            'epochs_trained': len(history.history['loss']),
            'batch_size': args.batch_size,
            'optimizer': 'Adam',
            'learning_rate': 0.001,
            'loss': 'binary_crossentropy'
        },
        'data': {
            'train_samples': int(len(X_train)),
            'val_samples': int(len(X_val)),
            'test_samples': int(len(X_test)),
            'train_short': int(np.sum(y_train == 0)),
            'train_long': int(np.sum(y_train == 1)),
            'test_short': int(np.sum(y_test == 0)),
            'test_long': int(np.sum(y_test == 1))
        },
        'metrics': {
            'test_loss': float(results[0]),
            'test_accuracy': float(results[1]),
            'test_precision': float(results[2]),
            'test_recall': float(results[3]),
            'test_auc': float(results[4])
        }
    }

    metadata_path = output_dir / f'profitable_stage2_metadata_{timestamp}.json'
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"✅ Metadata saved: {metadata_path}")

    # Save training history
    history_path = output_dir / f'profitable_stage2_history_{timestamp}.json'
    history_dict = {k: [float(v) for v in vals] for k, vals in history.history.items()}
    with open(history_path, 'w') as f:
        json.dump(history_dict, f, indent=2)
    logger.info(f"✅ Training history saved: {history_path}")

    # Summary
    logger.info(f"\n{'='*80}")
    logger.info("✅ TRAINING COMPLETE")
    logger.info(f"{'='*80}")
    logger.info(f"Model: {model_path.name}")
    logger.info(f"Test Accuracy: {results[1]:.2%}")
    logger.info(f"Test Precision: {results[2]:.2%}")
    logger.info(f"Test Recall: {results[3]:.2%}")
    logger.info(f"Training Duration: {training_duration:.0f}s ({training_duration/60:.1f}min)")

if __name__ == '__main__':
    main()
