#!/usr/bin/env python3
"""
Evaluate Profitable Reversal Model on Test Set

對比新舊模型性能：
- 舊模型: Swing Point + 閾值0.2 (Recall 22.22%)
- 新模型: Profitable Logic (預期Recall 70%+)

Author: AI-assisted
Created: 2025-10-15
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import pandas as pd
import numpy as np
import json
import pickle
import logging
from sklearn.metrics import classification_report, confusion_matrix
from tensorflow import keras

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ProfitableModelEvaluator:
    """評估新模型性能"""

    def __init__(self, models_dir: Path, data_dir: Path):
        self.models_dir = Path(models_dir)
        self.data_dir = Path(data_dir)
        self.sequence_length = 20

    def load_model(self):
        """加載訓練好的模型"""
        logger.info("="*80)
        logger.info("Loading Profitable Reversal Model")
        logger.info("="*80)

        model_file = self.models_dir / 'profitable_reversal_detector_stage1.h5'
        if not model_file.exists():
            raise FileNotFoundError(f"Model not found: {model_file}")

        logger.info(f"Loading: {model_file}")
        self.model = keras.models.load_model(model_file, compile=False)
        logger.info(f"✅ Model loaded: {self.model.count_params():,} parameters")

        # 加載scaler
        scaler_file = self.models_dir / 'profitable_feature_scaler.pkl'
        with open(scaler_file, 'rb') as f:
            self.scaler = pickle.load(f)
        logger.info("✅ Scaler loaded")

        # 加載特徵列表
        features_file = self.models_dir / 'profitable_selected_features.json'
        with open(features_file, 'r') as f:
            config = json.load(f)
            self.selected_features = config['features']
        logger.info(f"✅ Using {len(self.selected_features)} features\n")

    def load_test_data(self):
        """加載測試數據"""
        logger.info("="*80)
        logger.info("Loading Test Data")
        logger.info("="*80)

        # 加載特徵
        features_file = self.data_dir / 'EURUSD_profitable_test_features.csv'
        features = pd.read_csv(features_file, index_col=0, parse_dates=True)
        features = features[self.selected_features]
        logger.info(f"Features: {features.shape}")

        # 歸一化
        features_scaled = self.scaler.transform(features)
        features = pd.DataFrame(
            features_scaled,
            columns=features.columns,
            index=features.index
        )

        # 加載標籤
        labels_file = self.data_dir / 'EURUSD_profitable_test_labels.csv'
        labels = pd.read_csv(labels_file)
        logger.info(f"Labels: {labels.shape}")

        # 創建序列
        X = []
        y_binary = []
        y_full = []
        timestamps = []

        for i in range(self.sequence_length, len(features)):
            sequence = features.iloc[i-self.sequence_length:i].values
            X.append(sequence)

            label = labels.iloc[i]['signal']
            y_binary.append(1 if label > 0 else 0)  # Binary: has reversal
            y_full.append(int(label))  # Full: 0=none, 1=long, 2=short
            timestamps.append(features.index[i])

        X = np.array(X)
        y_binary = np.array(y_binary)
        y_full = np.array(y_full)

        logger.info(f"\nTest sequences: {len(X)}")
        logger.info(f"  Shape: {X.shape}")
        logger.info(f"  Has reversal: {np.sum(y_binary)} ({100*np.mean(y_binary):.2f}%)")
        logger.info(f"  No reversal: {len(y_binary) - np.sum(y_binary)} ({100*(1-np.mean(y_binary)):.2f}%)")
        logger.info("")

        return X, y_binary, y_full, timestamps

    def evaluate(self, X, y_true, threshold=0.5):
        """評估模型"""
        logger.info("="*80)
        logger.info(f"Evaluating Model (threshold={threshold})")
        logger.info("="*80)

        # 預測
        logger.info("Running predictions...")
        probabilities = self.model.predict(X, verbose=0).flatten()
        y_pred = (probabilities >= threshold).astype(int)

        logger.info(f"Predictions complete")
        logger.info(f"  Prob range: [{probabilities.min():.4f}, {probabilities.max():.4f}]")
        logger.info(f"  Prob mean: {probabilities.mean():.4f}")
        logger.info(f"  Prob std: {probabilities.std():.4f}\n")

        # 分類報告
        logger.info("="*80)
        logger.info("Classification Report")
        logger.info("="*80)
        print("\n" + classification_report(
            y_true,
            y_pred,
            target_names=['No Reversal', 'Has Reversal'],
            digits=4
        ))

        # Confusion Matrix
        cm = confusion_matrix(y_true, y_pred)
        tn, fp, fn, tp = cm.ravel()

        logger.info("\n" + "="*80)
        logger.info("Confusion Matrix")
        logger.info("="*80)
        logger.info(f"\n{cm}")
        logger.info("\nRows: True | Cols: Predicted")
        logger.info(f"             No Rev    Has Rev")
        logger.info(f"No Rev       {tn:>6}    {fp:>6}")
        logger.info(f"Has Rev      {fn:>6}    {tp:>6}")

        # 關鍵指標
        accuracy = (tp + tn) / (tp + tn + fp + fn)
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0

        logger.info("\n" + "="*80)
        logger.info("Key Metrics Summary")
        logger.info("="*80)
        logger.info(f"\nAccuracy:  {accuracy:.4f} ({accuracy*100:.2f}%)")
        logger.info(f"Precision: {precision:.4f} ({precision*100:.2f}%)")
        logger.info(f"Recall:    {recall:.4f} ({recall*100:.2f}%)")
        logger.info(f"F1-Score:  {f1:.4f}")
        logger.info(f"\nTrue Positives:  {tp} (檢測到的反轉)")
        logger.info(f"False Positives: {fp} (誤報)")
        logger.info(f"True Negatives:  {tn} (正確識別無反轉)")
        logger.info(f"False Negatives: {fn} (漏檢的反轉)")

        return {
            'threshold': threshold,
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1,
            'tp': tp,
            'fp': fp,
            'tn': tn,
            'fn': fn,
            'probabilities': probabilities,
            'predictions': y_pred
        }

    def compare_with_old_model(self, new_results):
        """對比舊模型結果"""
        logger.info("\n" + "="*80)
        logger.info("COMPARISON WITH OLD MODEL")
        logger.info("="*80)

        # 舊模型結果（從之前的評估）
        old_results = {
            'name': 'Swing Point + Threshold 0.2',
            'recall': 0.2222,
            'precision': 0.0253,
            'accuracy': 0.6529,
            'f1_score': 0.0455,
            'detected': '2/9 reversals',
            'fp': 77
        }

        new_detected = f"{new_results['tp']}/{new_results['tp'] + new_results['fn']} reversals"

        logger.info("\n舊模型 (Swing Point + Threshold 0.2):")
        logger.info(f"  Recall:    {old_results['recall']:.4f} ({old_results['recall']*100:.2f}%)")
        logger.info(f"  Precision: {old_results['precision']:.4f} ({old_results['precision']*100:.2f}%)")
        logger.info(f"  Accuracy:  {old_results['accuracy']:.4f} ({old_results['accuracy']*100:.2f}%)")
        logger.info(f"  F1-Score:  {old_results['f1_score']:.4f}")
        logger.info(f"  Detected:  {old_results['detected']}")
        logger.info(f"  False Positives: {old_results['fp']}")

        logger.info("\n新模型 (Profitable Logic + Threshold 0.5):")
        logger.info(f"  Recall:    {new_results['recall']:.4f} ({new_results['recall']*100:.2f}%)")
        logger.info(f"  Precision: {new_results['precision']:.4f} ({new_results['precision']*100:.2f}%)")
        logger.info(f"  Accuracy:  {new_results['accuracy']:.4f} ({new_results['accuracy']*100:.2f}%)")
        logger.info(f"  F1-Score:  {new_results['f1_score']:.4f}")
        logger.info(f"  Detected:  {new_detected}")
        logger.info(f"  False Positives: {new_results['fp']}")

        logger.info("\n改進:")
        recall_improvement = ((new_results['recall'] / old_results['recall']) - 1) * 100
        precision_improvement = ((new_results['precision'] / old_results['precision']) - 1) * 100
        f1_improvement = ((new_results['f1_score'] / old_results['f1_score']) - 1) * 100

        logger.info(f"  Recall:    {recall_improvement:+.1f}% ({old_results['recall']:.2%} → {new_results['recall']:.2%})")
        logger.info(f"  Precision: {precision_improvement:+.1f}% ({old_results['precision']:.2%} → {new_results['precision']:.2%})")
        logger.info(f"  F1-Score:  {f1_improvement:+.1f}% ({old_results['f1_score']:.4f} → {new_results['f1_score']:.4f})")


def main():
    """主執行"""
    logger.info("\n" + "="*80)
    logger.info("PROFITABLE REVERSAL MODEL EVALUATION")
    logger.info("="*80 + "\n")

    models_dir = Path(__file__).parent.parent / 'models' / 'trained'
    data_dir = Path(__file__).parent.parent / 'data' / 'training_v3_profitable'

    evaluator = ProfitableModelEvaluator(models_dir, data_dir)

    # 加載模型
    evaluator.load_model()

    # 加載測試數據
    X_test, y_test_binary, y_test_full, timestamps = evaluator.load_test_data()

    # 評估（使用預設閾值0.5）
    results = evaluator.evaluate(X_test, y_test_binary, threshold=0.5)

    # 對比舊模型
    evaluator.compare_with_old_model(results)

    logger.info("\n" + "="*80)
    logger.info("✅ EVALUATION COMPLETE!")
    logger.info("="*80 + "\n")


if __name__ == '__main__':
    main()
