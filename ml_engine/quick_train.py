#!/usr/bin/env python3
"""
Quick Training Script for LSTM Model
Uses pre-processed data from data/training/
"""

import os
import sys
import yaml
import numpy as np
from pathlib import Path
from datetime import datetime
import joblib

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

# Fix for libgomp
import ctypes
try:
    ctypes.CDLL('/usr/lib/aarch64-linux-gnu/libgomp.so.1', mode=ctypes.RTLD_GLOBAL)
except:
    pass

# Suppress TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from sklearn.preprocessing import MinMaxScaler

# Import our classes
from data_processing.preprocessor import DataPreprocessor
from models.price_predictor import PricePredictor

print("=" * 80)
print("Quick LSTM Model Training")
print("=" * 80)
print(f"TensorFlow: {tf.__version__}")
print(f"Keras: {tf.keras.__version__}")
print()

# Load config
with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

# Select pair and load data
PAIR = 'EURUSD'
data_dir = Path('./data/training')

print(f"📁 Loading {PAIR} training data...")
X_train = np.load(data_dir / f'{PAIR}_X_train.npy')
y_train = np.load(data_dir / f'{PAIR}_y_train.npy')
X_test = np.load(data_dir / f'{PAIR}_X_test.npy')
y_test = np.load(data_dir / f'{PAIR}_y_test.npy')

print(f"✅ Data loaded:")
print(f"  X_train: {X_train.shape}")
print(f"  y_train: {y_train.shape}")
print(f"  X_test: {X_test.shape}")
print(f"  y_test: {y_test.shape}")
print()

# Build model
print("🔨 Building LSTM model...")
input_shape = (X_train.shape[1], X_train.shape[2])
print(f"  Input shape: {input_shape}")

model = Sequential([
    # LSTM layers
    LSTM(128, return_sequences=True, input_shape=input_shape,
         dropout=0.2, recurrent_dropout=0.1, name='lstm_1'),
    LSTM(64, return_sequences=True, dropout=0.2, recurrent_dropout=0.1, name='lstm_2'),
    LSTM(32, return_sequences=False, dropout=0.2, recurrent_dropout=0.1, name='lstm_3'),

    # Dense layers
    Dense(16, activation='relu', name='dense_1'),
    Dropout(0.2, name='dropout_1'),
    Dense(8, activation='relu', name='dense_2'),
    Dropout(0.2, name='dropout_2'),

    # Output
    Dense(1, activation='linear', name='output')
], name='forex_price_predictor')

# Compile
model.compile(
    optimizer=Adam(learning_rate=0.001),
    loss='mean_squared_error',
    metrics=['mae', 'mse']
)

print("✅ Model built successfully")
print(f"  Total parameters: {model.count_params():,}")
print()

# Print summary
model.summary()
print()

# Setup callbacks
print("⚙️ Setting up training callbacks...")
checkpoint_dir = Path('./checkpoints')
checkpoint_dir.mkdir(exist_ok=True)

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
checkpoint_path = checkpoint_dir / f'model_checkpoint_{timestamp}.h5'

callbacks = [
    EarlyStopping(
        monitor='val_loss',
        patience=10,
        restore_best_weights=True,
        verbose=1
    ),
    ModelCheckpoint(
        str(checkpoint_path),
        monitor='val_loss',
        save_best_only=True,
        verbose=1
    ),
    ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=5,
        min_lr=1e-7,
        verbose=1
    )
]

print("✅ Callbacks configured")
print()

# Train
print("🚀 Starting training...")
print(f"  Epochs: 50 (with early stopping)")
print(f"  Batch size: 32")
print(f"  Validation split: 0.2")
print()

history = model.fit(
    X_train, y_train,
    validation_split=0.2,
    epochs=50,
    batch_size=32,
    callbacks=callbacks,
    verbose=1
)

print()
print("=" * 80)
print("Training Completed!")
print("=" * 80)

# Evaluate
print("\n📊 Evaluating model on test set...")
test_loss, test_mae, test_mse = model.evaluate(X_test, y_test, verbose=0)
print(f"  Test Loss (MSE): {test_loss:.6f}")
print(f"  Test MAE: {test_mae:.6f}")
print(f"  Test RMSE: {np.sqrt(test_mse):.6f}")

# Save final model
model_dir = Path('./saved_models')
model_dir.mkdir(exist_ok=True)

version = config.get('model', {}).get('version', '1.0.0')
model_name = f"price_predictor_v{version}_{timestamp}.h5"
model_path = model_dir / model_name

print(f"\n💾 Saving model to {model_path}...")
model.save(str(model_path))
print(f"✅ Model saved successfully!")
print(f"📊 File size: {model_path.stat().st_size / 1024 / 1024:.2f} MB")

# Load and save scaler
# The training data was scaled using scaler_yfinance.pkl during data preparation
# We need to copy that scaler to work with this model
print(f"\n💾 Loading and saving scaler...")
source_scaler = Path('./data/processed/scaler_yfinance.pkl')
scaler_path = str(model_path).replace('.h5', '_scaler.pkl')

if source_scaler.exists():
    # Load the original scaler used for data preparation
    scaler_data = joblib.load(source_scaler)
    print(f"✅ Loaded scaler from {source_scaler.name}")

    # Save it with the model
    joblib.dump(scaler_data, scaler_path)
    print(f"✅ Scaler saved to {Path(scaler_path).name}")
    print(f"   Scaler type: {scaler_data.get('scaler_type', 'unknown')}")
    print(f"   Feature range: {scaler_data.get('feature_range', 'unknown')}")
else:
    # Fallback: create a new scaler fitted on the training data
    print(f"⚠️ Original scaler not found at {source_scaler}")
    print(f"   Creating new scaler fitted on training data...")
    scaler_data = {
        'feature_scaler': MinMaxScaler(feature_range=(0, 1)),
        'target_scaler': MinMaxScaler(feature_range=(0, 1)),
        'scaler_type': 'minmax',
        'feature_range': [0, 1]
    }
    scaler_data['feature_scaler'].fit(X_train.reshape(-1, X_train.shape[-1]))
    scaler_data['target_scaler'].fit(y_train.reshape(-1, 1))
    joblib.dump(scaler_data, scaler_path)
    print(f"✅ New scaler saved to {Path(scaler_path).name}")

# Save metadata
import json
metadata = {
    "pair": PAIR,
    "version": version,
    "timestamp": timestamp,
    "tensorflow_version": tf.__version__,
    "keras_version": tf.keras.__version__,
    "input_shape": list(input_shape),
    "output_shape": [1],
    "total_parameters": int(model.count_params()),
    "training_samples": int(X_train.shape[0]),
    "test_samples": int(X_test.shape[0]),
    "test_loss": float(test_loss),
    "test_mae": float(test_mae),
    "test_rmse": float(np.sqrt(test_mse)),
    "epochs_completed": len(history.history['loss']),
    "final_train_loss": float(history.history['loss'][-1]),
    "final_val_loss": float(history.history.get('val_loss', [0])[-1]),
    "scaler_path": Path(scaler_path).name,
    "scaler_type": "minmax",
    "feature_range": [0, 1]
}

metadata_path = model_path.parent / f"{model_path.stem}_metadata.json"
with open(metadata_path, 'w') as f:
    json.dump(metadata, f, indent=2)
print(f"✅ Metadata saved to {metadata_path.name}")

# Test loading
print("\n🧪 Testing model loading...")
try:
    loaded_model = tf.keras.models.load_model(str(model_path))
    print("✅ Model loads successfully!")

    # Test prediction
    test_input = X_test[:1]
    prediction = loaded_model.predict(test_input, verbose=0)
    print(f"✅ Test prediction: {prediction[0][0]:.6f}")
    print(f"   Actual value: {y_test[0]:.6f}")

except Exception as e:
    print(f"❌ Error loading model: {e}")

print("\n" + "=" * 80)
print("✅ ALL DONE!")
print("=" * 80)
print(f"\n📁 Model file: {model_path}")
print(f"📁 Metadata: {metadata_path}")
print(f"📁 Best checkpoint: {checkpoint_path}")
print("\nNext steps:")
print("1. Restart ML Engine service")
print("2. Test /predict endpoint")
print()
