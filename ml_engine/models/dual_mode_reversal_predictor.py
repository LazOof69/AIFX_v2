#!/usr/bin/env python3
"""
Dual-Mode Reversal Prediction Model for ML v3.0

Mode 1: Reversal Point Detection
- Input: OHLC + 38 technical indicators
- Output: 3-class classification (None/Long/Short) + Confidence

Mode 2: Dynamic Risk Management
- Input: Position state + market data
- Output: Misjudge probability + Reversal probability

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


class ReversalDetectionModel:
    """
    Mode 1: Reversal Point Detection Model

    Architecture:
    - Input: (sequence_length, num_features)
    - LSTM layers for temporal pattern recognition
    - Dense layers for classification
    - Output: [signal_class (3), confidence (1)]
    """

    def __init__(self, sequence_length: int = 20, num_features: int = 38,
                 lstm_units: int = 64, dropout_rate: float = 0.3):
        """
        Initialize reversal detection model

        Args:
            sequence_length: Number of candles in lookback window
            num_features: Number of technical indicators
            lstm_units: Number of LSTM units in each layer
            dropout_rate: Dropout rate for regularization
        """
        self.sequence_length = sequence_length
        self.num_features = num_features
        self.lstm_units = lstm_units
        self.dropout_rate = dropout_rate

        self.model = None

    def build_model(self) -> keras.Model:
        """
        Build Mode 1 model architecture

        Returns:
            keras.Model: Compiled model
        """
        logger.info("Building Mode 1: Reversal Detection Model")

        # Input layer
        inputs = layers.Input(
            shape=(self.sequence_length, self.num_features),
            name='market_data'
        )

        # LSTM layers for temporal pattern recognition
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
            32,
            activation='relu',
            kernel_regularizer=regularizers.l2(0.01),
            name='dense_1'
        )(x)
        x = layers.Dropout(self.dropout_rate / 2, name='dropout_3')(x)

        # Output branches
        # Branch 1: Signal classification (None=0, Long=1, Short=2)
        signal_output = layers.Dense(
            3,
            activation='softmax',
            name='signal'
        )(x)

        # Branch 2: Confidence score (0.0-1.0)
        confidence_output = layers.Dense(
            1,
            activation='sigmoid',
            name='confidence'
        )(x)

        # Create model
        model = models.Model(
            inputs=inputs,
            outputs=[signal_output, confidence_output],
            name='ReversalDetectionModel'
        )

        logger.info(f"Model built: {self.sequence_length}x{self.num_features} input, "
                   f"{self.lstm_units} LSTM units")

        return model

    def compile_model(self, model: keras.Model,
                     class_weights: Optional[Dict] = None) -> keras.Model:
        """
        Compile model with custom loss functions and metrics

        Args:
            model: Keras model to compile
            class_weights: Class weights for imbalanced data

        Returns:
            keras.Model: Compiled model
        """
        logger.info("Compiling Mode 1 model...")

        # Custom loss weights
        # Signal classification is more important than confidence
        loss_weights = {
            'signal': 0.7,
            'confidence': 0.3
        }

        # Compile
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss={
                'signal': keras.losses.CategoricalCrossentropy(),
                'confidence': keras.losses.MeanSquaredError()
            },
            loss_weights=loss_weights,
            metrics={
                'signal': [
                    keras.metrics.CategoricalAccuracy(name='accuracy'),
                    keras.metrics.Precision(name='precision'),
                    keras.metrics.Recall(name='recall')
                ],
                'confidence': [
                    keras.metrics.MeanAbsoluteError(name='mae')
                ]
            }
        )

        logger.info("✅ Mode 1 model compiled")
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

    def summary(self):
        """Print model summary"""
        if self.model is None:
            logger.error("Model not created yet. Call create() first.")
            return

        self.model.summary()


class DynamicRiskModel:
    """
    Mode 2: Dynamic Risk Management Model

    Architecture:
    - Input: Position state + market data
    - LSTM for temporal patterns
    - Dense layers for probability prediction
    - Output: [misjudge_prob (1), reversal_prob (1)]
    """

    def __init__(self, sequence_length: int = 10, num_features: int = 38,
                 position_features: int = 5, lstm_units: int = 32,
                 dropout_rate: float = 0.3):
        """
        Initialize dynamic risk model

        Args:
            sequence_length: Number of candles since entry
            num_features: Number of market features
            position_features: Number of position state features
            lstm_units: Number of LSTM units
            dropout_rate: Dropout rate for regularization
        """
        self.sequence_length = sequence_length
        self.num_features = num_features
        self.position_features = position_features
        self.lstm_units = lstm_units
        self.dropout_rate = dropout_rate

        self.model = None

    def build_model(self) -> keras.Model:
        """
        Build Mode 2 model architecture

        Returns:
            keras.Model: Compiled model
        """
        logger.info("Building Mode 2: Dynamic Risk Management Model")

        # Input 1: Market data sequence
        market_input = layers.Input(
            shape=(self.sequence_length, self.num_features),
            name='market_data'
        )

        # Input 2: Position state (entry_price, current_pnl, bars_held, etc.)
        position_input = layers.Input(
            shape=(self.position_features,),
            name='position_state'
        )

        # Process market data with LSTM
        x_market = layers.LSTM(
            self.lstm_units,
            return_sequences=False,
            kernel_regularizer=regularizers.l2(0.01),
            name='market_lstm'
        )(market_input)
        x_market = layers.Dropout(self.dropout_rate, name='market_dropout')(x_market)

        # Process position state
        x_position = layers.Dense(
            16,
            activation='relu',
            kernel_regularizer=regularizers.l2(0.01),
            name='position_dense'
        )(position_input)

        # Concatenate market and position features
        x = layers.concatenate([x_market, x_position], name='concat')

        # Shared dense layers
        x = layers.Dense(
            32,
            activation='relu',
            kernel_regularizer=regularizers.l2(0.01),
            name='shared_dense'
        )(x)
        x = layers.Dropout(self.dropout_rate / 2, name='shared_dropout')(x)

        # Output branches
        # Branch 1: Misjudge probability (should stop loss?)
        misjudge_output = layers.Dense(
            1,
            activation='sigmoid',
            name='misjudge_probability'
        )(x)

        # Branch 2: Reversal probability (should take profit?)
        reversal_output = layers.Dense(
            1,
            activation='sigmoid',
            name='reversal_probability'
        )(x)

        # Create model
        model = models.Model(
            inputs=[market_input, position_input],
            outputs=[misjudge_output, reversal_output],
            name='DynamicRiskModel'
        )

        logger.info(f"Model built: Market {self.sequence_length}x{self.num_features}, "
                   f"Position {self.position_features} features")

        return model

    def compile_model(self, model: keras.Model) -> keras.Model:
        """
        Compile model with custom loss and metrics

        Args:
            model: Keras model to compile

        Returns:
            keras.Model: Compiled model
        """
        logger.info("Compiling Mode 2 model...")

        # Both outputs are equally important
        loss_weights = {
            'misjudge_probability': 0.5,
            'reversal_probability': 0.5
        }

        # Compile
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss={
                'misjudge_probability': keras.losses.BinaryCrossentropy(),
                'reversal_probability': keras.losses.BinaryCrossentropy()
            },
            loss_weights=loss_weights,
            metrics={
                'misjudge_probability': [
                    keras.metrics.BinaryAccuracy(name='accuracy'),
                    keras.metrics.AUC(name='auc')
                ],
                'reversal_probability': [
                    keras.metrics.BinaryAccuracy(name='accuracy'),
                    keras.metrics.AUC(name='auc')
                ]
            }
        )

        logger.info("✅ Mode 2 model compiled")
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

    def summary(self):
        """Print model summary"""
        if self.model is None:
            logger.error("Model not created yet. Call create() first.")
            return

        self.model.summary()


def get_training_callbacks(model_name: str, patience: int = 10) -> list:
    """
    Get standard training callbacks

    Args:
        model_name: Name of model for checkpoint files
        patience: Early stopping patience

    Returns:
        list: List of Keras callbacks
    """
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
    logger.info("Testing Dual-Mode Reversal Prediction Models")
    logger.info("="*80)

    # Test Mode 1
    logger.info("\n### Mode 1: Reversal Detection ###")
    mode1 = ReversalDetectionModel(
        sequence_length=20,
        num_features=38,
        lstm_units=64,
        dropout_rate=0.3
    )
    model1 = mode1.create()
    mode1.summary()

    logger.info(f"\n✅ Mode 1 model created successfully")
    logger.info(f"   Total parameters: {model1.count_params():,}")

    # Test Mode 2
    logger.info("\n### Mode 2: Dynamic Risk Management ###")
    mode2 = DynamicRiskModel(
        sequence_length=10,
        num_features=38,
        position_features=5,
        lstm_units=32,
        dropout_rate=0.3
    )
    model2 = mode2.create()
    mode2.summary()

    logger.info(f"\n✅ Mode 2 model created successfully")
    logger.info(f"   Total parameters: {model2.count_params():,}")

    logger.info("\n" + "="*80)
    logger.info("✅ All models created successfully!")
    logger.info("="*80)


if __name__ == '__main__':
    main()
