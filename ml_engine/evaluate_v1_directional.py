#!/usr/bin/env python3
"""
Evaluate v1.0 EURUSD model for directional accuracy
Compares v1.0 (3-class classifier) with v2.0 (regression) on the same metric
"""

import os
import sys
import numpy as np
from pathlib import Path
from tensorflow.keras.models import load_model
import json

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

def calculate_directional_accuracy(y_true, y_pred_classes):
    """
    Calculate directional accuracy for v1.0 classifier

    Args:
        y_true: True labels (0=Sell, 1=Hold, 2=Buy)
        y_pred_classes: Predicted classes

    Returns:
        dict with metrics
    """
    # Total 3-class accuracy
    total_accuracy = np.mean(y_true == y_pred_classes)

    # Filter out Hold predictions (class 1)
    # Only keep Buy (2) and Sell (0) predictions for directional accuracy
    directional_mask = (y_pred_classes != 1)

    if np.sum(directional_mask) == 0:
        return {
            'total_accuracy': total_accuracy,
            'directional_accuracy': None,
            'directional_samples': 0,
            'total_samples': len(y_true),
            'error': 'Model predicted only Hold - no directional predictions'
        }

    y_true_directional = y_true[directional_mask]
    y_pred_directional = y_pred_classes[directional_mask]

    # Calculate directional accuracy (correct Buy/Sell predictions)
    directional_accuracy = np.mean(y_true_directional == y_pred_directional)

    # Class distribution
    unique_true, counts_true = np.unique(y_true, return_counts=True)
    unique_pred, counts_pred = np.unique(y_pred_classes, return_counts=True)

    class_names = ['Sell', 'Hold', 'Buy']
    true_dist = {class_names[i]: int(count) for i, count in zip(unique_true, counts_true)}
    pred_dist = {class_names[i]: int(count) for i, count in zip(unique_pred, counts_pred)}

    return {
        'total_accuracy': float(total_accuracy),
        'directional_accuracy': float(directional_accuracy),
        'directional_samples': int(np.sum(directional_mask)),
        'total_samples': int(len(y_true)),
        'hold_predictions': int(np.sum(y_pred_classes == 1)),
        'true_distribution': true_dist,
        'pred_distribution': pred_dist
    }

def evaluate_model(model_path, data_dir='/root/AIFX_v2/ml_engine/data/training'):
    """
    Load model and evaluate on test set
    """
    print(f"Loading model: {model_path}")

    # Load model
    model = load_model(model_path)

    # Load test data
    data_dir = Path(data_dir)
    X_test = np.load(data_dir / 'EURUSD_X_test.npy')
    y_test = np.load(data_dir / 'EURUSD_y_test.npy')

    print(f"Test data shape: X={X_test.shape}, y={y_test.shape}")

    # Make predictions
    y_pred_proba = model.predict(X_test, verbose=0)
    y_pred_classes = np.argmax(y_pred_proba, axis=1)

    # Calculate metrics
    metrics = calculate_directional_accuracy(y_test, y_pred_classes)

    return metrics

def main():
    print("="*70)
    print("ML v1.0 EURUSD Directional Accuracy Evaluation")
    print("="*70)

    # Find v1.0 models
    models_dir = Path('/root/AIFX_v2/ml_engine/saved_models')
    v1_models = sorted(models_dir.glob('forex_classifier_EURUSD_*.h5'))

    if not v1_models:
        print("❌ No v1.0 EURUSD models found")
        return

    print(f"\nFound {len(v1_models)} v1.0 models:")
    for i, model in enumerate(v1_models):
        print(f"  {i+1}. {model.name}")

    results = []

    for model_path in v1_models:
        print(f"\n{'='*70}")
        print(f"Evaluating: {model_path.name}")
        print(f"{'='*70}")

        try:
            metrics = evaluate_model(str(model_path))

            # Load metadata for comparison
            metadata_path = str(model_path).replace('.h5', '_metadata.json')
            metadata = {}
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)

            print(f"\n📊 Results:")
            print(f"  3-Class Accuracy:      {metrics['total_accuracy']:.4f} ({metrics['total_accuracy']*100:.2f}%)")
            print(f"  Directional Accuracy:  {metrics['directional_accuracy']:.4f} ({metrics['directional_accuracy']*100:.2f}%)")
            print(f"  Directional Samples:   {metrics['directional_samples']} / {metrics['total_samples']}")
            print(f"  Hold Predictions:      {metrics['hold_predictions']} ({metrics['hold_predictions']/metrics['total_samples']*100:.1f}%)")

            print(f"\n  True Distribution:")
            for cls, count in metrics['true_distribution'].items():
                pct = count / metrics['total_samples'] * 100
                print(f"    {cls:5}: {count:>4} ({pct:>5.1f}%)")

            print(f"\n  Predicted Distribution:")
            for cls, count in metrics['pred_distribution'].items():
                pct = count / metrics['total_samples'] * 100
                print(f"    {cls:5}: {count:>4} ({pct:>5.1f}%)")

            # Compare with metadata
            if 'final_val_accuracy' in metadata:
                print(f"\n  Metadata val_accuracy: {metadata['final_val_accuracy']:.4f}")

            # Status
            if metrics['directional_accuracy'] >= 0.55:
                status = "✅ EXCELLENT (>55%)"
            elif metrics['directional_accuracy'] >= 0.50:
                status = "✅ GOOD (>50%)"
            elif metrics['directional_accuracy'] >= 0.45:
                status = "⚠️  MARGINAL (45-50%)"
            else:
                status = "❌ POOR (<45%)"

            print(f"\n  Status: {status}")

            results.append({
                'model': model_path.name,
                'metrics': metrics,
                'metadata': metadata,
                'status': status
            })

        except Exception as e:
            print(f"❌ Error evaluating model: {e}")
            import traceback
            traceback.print_exc()

    # Summary
    print(f"\n{'='*70}")
    print("Summary Comparison")
    print(f"{'='*70}")

    print(f"\n{'Model':<50} {'Dir. Acc':<12} {'Status'}")
    print(f"{'-'*50} {'-'*12} {'-'*20}")

    for result in results:
        dir_acc = result['metrics']['directional_accuracy']
        print(f"{result['model']:<50} {dir_acc*100:>6.2f}%     {result['status']}")

    # Find best model
    if results:
        best = max(results, key=lambda x: x['metrics']['directional_accuracy'])
        print(f"\n🏆 Best Model: {best['model']}")
        print(f"   Directional Accuracy: {best['metrics']['directional_accuracy']*100:.2f}%")

        # Compare with v2.0
        v2_dir_acc = 47.60  # From ML_V2_CRITICAL_ANALYSIS.md
        print(f"\n📊 Comparison with v2.0:")
        print(f"   v1.0 (best):  {best['metrics']['directional_accuracy']*100:.2f}%")
        print(f"   v2.0 (latest): {v2_dir_acc:.2f}%")

        if best['metrics']['directional_accuracy'] * 100 > v2_dir_acc:
            diff = best['metrics']['directional_accuracy'] * 100 - v2_dir_acc
            print(f"   ✅ v1.0 is BETTER by {diff:.2f} percentage points")
        else:
            diff = v2_dir_acc - best['metrics']['directional_accuracy'] * 100
            print(f"   ❌ v2.0 is BETTER by {diff:.2f} percentage points")

        # Recommendation
        print(f"\n💡 Recommendation:")
        if best['metrics']['directional_accuracy'] >= 0.50:
            print(f"   ✅ Use v1.0 model: {best['model']}")
            print(f"   Directional accuracy > 50% (better than random)")
        elif best['metrics']['directional_accuracy'] >= 0.45:
            print(f"   ⚠️  v1.0 is marginal (45-50%)")
            print(f"   Consider fixing v2.0 with directional loss function")
        else:
            print(f"   ❌ v1.0 is below 45%")
            print(f"   Recommend building v3.0 with proper architecture")

if __name__ == '__main__':
    main()
