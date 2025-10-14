#!/usr/bin/env python3
"""
Two-Stage Reversal Prediction System for ML v3.0

Stage 1: Reversal Detector (Binary: Has Reversal vs No Reversal)
Stage 2: Direction Classifier (Binary: Long vs Short)

This approach solves the extreme class imbalance problem by decomposing
the 3-class problem into two binary problems.

Author: AI-assisted
Created: 2025-10-14
"""

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, models, regularizers
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
import numpy as np
from typing import Dict, Tuple, Optional
import logging

logger = logging.getLogger(__name__)


class FocalLoss(keras.losses.Loss):
    """
    Focal Loss for binary classification

    Addresses class imbalance by down-weighting easy examples
    and focusing on hard examples.

    Formula: FL(p) = -(1-p)^gamma * log(p)

    Args:
        gamma: Focusing parameter (default: 2.0)
        alpha: Class balance parameter (default: 0.25)
    """

    def __init__(self, gamma=2.0, alpha=0.25, name='focal_loss'):
        super().__init__(name=name)
        self.gamma = gamma
        self.alpha = alpha

    def call(self, y_true, y_pred):
        """
        Compute focal loss

        Args:
            y_true: Ground truth labels (0 or 1)
            y_pred: Predicted probabilities (0.0-1.0)

        Returns:
            Focal loss value
        """
        # Clip predictions to prevent log(0)
        epsilon = keras.backend.epsilon()
        y_pred = tf.clip_by_value(y_pred, epsilon, 1 - epsilon)

        # Compute focal loss
        cross_entropy = -y_true * tf.math.log(y_pred)

        # Apply focal term: (1-p)^gamma
        focal_weight = tf.pow(1 - y_pred, self.gamma)

        # Apply alpha balancing
        alpha_weight = y_true * self.alpha + (1 - y_true) * (1 - self.alpha)

        focal_loss = alpha_weight * focal_weight * cross_entropy

        return tf.reduce_mean(focal_loss)


class ReversalDetector:
    """
    Stage 1: Binary classifier to detect if a reversal exists

    Input: Market data (20 candles × 38 features)
    Output: has_reversal (0 or 1) + confidence

    This model uses Focal Loss to handle the severe class imbalance
    (96.7% no reversal vs 3.3% reversal).
    """

    def __init__(self, sequence_length: int = 20, num_features: int = 38,
                 lstm_units: int = 64, dropout_rate: float = 0.2):
        """
        Initialize reversal detector

        Args:
            sequence_length: Number of candles in lookback window
            num_features: Number of technical indicators
            lstm_units: Number of LSTM units
            dropout_rate: Dropout rate for regularization (default: 0.2, reduced from 0.4)
        """
        self.sequence_length = sequence_length
        self.num_features = num_features
        self.lstm_units = lstm_units
        self.dropout_rate = dropout_rate
        self.model = None

    def build_model(self) -> keras.Model:
        """
        Build Stage 1 model architecture

        Returns:
            keras.Model: Compiled model
        """
        logger.info("Building Stage 1: Reversal Detector")

        # Input layer
        inputs = layers.Input(
            shape=(self.sequence_length, self.num_features),
            name='market_data'
        )

        # LSTM layers (reduced L2 regularization from 0.01 to 0.0001)
        x = layers.LSTM(
            self.lstm_units,
            return_sequences=True,
            kernel_regularizer=regularizers.l2(0.0001),
            name='lstm_1'
        )(inputs)
        x = layers.Dropout(self.dropout_rate, name='dropout_1')(x)

        x = layers.LSTM(
            self.lstm_units // 2,
            return_sequences=False,
            kernel_regularizer=regularizers.l2(0.0001),
            name='lstm_2'
        )(x)
        x = layers.Dropout(self.dropout_rate, name='dropout_2')(x)

        # Dense layers (reduced L2 regularization from 0.01 to 0.0001)
        x = layers.Dense(
            32,
            activation='relu',
            kernel_regularizer=regularizers.l2(0.0001),
            name='dense_1'
        )(x)
        x = layers.Dropout(self.dropout_rate / 2, name='dropout_3')(x)

        x = layers.Dense(
            16,
            activation='relu',
            kernel_regularizer=regularizers.l2(0.0001),
            name='dense_2'
        )(x)

        # Output: Binary classification
        output = layers.Dense(
            1,
            activation='sigmoid',
            name='has_reversal'
        )(x)

        # Create model
        model = models.Model(
            inputs=inputs,
            outputs=output,
            name='ReversalDetector'
        )

        logger.info(f"Stage 1 model built: {self.sequence_length}x{self.num_features} input")

        return model

    def compile_model(self, model: keras.Model, focal_gamma: float = 1.5,
                     focal_alpha: float = 0.25) -> keras.Model:
        """
        Compile model with Focal Loss

        Args:
            model: Keras model to compile
            focal_gamma: Focal loss gamma parameter (default: 1.5, reduced from 2.0)
            focal_alpha: Focal loss alpha parameter

        Returns:
            keras.Model: Compiled model
        """
        logger.info(f"Compiling Stage 1 with Focal Loss (gamma={focal_gamma}, alpha={focal_alpha})")

        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss=FocalLoss(gamma=focal_gamma, alpha=focal_alpha),
            metrics=[
                keras.metrics.BinaryAccuracy(name='accuracy'),
                keras.metrics.Precision(name='precision'),
                keras.metrics.Recall(name='recall'),
                keras.metrics.AUC(name='auc')
            ]
        )

        logger.info("✅ Stage 1 model compiled")
        return model

    def create(self, focal_gamma: float = 1.5, focal_alpha: float = 0.25) -> keras.Model:
        """
        Build and compile complete model

        Args:
            focal_gamma: Focal loss gamma parameter (default: 1.5, reduced from 2.0)
            focal_alpha: Focal loss alpha parameter

        Returns:
            keras.Model: Ready-to-train model
        """
        model = self.build_model()
        model = self.compile_model(model, focal_gamma, focal_alpha)
        self.model = model
        return model


class DirectionClassifier:
    """
    Stage 2: Binary classifier to determine reversal direction

    Input: Market data (20 candles × 38 features)
    Output: direction (0=long, 1=short) + confidence

    This model only trains on reversal points, where the class distribution
    is nearly balanced (47% long vs 53% short).
    """

    def __init__(self, sequence_length: int = 20, num_features: int = 38,
                 lstm_units: int = 48, dropout_rate: float = 0.3):
        """
        Initialize direction classifier

        Args:
            sequence_length: Number of candles in lookback window
            num_features: Number of technical indicators
            lstm_units: Number of LSTM units (smaller than Stage 1)
            dropout_rate: Dropout rate for regularization
        """
        self.sequence_length = sequence_length
        self.num_features = num_features
        self.lstm_units = lstm_units
        self.dropout_rate = dropout_rate
        self.model = None

    def build_model(self) -> keras.Model:
        """
        Build Stage 2 model architecture

        Returns:
            keras.Model: Compiled model
        """
        logger.info("Building Stage 2: Direction Classifier")

        # Input layer
        inputs = layers.Input(
            shape=(self.sequence_length, self.num_features),
            name='market_data'
        )

        # LSTM layers (smaller than Stage 1)
        x = layers.LSTM(
            self.lstm_units,
            return_sequences=True,
            kernel_regularizer=regularizers.l2(0.01),
            name='lstm_1'
        )(inputs)
        x = layers.Dropout(self.dropout_rate, name='dropout_1')(x)

        x = layers.LSTM(
            self.lstm_units // 2,
            return_sequences=False,
            kernel_regularizer=regularizers.l2(0.01),
            name='lstm_2'
        )(x)
        x = layers.Dropout(self.dropout_rate, name='dropout_2')(x)

        # Dense layers
        x = layers.Dense(
            24,
            activation='relu',
            kernel_regularizer=regularizers.l2(0.01),
            name='dense_1'
        )(x)
        x = layers.Dropout(self.dropout_rate / 2, name='dropout_3')(x)

        # Output: Binary classification (0=long, 1=short)
        output = layers.Dense(
            1,
            activation='sigmoid',
            name='direction'
        )(x)

        # Create model
        model = models.Model(
            inputs=inputs,
            outputs=output,
            name='DirectionClassifier'
        )

        logger.info(f"Stage 2 model built: {self.sequence_length}x{self.num_features} input")

        return model

    def compile_model(self, model: keras.Model) -> keras.Model:
        """
        Compile model with standard Binary Crossentropy

        Args:
            model: Keras model to compile

        Returns:
            keras.Model: Compiled model
        """
        logger.info("Compiling Stage 2 with Binary Crossentropy (balanced classes)")

        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss=keras.losses.BinaryCrossentropy(),
            metrics=[
                keras.metrics.BinaryAccuracy(name='accuracy'),
                keras.metrics.Precision(name='precision'),
                keras.metrics.Recall(name='recall'),
                keras.metrics.AUC(name='auc')
            ]
        )

        logger.info("✅ Stage 2 model compiled")
        return model

    def create(self) -> keras.Model:
        """
        Build and compile complete model

        Returns:
            keras.Model: Ready-to-train model
        """
        model = self.build_model()
        model = self.compile_model(model)
        self.model = model
        return model


class TwoStageReversalPredictor:
    """
    Combined two-stage prediction system

    Combines Stage 1 (reversal detection) and Stage 2 (direction classification)
    into a single prediction pipeline.
    """

    def __init__(self, stage1_model: keras.Model, stage2_model: keras.Model,
                 stage1_threshold: float = 0.5):
        """
        Initialize two-stage predictor

        Args:
            stage1_model: Trained reversal detector
            stage2_model: Trained direction classifier
            stage1_threshold: Threshold for Stage 1 (default: 0.5)
        """
        self.stage1_model = stage1_model
        self.stage2_model = stage2_model
        self.stage1_threshold = stage1_threshold

    def predict(self, X: np.ndarray) -> Dict:
        """
        Make prediction using two-stage pipeline

        Args:
            X: Input data (batch_size, sequence_length, num_features)

        Returns:
            dict: Prediction results
                - signal: 'none', 'long', or 'short'
                - confidence: Overall confidence (0.0-1.0)
                - stage1_prob: Reversal probability
                - stage2_prob: Direction probability (if reversal detected)
        """
        # Stage 1: Detect reversal
        stage1_pred = self.stage1_model.predict(X, verbose=0)
        has_reversal_prob = float(stage1_pred[0][0])

        if has_reversal_prob < self.stage1_threshold:
            # No reversal detected
            return {
                'signal': 'none',
                'confidence': 1.0 - has_reversal_prob,
                'stage1_prob': has_reversal_prob,
                'stage2_prob': None
            }

        # Stage 2: Determine direction
        stage2_pred = self.stage2_model.predict(X, verbose=0)
        direction_prob = float(stage2_pred[0][0])

        # 0 = long, 1 = short
        signal = 'short' if direction_prob > 0.5 else 'long'
        direction_confidence = direction_prob if direction_prob > 0.5 else (1.0 - direction_prob)

        # Overall confidence: average of both stages
        overall_confidence = (has_reversal_prob + direction_confidence) / 2

        return {
            'signal': signal,
            'confidence': overall_confidence,
            'stage1_prob': has_reversal_prob,
            'stage2_prob': direction_prob
        }

    def predict_batch(self, X: np.ndarray) -> list:
        """
        Make predictions for a batch of inputs

        Args:
            X: Input data (batch_size, sequence_length, num_features)

        Returns:
            list: List of prediction dictionaries
        """
        results = []

        # Stage 1: Batch prediction
        stage1_preds = self.stage1_model.predict(X, verbose=0)

        for i in range(len(X)):
            has_reversal_prob = float(stage1_preds[i][0])

            if has_reversal_prob < self.stage1_threshold:
                results.append({
                    'signal': 'none',
                    'confidence': 1.0 - has_reversal_prob,
                    'stage1_prob': has_reversal_prob,
                    'stage2_prob': None
                })
            else:
                # Need Stage 2 prediction
                results.append({
                    'needs_stage2': True,
                    'stage1_prob': has_reversal_prob,
                    'index': i
                })

        # Stage 2: Only for detected reversals
        indices_needing_stage2 = [r['index'] for r in results if r.get('needs_stage2')]

        if len(indices_needing_stage2) > 0:
            X_stage2 = X[indices_needing_stage2]
            stage2_preds = self.stage2_model.predict(X_stage2, verbose=0)

            stage2_idx = 0
            for i, result in enumerate(results):
                if result.get('needs_stage2'):
                    direction_prob = float(stage2_preds[stage2_idx][0])
                    signal = 'short' if direction_prob > 0.5 else 'long'
                    direction_confidence = direction_prob if direction_prob > 0.5 else (1.0 - direction_prob)
                    overall_confidence = (result['stage1_prob'] + direction_confidence) / 2

                    results[i] = {
                        'signal': signal,
                        'confidence': overall_confidence,
                        'stage1_prob': result['stage1_prob'],
                        'stage2_prob': direction_prob
                    }
                    stage2_idx += 1

        return results


def get_training_callbacks(model_name: str, patience: int = 15) -> list:
    """
    Get standard training callbacks

    Args:
        model_name: Name of model for checkpoint files
        patience: Early stopping patience

    Returns:
        list: List of Keras callbacks
    """
    from pathlib import Path
    checkpoint_dir = Path('models/checkpoints')
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    return [
        EarlyStopping(
            monitor='val_loss',
            patience=patience,
            restore_best_weights=True,
            verbose=1
        ),
        ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=patience // 2,
            min_lr=1e-6,
            verbose=1
        ),
        ModelCheckpoint(
            f'models/checkpoints/{model_name}_best.h5',
            monitor='val_loss',
            save_best_only=True,
            verbose=1
        )
    ]


def main():
    """Test model creation"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    logger.info("="*80)
    logger.info("Testing Two-Stage Reversal Prediction System")
    logger.info("="*80)

    # Test Stage 1
    logger.info("\n### Stage 1: Reversal Detector ###")
    stage1 = ReversalDetector(
        sequence_length=20,
        num_features=38,
        lstm_units=64,
        dropout_rate=0.4
    )
    model1 = stage1.create(focal_gamma=2.0, focal_alpha=0.25)
    model1.summary()

    logger.info(f"\n✅ Stage 1 model created successfully")
    logger.info(f"   Total parameters: {model1.count_params():,}")

    # Test Stage 2
    logger.info("\n### Stage 2: Direction Classifier ###")
    stage2 = DirectionClassifier(
        sequence_length=20,
        num_features=38,
        lstm_units=48,
        dropout_rate=0.3
    )
    model2 = stage2.create()
    model2.summary()

    logger.info(f"\n✅ Stage 2 model created successfully")
    logger.info(f"   Total parameters: {model2.count_params():,}")

    logger.info("\n" + "="*80)
    logger.info("✅ All models created successfully!")
    logger.info("="*80)


if __name__ == '__main__':
    main()
