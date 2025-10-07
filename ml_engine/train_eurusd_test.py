#!/usr/bin/env python3
"""
Test training script for EURUSD with optimizations
- Uses class_weight for imbalanced data
- Saves scaler with model
- Uses updated config (150 epochs, patience 15)
"""

import os
import sys
import yaml
import numpy as np
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from models.price_predictor import PricePredictor
from data_processing.preprocessor import DataPreprocessor

def main():
    print("="*70)
    print("EURUSD Training Test with Optimizations")
    print("="*70)

    # Load config
    config_path = Path(__file__).parent / 'config.yaml'
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)

    print(f"\nConfig loaded:")
    print(f"  - Epochs: {config['model']['training']['epochs']}")
    print(f"  - Early stopping patience: {config['model']['training']['early_stopping_patience']}")
    print(f"  - Batch size: {config['model']['training']['batch_size']}")

    # Initialize preprocessor and predictor
    preprocessor = DataPreprocessor(config)
    predictor = PricePredictor(config)

    # Load the fitted scaler from data preparation
    scaler_path = Path(__file__).parent / 'data' / 'processed' / 'scaler_yfinance.pkl'
    if scaler_path.exists():
        print(f"\nLoading fitted scaler from {scaler_path}...")
        preprocessor.load_scaler(str(scaler_path))
        print("✓ Fitted scaler loaded")
    else:
        print(f"⚠ WARNING: Fitted scaler not found at {scaler_path}")
        print("  Scaler will not be available for predictions!")

    # Load training data
    pair = 'EURUSD'
    data_dir = Path(__file__).parent / 'data' / 'training'

    print(f"\nLoading training data for {pair}...")
    X_train = np.load(data_dir / f'{pair}_X_train.npy')
    y_train = np.load(data_dir / f'{pair}_y_train.npy')
    X_test = np.load(data_dir / f'{pair}_X_test.npy')
    y_test = np.load(data_dir / f'{pair}_y_test.npy')

    print(f"✓ Data loaded:")
    print(f"  - X_train: {X_train.shape}")
    print(f"  - y_train: {y_train.shape}")
    print(f"  - X_test: {X_test.shape}")
    print(f"  - y_test: {y_test.shape}")

    # Check label distribution
    unique, counts = np.unique(y_train, return_counts=True)
    print(f"\nLabel distribution (training):")
    for label, count in zip(unique, counts):
        label_name = ['Sell', 'Hold', 'Buy'][int(label)]
        pct = count/len(y_train)*100
        print(f"  - {label_name}: {count:>5} ({pct:>5.1f}%)")

    # Build model
    input_shape = (X_train.shape[1], X_train.shape[2])
    print(f"\nBuilding model with input shape: {input_shape}")
    predictor.build_model(input_shape)

    print(f"✓ Model built:")
    print(f"  - Total parameters: {predictor.model.count_params():,}")

    # Train model (with class_weight automatically calculated)
    print(f"\nStarting training...")
    print(f"  Note: Class weights will be calculated automatically")
    print(f"  Note: Scaler will be saved with the model")

    history = predictor.train(
        X_train, y_train,
        X_test, y_test,
        verbose=1
    )

    # Evaluate model
    print(f"\nEvaluating model...")
    metrics = predictor.evaluate(X_test, y_test)

    # Save model with scaler
    print(f"\nSaving model and scaler...")
    model_path = predictor.save_model(preprocessor=preprocessor)

    # Verify scaler was saved
    scaler_path = model_path.replace('.h5', '_scaler.pkl')
    if os.path.exists(scaler_path):
        print(f"✓ Scaler saved: {scaler_path}")
    else:
        print(f"✗ WARNING: Scaler not found at {scaler_path}")

    # Final summary
    print(f"\n{'='*70}")
    print("Training Complete!")
    print(f"{'='*70}")
    print(f"  - Model: {model_path}")
    print(f"  - Scaler: {scaler_path}")
    print(f"  - Accuracy: {metrics.get('accuracy', 'N/A')}")
    print(f"  - Test Loss: {metrics.get('loss', 'N/A')}")

    return model_path

if __name__ == '__main__':
    try:
        model_path = main()
        print(f"\n✓ SUCCESS: Model trained and saved with scaler")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
