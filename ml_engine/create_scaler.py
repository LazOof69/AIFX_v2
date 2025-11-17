#!/usr/bin/env python3
"""
Create scaler for the trained model
"""
import os
import sys
import numpy as np
from pathlib import Path
import joblib
from sklearn.preprocessing import MinMaxScaler

# Load training data
data_dir = Path('./data/training')
X_train = np.load(data_dir / 'EURUSD_X_train.npy')
y_train = np.load(data_dir / 'EURUSD_y_train.npy')

print(f"X_train shape: {X_train.shape}")
print(f"y_train shape: {y_train.shape}")

# Create scalers
feature_scaler = MinMaxScaler(feature_range=(0, 1))
target_scaler = MinMaxScaler(feature_range=(0, 1))

# Fit scalers on the training data
# X_train shape is (samples, timesteps, features) -> reshape for fitting
X_train_reshaped = X_train.reshape(-1, X_train.shape[-1])
feature_scaler.fit(X_train_reshaped)

# y_train shape is (samples,) -> reshape to 2D
y_train_reshaped = y_train.reshape(-1, 1)
target_scaler.fit(y_train_reshaped)

print(f"\nFeature scaler fitted:")
print(f"  Data shape: {X_train_reshaped.shape}")
print(f"  Data min: {feature_scaler.data_min_[:5]}")  # Show first 5
print(f"  Data max: {feature_scaler.data_max_[:5]}")

print(f"\nTarget scaler fitted:")
print(f"  Data shape: {y_train_reshaped.shape}")
print(f"  Data min: {target_scaler.data_min_}")
print(f"  Data max: {target_scaler.data_max_}")

# Create scaler data structure
scaler_data = {
    'feature_scaler': feature_scaler,
    'target_scaler': target_scaler,
    'scaler_type': 'minmax',
    'feature_range': [0, 1]
}

# Save scaler
model_path = Path('./saved_models/price_predictor_v1.0.0_20251117_105508.h5')
scaler_path = str(model_path).replace('.h5', '_scaler.pkl')

joblib.dump(scaler_data, scaler_path)
print(f"\n✅ Scaler saved to {scaler_path}")

# Test loading
loaded_scaler_data = joblib.load(scaler_path)
print(f"✅ Scaler loaded successfully!")
print(f"   Scaler type: {loaded_scaler_data.get('scaler_type')}")
print(f"   Feature range: {loaded_scaler_data.get('feature_range')}")

# Save metadata
import json
metadata = {
    "pair": "EURUSD",
    "version": "1.0.0",
    "timestamp": "20251117_105508",
    "tensorflow_version": "2.12.0",
    "keras_version": "2.12.0",
    "input_shape": [60, 28],
    "output_shape": [1],
    "total_parameters": 142881,
    "training_samples": X_train.shape[0],
    "test_loss": 0.797320,
    "test_mae": 0.799674,
    "test_rmse": 0.892928,
    "scaler_path": Path(scaler_path).name,
    "scaler_type": "minmax",
    "feature_range": [0, 1]
}

metadata_path = model_path.parent / f"{model_path.stem}_metadata.json"
with open(metadata_path, 'w') as f:
    json.dump(metadata, f, indent=2)
print(f"✅ Metadata saved to {metadata_path}")
