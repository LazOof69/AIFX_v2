#!/usr/bin/env python3
"""
Debug script to test scaler loading
"""
import sys
import os
import yaml

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.price_predictor import PricePredictor
from data_processing.preprocessor import DataPreprocessor

# Load config
CONFIG_PATH = 'config.yaml'
with open(CONFIG_PATH, 'r') as f:
    config = yaml.safe_load(f)

# Initialize preprocessor and predictor
preprocessor = DataPreprocessor(config)
predictor = PricePredictor(config)

print("=" * 60)
print("BEFORE loading model")
print("=" * 60)
print(f"feature_scaler fitted: {hasattr(preprocessor.feature_scaler, 'n_features_in_')}")
if hasattr(preprocessor.feature_scaler, 'n_features_in_'):
    print(f"feature_scaler n_features: {preprocessor.feature_scaler.n_features_in_}")

# Load model
latest_model = predictor.get_latest_model_path()
print(f"\nLatest model: {latest_model}")

if latest_model:
    predictor.load_model(latest_model, preprocessor)

    print("\n" + "=" * 60)
    print("AFTER loading model")
    print("=" * 60)
    print(f"feature_scaler fitted: {hasattr(preprocessor.feature_scaler, 'n_features_in_')}")
    if hasattr(preprocessor.feature_scaler, 'n_features_in_'):
        print(f"feature_scaler n_features: {preprocessor.feature_scaler.n_features_in_}")

    # Try to use the scaler
    import pandas as pd
    import numpy as np

    # Create dummy data with correct number of features
    print(f"\nTesting scaler with dummy data...")
    try:
        # The model expects 28 features
        dummy_data = pd.DataFrame(np.random.rand(100, 28))
        scaled = preprocessor.scale_features(dummy_data, fit=False)
        print(f"✓ Scaler works! Scaled shape: {scaled.shape}")
    except Exception as e:
        print(f"✗ Scaler failed: {e}")
else:
    print("No model found!")
