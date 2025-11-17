#!/usr/bin/env python3
"""
Test model loading with new scaler
"""
import os
import sys
import yaml
from pathlib import Path

# Fix for libgomp
import ctypes
try:
    ctypes.CDLL('/usr/lib/aarch64-linux-gnu/libgomp.so.1', mode=ctypes.RTLD_GLOBAL)
except:
    pass

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

# Load config
with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

from models.price_predictor import PricePredictor
from data_processing.preprocessor import DataPreprocessor

print("=" * 80)
print("Testing Model and Scaler Loading")
print("=" * 80)

# Initialize
preprocessor = DataPreprocessor(config)
predictor = PricePredictor(config)

# Get latest model path
latest_model = predictor.get_latest_model_path()
print(f"\nLatest model found: {latest_model}")

if latest_model:
    try:
        print(f"\nLoading model: {latest_model}")
        predictor.load_model(latest_model, preprocessor)
        print("✅ Model loaded successfully!")

        # Check if model has a model attribute
        if predictor.model is not None:
            print(f"✅ Model object exists")
            print(f"   Input shape: {predictor.model.input_shape}")
            print(f"   Output shape: {predictor.model.output_shape}")
        else:
            print("❌ Model object is None")

        # Check scaler
        print(f"\nChecking preprocessor scaler...")
        if hasattr(preprocessor.feature_scaler, 'data_min_'):
            print("✅ Feature scaler is fitted")
            print(f"   Feature scaler data_min shape: {preprocessor.feature_scaler.data_min_.shape}")
            print(f"   Feature scaler data_max shape: {preprocessor.feature_scaler.data_max_.shape}")
        else:
            print("❌ Feature scaler is NOT fitted")

        if hasattr(preprocessor.target_scaler, 'data_min_'):
            print("✅ Target scaler is fitted")
            print(f"   Target scaler data_min: {preprocessor.target_scaler.data_min_}")
            print(f"   Target scaler data_max: {preprocessor.target_scaler.data_max_}")
        else:
            print("❌ Target scaler is NOT fitted")

    except Exception as e:
        print(f"❌ Error loading model: {e}")
        import traceback
        traceback.print_exc()
else:
    print("❌ No model found!")

print("\n" + "=" * 80)
