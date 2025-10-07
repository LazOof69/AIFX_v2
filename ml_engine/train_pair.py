#!/usr/bin/env python3
"""
通用貨幣對訓練腳本
支持 EURUSD, GBPUSD, USDJPY 等
"""

import os
import sys
import yaml
import numpy as np
from pathlib import Path
import argparse
from datetime import datetime

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from models.price_predictor import PricePredictor
from data_processing.preprocessor import DataPreprocessor

def main(pair='EURUSD'):
    print("="*70)
    print(f"{pair} 模型訓練 (帶 Scaler)")
    print("="*70)

    # Load config
    config_path = Path(__file__).parent / 'config.yaml'
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)

    print(f"\n配置:")
    print(f"  - Epochs: {config['model']['training']['epochs']}")
    print(f"  - Early stopping patience: {config['model']['training']['early_stopping_patience']}")
    print(f"  - Batch size: {config['model']['training']['batch_size']}")

    # Initialize preprocessor and predictor
    preprocessor = DataPreprocessor(config)
    predictor = PricePredictor(config)

    # Load the fitted scaler from data preparation
    scaler_path = Path(__file__).parent / 'data' / 'processed' / 'scaler_yfinance.pkl'
    if scaler_path.exists():
        print(f"\n✓ 載入 fitted scaler: {scaler_path}")
        preprocessor.load_scaler(str(scaler_path))
    else:
        print(f"\n⚠️  警告: Scaler 未找到，預測時可能失敗!")

    # Load training data
    data_dir = Path(__file__).parent / 'data' / 'training'

    print(f"\n載入 {pair} 訓練數據...")
    X_train = np.load(data_dir / f'{pair}_X_train.npy')
    y_train = np.load(data_dir / f'{pair}_y_train.npy')
    X_test = np.load(data_dir / f'{pair}_X_test.npy')
    y_test = np.load(data_dir / f'{pair}_y_test.npy')

    print(f"✓ 數據載入完成:")
    print(f"  - X_train: {X_train.shape}")
    print(f"  - y_train: {y_train.shape}")
    print(f"  - X_test: {X_test.shape}")
    print(f"  - y_test: {y_test.shape}")

    # Check label distribution
    unique, counts = np.unique(y_train, return_counts=True)
    print(f"\n標籤分佈 (訓練集):")
    for label, count in zip(unique, counts):
        label_name = ['Sell', 'Hold', 'Buy'][int(label)]
        pct = count/len(y_train)*100
        print(f"  - {label_name:5}: {count:>6,} ({pct:>5.1f}%)")

    # Build model
    input_shape = (X_train.shape[1], X_train.shape[2])
    print(f"\n構建模型 (input shape: {input_shape})...")
    predictor.build_model(input_shape)
    print(f"✓ 模型參數: {predictor.model.count_params():,}")

    # Train model
    print(f"\n開始訓練...")
    print(f"  - 使用 class_weight 處理類別不平衡")
    print(f"  - Scaler 將與模型一起保存")

    history = predictor.train(
        X_train, y_train,
        X_test, y_test,
        verbose=1
    )

    # Evaluate model
    print(f"\n評估模型...")
    metrics = predictor.evaluate(X_test, y_test)

    # Save model with scaler
    print(f"\n保存模型和 scaler...")
    model_path = predictor.save_model(preprocessor=preprocessor)

    # Verify scaler was saved
    scaler_path = model_path.replace('.h5', '_scaler.pkl')
    if os.path.exists(scaler_path):
        print(f"✓ Scaler 已保存: {scaler_path}")
    else:
        print(f"✗ 警告: Scaler 未保存!")

    # Summary
    print(f"\n{'='*70}")
    print(f"訓練完成 - {pair}")
    print(f"{'='*70}")
    print(f"  模型:     {model_path}")
    print(f"  Scaler:   {scaler_path}")
    print(f"  準確率:   {metrics.get('accuracy', 'N/A')}")
    print(f"  測試損失: {metrics.get('loss', 'N/A')}")
    print(f"  完成時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    return model_path

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='訓練指定貨幣對的模型')
    parser.add_argument('pair', type=str, help='貨幣對名稱 (如 EURUSD, GBPUSD, USDJPY)')
    args = parser.parse_args()

    try:
        model_path = main(args.pair)
        print(f"\n✓ 成功: {args.pair} 模型已訓練並保存")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ 錯誤: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
