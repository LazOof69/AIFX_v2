"""
Price Predictor Module for AIFX_v2 ML Engine
Implements LSTM-based price prediction model
"""

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from tensorflow.keras.optimizers import Adam
from sklearn.utils.class_weight import compute_class_weight
from typing import Dict, Tuple, Optional, List
import logging
import os
from datetime import datetime, timezone, timedelta
import json

logger = logging.getLogger(__name__)

# GMT+8 timezone
GMT_PLUS_8 = timezone(timedelta(hours=8))


class PricePredictor:
    """
    LSTM-based forex price prediction model
    """

    def __init__(self, config: Dict):
        """
        Initialize the price predictor

        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.model = None
        self.history = None
        self.model_version = config.get('model', {}).get('version', '1.0.0')
        self.model_dir = config.get('model', {}).get('model_dir', './saved_models')
        self.checkpoint_dir = config.get('model', {}).get('checkpoint_dir', './checkpoints')

        # Create directories if they don't exist
        os.makedirs(self.model_dir, exist_ok=True)
        os.makedirs(self.checkpoint_dir, exist_ok=True)

        logger.info(f"PricePredictor initialized with version {self.model_version}")

    def build_model(self, input_shape: Tuple[int, int]) -> Sequential:
        """
        Build LSTM model architecture

        Args:
            input_shape: Shape of input data (sequence_length, n_features)

        Returns:
            Compiled Keras Sequential model
        """
        logger.info(f"Building LSTM model with input shape: {input_shape}")

        model = Sequential()

        # Get LSTM configuration
        lstm_config = self.config.get('model', {}).get('lstm', {})
        lstm_units = lstm_config.get('units', [128, 64, 32])
        dropout = lstm_config.get('dropout', 0.2)
        recurrent_dropout = lstm_config.get('recurrent_dropout', 0.1)

        # First LSTM layer
        model.add(LSTM(
            units=lstm_units[0],
            return_sequences=True,
            input_shape=input_shape,
            dropout=dropout,
            recurrent_dropout=recurrent_dropout
        ))

        # Additional LSTM layers
        for i, units in enumerate(lstm_units[1:], 1):
            return_sequences = i < len(lstm_units) - 1
            model.add(LSTM(
                units=units,
                return_sequences=return_sequences,
                dropout=dropout,
                recurrent_dropout=recurrent_dropout
            ))

        # Dense layers
        dense_config = self.config.get('model', {}).get('dense', {})
        dense_units = dense_config.get('units', [16, 8])
        dense_activation = dense_config.get('activation', 'relu')
        dense_dropout = dense_config.get('dropout', 0.2)

        for units in dense_units:
            model.add(Dense(units, activation=dense_activation))
            model.add(Dropout(dense_dropout))

        # Output layer
        output_config = self.config.get('model', {}).get('output', {})
        output_units = output_config.get('units', 1)
        output_activation = output_config.get('activation', 'linear')

        model.add(Dense(output_units, activation=output_activation))

        # Compile model
        training_config = self.config.get('model', {}).get('training', {})
        learning_rate = training_config.get('learning_rate', 0.001)
        optimizer_name = training_config.get('optimizer', 'adam')
        loss = training_config.get('loss', 'mean_squared_error')
        metrics = training_config.get('metrics', ['mae', 'mse'])

        if optimizer_name.lower() == 'adam':
            optimizer = Adam(learning_rate=learning_rate)
        else:
            optimizer = optimizer_name

        model.compile(
            optimizer=optimizer,
            loss=loss,
            metrics=metrics
        )

        self.model = model
        logger.info(f"Model built successfully with {model.count_params()} parameters")

        return model

    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
        verbose: int = 1
    ) -> Dict:
        """
        Train the LSTM model

        Args:
            X_train: Training features
            y_train: Training targets
            X_val: Validation features (optional)
            y_val: Validation targets (optional)
            verbose: Verbosity level

        Returns:
            Training history dictionary
        """
        logger.info(f"Starting model training with data shape: {X_train.shape}")

        # Build model if not already built
        if self.model is None:
            input_shape = (X_train.shape[1], X_train.shape[2])
            self.build_model(input_shape)

        # Get training configuration
        training_config = self.config.get('model', {}).get('training', {})
        epochs = training_config.get('epochs', 100)
        batch_size = training_config.get('batch_size', 32)
        validation_split = training_config.get('validation_split', 0.2)
        early_stopping_patience = training_config.get('early_stopping_patience', 10)

        # Prepare callbacks
        callbacks = self._get_callbacks(early_stopping_patience)

        # Prepare validation data
        if X_val is not None and y_val is not None:
            validation_data = (X_val, y_val)
            validation_split = 0.0
        else:
            validation_data = None

        # Calculate class weights to handle imbalanced data
        unique_classes = np.unique(y_train)
        class_weights = compute_class_weight(
            class_weight='balanced',
            classes=unique_classes,
            y=y_train
        )
        class_weight_dict = dict(enumerate(class_weights))
        logger.info(f"Class weights: {class_weight_dict}")

        # Train the model
        history = self.model.fit(
            X_train,
            y_train,
            epochs=epochs,
            batch_size=batch_size,
            validation_split=validation_split,
            validation_data=validation_data,
            callbacks=callbacks,
            class_weight=class_weight_dict,
            verbose=verbose
        )

        self.history = history.history

        # Log training results
        final_loss = history.history['loss'][-1]
        final_val_loss = history.history.get('val_loss', [0])[-1]
        logger.info(f"Training completed. Final loss: {final_loss:.6f}, Val loss: {final_val_loss:.6f}")

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
            verbose=1
        )
        callbacks.append(early_stop)

        # Model checkpoint
        checkpoint_path = os.path.join(
            self.checkpoint_dir,
            f'model_checkpoint_{datetime.now().strftime("%Y%m%d_%H%M%S")}.h5'
        )
        checkpoint = ModelCheckpoint(
            checkpoint_path,
            monitor='val_loss',
            save_best_only=True,
            verbose=1
        )
        callbacks.append(checkpoint)

        # Reduce learning rate on plateau
        reduce_lr = ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=patience // 2,
            min_lr=1e-7,
            verbose=1
        )
        callbacks.append(reduce_lr)

        return callbacks

    def predict(
        self,
        X: np.ndarray,
        return_confidence: bool = True
    ) -> Dict:
        """
        Make predictions using the trained model

        Args:
            X: Input features
            return_confidence: Whether to calculate confidence score

        Returns:
            Dictionary with prediction results following claude.md format
        """
        if self.model is None:
            raise ValueError("Model has not been trained or loaded")

        logger.info(f"Making prediction for data shape: {X.shape}")

        # Make prediction
        prediction = self.model.predict(X, verbose=0)
        predicted_price = float(prediction[0][0])

        # Calculate confidence score
        if return_confidence:
            confidence = self._calculate_confidence(X, prediction)
        else:
            confidence = 0.5

        # Determine prediction signal
        signal = self._determine_signal(predicted_price, confidence)

        # Calculate factors (placeholder for now, can be enhanced with additional models)
        factors = {
            "technical": confidence,
            "sentiment": 0.5,  # Placeholder for sentiment analysis
            "pattern": 0.5  # Placeholder for pattern recognition
        }

        # Build response following claude.md ML Model Integration format
        result = {
            "prediction": signal,
            "confidence": float(f"{confidence:.2f}"),
            "predicted_price": float(f"{predicted_price:.5f}"),
            "factors": factors,
            "timestamp": datetime.now(GMT_PLUS_8).isoformat()
        }

        logger.info(f"Prediction: {signal} with confidence {confidence:.2f}")

        return result

    def _calculate_confidence(self, X: np.ndarray, prediction: np.ndarray) -> float:
        """
        Calculate prediction confidence score

        Args:
            X: Input features
            prediction: Model prediction

        Returns:
            Confidence score between 0 and 1
        """
        # Simple confidence calculation based on prediction variance
        # Can be enhanced with ensemble methods or prediction intervals

        # Make multiple predictions with dropout enabled (Monte Carlo dropout)
        n_iterations = 10
        predictions = []

        for _ in range(n_iterations):
            pred = self.model.predict(X, verbose=0)
            predictions.append(pred[0][0])

        predictions = np.array(predictions)
        mean_pred = np.mean(predictions)
        std_pred = np.std(predictions)

        # Lower std means higher confidence
        # Normalize to 0-1 range
        confidence = 1.0 / (1.0 + std_pred * 100)

        # Ensure confidence is between 0 and 1
        confidence = np.clip(confidence, 0.0, 1.0)

        return float(confidence)

    def _determine_signal(self, predicted_price: float, confidence: float) -> str:
        """
        Determine trading signal from predicted price

        Args:
            predicted_price: Predicted price value
            confidence: Confidence score

        Returns:
            Trading signal: 'buy', 'sell', or 'hold'
        """
        signal_threshold = self.config.get('prediction', {}).get('signal_threshold', 0.02)
        min_confidence = self.config.get('prediction', {}).get('confidence', {}).get('low', 0.5)

        # If confidence is too low, return hold
        if confidence < min_confidence:
            return 'hold'

        # This is a simplified signal generation
        # In practice, you would compare with current price
        # For now, we use a simple threshold
        if predicted_price > 0:
            return 'buy'
        elif predicted_price < 0:
            return 'sell'
        else:
            return 'hold'

    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict:
        """
        Evaluate model performance

        Args:
            X_test: Test features
            y_test: Test targets

        Returns:
            Dictionary with evaluation metrics
        """
        if self.model is None:
            raise ValueError("Model has not been trained or loaded")

        logger.info(f"Evaluating model on test data: {X_test.shape}")

        # Get predictions
        y_pred = self.model.predict(X_test, verbose=0)

        # Calculate metrics
        mse = np.mean((y_test - y_pred.flatten()) ** 2)
        mae = np.mean(np.abs(y_test - y_pred.flatten()))
        rmse = np.sqrt(mse)

        # Calculate directional accuracy (up/down prediction)
        if len(y_test) > 1:
            y_test_direction = np.diff(y_test) > 0
            y_pred_direction = np.diff(y_pred.flatten()) > 0
            directional_accuracy = np.mean(y_test_direction == y_pred_direction)
        else:
            directional_accuracy = 0.0

        metrics = {
            "mse": float(f"{mse:.6f}"),
            "mae": float(f"{mae:.6f}"),
            "rmse": float(f"{rmse:.6f}"),
            "directional_accuracy": float(f"{directional_accuracy:.4f}")
        }

        logger.info(f"Evaluation metrics: {metrics}")

        return metrics

    def save_model(self, filepath: Optional[str] = None, preprocessor = None) -> str:
        """
        Save the trained model and fitted scaler

        Args:
            filepath: Path to save the model (optional)
            preprocessor: DataPreprocessor instance with fitted scaler (optional)

        Returns:
            Path where model was saved
        """
        if self.model is None:
            raise ValueError("No model to save")

        if filepath is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filepath = os.path.join(
                self.model_dir,
                f"price_predictor_v{self.model_version}_{timestamp}.h5"
            )

        self.model.save(filepath)
        logger.info(f"Model saved to {filepath}")

        # Save model metadata
        metadata = {
            "version": self.model_version,
            "saved_at": datetime.now(GMT_PLUS_8).isoformat(),
            "input_shape": self.model.input_shape,
            "output_shape": self.model.output_shape,
            "total_params": self.model.count_params()
        }

        metadata_path = filepath.replace('.h5', '_metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"Model metadata saved to {metadata_path}")

        # Save fitted scaler if preprocessor is provided
        if preprocessor is not None:
            scaler_path = filepath.replace('.h5', '_scaler.pkl')
            try:
                preprocessor.save_scaler(scaler_path)
                logger.info(f"Scaler saved to {scaler_path}")
            except Exception as e:
                logger.warning(f"Failed to save scaler: {e}")

        return filepath

    def load_model(self, filepath: str, preprocessor = None) -> None:
        """
        Load a saved model and fitted scaler

        Args:
            filepath: Path to the saved model
            preprocessor: DataPreprocessor instance to load scaler into (optional)
        """
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Model file not found: {filepath}")

        self.model = load_model(filepath)
        logger.info(f"Model loaded from {filepath}")

        # Load metadata if available
        metadata_path = filepath.replace('.h5', '_metadata.json')
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
            logger.info(f"Model metadata: {metadata}")

        # Load fitted scaler if available and preprocessor is provided
        if preprocessor is not None:
            scaler_path = filepath.replace('.h5', '_scaler.pkl')
            if os.path.exists(scaler_path):
                try:
                    preprocessor.load_scaler(scaler_path)
                    logger.info(f"Scaler loaded from {scaler_path}")
                except Exception as e:
                    logger.warning(f"Failed to load scaler: {e}")
            else:
                logger.warning(f"Scaler file not found: {scaler_path}")

    def get_latest_model_path(self) -> Optional[str]:
        """
        Get the path to the latest saved model

        Returns:
            Path to latest model or None if no models found
        """
        if not os.path.exists(self.model_dir):
            return None

        model_files = [
            f for f in os.listdir(self.model_dir)
            if f.endswith('.h5') and (f.startswith('price_predictor') or f.startswith('forex_classifier'))
        ]

        if not model_files:
            return None

        # Sort by timestamp in filename
        model_files.sort(reverse=True)
        latest_model = os.path.join(self.model_dir, model_files[0])

        return latest_model