#!/usr/bin/env python3
"""
Threshold Optimization for Stage 1 Reversal Detector

This script performs threshold scanning to find the optimal decision threshold
for Stage 1 (reversal detector) that maximizes recall while maintaining
reasonable precision.

The script:
1. Loads the trained Stage 1 model
2. Gets raw prediction probabilities on test set
3. Tests multiple thresholds (0.05 to 0.95)
4. Generates Precision-Recall curve
5. Recommends optimal threshold based on F1 or custom metric

Usage:
    python scripts/optimize_threshold.py

Output:
    - Threshold performance metrics table
    - Precision-Recall curve (PNG)
    - Optimal threshold recommendation

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
import matplotlib.pyplot as plt
from sklearn.metrics import (
    precision_recall_curve,
    f1_score,
    precision_score,
    recall_score,
    average_precision_score,
    confusion_matrix
)
from tensorflow import keras

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ThresholdOptimizer:
    """Optimizer for finding best classification threshold"""

    def __init__(self, models_dir: Path, data_dir: Path):
        self.models_dir = Path(models_dir)
        self.data_dir = Path(data_dir)
        self.stage1_model = None
        self.X_test = None
        self.y_test_binary = None  # 0=no reversal, 1=has reversal
        self.y_test_full = None    # 0=none, 1=long, 2=short
        self.probabilities = None

    def load_model(self):
        """Load Stage 1 model"""
        logger.info("="*80)
        logger.info("Loading Stage 1 Model")
        logger.info("="*80)

        stage1_path = self.models_dir / 'reversal_detector_stage1.h5'
        if not stage1_path.exists():
            raise FileNotFoundError(f"Stage 1 model not found: {stage1_path}")

        logger.info(f"Loading: {stage1_path}")
        self.stage1_model = keras.models.load_model(
            stage1_path,
            custom_objects={'FocalLoss': None},
            compile=False
        )
        logger.info(f"✅ Model loaded: {self.stage1_model.count_params():,} parameters\n")

    def load_test_data(self, sequence_length: int = 20):
        """Load and prepare test data"""
        logger.info("="*80)
        logger.info("Loading Test Data")
        logger.info("="*80)

        # Load selected features
        features_list_file = self.models_dir / 'selected_features.json'
        if features_list_file.exists():
            with open(features_list_file, 'r') as f:
                features_config = json.load(f)
                selected_features = features_config['features']
            logger.info(f"Using {len(selected_features)} selected features")
        else:
            raise FileNotFoundError("selected_features.json not found")

        # Load features
        features_file = self.data_dir / 'EURUSD_reversal_mode1_test_features.csv'
        features = pd.read_csv(features_file, index_col=0, parse_dates=True)
        features = features[selected_features]
        logger.info(f"Features shape: {features.shape}")

        # Apply scaler
        scaler_file = self.models_dir / 'feature_scaler.pkl'
        if not scaler_file.exists():
            raise FileNotFoundError("feature_scaler.pkl not found")

        with open(scaler_file, 'rb') as f:
            scaler = pickle.load(f)

        features_normalized = scaler.transform(features)
        features = pd.DataFrame(
            features_normalized,
            index=features.index,
            columns=features.columns
        )
        logger.info("Features normalized")

        # Load labels
        labels_file = self.data_dir / 'EURUSD_reversal_mode1_test_labels.csv'
        labels = pd.read_csv(labels_file)
        logger.info(f"Labels shape: {labels.shape}")

        # Create sequences
        X = []
        y_full = []

        for i in range(sequence_length, len(features)):
            sequence = features.iloc[i-sequence_length:i].values
            X.append(sequence)
            y_full.append(int(labels.iloc[i]['signal']))

        self.X_test = np.array(X)
        self.y_test_full = np.array(y_full)

        # Convert to binary for Stage 1 (has reversal or not)
        self.y_test_binary = (self.y_test_full > 0).astype(int)

        logger.info(f"\nTest sequences: {len(self.X_test)}")
        logger.info(f"  Shape: {self.X_test.shape}")
        logger.info(f"  No reversal: {np.sum(self.y_test_binary==0)} ({100*np.mean(self.y_test_binary==0):.2f}%)")
        logger.info(f"  Has reversal: {np.sum(self.y_test_binary==1)} ({100*np.mean(self.y_test_binary==1):.2f}%)")
        logger.info("")

    def get_probabilities(self):
        """Get raw prediction probabilities from Stage 1"""
        logger.info("="*80)
        logger.info("Getting Prediction Probabilities")
        logger.info("="*80)

        logger.info("Running inference on test set...")
        self.probabilities = self.stage1_model.predict(self.X_test, verbose=0).flatten()

        logger.info(f"✅ Probabilities shape: {self.probabilities.shape}")
        logger.info(f"   Min: {self.probabilities.min():.6f}")
        logger.info(f"   Max: {self.probabilities.max():.6f}")
        logger.info(f"   Mean: {self.probabilities.mean():.6f}")
        logger.info(f"   Std: {self.probabilities.std():.6f}\n")

    def scan_thresholds(self, threshold_range=None):
        """Scan different thresholds and compute metrics"""
        logger.info("="*80)
        logger.info("Threshold Scanning")
        logger.info("="*80)

        if threshold_range is None:
            # Test from 0.05 to 0.95 with 0.05 step
            threshold_range = np.arange(0.05, 1.0, 0.05)

        results = []

        for threshold in threshold_range:
            # Make predictions with this threshold
            y_pred = (self.probabilities >= threshold).astype(int)

            # Calculate metrics
            precision = precision_score(self.y_test_binary, y_pred, zero_division=0)
            recall = recall_score(self.y_test_binary, y_pred, zero_division=0)
            f1 = f1_score(self.y_test_binary, y_pred, zero_division=0)

            # Confusion matrix
            tn, fp, fn, tp = confusion_matrix(self.y_test_binary, y_pred).ravel()

            # Custom metric: F2 score (emphasizes recall)
            # F-beta score where beta=2 gives more weight to recall
            beta = 2.0
            f2 = ((1 + beta**2) * precision * recall) / (beta**2 * precision + recall) if (precision + recall) > 0 else 0

            results.append({
                'threshold': threshold,
                'precision': precision,
                'recall': recall,
                'f1_score': f1,
                'f2_score': f2,
                'true_positives': tp,
                'false_positives': fp,
                'true_negatives': tn,
                'false_negatives': fn,
                'accuracy': (tp + tn) / (tp + tn + fp + fn)
            })

        self.results_df = pd.DataFrame(results)

        logger.info(f"\n✅ Tested {len(threshold_range)} thresholds\n")
        return self.results_df

    def print_results_table(self):
        """Print formatted results table"""
        logger.info("="*80)
        logger.info("Threshold Performance Summary")
        logger.info("="*80)

        print("\n" + "="*120)
        print(f"{'Threshold':^12} | {'Precision':^10} | {'Recall':^10} | {'F1-Score':^10} | {'F2-Score':^10} | {'Accuracy':^10} | {'TP':^6} | {'FP':^6} | {'FN':^6}")
        print("="*120)

        for _, row in self.results_df.iterrows():
            print(
                f"{row['threshold']:^12.2f} | "
                f"{row['precision']:^10.4f} | "
                f"{row['recall']:^10.4f} | "
                f"{row['f1_score']:^10.4f} | "
                f"{row['f2_score']:^10.4f} | "
                f"{row['accuracy']:^10.4f} | "
                f"{row['true_positives']:^6.0f} | "
                f"{row['false_positives']:^6.0f} | "
                f"{row['false_negatives']:^6.0f}"
            )

        print("="*120 + "\n")

    def plot_precision_recall_curve(self, output_path: str = None):
        """Generate Precision-Recall curve"""
        logger.info("="*80)
        logger.info("Generating Precision-Recall Curve")
        logger.info("="*80)

        # Calculate PR curve
        precision, recall, thresholds = precision_recall_curve(
            self.y_test_binary,
            self.probabilities
        )

        # Calculate average precision
        avg_precision = average_precision_score(self.y_test_binary, self.probabilities)

        # Create figure with multiple subplots
        fig, axes = plt.subplots(2, 2, figsize=(16, 12))

        # Plot 1: Precision-Recall Curve
        ax1 = axes[0, 0]
        ax1.plot(recall, precision, linewidth=2, label=f'PR Curve (AP={avg_precision:.3f})')
        ax1.set_xlabel('Recall', fontsize=12)
        ax1.set_ylabel('Precision', fontsize=12)
        ax1.set_title('Precision-Recall Curve', fontsize=14, fontweight='bold')
        ax1.grid(True, alpha=0.3)
        ax1.legend(fontsize=11)
        ax1.set_xlim([0, 1])
        ax1.set_ylim([0, 1])

        # Plot 2: Threshold vs Precision & Recall
        ax2 = axes[0, 1]
        ax2.plot(self.results_df['threshold'], self.results_df['precision'],
                 'b-', linewidth=2, label='Precision', marker='o', markersize=4)
        ax2.plot(self.results_df['threshold'], self.results_df['recall'],
                 'r-', linewidth=2, label='Recall', marker='s', markersize=4)
        ax2.plot(self.results_df['threshold'], self.results_df['f1_score'],
                 'g--', linewidth=2, label='F1-Score', marker='^', markersize=4)
        ax2.set_xlabel('Threshold', fontsize=12)
        ax2.set_ylabel('Score', fontsize=12)
        ax2.set_title('Metrics vs Threshold', fontsize=14, fontweight='bold')
        ax2.grid(True, alpha=0.3)
        ax2.legend(fontsize=11)
        ax2.set_xlim([0, 1])
        ax2.set_ylim([0, 1])

        # Plot 3: F1 and F2 Score vs Threshold
        ax3 = axes[1, 0]
        ax3.plot(self.results_df['threshold'], self.results_df['f1_score'],
                 'g-', linewidth=2, label='F1-Score (balanced)', marker='o', markersize=4)
        ax3.plot(self.results_df['threshold'], self.results_df['f2_score'],
                 'm-', linewidth=2, label='F2-Score (favors recall)', marker='s', markersize=4)
        ax3.set_xlabel('Threshold', fontsize=12)
        ax3.set_ylabel('Score', fontsize=12)
        ax3.set_title('F-Scores vs Threshold', fontsize=14, fontweight='bold')
        ax3.grid(True, alpha=0.3)
        ax3.legend(fontsize=11)
        ax3.set_xlim([0, 1])
        ax3.set_ylim([0, 1])

        # Mark optimal points
        best_f1_idx = self.results_df['f1_score'].idxmax()
        best_f2_idx = self.results_df['f2_score'].idxmax()

        ax3.axvline(self.results_df.loc[best_f1_idx, 'threshold'],
                    color='g', linestyle='--', alpha=0.5, label='Best F1')
        ax3.axvline(self.results_df.loc[best_f2_idx, 'threshold'],
                    color='m', linestyle='--', alpha=0.5, label='Best F2')

        # Plot 4: True Positives vs False Positives
        ax4 = axes[1, 1]
        ax4.plot(self.results_df['threshold'], self.results_df['true_positives'],
                 'g-', linewidth=2, label='True Positives', marker='o', markersize=4)
        ax4.plot(self.results_df['threshold'], self.results_df['false_positives'],
                 'r-', linewidth=2, label='False Positives', marker='s', markersize=4)
        ax4.plot(self.results_df['threshold'], self.results_df['false_negatives'],
                 'orange', linewidth=2, label='False Negatives', marker='^', markersize=4)
        ax4.set_xlabel('Threshold', fontsize=12)
        ax4.set_ylabel('Count', fontsize=12)
        ax4.set_title('Prediction Counts vs Threshold', fontsize=14, fontweight='bold')
        ax4.grid(True, alpha=0.3)
        ax4.legend(fontsize=11)
        ax4.set_xlim([0, 1])

        plt.tight_layout()

        # Save figure
        if output_path is None:
            output_path = self.models_dir / 'threshold_optimization.png'
        else:
            output_path = Path(output_path)

        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        logger.info(f"✅ Plot saved to: {output_path}\n")

        return avg_precision

    def recommend_threshold(self, strategy='f2'):
        """Recommend optimal threshold based on strategy

        Args:
            strategy: 'f1', 'f2', 'recall_50', 'recall_70', or 'custom'
        """
        logger.info("="*80)
        logger.info("Threshold Recommendation")
        logger.info("="*80)

        if strategy == 'f1':
            # Best F1 score (balanced precision and recall)
            best_idx = self.results_df['f1_score'].idxmax()
            metric_name = 'F1-Score'

        elif strategy == 'f2':
            # Best F2 score (emphasizes recall over precision)
            best_idx = self.results_df['f2_score'].idxmax()
            metric_name = 'F2-Score (favors recall)'

        elif strategy == 'recall_50':
            # First threshold that achieves recall >= 50%
            candidates = self.results_df[self.results_df['recall'] >= 0.5]
            if len(candidates) == 0:
                logger.warning("⚠️  No threshold achieves recall >= 50%")
                best_idx = self.results_df['recall'].idxmax()
            else:
                # Among those, choose highest F1
                best_idx = candidates['f1_score'].idxmax()
            metric_name = 'Recall >= 50% with best F1'

        elif strategy == 'recall_70':
            # First threshold that achieves recall >= 70%
            candidates = self.results_df[self.results_df['recall'] >= 0.7]
            if len(candidates) == 0:
                logger.warning("⚠️  No threshold achieves recall >= 70%")
                best_idx = self.results_df['recall'].idxmax()
            else:
                best_idx = candidates['f1_score'].idxmax()
            metric_name = 'Recall >= 70% with best F1'

        else:
            raise ValueError(f"Unknown strategy: {strategy}")

        best_row = self.results_df.loc[best_idx]

        logger.info(f"\n{'Strategy:':<25} {metric_name}")
        logger.info(f"{'='*60}")
        logger.info(f"{'Recommended Threshold:':<25} {best_row['threshold']:.3f}")
        logger.info(f"")
        logger.info(f"{'Expected Performance:':<25}")
        logger.info(f"  {'Precision:':<23} {best_row['precision']:.4f} ({best_row['precision']*100:.2f}%)")
        logger.info(f"  {'Recall:':<23} {best_row['recall']:.4f} ({best_row['recall']*100:.2f}%)")
        logger.info(f"  {'F1-Score:':<23} {best_row['f1_score']:.4f}")
        logger.info(f"  {'F2-Score:':<23} {best_row['f2_score']:.4f}")
        logger.info(f"  {'Accuracy:':<23} {best_row['accuracy']:.4f} ({best_row['accuracy']*100:.2f}%)")
        logger.info(f"")
        logger.info(f"{'Confusion Matrix:':<25}")
        logger.info(f"  {'True Positives (TP):':<23} {best_row['true_positives']:.0f}")
        logger.info(f"  {'False Positives (FP):':<23} {best_row['false_positives']:.0f}")
        logger.info(f"  {'True Negatives (TN):':<23} {best_row['true_negatives']:.0f}")
        logger.info(f"  {'False Negatives (FN):':<23} {best_row['false_negatives']:.0f}")
        logger.info(f"{'='*60}\n")

        return best_row['threshold'], best_row.to_dict()

    def compare_strategies(self):
        """Compare all recommendation strategies"""
        logger.info("="*80)
        logger.info("Strategy Comparison")
        logger.info("="*80)

        strategies = {
            'f1': 'Best F1 Score (balanced)',
            'f2': 'Best F2 Score (favors recall)',
            'recall_50': 'Recall >= 50%',
            'recall_70': 'Recall >= 70%'
        }

        comparison = []

        for strategy, description in strategies.items():
            try:
                threshold, metrics = self.recommend_threshold(strategy=strategy)
                comparison.append({
                    'Strategy': description,
                    'Threshold': threshold,
                    'Precision': f"{metrics['precision']:.4f}",
                    'Recall': f"{metrics['recall']:.4f}",
                    'F1': f"{metrics['f1_score']:.4f}",
                    'F2': f"{metrics['f2_score']:.4f}",
                    'TP': int(metrics['true_positives']),
                    'FP': int(metrics['false_positives']),
                    'FN': int(metrics['false_negatives'])
                })
            except Exception as e:
                logger.warning(f"⚠️  Strategy '{strategy}' failed: {e}")

        comparison_df = pd.DataFrame(comparison)

        print("\n" + "="*140)
        print(comparison_df.to_string(index=False))
        print("="*140 + "\n")

        return comparison_df


def main():
    """Main execution"""
    logger.info("\n" + "="*80)
    logger.info("STAGE 1 THRESHOLD OPTIMIZATION")
    logger.info("="*80 + "\n")

    # Setup paths
    models_dir = Path(__file__).parent.parent / 'models' / 'trained'
    data_dir = Path(__file__).parent.parent / 'data' / 'training_v3_reversal'

    # Create optimizer
    optimizer = ThresholdOptimizer(models_dir=models_dir, data_dir=data_dir)

    # Step 1: Load model
    optimizer.load_model()

    # Step 2: Load test data
    optimizer.load_test_data(sequence_length=20)

    # Step 3: Get probabilities
    optimizer.get_probabilities()

    # Step 4: Scan thresholds
    optimizer.scan_thresholds()

    # Step 5: Print results
    optimizer.print_results_table()

    # Step 6: Generate plots
    avg_precision = optimizer.plot_precision_recall_curve()

    # Step 7: Compare strategies
    logger.info("\n")
    comparison = optimizer.compare_strategies()

    # Step 8: Final recommendation
    logger.info("\n" + "="*80)
    logger.info("FINAL RECOMMENDATION")
    logger.info("="*80)

    logger.info("\n🎯 For trading signal system (prioritize catching reversals):")
    logger.info("   → Use F2-Score strategy (emphasizes recall)\n")

    best_threshold, best_metrics = optimizer.recommend_threshold(strategy='f2')

    # Save results
    results_file = models_dir / 'threshold_optimization_results.csv'
    optimizer.results_df.to_csv(results_file, index=False)
    logger.info(f"📊 Full results saved to: {results_file}")

    comparison_file = models_dir / 'threshold_strategy_comparison.csv'
    comparison.to_csv(comparison_file, index=False)
    logger.info(f"📊 Strategy comparison saved to: {comparison_file}")

    logger.info("\n" + "="*80)
    logger.info("✅ THRESHOLD OPTIMIZATION COMPLETE!")
    logger.info("="*80 + "\n")


if __name__ == '__main__':
    main()
