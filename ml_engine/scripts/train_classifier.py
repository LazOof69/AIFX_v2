#!/usr/bin/env python3
"""
LSTM Classifier Training Script for AIFX v2

Trains an LSTM model for forex trading signal classification (buy/hold/sell)
using prepared training data.
"""

import os
import sys
import numpy as np
import json
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau, TensorBoard
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.utils import to_categorical
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

print(f"TensorFlow version: {tf.__version__}")
print(f"GPU available: {tf.config.list_physical_devices('GPU')}")

class ForexClassifier:
    """LSTM-based forex signal classifier"""

    def __init__(self, data_dir='data/training', model_dir='saved_models'):
        self.data_dir = Path(data_dir)
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)

        self.model = None
        self.history = None
        self.pair = None
        self.metadata = None

    def load_training_data(self, pair='EURUSD'):
        """
        Load training data from NumPy files

        Args:
            pair: Currency pair name (e.g., 'EURUSD')

        Returns:
            Tuple of (X_train, y_train, X_test, y_test, metadata)
        """
        print(f"\nLoading training data for {pair}...")

        # Load data
        X_train = np.load(self.data_dir / f'{pair}_X_train.npy')
        y_train = np.load(self.data_dir / f'{pair}_y_train.npy')
        X_test = np.load(self.data_dir / f'{pair}_X_test.npy')
        y_test = np.load(self.data_dir / f'{pair}_y_test.npy')

        # Load metadata
        metadata_file = self.data_dir / f'{pair}_metadata.json'
        if metadata_file.exists():
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
        else:
            metadata = {}

        print(f"✓ Data loaded successfully")
        print(f"  - X_train: {X_train.shape}")
        print(f"  - y_train: {y_train.shape}")
        print(f"  - X_test: {X_test.shape}")
        print(f"  - y_test: {y_test.shape}")
        print(f"  - Features: {metadata.get('n_features', 'unknown')}")
        print(f"  - Sequence length: {metadata.get('sequence_length', 'unknown')}")

        # Check label distribution
        unique, counts = np.unique(y_train, return_counts=True)
        print(f"\nLabel distribution (training):")
        for label, count in zip(unique, counts):
            label_name = ['Sell', 'Hold', 'Buy'][int(label)]
            print(f"  - {label_name} ({label}): {count} ({count/len(y_train)*100:.1f}%)")

        self.pair = pair
        self.metadata = metadata

        return X_train, y_train, X_test, y_test, metadata

    def build_model(self, input_shape, num_classes=3):
        """
        Build LSTM classification model

        Args:
            input_shape: Tuple of (sequence_length, n_features)
            num_classes: Number of output classes (default: 3 for buy/hold/sell)

        Returns:
            Compiled Keras model
        """
        print(f"\nBuilding LSTM classifier...")
        print(f"  - Input shape: {input_shape}")
        print(f"  - Output classes: {num_classes}")

        model = Sequential([
            # First LSTM layer
            LSTM(128, return_sequences=True, input_shape=input_shape,
                 dropout=0.2, recurrent_dropout=0.1),
            BatchNormalization(),

            # Second LSTM layer
            LSTM(64, return_sequences=True,
                 dropout=0.2, recurrent_dropout=0.1),
            BatchNormalization(),

            # Third LSTM layer
            LSTM(32, return_sequences=False,
                 dropout=0.2, recurrent_dropout=0.1),
            BatchNormalization(),

            # Dense layers
            Dense(64, activation='relu'),
            Dropout(0.3),

            Dense(32, activation='relu'),
            Dropout(0.3),

            # Output layer (3 classes: sell, hold, buy)
            Dense(num_classes, activation='softmax')
        ])

        # Compile model
        model.compile(
            optimizer=Adam(learning_rate=0.001),
            loss='sparse_categorical_crossentropy',  # Use sparse for integer labels
            metrics=['accuracy', tf.keras.metrics.SparseCategoricalAccuracy()]
        )

        print(f"\n{model.summary()}")
        print(f"\n✓ Model built successfully")
        print(f"  - Total parameters: {model.count_params():,}")

        self.model = model
        return model

    def train(self, X_train, y_train, X_test, y_test, epochs=50, batch_size=32):
        """
        Train the model

        Args:
            X_train: Training features
            y_train: Training labels
            X_test: Test features
            y_test: Test labels
            epochs: Number of training epochs
            batch_size: Batch size

        Returns:
            Training history
        """
        print(f"\nStarting training...")
        print(f"  - Epochs: {epochs}")
        print(f"  - Batch size: {batch_size}")

        # Callbacks
        callbacks = [
            # Early stopping
            EarlyStopping(
                monitor='val_loss',
                patience=10,
                restore_best_weights=True,
                verbose=1
            ),

            # Model checkpoint
            ModelCheckpoint(
                str(self.model_dir / 'best_model_checkpoint.h5'),
                monitor='val_accuracy',
                save_best_only=True,
                verbose=1
            ),

            # Reduce learning rate
            ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=5,
                min_lr=1e-7,
                verbose=1
            ),

            # TensorBoard
            TensorBoard(
                log_dir=f'logs/{datetime.now().strftime("%Y%m%d_%H%M%S")}',
                histogram_freq=1
            )
        ]

        # Train
        history = self.model.fit(
            X_train, y_train,
            validation_data=(X_test, y_test),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1
        )

        self.history = history.history

        # Log final results
        final_loss = history.history['loss'][-1]
        final_acc = history.history['accuracy'][-1]
        final_val_loss = history.history['val_loss'][-1]
        final_val_acc = history.history['val_accuracy'][-1]

        print(f"\n{'='*60}")
        print(f"Training Complete!")
        print(f"{'='*60}")
        print(f"  - Final training loss: {final_loss:.4f}")
        print(f"  - Final training accuracy: {final_acc:.4f}")
        print(f"  - Final validation loss: {final_val_loss:.4f}")
        print(f"  - Final validation accuracy: {final_val_acc:.4f}")

        return history

    def evaluate(self, X_test, y_test):
        """
        Evaluate model performance

        Args:
            X_test: Test features
            y_test: Test labels

        Returns:
            Dictionary with evaluation metrics
        """
        print(f"\n{'='*60}")
        print(f"Evaluating Model Performance")
        print(f"{'='*60}")

        # Get predictions
        y_pred_probs = self.model.predict(X_test, verbose=0)
        y_pred = np.argmax(y_pred_probs, axis=1)

        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred)
        print(f"\nAccuracy: {accuracy:.4f}")

        # Classification report
        class_names = ['Sell', 'Hold', 'Buy']
        print(f"\nClassification Report:")
        print(classification_report(y_test, y_pred, target_names=class_names))

        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        print(f"\nConfusion Matrix:")
        print(f"{'':>8} {'Sell':>8} {'Hold':>8} {'Buy':>8}")
        for i, row in enumerate(cm):
            print(f"{class_names[i]:>8} {row[0]:>8} {row[1]:>8} {row[2]:>8}")

        # Calculate per-class accuracy
        per_class_accuracy = cm.diagonal() / cm.sum(axis=1)
        print(f"\nPer-class Accuracy:")
        for i, acc in enumerate(per_class_accuracy):
            print(f"  - {class_names[i]}: {acc:.4f}")

        metrics = {
            'accuracy': float(accuracy),
            'per_class_accuracy': {
                'sell': float(per_class_accuracy[0]),
                'hold': float(per_class_accuracy[1]),
                'buy': float(per_class_accuracy[2])
            },
            'confusion_matrix': cm.tolist()
        }

        return metrics

    def save_model(self, filename=None):
        """
        Save the trained model

        Args:
            filename: Custom filename (optional)

        Returns:
            Path to saved model
        """
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"forex_classifier_{self.pair}_{timestamp}.h5"

        filepath = self.model_dir / filename
        self.model.save(filepath)
        print(f"\n✓ Model saved to: {filepath}")

        # Save metadata
        metadata = {
            'pair': self.pair,
            'saved_at': datetime.now().isoformat(),
            'input_shape': str(self.model.input_shape),
            'output_shape': str(self.model.output_shape),
            'total_params': int(self.model.count_params()),
            'training_metadata': self.metadata,
            'final_accuracy': float(self.history['accuracy'][-1]) if self.history else None,
            'final_val_accuracy': float(self.history['val_accuracy'][-1]) if self.history else None
        }

        metadata_path = str(filepath).replace('.h5', '_metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        print(f"✓ Metadata saved to: {metadata_path}")

        return str(filepath)


def main():
    """Main training pipeline"""
    print("="*70)
    print("AIFX v2 LSTM Classifier Training")
    print("="*70)

    # Initialize classifier
    classifier = ForexClassifier(
        data_dir='/root/AIFX_v2/ml_engine/data/training',
        model_dir='/root/AIFX_v2/ml_engine/saved_models'
    )

    # Currency pairs to train
    pairs = ['EURUSD', 'GBPUSD', 'USDJPY']

    for pair in pairs:
        print(f"\n\n{'#'*70}")
        print(f"# Training {pair} Classifier")
        print(f"{'#'*70}")

        try:
            # Load data
            X_train, y_train, X_test, y_test, metadata = classifier.load_training_data(pair)

            # Build model
            input_shape = (X_train.shape[1], X_train.shape[2])
            classifier.build_model(input_shape, num_classes=3)

            # Train model
            history = classifier.train(
                X_train, y_train,
                X_test, y_test,
                epochs=50,
                batch_size=32
            )

            # Evaluate model
            metrics = classifier.evaluate(X_test, y_test)

            # Save model
            model_path = classifier.save_model()

            print(f"\n✓ {pair} training complete!")
            print(f"  - Model saved: {model_path}")
            print(f"  - Accuracy: {metrics['accuracy']:.4f}")

        except Exception as e:
            print(f"\n✗ Error training {pair}: {str(e)}")
            import traceback
            traceback.print_exc()
            continue

    print(f"\n\n{'='*70}")
    print("All Training Complete!")
    print(f"{'='*70}")
    print(f"\nModels saved in: /root/AIFX_v2/ml_engine/saved_models/")


if __name__ == '__main__':
    main()
