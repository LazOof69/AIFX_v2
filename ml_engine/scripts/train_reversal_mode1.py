#!/usr/bin/env python3
"""
Train Mode 1: Reversal Point Detection Model

Trains a model to identify swing low/high reversal points.

Output:
- Signal: None (0) / Long (1) / Short (2)
- Confidence: 0.0-1.0

Usage:
    python scripts/train_reversal_mode1.py --epochs 100 --batch_size 32

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
from sklearn.utils.class_weight import compute_class_weight

from models.dual_mode_reversal_predictor import ReversalDetectionModel, get_training_callbacks

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ReversalMode1Trainer:
    """Trainer for Mode 1 reversal detection model"""

    def __init__(self, data_dir: Path, sequence_length: int = 20):
        self.data_dir = Path(data_dir)
        self.sequence_length = sequence_length
        self.model = None

    def load_data(self, split: str) -> tuple:
        """
        Load features and labels for given split

        Args:
            split: 'train', 'val', or 'test'

        Returns:
            tuple: (features, labels_signal, labels_confidence)
        """
        logger.info(f"Loading {split} data...")

        # Load features
        features_file = self.data_dir / f'EURUSD_reversal_mode1_{split}_features.csv'
        features = pd.read_csv(features_file, index_col=0, parse_dates=True)

        # Load labels
        labels_file = self.data_dir / f'EURUSD_reversal_mode1_{split}_labels.csv'
        labels = pd.read_csv(labels_file)

        logger.info(f"Loaded {split}: {len(features)} samples")

        return features, labels

    def create_sequences(self, features: pd.DataFrame, labels: pd.DataFrame) -> tuple:
        """
        Create sequences for LSTM input

        Args:
            features: DataFrame with features
            labels: DataFrame with labels

        Returns:
            tuple: (X, y_signal, y_confidence)
        """
        logger.info(f"Creating sequences with length {self.sequence_length}...")

        X = []
        y_signal = []
        y_confidence = []

        # Skip first sequence_length rows (not enough history)
        for i in range(self.sequence_length, len(features)):
            # Get sequence of past data
            sequence = features.iloc[i-self.sequence_length:i].values
            X.append(sequence)

            # Get label for current position
            label = labels.iloc[i]
            signal = int(label['signal'])
            confidence = float(label['confidence'])

            y_signal.append(signal)
            y_confidence.append(confidence)

        X = np.array(X)
        y_signal = np.array(y_signal)
        y_confidence = np.array(y_confidence)

        logger.info(f"Created {len(X)} sequences")
        logger.info(f"Shape: X={X.shape}, y_signal={y_signal.shape}, y_confidence={y_confidence.shape}")

        return X, y_signal, y_confidence

    def prepare_data(self) -> dict:
        """
        Load and prepare all data splits

        Returns:
            dict: Data dictionary with train/val/test splits
        """
        logger.info("="*80)
        logger.info("Preparing training data...")
        logger.info("="*80)

        data = {}

        for split in ['train', 'val', 'test']:
            features, labels = self.load_data(split)
            X, y_signal, y_confidence = self.create_sequences(features, labels)

            # Convert signal to one-hot encoding
            y_signal_onehot = keras.utils.to_categorical(y_signal, num_classes=3)

            data[split] = {
                'X': X,
                'y_signal': y_signal_onehot,
                'y_signal_raw': y_signal,  # For class weights calculation
                'y_confidence': y_confidence
            }

            logger.info(f"{split.upper()} prepared: {len(X)} sequences")
            logger.info(f"  Signal distribution: "
                       f"None={np.sum(y_signal==0)}, "
                       f"Long={np.sum(y_signal==1)}, "
                       f"Short={np.sum(y_signal==2)}")

        return data

    def calculate_class_weights(self, y_signal: np.ndarray) -> dict:
        """
        Calculate class weights for imbalanced data

        Args:
            y_signal: Signal labels (0/1/2)

        Returns:
            dict: Class weights
        """
        logger.info("Calculating class weights for imbalanced data...")

        # Calculate weights
        classes = np.unique(y_signal)
        weights = compute_class_weight('balanced', classes=classes, y=y_signal)

        class_weights = {int(c): float(w) for c, w in zip(classes, weights)}

        logger.info(f"Class weights: {class_weights}")

        return class_weights

    def train_model(self, data: dict, epochs: int = 100, batch_size: int = 32):
        """
        Train Mode 1 model

        Args:
            data: Prepared data dictionary
            epochs: Number of training epochs
            batch_size: Batch size
        """
        logger.info("="*80)
        logger.info("Training Mode 1: Reversal Detection Model")
        logger.info("="*80)

        # Get training data
        X_train = data['train']['X']
        y_train_signal = data['train']['y_signal']
        y_train_confidence = data['train']['y_confidence']

        X_val = data['val']['X']
        y_val_signal = data['val']['y_signal']
        y_val_confidence = data['val']['y_confidence']

        # Calculate class weights
        class_weights = self.calculate_class_weights(data['train']['y_signal_raw'])

        # Create model
        logger.info(f"\nCreating model...")
        model_builder = ReversalDetectionModel(
            sequence_length=self.sequence_length,
            num_features=X_train.shape[2],
            lstm_units=64,
            dropout_rate=0.3
        )
        model = model_builder.create()
        self.model = model

        logger.info("\nModel architecture:")
        model.summary()

        # Prepare callbacks
        callbacks = get_training_callbacks('reversal_mode1', patience=15)

        # Train
        logger.info(f"\nStarting training...")
        logger.info(f"Epochs: {epochs}")
        logger.info(f"Batch size: {batch_size}")
        logger.info(f"Training samples: {len(X_train)}")
        logger.info(f"Validation samples: {len(X_val)}")

        # Note: class_weight not supported for multi-output models
        # Using weighted loss instead (configured in model compilation)
        history = model.fit(
            X_train,
            {
                'signal': y_train_signal,
                'confidence': y_train_confidence
            },
            validation_data=(
                X_val,
                {
                    'signal': y_val_signal,
                    'confidence': y_val_confidence
                }
            ),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1
        )

        logger.info("\n✅ Training complete!")

        return history

    def evaluate_model(self, data: dict):
        """
        Evaluate model on test set

        Args:
            data: Prepared data dictionary
        """
        logger.info("="*80)
        logger.info("Evaluating on test set...")
        logger.info("="*80)

        X_test = data['test']['X']
        y_test_signal = data['test']['y_signal']
        y_test_confidence = data['test']['y_confidence']

        # Evaluate
        results = self.model.evaluate(
            X_test,
            {
                'signal': y_test_signal,
                'confidence': y_test_confidence
            },
            verbose=1
        )

        logger.info("\n📊 Test Results:")
        for metric_name, value in zip(self.model.metrics_names, results):
            logger.info(f"  {metric_name}: {value:.4f}")

        # Get predictions
        predictions = self.model.predict(X_test)
        y_pred_signal = predictions[0]
        y_pred_confidence = predictions[1]

        # Convert predictions to class labels
        y_pred_class = np.argmax(y_pred_signal, axis=1)
        y_true_class = np.argmax(y_test_signal, axis=1)

        # Calculate signal-specific metrics
        from sklearn.metrics import classification_report, confusion_matrix

        logger.info("\n📊 Detailed Classification Report:")
        report = classification_report(
            y_true_class,
            y_pred_class,
            target_names=['None', 'Long', 'Short'],
            digits=3
        )
        logger.info(f"\n{report}")

        logger.info("\n📊 Confusion Matrix:")
        cm = confusion_matrix(y_true_class, y_pred_class)
        logger.info(f"\n{cm}")
        logger.info("\nRows: True labels (None, Long, Short)")
        logger.info("Cols: Predicted labels (None, Long, Short)")

        # Analyze predictions on actual signals (ignore None class)
        signal_mask = y_true_class > 0
        if np.sum(signal_mask) > 0:
            logger.info(f"\n📊 Performance on actual signals ({np.sum(signal_mask)} samples):")
            logger.info(f"  Correct direction: {np.sum(y_pred_class[signal_mask] == y_true_class[signal_mask])}/{np.sum(signal_mask)}")
            logger.info(f"  Accuracy: {np.mean(y_pred_class[signal_mask] == y_true_class[signal_mask]):.2%}")

        return results, predictions

    def save_model(self, output_dir: Path):
        """
        Save trained model

        Args:
            output_dir: Directory to save model
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        model_path = output_dir / 'reversal_mode1_model.h5'
        self.model.save(model_path)

        logger.info(f"✅ Model saved to {model_path}")

        # Save model metadata
        metadata = {
            'version': '3.0-reversal',
            'mode': 'mode1_reversal_detection',
            'sequence_length': self.sequence_length,
            'num_features': self.model.input_shape[2],
            'trained_at': datetime.now().isoformat(),
            'total_parameters': int(self.model.count_params())
        }

        metadata_path = output_dir / 'reversal_mode1_metadata.json'
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"✅ Metadata saved to {metadata_path}")


def main():
    parser = argparse.ArgumentParser(description='Train Mode 1 Reversal Detection Model')
    parser.add_argument('--epochs', type=int, default=100, help='Number of epochs')
    parser.add_argument('--batch_size', type=int, default=32, help='Batch size')
    parser.add_argument('--sequence_length', type=int, default=20, help='Sequence length')

    args = parser.parse_args()

    logger.info("="*80)
    logger.info("MODE 1: REVERSAL POINT DETECTION - TRAINING")
    logger.info("="*80)
    logger.info(f"Configuration:")
    logger.info(f"  Epochs: {args.epochs}")
    logger.info(f"  Batch size: {args.batch_size}")
    logger.info(f"  Sequence length: {args.sequence_length}")

    # Setup paths
    data_dir = Path(__file__).parent.parent / 'data' / 'training_v3_reversal'
    output_dir = Path(__file__).parent.parent / 'models' / 'trained'

    if not data_dir.exists():
        logger.error(f"Data directory not found: {data_dir}")
        return

    # Create trainer
    trainer = ReversalMode1Trainer(
        data_dir=data_dir,
        sequence_length=args.sequence_length
    )

    # Prepare data
    data = trainer.prepare_data()

    # Train model
    history = trainer.train_model(
        data=data,
        epochs=args.epochs,
        batch_size=args.batch_size
    )

    # Evaluate model
    results, predictions = trainer.evaluate_model(data)

    # Save model
    trainer.save_model(output_dir)

    logger.info("\n" + "="*80)
    logger.info("✅ TRAINING PIPELINE COMPLETE!")
    logger.info("="*80)


if __name__ == '__main__':
    main()
