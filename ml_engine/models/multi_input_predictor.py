"""
Multi-Input Price Predictor Module for AIFX_v2 ML Engine v2.0

Implements multi-input LSTM model that combines:
- Technical indicators (LSTM processing)
- Fundamental features (Dense processing)
- Economic event features (Dense processing)

Architecture: Multi-Input LSTM v2.0
Created: 2025-10-08
"""

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.models import Model, load_model
from tensorflow.keras.layers import (
    Input, LSTM, Dense, Dropout, Concatenate,
    BatchNormalization, Layer
)
from tensorflow.keras.callbacks import (
    EarlyStopping, ModelCheckpoint, ReduceLROnPlateau,
    TensorBoard, Callback
)
from tensorflow.keras.optimizers import Adam
from typing import Dict, Tuple, Optional, List
import logging
import os
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class DirectionalAccuracyMetric(tf.keras.metrics.Metric):
    """
    Custom metric to calculate directional accuracy
    (percentage of correct price movement direction predictions)
    """

    def __init__(self, name='directional_accuracy', **kwargs):
        super(DirectionalAccuracyMetric, self).__init__(name=name, **kwargs)
        self.correct = self.add_weight(name='correct', initializer='zeros')
        self.total = self.add_weight(name='total', initializer='zeros')

    def update_state(self, y_true, y_pred, sample_weight=None):
        # Calculate direction: positive if price increases
        y_true_diff = y_true[1:] - y_true[:-1]
        y_pred_diff = y_pred[1:] - y_pred[:-1]

        # Check if directions match
        correct_direction = tf.cast(
            tf.sign(y_true_diff) == tf.sign(y_pred_diff),
            tf.float32
        )

        self.correct.assign_add(tf.reduce_sum(correct_direction))
        self.total.assign_add(tf.cast(tf.size(correct_direction), tf.float32))

    def result(self):
        return self.correct / (self.total + tf.keras.backend.epsilon())

    def reset_states(self):
        self.correct.assign(0.0)
        self.total.assign(0.0)


class MultiInputPricePredictor:
    """
    Multi-Input LSTM-based forex price prediction model v2.0

    Combines technical indicators, fundamental data, and economic events
    for improved price prediction accuracy.
    """

    def __init__(self, config: Dict):
        """
        Initialize the multi-input price predictor

        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.model = None
        self.history = None
        self.model_version = config.get('model', {}).get('version', '2.0.0')
        self.model_dir = config.get('model', {}).get('model_dir', './saved_models')
        self.checkpoint_dir = config.get('model', {}).get('checkpoint_dir', './checkpoints')

        # Create directories if they don't exist
        os.makedirs(self.model_dir, exist_ok=True)
        os.makedirs(self.checkpoint_dir, exist_ok=True)

        logger.info(f"✅ MultiInputPricePredictor initialized (v{self.model_version})")

    def build_model(
        self,
        technical_shape: Tuple[int, int],
        fundamental_shape: int,
        event_shape: int
    ) -> Model:
        """
        Build multi-input LSTM model architecture

        Args:
            technical_shape: Shape of technical indicators (sequence_length, n_features)
            fundamental_shape: Number of fundamental features
            event_shape: Number of event features

        Returns:
            Compiled Keras Functional API model
        """
        logger.info(f"🔨 Building Multi-Input LSTM v2.0 model")
        logger.info(f"   Technical: {technical_shape}")
        logger.info(f"   Fundamental: {fundamental_shape}")
        logger.info(f"   Event: {event_shape}")

        # ==================================================================
        # INPUT BRANCH 1: Technical Indicators (LSTM)
        # ==================================================================
        technical_input = Input(shape=technical_shape, name='technical_input')

        # Get technical LSTM configuration
        tech_config = self.config.get('model', {}).get('technical_lstm', {})
        tech_units = tech_config.get('units', [64, 32])
        tech_dropout = tech_config.get('dropout', 0.2)
        tech_recurrent_dropout = tech_config.get('recurrent_dropout', 0.1)

        # First LSTM layer
        x_tech = LSTM(
            units=tech_units[0],
            return_sequences=True,
            dropout=tech_dropout,
            recurrent_dropout=tech_recurrent_dropout,
            name='technical_lstm_1'
        )(technical_input)

        # Second LSTM layer
        x_tech = LSTM(
            units=tech_units[1],
            return_sequences=False,
            dropout=tech_dropout,
            recurrent_dropout=tech_recurrent_dropout,
            name='technical_lstm_2'
        )(x_tech)

        # Dense layer for technical branch
        x_tech = Dense(16, activation='relu', name='technical_dense')(x_tech)
        x_tech = Dropout(0.2, name='technical_dropout')(x_tech)

        # ==================================================================
        # INPUT BRANCH 2: Fundamental Features (Dense)
        # ==================================================================
        fundamental_input = Input(shape=(fundamental_shape,), name='fundamental_input')

        # Get fundamental configuration
        fund_config = self.config.get('model', {}).get('fundamental_dense', {})
        fund_units = fund_config.get('units', [32, 16])
        fund_activation = fund_config.get('activation', 'relu')
        fund_dropout = fund_config.get('dropout', 0.2)

        # Dense layers for fundamental branch
        x_fund = Dense(
            fund_units[0],
            activation=fund_activation,
            name='fundamental_dense_1'
        )(fundamental_input)
        x_fund = Dropout(fund_dropout, name='fundamental_dropout_1')(x_fund)

        x_fund = Dense(
            fund_units[1],
            activation=fund_activation,
            name='fundamental_dense_2'
        )(x_fund)
        x_fund = Dropout(fund_dropout, name='fundamental_dropout_2')(x_fund)

        # ==================================================================
        # INPUT BRANCH 3: Event Features (Dense)
        # ==================================================================
        event_input = Input(shape=(event_shape,), name='event_input')

        # Get event configuration
        event_config = self.config.get('model', {}).get('event_dense', {})
        event_units = event_config.get('units', [16, 8])
        event_activation = event_config.get('activation', 'relu')
        event_dropout = event_config.get('dropout', 0.2)

        # Dense layers for event branch
        x_event = Dense(
            event_units[0],
            activation=event_activation,
            name='event_dense_1'
        )(event_input)
        x_event = Dropout(event_dropout, name='event_dropout_1')(x_event)

        x_event = Dense(
            event_units[1],
            activation=event_activation,
            name='event_dense_2'
        )(x_event)
        x_event = Dropout(event_dropout, name='event_dropout_2')(x_event)

        # ==================================================================
        # FUSION LAYER: Concatenate all branches
        # ==================================================================
        concatenated = Concatenate(name='fusion_concatenate')([x_tech, x_fund, x_event])

        # Get fusion configuration
        fusion_config = self.config.get('model', {}).get('fusion', {})
        fusion_units = fusion_config.get('units', [64, 32])
        fusion_dropout = fusion_config.get('dropout', [0.3, 0.2])

        # Fusion dense layers
        x_fusion = Dense(
            fusion_units[0],
            activation='relu',
            name='fusion_dense_1'
        )(concatenated)
        x_fusion = Dropout(fusion_dropout[0], name='fusion_dropout_1')(x_fusion)

        x_fusion = Dense(
            fusion_units[1],
            activation='relu',
            name='fusion_dense_2'
        )(x_fusion)
        x_fusion = Dropout(fusion_dropout[1], name='fusion_dropout_2')(x_fusion)

        # ==================================================================
        # OUTPUT LAYER: Price prediction
        # ==================================================================
        output = Dense(1, activation='linear', name='price_output')(x_fusion)

        # ==================================================================
        # CREATE MODEL
        # ==================================================================
        model = Model(
            inputs=[technical_input, fundamental_input, event_input],
            outputs=output,
            name='MultiInputLSTM_v2'
        )

        # ==================================================================
        # COMPILE MODEL
        # ==================================================================
        training_config = self.config.get('model', {}).get('training', {})
        learning_rate = training_config.get('learning_rate', 0.001)
        loss = training_config.get('loss', 'mse')

        optimizer = Adam(learning_rate=learning_rate)

        # Use custom directional accuracy metric
        model.compile(
            optimizer=optimizer,
            loss=loss,
            metrics=[
                'mae',
                'mse',
                DirectionalAccuracyMetric()
            ]
        )

        self.model = model

        logger.info(f"✅ Model built successfully")
        logger.info(f"   Total parameters: {model.count_params():,}")
        logger.info(f"   Trainable parameters: {sum([tf.size(w).numpy() for w in model.trainable_weights]):,}")

        return model

    def train(
        self,
        X_technical_train: np.ndarray,
        X_fundamental_train: np.ndarray,
        X_event_train: np.ndarray,
        y_train: np.ndarray,
        X_technical_val: Optional[np.ndarray] = None,
        X_fundamental_val: Optional[np.ndarray] = None,
        X_event_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
        verbose: int = 1
    ) -> Dict:
        """
        Train the multi-input LSTM model

        Args:
            X_technical_train: Technical indicators training data
            X_fundamental_train: Fundamental features training data
            X_event_train: Event features training data
            y_train: Training targets
            X_technical_val: Technical indicators validation data
            X_fundamental_val: Fundamental features validation data
            X_event_val: Event features validation data
            y_val: Validation targets
            verbose: Verbosity level

        Returns:
            Training history dictionary
        """
        logger.info(f"🚀 Starting Multi-Input LSTM training")
        logger.info(f"   Technical shape: {X_technical_train.shape}")
        logger.info(f"   Fundamental shape: {X_fundamental_train.shape}")
        logger.info(f"   Event shape: {X_event_train.shape}")
        logger.info(f"   Target shape: {y_train.shape}")

        # Build model if not already built
        if self.model is None:
            technical_shape = (X_technical_train.shape[1], X_technical_train.shape[2])
            fundamental_shape = X_fundamental_train.shape[1]
            event_shape = X_event_train.shape[1]
            self.build_model(technical_shape, fundamental_shape, event_shape)

        # Get training configuration
        training_config = self.config.get('model', {}).get('training', {})
        epochs = training_config.get('epochs', 100)
        batch_size = training_config.get('batch_size', 32)
        early_stopping_patience = training_config.get('early_stopping_patience', 15)

        # Prepare callbacks
        callbacks = self._get_callbacks(early_stopping_patience)

        # Prepare validation data
        if all(x is not None for x in [X_technical_val, X_fundamental_val, X_event_val, y_val]):
            validation_data = (
                [X_technical_val, X_fundamental_val, X_event_val],
                y_val
            )
        else:
            validation_data = None

        # Train the model
        history = self.model.fit(
            [X_technical_train, X_fundamental_train, X_event_train],
            y_train,
            epochs=epochs,
            batch_size=batch_size,
            validation_data=validation_data,
            callbacks=callbacks,
            verbose=verbose
        )

        self.history = history.history

        # Log training results
        final_loss = history.history['loss'][-1]
        final_val_loss = history.history.get('val_loss', [0])[-1]
        final_dir_acc = history.history.get('directional_accuracy', [0])[-1]
        final_val_dir_acc = history.history.get('val_directional_accuracy', [0])[-1]

        logger.info(f"✅ Training completed!")
        logger.info(f"   Final loss: {final_loss:.6f}")
        logger.info(f"   Final val_loss: {final_val_loss:.6f}")
        logger.info(f"   Directional accuracy: {final_dir_acc:.4f}")
        logger.info(f"   Val directional accuracy: {final_val_dir_acc:.4f}")

        return self.history

    def _get_callbacks(self, patience: int) -> List:
        """
        Get training callbacks

        Args:
            patience: Early stopping patience

        Returns:
            List of callbacks
        """
        callbacks = []

        # Early stopping
        early_stop = EarlyStopping(
            monitor='val_loss',
            patience=patience,
            restore_best_weights=True,
            verbose=1,
            mode='min'
        )
        callbacks.append(early_stop)

        # Model checkpoint
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        checkpoint_path = os.path.join(
            self.checkpoint_dir,
            f'multi_input_v2_{timestamp}_best.h5'
        )
        checkpoint = ModelCheckpoint(
            checkpoint_path,
            monitor='val_loss',
            save_best_only=True,
            verbose=1,
            mode='min'
        )
        callbacks.append(checkpoint)

        # Reduce learning rate on plateau
        reduce_lr = ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=patience // 2,
            min_lr=1e-7,
            verbose=1,
            mode='min'
        )
        callbacks.append(reduce_lr)

        # TensorBoard
        log_dir = os.path.join('logs', 'v2_runs', timestamp)
        tensorboard = TensorBoard(
            log_dir=log_dir,
            histogram_freq=1,
            write_graph=True,
            write_images=False,
            update_freq='epoch'
        )
        callbacks.append(tensorboard)

        return callbacks

    def predict(
        self,
        X_technical: np.ndarray,
        X_fundamental: np.ndarray,
        X_event: np.ndarray
    ) -> np.ndarray:
        """
        Make predictions using the trained model

        Args:
            X_technical: Technical indicators
            X_fundamental: Fundamental features
            X_event: Event features

        Returns:
            Predicted prices
        """
        if self.model is None:
            raise ValueError("Model not built or loaded")

        predictions = self.model.predict(
            [X_technical, X_fundamental, X_event],
            verbose=0
        )

        return predictions

    def evaluate(
        self,
        X_technical: np.ndarray,
        X_fundamental: np.ndarray,
        X_event: np.ndarray,
        y_true: np.ndarray
    ) -> Dict[str, float]:
        """
        Evaluate model performance with comprehensive metrics

        Args:
            X_technical: Technical indicators
            X_fundamental: Fundamental features
            X_event: Event features
            y_true: True prices

        Returns:
            Dictionary of evaluation metrics
        """
        logger.info(f"📊 Evaluating model performance...")

        # Get predictions
        y_pred = self.predict(X_technical, X_fundamental, X_event).flatten()

        # Basic metrics
        from sklearn.metrics import mean_squared_error, mean_absolute_error

        mse = mean_squared_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(y_true, y_pred)

        # Directional accuracy
        y_true_direction = np.diff(y_true) > 0
        y_pred_direction = np.diff(y_pred) > 0
        directional_accuracy = np.mean(y_true_direction == y_pred_direction)

        # Sharpe ratio (simplified - based on returns)
        returns = np.diff(y_true) / y_true[:-1]
        pred_returns = np.diff(y_pred) / y_pred[:-1]

        # Trading strategy: trade when predicted direction matches
        strategy_returns = np.where(
            y_pred_direction,
            returns,
            -returns
        )

        sharpe_ratio = 0.0
        if len(strategy_returns) > 0 and np.std(strategy_returns) > 0:
            sharpe_ratio = np.sqrt(252) * np.mean(strategy_returns) / np.std(strategy_returns)

        # Max drawdown
        cumulative_returns = np.cumprod(1 + strategy_returns)
        running_max = np.maximum.accumulate(cumulative_returns)
        drawdown = (running_max - cumulative_returns) / running_max
        max_drawdown = np.max(drawdown) if len(drawdown) > 0 else 0.0

        metrics = {
            'mse': float(mse),
            'rmse': float(rmse),
            'mae': float(mae),
            'directional_accuracy': float(directional_accuracy),
            'sharpe_ratio': float(sharpe_ratio),
            'max_drawdown': float(max_drawdown)
        }

        logger.info(f"✅ Evaluation complete:")
        logger.info(f"   RMSE: {rmse:.6f}")
        logger.info(f"   MAE: {mae:.6f}")
        logger.info(f"   Directional Accuracy: {directional_accuracy:.4f} ({directional_accuracy*100:.2f}%)")
        logger.info(f"   Sharpe Ratio: {sharpe_ratio:.4f}")
        logger.info(f"   Max Drawdown: {max_drawdown:.4f} ({max_drawdown*100:.2f}%)")

        return metrics

    def save_model(self, filepath: str, save_history: bool = True):
        """
        Save the trained model

        Args:
            filepath: Path to save the model
            save_history: Whether to save training history
        """
        if self.model is None:
            raise ValueError("No model to save")

        # Save model
        self.model.save(filepath)
        logger.info(f"✅ Model saved to {filepath}")

        # Save training history
        if save_history and self.history is not None:
            history_path = filepath.replace('.h5', '_history.json')
            with open(history_path, 'w') as f:
                # Convert numpy types to Python types
                history_serializable = {
                    k: [float(v) for v in vals]
                    for k, vals in self.history.items()
                }
                json.dump(history_serializable, f, indent=2)
            logger.info(f"✅ Training history saved to {history_path}")

    def load_model(self, filepath: str):
        """
        Load a trained model

        Args:
            filepath: Path to the saved model
        """
        # Load with custom objects (for DirectionalAccuracyMetric)
        self.model = load_model(
            filepath,
            custom_objects={'DirectionalAccuracyMetric': DirectionalAccuracyMetric}
        )
        logger.info(f"✅ Model loaded from {filepath}")

    def summary(self):
        """Print model architecture summary"""
        if self.model is None:
            logger.warning("No model to summarize")
            return

        self.model.summary()
