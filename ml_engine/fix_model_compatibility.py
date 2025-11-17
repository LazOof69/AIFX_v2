#!/usr/bin/env python3
"""
Model Compatibility Fix Script
Converts old Keras models with 'batch_shape' to new format
"""

import os
import sys
import yaml
import numpy as np
from pathlib import Path

# Fix for libgomp static TLS block error on ARM64
import ctypes
try:
    ctypes.CDLL('/usr/lib/aarch64-linux-gnu/libgomp.so.1', mode=ctypes.RTLD_GLOBAL)
except Exception:
    pass

# Suppress TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.models import load_model, Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam

print("=" * 80)
print("ML Model Compatibility Fix Script")
print("=" * 80)
print(f"TensorFlow version: {tf.__version__}")
print(f"Keras version: {keras.__version__}")
print()

# Load configuration
config_path = Path(__file__).parent / 'config.yaml'
with open(config_path, 'r') as f:
    config = yaml.safe_load(f)

model_dir = Path('./saved_models')
latest_model_path = None

# Find the latest model
model_files = sorted(
    [f for f in model_dir.glob('price_predictor*.h5')],
    key=lambda x: x.stat().st_mtime,
    reverse=True
)

if not model_files:
    print("❌ No model files found in saved_models/")
    sys.exit(1)

latest_model_path = model_files[0]
print(f"📁 Latest model found: {latest_model_path}")
print(f"📊 File size: {latest_model_path.stat().st_size / 1024 / 1024:.2f} MB")
print()

# Try to load the model using different methods
print("🔄 Attempting to load model...")
print()

model = None
method_used = None

# Method 1: Try loading with compile=False
try:
    print("Method 1: Loading with compile=False...")
    model = load_model(latest_model_path, compile=False)
    method_used = "compile=False"
    print("✅ Successfully loaded with compile=False")
except Exception as e:
    print(f"❌ Method 1 failed: {e}")
    print()

# Method 2: Try with custom objects
if model is None:
    try:
        print("Method 2: Loading with custom_objects...")

        # Custom InputLayer that accepts batch_shape
        from tensorflow.keras.layers import InputLayer

        class CompatInputLayer(InputLayer):
            def __init__(self, batch_shape=None, input_shape=None, **kwargs):
                if batch_shape is not None and input_shape is None:
                    # Convert batch_shape to input_shape
                    input_shape = batch_shape[1:]
                super().__init__(input_shape=input_shape, **kwargs)

        custom_objects = {
            'InputLayer': CompatInputLayer
        }

        model = load_model(latest_model_path, custom_objects=custom_objects, compile=False)
        method_used = "custom_objects"
        print("✅ Successfully loaded with custom_objects")
    except Exception as e:
        print(f"❌ Method 2 failed: {e}")
        print()

# Method 3: Manual reconstruction
if model is None:
    print("Method 3: Manual model reconstruction...")
    print("⚠️ This method requires knowing the exact architecture")
    print("❌ Cannot proceed without a loadable model")
    sys.exit(1)

print()
print("=" * 80)
print("Model Information")
print("=" * 80)

# Print model summary
print("\n📋 Model Architecture:")
model.summary()

print("\n📊 Model Details:")
print(f"Input shape: {model.input_shape}")
print(f"Output shape: {model.output_shape}")
print(f"Total parameters: {model.count_params():,}")

# Get weights
print("\n🔧 Extracting weights...")
weights = model.get_weights()
print(f"Number of weight arrays: {len(weights)}")
print(f"Total weight size: {sum(w.size for w in weights):,} elements")

# Rebuild the model with new format
print("\n🔨 Rebuilding model in new format...")

# Get model configuration
lstm_config = config.get('model', {}).get('lstm', {})
dense_config = config.get('model', {}).get('dense', {})
output_config = config.get('model', {}).get('output', {})
training_config = config.get('model', {}).get('training', {})

# Extract input shape from original model
input_shape = model.input_shape[1:]  # Remove batch dimension
print(f"Input shape for new model: {input_shape}")

# Build new model
new_model = Sequential()

lstm_units = lstm_config.get('units', [128, 64, 32])
dropout = lstm_config.get('dropout', 0.2)
recurrent_dropout = lstm_config.get('recurrent_dropout', 0.1)

# First LSTM layer
new_model.add(LSTM(
    units=lstm_units[0],
    return_sequences=True,
    input_shape=input_shape,
    dropout=dropout,
    recurrent_dropout=recurrent_dropout,
    name='lstm_1'
))

# Additional LSTM layers
for i, units in enumerate(lstm_units[1:], 2):
    return_sequences = i < len(lstm_units)
    new_model.add(LSTM(
        units=units,
        return_sequences=return_sequences,
        dropout=dropout,
        recurrent_dropout=recurrent_dropout,
        name=f'lstm_{i}'
    ))

# Dense layers
dense_units = dense_config.get('units', [16, 8])
dense_activation = dense_config.get('activation', 'relu')
dense_dropout = dense_config.get('dropout', 0.2)

for i, units in enumerate(dense_units, 1):
    new_model.add(Dense(units, activation=dense_activation, name=f'dense_{i}'))
    new_model.add(Dropout(dense_dropout, name=f'dropout_{i}'))

# Output layer
output_units = output_config.get('units', 1)
output_activation = output_config.get('activation', 'linear')
new_model.add(Dense(output_units, activation=output_activation, name='output'))

print("✅ New model architecture created")

# Copy weights from old model to new model
print("\n📦 Transferring weights...")
try:
    new_model.set_weights(weights)
    print("✅ Weights transferred successfully")
except Exception as e:
    print(f"❌ Weight transfer failed: {e}")
    print("⚠️ Model architectures may not match exactly")
    sys.exit(1)

# Compile the new model
print("\n⚙️ Compiling new model...")
learning_rate = training_config.get('learning_rate', 0.001)
optimizer = Adam(learning_rate=learning_rate)
loss = training_config.get('loss', 'mean_squared_error')
metrics = training_config.get('metrics', ['mae', 'mse'])

new_model.compile(
    optimizer=optimizer,
    loss=loss,
    metrics=metrics
)
print("✅ Model compiled successfully")

# Print new model summary
print("\n📋 New Model Architecture:")
new_model.summary()

# Save the new model
print("\n💾 Saving fixed model...")
version = config.get('model', {}).get('version', '1.0.0')
timestamp = Path(latest_model_path).stem.split('_')[-1]

# Create backup of old model
backup_path = latest_model_path.parent / f"{latest_model_path.stem}_backup.h5"
if not backup_path.exists():
    print(f"📋 Creating backup: {backup_path.name}")
    import shutil
    shutil.copy2(latest_model_path, backup_path)

# Save new model with _fixed suffix
new_model_name = f"price_predictor_v{version}_fixed_{timestamp}.h5"
new_model_path = model_dir / new_model_name

new_model.save(new_model_path)
print(f"✅ New model saved: {new_model_path}")
print(f"📊 File size: {new_model_path.stat().st_size / 1024 / 1024:.2f} MB")

# Save metadata
metadata = {
    "original_model": str(latest_model_path),
    "conversion_method": method_used,
    "tensorflow_version": tf.__version__,
    "keras_version": keras.__version__,
    "input_shape": list(input_shape),
    "output_shape": list(model.output_shape[1:]),
    "total_parameters": int(new_model.count_params()),
    "created_at": __import__('datetime').datetime.now().isoformat()
}

import json
metadata_path = new_model_path.with_suffix('.json')
metadata_path = metadata_path.parent / f"{metadata_path.stem}_metadata.json"
with open(metadata_path, 'w') as f:
    json.dump(metadata, f, indent=2)
print(f"✅ Metadata saved: {metadata_path.name}")

# Test loading the new model
print("\n🧪 Testing new model loading...")
try:
    test_model = load_model(new_model_path)
    print("✅ New model loads successfully!")
    print(f"Input shape: {test_model.input_shape}")
    print(f"Output shape: {test_model.output_shape}")

    # Test prediction with dummy data
    print("\n🧪 Testing prediction with dummy data...")
    dummy_input = np.random.randn(1, *input_shape).astype(np.float32)
    prediction = test_model.predict(dummy_input, verbose=0)
    print(f"✅ Prediction successful!")
    print(f"Dummy prediction output: {prediction[0][0]:.6f}")

except Exception as e:
    print(f"❌ Test loading failed: {e}")
    sys.exit(1)

print("\n" + "=" * 80)
print("✅ MODEL CONVERSION COMPLETED SUCCESSFULLY!")
print("=" * 80)
print(f"\n📁 Original model: {latest_model_path.name}")
print(f"📁 Fixed model: {new_model_path.name}")
print(f"📁 Backup: {backup_path.name}")
print(f"📁 Metadata: {metadata_path.name}")
print()
print("Next steps:")
print("1. Restart ML Engine service to use the fixed model")
print("2. Test /predict endpoint")
print("3. Verify predictions are working correctly")
print()
