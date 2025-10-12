#!/usr/bin/env python3
"""
Multi-Input LSTM v2.0 Training Script for AIFX_v2

Trains v2.0 models that combine:
- Technical indicators (LSTM)
- Fundamental features (Dense)
- Economic event features (Dense)

Usage:
    python train_v2_pair.py EURUSD --epochs 100 --batch-size 32

Created: 2025-10-08
"""

import os
import sys
import yaml
import numpy as np
from pathlib import Path
import argparse
from datetime import datetime
import json
import logging

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from models.multi_input_predictor import MultiInputPricePredictor

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_v2_training_data(pair: str, data_dir: Path = None):
    """
    Load v2.0 multi-input training data

    Args:
        pair: Currency pair (e.g., 'EURUSD')
        data_dir: Directory containing training data (default: data/training_v2)

    Returns:
        Tuple of (X_technical_train, X_fundamental_train, X_event_train, y_train,
                  X_technical_test, X_fundamental_test, X_event_test, y_test)
    """
    if data_dir is None:
        data_dir = Path(__file__).parent / 'data' / 'training_v2'
    else:
        data_dir = Path(data_dir)

    logger.info(f"Loading {pair} v2.0 training data from {data_dir}")

    # Load technical indicators
    X_technical_train = np.load(data_dir / f'{pair}_technical_X_train.npy')
    X_technical_test = np.load(data_dir / f'{pair}_technical_X_test.npy')

    # Load fundamental features
    X_fundamental_train = np.load(data_dir / f'{pair}_fundamental_X_train.npy')
    X_fundamental_test = np.load(data_dir / f'{pair}_fundamental_X_test.npy')

    # Load event features
    X_event_train = np.load(data_dir / f'{pair}_event_X_train.npy')
    X_event_test = np.load(data_dir / f'{pair}_event_X_test.npy')

    # Load targets
    y_train = np.load(data_dir / f'{pair}_y_train.npy')
    y_test = np.load(data_dir / f'{pair}_y_test.npy')

    logger.info(f"✓ Data loaded successfully:")
    logger.info(f"  - Technical train: {X_technical_train.shape}")
    logger.info(f"  - Fundamental train: {X_fundamental_train.shape}")
    logger.info(f"  - Event train: {X_event_train.shape}")
    logger.info(f"  - y_train: {y_train.shape}")
    logger.info(f"  - Technical test: {X_technical_test.shape}")
    logger.info(f"  - Fundamental test: {X_fundamental_test.shape}")
    logger.info(f"  - Event test: {X_event_test.shape}")
    logger.info(f"  - y_test: {y_test.shape}")

    return (X_technical_train, X_fundamental_train, X_event_train, y_train,
            X_technical_test, X_fundamental_test, X_event_test, y_test)


def calculate_directional_accuracy(y_true, y_pred):
    """
    Calculate directional accuracy (correct price movement direction)

    Args:
        y_true: True price values
        y_pred: Predicted price values

    Returns:
        Directional accuracy percentage
    """
    y_true_direction = np.diff(y_true.flatten()) > 0
    y_pred_direction = np.diff(y_pred.flatten()) > 0

    accuracy = np.mean(y_true_direction == y_pred_direction) * 100
    return accuracy


def evaluate_model(predictor, X_test_list, y_test):
    """
    Comprehensive model evaluation

    Args:
        predictor: MultiInputPricePredictor instance
        X_test_list: List of [X_technical_test, X_fundamental_test, X_event_test]
        y_test: Test targets

    Returns:
        Dictionary of evaluation metrics
    """
    logger.info("Evaluating model...")

    # Get predictions
    y_pred = predictor.model.predict(X_test_list, verbose=0)

    # Calculate metrics
    mse = np.mean((y_test - y_pred) ** 2)
    mae = np.mean(np.abs(y_test - y_pred))
    rmse = np.sqrt(mse)

    # Directional accuracy
    dir_accuracy = calculate_directional_accuracy(y_test, y_pred)

    # Calculate standard metrics using keras evaluate
    eval_results = predictor.model.evaluate(
        X_test_list, y_test, verbose=0
    )
    # eval_results = [loss, mae, mse, directional_accuracy]
    test_loss = eval_results[0] if len(eval_results) > 0 else mse

    metrics = {
        'test_loss': float(test_loss),
        'mse': float(mse),
        'mae': float(mae),
        'rmse': float(rmse),
        'directional_accuracy': float(dir_accuracy),
        'total_samples': int(len(y_test))
    }

    logger.info(f"✓ Evaluation complete:")
    logger.info(f"  - Test Loss: {test_loss:.4f}")
    logger.info(f"  - RMSE: {rmse:.4f}")
    logger.info(f"  - MAE: {mae:.4f}")
    logger.info(f"  - Directional Accuracy: {dir_accuracy:.2f}%")

    return metrics


def main(pair='EURUSD', epochs=None, batch_size=None, prepare_data=False, data_dir=None):
    """
    Main training function for v2.0 multi-input models

    Args:
        pair: Currency pair to train
        epochs: Number of training epochs (override config)
        batch_size: Batch size (override config)
        prepare_data: Whether to prepare training data first
        data_dir: Directory containing training data (default: data/training_v2)
    """
    print("=" * 80)
    print(f"Multi-Input LSTM v2.0 Training - {pair}")
    print("=" * 80)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Load config
    config_path = Path(__file__).parent / 'config.yaml'
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)

    # Update model version
    if 'model' not in config:
        config['model'] = {}
    config['model']['version'] = '2.0.0'
    config['model']['model_dir'] = './saved_models_v2'
    config['model']['checkpoint_dir'] = './checkpoints_v2'

    # Override training parameters if provided
    if epochs is not None:
        config['model']['training']['epochs'] = epochs
    if batch_size is not None:
        config['model']['training']['batch_size'] = batch_size

    print(f"\nConfiguration:")
    print(f"  - Model Version: {config['model']['version']}")
    print(f"  - Epochs: {config['model']['training']['epochs']}")
    print(f"  - Batch Size: {config['model']['training']['batch_size']}")
    print(f"  - Early Stopping Patience: {config['model']['training']['early_stopping_patience']}")

    # Data directory
    if data_dir is None:
        data_dir = Path(__file__).parent / 'data' / 'training_v2'
    else:
        data_dir = Path(data_dir)

    # Prepare data if requested
    if prepare_data:
        logger.info(f"\nPreparing v2.0 training data for {pair}...")
        logger.warning("Please run: python scripts/prepare_v2_training_data.py")
        logger.error("Data preparation not integrated yet. Exiting.")
        sys.exit(1)

    # Check if data exists
    required_files = [
        f'{pair}_technical_X_train.npy',
        f'{pair}_fundamental_X_train.npy',
        f'{pair}_event_X_train.npy',
        f'{pair}_y_train.npy'
    ]

    missing_files = [f for f in required_files if not (data_dir / f).exists()]
    if missing_files:
        logger.error(f"\n✗ Missing training data files:")
        for f in missing_files:
            logger.error(f"  - {f}")
        logger.error(f"\nRun with --prepare-data flag to generate training data")
        sys.exit(1)

    # Load training data
    (X_technical_train, X_fundamental_train, X_event_train, y_train,
     X_technical_test, X_fundamental_test, X_event_test, y_test) = load_v2_training_data(
        pair, data_dir
    )

    # Initialize predictor
    logger.info("\nInitializing MultiInputPricePredictor...")
    predictor = MultiInputPricePredictor(config)

    # Build model
    logger.info("Building model architecture...")
    predictor.build_model(
        technical_shape=(X_technical_train.shape[1], X_technical_train.shape[2]),
        fundamental_shape=X_fundamental_train.shape[1],
        event_shape=X_event_train.shape[1]
    )

    logger.info(f"✓ Model built successfully")
    logger.info(f"  - Total parameters: {predictor.model.count_params():,}")

    # Print model summary
    print("\n" + "=" * 80)
    print("Model Architecture Summary")
    print("=" * 80)
    predictor.model.summary()
    print("=" * 80)

    # Train model
    logger.info("\nStarting training...")
    history = predictor.train(
        X_technical_train=X_technical_train,
        X_fundamental_train=X_fundamental_train,
        X_event_train=X_event_train,
        y_train=y_train,
        X_technical_val=X_technical_test,
        X_fundamental_val=X_fundamental_test,
        X_event_val=X_event_test,
        y_val=y_test,
        verbose=1
    )

    # Evaluate model
    metrics = evaluate_model(
        predictor,
        [X_technical_test, X_fundamental_test, X_event_test],
        y_test
    )

    # Save model
    logger.info("\nSaving model...")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_path = f'./saved_models_v2/{pair}_v2_{timestamp}.h5'
    predictor.save_model(filepath=model_path, save_history=True)
    logger.info(f"✓ Model saved: {model_path}")

    # Save training metadata
    metadata = {
        'pair': pair,
        'model_version': '2.0.0',
        'training_date': datetime.now().isoformat(),
        'epochs_trained': len(history['loss']),
        'config': config['model'],
        'data_shapes': {
            'technical': list(X_technical_train.shape),
            'fundamental': list(X_fundamental_train.shape),
            'event': list(X_event_train.shape),
            'target': list(y_train.shape)
        },
        'metrics': metrics,
        'best_epoch': int(np.argmin(history['val_loss'])) + 1,
        'best_val_loss': float(np.min(history['val_loss']))
    }

    metadata_path = model_path.replace('.h5', '_metadata.json')
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"✓ Metadata saved: {metadata_path}")

    # Print summary
    print("\n" + "=" * 80)
    print(f"Training Complete - {pair} v2.0")
    print("=" * 80)
    print(f"Model:              {model_path}")
    print(f"Metadata:           {metadata_path}")
    print(f"Parameters:         {predictor.model.count_params():,}")
    print(f"Training samples:   {len(y_train):,}")
    print(f"Test samples:       {len(y_test):,}")
    print(f"\nPerformance Metrics:")
    print(f"  - Test Loss:      {metrics['test_loss']:.4f}")
    print(f"  - RMSE:           {metrics['rmse']:.4f}")
    print(f"  - MAE:            {metrics['mae']:.4f}")
    print(f"  - Dir. Accuracy:  {metrics['directional_accuracy']:.2f}%")
    print(f"\nBest Validation Loss: {metadata['best_val_loss']:.4f} (epoch {metadata['best_epoch']})")
    print(f"Completed:         {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    return model_path, metrics


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Train v2.0 Multi-Input LSTM model for forex prediction'
    )
    parser.add_argument(
        'pair',
        type=str,
        help='Currency pair (e.g., EURUSD, GBPUSD, USDJPY)'
    )
    parser.add_argument(
        '--epochs',
        type=int,
        default=None,
        help='Number of training epochs (override config)'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=None,
        help='Batch size (override config)'
    )
    parser.add_argument(
        '--prepare-data',
        action='store_true',
        help='Prepare training data before training'
    )
    parser.add_argument(
        '--data-dir',
        type=str,
        default=None,
        help='Directory containing training data (default: data/training_v2)'
    )

    args = parser.parse_args()

    try:
        model_path, metrics = main(
            pair=args.pair,
            epochs=args.epochs,
            batch_size=args.batch_size,
            prepare_data=args.prepare_data,
            data_dir=args.data_dir
        )

        print(f"\n✅ SUCCESS: {args.pair} v2.0 model trained and saved")
        print(f"✅ Directional Accuracy: {metrics['directional_accuracy']:.2f}%")
        sys.exit(0)

    except KeyboardInterrupt:
        print("\n\n⚠️  Training interrupted by user")
        sys.exit(1)

    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
