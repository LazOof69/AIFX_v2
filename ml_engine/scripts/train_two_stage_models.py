#!/usr/bin/env python3
"""
Train Two-Stage Reversal Detection System

Stage 1: Reversal Detector (Binary: has_reversal)
Stage 2: Direction Classifier (Binary: long vs short)

Usage:
    python scripts/train_two_stage_models.py --epochs 100 --batch_size 32

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
    DirectionClassifier,
    TwoStageReversalPredictor,
    get_training_callbacks
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TwoStageTrainer:
    """Trainer for two-stage reversal detection system"""

    def __init__(self, data_dir: Path, sequence_length: int = 20):
        self.data_dir = Path(data_dir)
        self.sequence_length = sequence_length
        self.stage1_model = None
        self.stage2_model = None

    def load_data(self, split: str) -> tuple:
        """Load features and labels"""
        logger.info(f"Loading {split} data...")

        features_file = self.data_dir / f'EURUSD_reversal_mode1_{split}_features.csv'
        features = pd.read_csv(features_file, index_col=0, parse_dates=True)

        labels_file = self.data_dir / f'EURUSD_reversal_mode1_{split}_labels.csv'
        labels = pd.read_csv(labels_file)

        logger.info(f"Loaded {split}: {len(features)} samples")

        return features, labels

    def create_sequences(self, features: pd.DataFrame, labels: pd.DataFrame) -> tuple:
        """Create sequences for LSTM"""
        X = []
        y_signal = []

        for i in range(self.sequence_length, len(features)):
            sequence = features.iloc[i-self.sequence_length:i].values
            X.append(sequence)

            label = labels.iloc[i]
            y_signal.append(int(label['signal']))

        X = np.array(X)
        y_signal = np.array(y_signal)

        return X, y_signal

    def prepare_stage1_data(self) -> dict:
        """
        Prepare data for Stage 1 (Reversal Detector)

        Stage 1 learns: has_reversal (binary)
        - 0: No reversal (signal == 0)
        - 1: Has reversal (signal > 0)
        """
        logger.info("="*80)
        logger.info("Preparing Stage 1 Data: Reversal Detection (Binary)")
        logger.info("="*80)

        data = {}

        for split in ['train', 'val', 'test']:
            features, labels = self.load_data(split)
            X, y_signal = self.create_sequences(features, labels)

            # Convert to binary: has_reversal
            y_has_reversal = (y_signal > 0).astype(np.float32)

            data[split] = {
                'X': X,
                'y': y_has_reversal,
                'y_raw': y_signal
            }

            logger.info(f"{split.upper()}: {len(X)} sequences")
            logger.info(f"  No reversal (0): {np.sum(y_has_reversal==0)} ({100*np.mean(y_has_reversal==0):.1f}%)")
            logger.info(f"  Has reversal (1): {np.sum(y_has_reversal==1)} ({100*np.mean(y_has_reversal==1):.1f}%)")

        return data

    def prepare_stage2_data(self) -> dict:
        """
        Prepare data for Stage 2 (Direction Classifier)

        Stage 2 learns: direction (binary) - ONLY on reversal points
        - 0: Long (signal == 1)
        - 1: Short (signal == 2)
        """
        logger.info("="*80)
        logger.info("Preparing Stage 2 Data: Direction Classification (Binary)")
        logger.info("="*80)

        data = {}

        for split in ['train', 'val', 'test']:
            features, labels = self.load_data(split)
            X, y_signal = self.create_sequences(features, labels)

            # Filter: only reversal points (signal > 0)
            reversal_mask = y_signal > 0
            X_reversals = X[reversal_mask]
            y_signals_reversals = y_signal[reversal_mask]

            # Convert to binary: 0=long, 1=short
            # signal=1 → direction=0 (long)
            # signal=2 → direction=1 (short)
            y_direction = (y_signals_reversals == 2).astype(np.float32)

            data[split] = {
                'X': X_reversals,
                'y': y_direction
            }

            logger.info(f"{split.upper()}: {len(X_reversals)} reversal sequences")
            logger.info(f"  Long (0): {np.sum(y_direction==0)} ({100*np.mean(y_direction==0):.1f}%)")
            logger.info(f"  Short (1): {np.sum(y_direction==1)} ({100*np.mean(y_direction==1):.1f}%)")

        return data

    def train_stage1(self, data: dict, epochs: int = 100, batch_size: int = 32):
        """Train Stage 1: Reversal Detector"""
        logger.info("="*80)
        logger.info("Training Stage 1: Reversal Detector (Focal Loss)")
        logger.info("="*80)

        X_train = data['train']['X']
        y_train = data['train']['y']
        X_val = data['val']['X']
        y_val = data['val']['y']

        # Create model with reduced regularization
        model_builder = ReversalDetector(
            sequence_length=self.sequence_length,
            num_features=X_train.shape[2],
            lstm_units=64,
            dropout_rate=0.2  # Reduced from 0.4
        )
        model = model_builder.create(focal_gamma=1.5, focal_alpha=0.25)  # Reduced gamma from 2.0

        logger.info("\nModel architecture:")
        model.summary()

        # Callbacks
        callbacks = get_training_callbacks('reversal_detector_stage1', patience=20)

        # Train
        logger.info(f"\nStarting training...")
        logger.info(f"Epochs: {epochs}")
        logger.info(f"Batch size: {batch_size}")

        history = model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1
        )

        logger.info("\n✅ Stage 1 training complete!")
        self.stage1_model = model

        return history

    def train_stage2(self, data: dict, epochs: int = 100, batch_size: int = 16):
        """Train Stage 2: Direction Classifier"""
        logger.info("="*80)
        logger.info("Training Stage 2: Direction Classifier (Binary CE)")
        logger.info("="*80)

        X_train = data['train']['X']
        y_train = data['train']['y']
        X_val = data['val']['X']
        y_val = data['val']['y']

        # Create model
        model_builder = DirectionClassifier(
            sequence_length=self.sequence_length,
            num_features=X_train.shape[2],
            lstm_units=48,
            dropout_rate=0.3
        )
        model = model_builder.create()

        logger.info("\nModel architecture:")
        model.summary()

        # Callbacks
        callbacks = get_training_callbacks('direction_classifier_stage2', patience=20)

        # Train
        logger.info(f"\nStarting training...")
        logger.info(f"Epochs: {epochs}")
        logger.info(f"Batch size: {batch_size}")

        history = model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1
        )

        logger.info("\n✅ Stage 2 training complete!")
        self.stage2_model = model

        return history

    def evaluate_stage1(self, data: dict):
        """Evaluate Stage 1 on test set"""
        logger.info("="*80)
        logger.info("Evaluating Stage 1: Reversal Detector")
        logger.info("="*80)

        X_test = data['test']['X']
        y_test = data['test']['y']

        # Evaluate
        results = self.stage1_model.evaluate(X_test, y_test, verbose=1)

        logger.info("\n📊 Stage 1 Test Results:")
        for metric_name, value in zip(self.stage1_model.metrics_names, results):
            logger.info(f"  {metric_name}: {value:.4f}")

        # Get predictions
        y_pred_probs = self.stage1_model.predict(X_test, verbose=0)
        y_pred = (y_pred_probs > 0.5).astype(int).flatten()
        y_true = y_test.astype(int)

        # Classification report
        from sklearn.metrics import classification_report, confusion_matrix

        logger.info("\n📊 Classification Report:")
        report = classification_report(
            y_true, y_pred,
            target_names=['No Reversal', 'Has Reversal'],
            digits=3,
            zero_division=0
        )
        print(report)

        logger.info("\n📊 Confusion Matrix:")
        cm = confusion_matrix(y_true, y_pred)
        logger.info(f"\n{cm}")
        logger.info("\nRows: True | Cols: Predicted")
        logger.info("       No-Rev  Has-Rev")
        for i, label in enumerate(['No-Rev', 'Has-Rev']):
            logger.info(f"{label:>6} {cm[i]}")

        return results

    def evaluate_stage2(self, data: dict):
        """Evaluate Stage 2 on test set"""
        logger.info("="*80)
        logger.info("Evaluating Stage 2: Direction Classifier")
        logger.info("="*80)

        X_test = data['test']['X']
        y_test = data['test']['y']

        if len(X_test) == 0:
            logger.warning("No test data for Stage 2 (no reversals in test set)")
            return None

        # Evaluate
        results = self.stage2_model.evaluate(X_test, y_test, verbose=1)

        logger.info("\n📊 Stage 2 Test Results:")
        for metric_name, value in zip(self.stage2_model.metrics_names, results):
            logger.info(f"  {metric_name}: {value:.4f}")

        # Get predictions
        y_pred_probs = self.stage2_model.predict(X_test, verbose=0)
        y_pred = (y_pred_probs > 0.5).astype(int).flatten()
        y_true = y_test.astype(int)

        # Classification report
        from sklearn.metrics import classification_report, confusion_matrix

        logger.info("\n📊 Classification Report:")
        report = classification_report(
            y_true, y_pred,
            target_names=['Long', 'Short'],
            digits=3,
            zero_division=0
        )
        print(report)

        logger.info("\n📊 Confusion Matrix:")
        cm = confusion_matrix(y_true, y_pred)
        logger.info(f"\n{cm}")
        logger.info("\nRows: True | Cols: Predicted")
        logger.info("        Long  Short")
        for i, label in enumerate(['Long', 'Short']):
            logger.info(f"{label:>5} {cm[i]}")

        return results

    def save_models(self, output_dir: Path):
        """Save trained models"""
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Save Stage 1
        stage1_path = output_dir / 'reversal_detector_stage1.h5'
        self.stage1_model.save(stage1_path)
        logger.info(f"✅ Stage 1 model saved to {stage1_path}")

        # Save Stage 2
        stage2_path = output_dir / 'direction_classifier_stage2.h5'
        self.stage2_model.save(stage2_path)
        logger.info(f"✅ Stage 2 model saved to {stage2_path}")

        # Save metadata
        metadata = {
            'version': '3.0-two-stage',
            'stage1': {
                'task': 'reversal_detection',
                'output': 'has_reversal (binary)',
                'loss': 'focal_loss',
                'parameters': int(self.stage1_model.count_params())
            },
            'stage2': {
                'task': 'direction_classification',
                'output': 'direction (0=long, 1=short)',
                'loss': 'binary_crossentropy',
                'parameters': int(self.stage2_model.count_params())
            },
            'sequence_length': self.sequence_length,
            'trained_at': datetime.now().isoformat()
        }

        metadata_path = output_dir / 'two_stage_metadata.json'
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"✅ Metadata saved to {metadata_path}")


def main():
    parser = argparse.ArgumentParser(description='Train Two-Stage Reversal Detection System')
    parser.add_argument('--epochs', type=int, default=100, help='Number of epochs')
    parser.add_argument('--batch_size', type=int, default=32, help='Batch size')
    parser.add_argument('--sequence_length', type=int, default=20, help='Sequence length')

    args = parser.parse_args()

    logger.info("="*80)
    logger.info("TWO-STAGE REVERSAL DETECTION - TRAINING PIPELINE")
    logger.info("="*80)

    # Setup paths
    data_dir = Path(__file__).parent.parent / 'data' / 'training_v3_reversal'
    output_dir = Path(__file__).parent.parent / 'models' / 'trained'

    # Create trainer
    trainer = TwoStageTrainer(data_dir=data_dir, sequence_length=args.sequence_length)

    # Prepare data
    logger.info("\n" + "="*80)
    logger.info("DATA PREPARATION")
    logger.info("="*80)

    stage1_data = trainer.prepare_stage1_data()
    stage2_data = trainer.prepare_stage2_data()

    # Train Stage 1
    logger.info("\n" + "="*80)
    logger.info("STAGE 1 TRAINING")
    logger.info("="*80)

    trainer.train_stage1(stage1_data, epochs=args.epochs, batch_size=args.batch_size)
    trainer.evaluate_stage1(stage1_data)

    # Train Stage 2
    logger.info("\n" + "="*80)
    logger.info("STAGE 2 TRAINING")
    logger.info("="*80)

    trainer.train_stage2(stage2_data, epochs=args.epochs, batch_size=16)
    trainer.evaluate_stage2(stage2_data)

    # Save models
    logger.info("\n" + "="*80)
    logger.info("SAVING MODELS")
    logger.info("="*80)

    trainer.save_models(output_dir)

    logger.info("\n" + "="*80)
    logger.info("✅ TRAINING PIPELINE COMPLETE!")
    logger.info("="*80)


if __name__ == '__main__':
    main()
