#!/usr/bin/env python3
"""
Evaluate Two-Stage Reversal Detection System on Test Set

This script loads the trained Stage 1 and Stage 2 models and evaluates
them on the test set, showing detailed performance metrics and examples.

Usage:
    python scripts/evaluate_reversal_mode1.py

Author: AI-assisted
Created: 2025-10-14
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import pandas as pd
import numpy as np
import json
from datetime import datetime
import logging
import pickle

from tensorflow import keras
from models.two_stage_reversal_predictor import TwoStageReversalPredictor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ReversalEvaluator:
    """Evaluator for two-stage reversal detection system"""

    def __init__(self, models_dir: Path, data_dir: Path):
        self.models_dir = Path(models_dir)
        self.data_dir = Path(data_dir)
        self.predictor = None

    def load_models(self):
        """Load trained models"""
        logger.info("="*80)
        logger.info("Loading Trained Models")
        logger.info("="*80)

        # Load Stage 1
        stage1_path = self.models_dir / 'reversal_detector_stage1.h5'
        if not stage1_path.exists():
            raise FileNotFoundError(f"Stage 1 model not found: {stage1_path}")

        logger.info(f"Loading Stage 1: {stage1_path}")
        stage1_model = keras.models.load_model(
            stage1_path,
            custom_objects={'FocalLoss': None},  # Will use saved loss
            compile=False
        )
        logger.info(f"✅ Stage 1 loaded: {stage1_model.count_params():,} parameters")

        # Load Stage 2
        stage2_path = self.models_dir / 'direction_classifier_stage2.h5'
        if not stage2_path.exists():
            raise FileNotFoundError(f"Stage 2 model not found: {stage2_path}")

        logger.info(f"Loading Stage 2: {stage2_path}")
        stage2_model = keras.models.load_model(stage2_path, compile=False)
        logger.info(f"✅ Stage 2 loaded: {stage2_model.count_params():,} parameters")

        # Load optimal threshold
        threshold_config_path = self.models_dir / 'stage1_threshold.json'
        if threshold_config_path.exists():
            import json
            with open(threshold_config_path, 'r') as f:
                threshold_config = json.load(f)
                optimal_threshold = threshold_config['optimal_threshold']
            logger.info(f"Using optimal threshold from config: {optimal_threshold}")
        else:
            optimal_threshold = 0.5
            logger.warning("Threshold config not found, using default: 0.5")

        # Create predictor
        self.predictor = TwoStageReversalPredictor(
            stage1_model=stage1_model,
            stage2_model=stage2_model,
            stage1_threshold=optimal_threshold
        )

        logger.info(f"\n✅ Two-stage predictor ready with threshold={optimal_threshold}!\n")

    def load_test_data(self, sequence_length: int = 20):
        """Load test data"""
        logger.info("="*80)
        logger.info("Loading Test Data")
        logger.info("="*80)

        # Load selected features list
        features_list_file = self.models_dir / 'selected_features.json'
        if features_list_file.exists():
            with open(features_list_file, 'r') as f:
                features_config = json.load(f)
                selected_features = features_config['features']
            logger.info(f"Using {len(selected_features)} selected features from trained model")
        else:
            selected_features = None
            logger.warning("selected_features.json not found, using all features")

        # Load features
        features_file = self.data_dir / 'EURUSD_reversal_mode1_test_features.csv'
        features = pd.read_csv(features_file, index_col=0, parse_dates=True)

        # Select only trained features
        if selected_features:
            features = features[selected_features]
            logger.info(f"Features: {features.shape} (selected)")
        else:
            logger.info(f"Features: {features.shape} (all)")

        # Load and apply scaler
        scaler_file = self.models_dir / 'feature_scaler.pkl'
        if scaler_file.exists():
            with open(scaler_file, 'rb') as f:
                scaler = pickle.load(f)
            logger.info(f"Loaded scaler, normalizing features...")
            features_normalized = scaler.transform(features)
            features = pd.DataFrame(
                features_normalized,
                index=features.index,
                columns=features.columns
            )
        else:
            logger.warning("feature_scaler.pkl not found, using raw features")

        # Load labels
        labels_file = self.data_dir / 'EURUSD_reversal_mode1_test_labels.csv'
        labels = pd.read_csv(labels_file)
        logger.info(f"Labels: {labels.shape}")

        # Create sequences
        X = []
        y_signal = []
        timestamps = []

        for i in range(sequence_length, len(features)):
            sequence = features.iloc[i-sequence_length:i].values
            X.append(sequence)

            label = labels.iloc[i]
            y_signal.append(int(label['signal']))
            timestamps.append(features.index[i])

        X = np.array(X)
        y_signal = np.array(y_signal)

        logger.info(f"\nTest sequences: {len(X)}")
        logger.info(f"  Shape: {X.shape}")
        logger.info(f"  Signal distribution:")
        logger.info(f"    None (0): {np.sum(y_signal==0)} ({100*np.mean(y_signal==0):.2f}%)")
        logger.info(f"    Long (1): {np.sum(y_signal==1)} ({100*np.mean(y_signal==1):.2f}%)")
        logger.info(f"    Short (2): {np.sum(y_signal==2)} ({100*np.mean(y_signal==2):.2f}%)")

        return X, y_signal, timestamps

    def evaluate(self, X: np.ndarray, y_true: np.ndarray, timestamps: list):
        """Evaluate predictions"""
        logger.info("="*80)
        logger.info("Making Predictions on Test Set")
        logger.info("="*80)

        # Make predictions
        logger.info("Predicting...")
        predictions = self.predictor.predict_batch(X)

        # Extract signals
        predicted_signals = []
        confidences = []
        stage1_probs = []
        stage2_probs = []

        for pred in predictions:
            signal = pred['signal']
            # Convert to numeric: none=0, long=1, short=2
            if signal == 'none':
                predicted_signals.append(0)
            elif signal == 'long':
                predicted_signals.append(1)
            else:  # short
                predicted_signals.append(2)

            confidences.append(pred['confidence'])
            stage1_probs.append(pred['stage1_prob'])
            stage2_probs.append(pred.get('stage2_prob', None))

        predicted_signals = np.array(predicted_signals)
        confidences = np.array(confidences)

        logger.info(f"\n✅ Predictions complete: {len(predictions)}")

        # Calculate metrics
        logger.info("\n" + "="*80)
        logger.info("Overall Performance Metrics")
        logger.info("="*80)

        accuracy = np.mean(predicted_signals == y_true)
        logger.info(f"\n📊 Overall Accuracy: {accuracy*100:.2f}%")

        # Prediction distribution
        logger.info(f"\n📊 Prediction Distribution:")
        for signal_val, signal_name in [(0, 'None'), (1, 'Long'), (2, 'Short')]:
            count = np.sum(predicted_signals == signal_val)
            pct = 100 * count / len(predicted_signals)
            logger.info(f"  {signal_name}: {count} ({pct:.2f}%)")

        # Detailed analysis by class
        logger.info("\n" + "="*80)
        logger.info("Performance by Signal Type")
        logger.info("="*80)

        for signal_val, signal_name in [(0, 'None'), (1, 'Long'), (2, 'Short')]:
            mask = y_true == signal_val
            if np.sum(mask) == 0:
                continue

            y_true_class = y_true[mask]
            y_pred_class = predicted_signals[mask]

            class_accuracy = np.mean(y_true_class == y_pred_class)

            logger.info(f"\n{signal_name} (True samples: {np.sum(mask)}):")
            logger.info(f"  Accuracy: {class_accuracy*100:.2f}%")

            # Show what it predicted
            for pred_val, pred_name in [(0, 'None'), (1, 'Long'), (2, 'Short')]:
                count = np.sum(y_pred_class == pred_val)
                pct = 100 * count / len(y_pred_class)
                logger.info(f"    Predicted as {pred_name}: {count} ({pct:.2f}%)")

        # Confusion matrix
        logger.info("\n" + "="*80)
        logger.info("Confusion Matrix")
        logger.info("="*80)

        from sklearn.metrics import confusion_matrix
        cm = confusion_matrix(y_true, predicted_signals, labels=[0, 1, 2])

        logger.info("\n" + str(cm))
        logger.info("\nRows: True Signal | Cols: Predicted Signal")
        logger.info("          None    Long   Short")
        for i, label in enumerate(['None', 'Long', 'Short']):
            logger.info(f"{label:>5}    {cm[i]}")

        # Find reversal predictions
        logger.info("\n" + "="*80)
        logger.info("Reversal Detection Analysis")
        logger.info("="*80)

        # Stage 1 performance
        has_reversal_true = (y_true > 0).astype(int)
        has_reversal_pred = (predicted_signals > 0).astype(int)

        from sklearn.metrics import classification_report

        logger.info("\n📊 Stage 1: Reversal Detection")
        print(classification_report(
            has_reversal_true,
            has_reversal_pred,
            target_names=['No Reversal', 'Has Reversal'],
            digits=4
        ))

        # Stage 2 performance (only on true reversals)
        reversal_mask = y_true > 0
        if np.sum(reversal_mask) > 0:
            y_true_reversals = y_true[reversal_mask]
            y_pred_reversals = predicted_signals[reversal_mask]

            # Convert to binary: 1=long(1), 2=short(2) → keep as is
            direction_correct = y_true_reversals == y_pred_reversals
            direction_accuracy = np.mean(direction_correct)

            logger.info(f"\n📊 Stage 2: Direction Classification (on true reversals)")
            logger.info(f"  Total true reversals: {len(y_true_reversals)}")
            logger.info(f"  Correct direction: {np.sum(direction_correct)} ({direction_accuracy*100:.2f}%)")
            logger.info(f"  Wrong direction: {len(direction_correct) - np.sum(direction_correct)} ({(1-direction_accuracy)*100:.2f}%)")

        # Show example predictions
        logger.info("\n" + "="*80)
        logger.info("Example Predictions")
        logger.info("="*80)

        # Find some reversal examples
        reversal_indices = np.where(y_true > 0)[0]

        if len(reversal_indices) > 0:
            logger.info("\n🔍 True Reversal Examples:")
            for idx in reversal_indices[:5]:  # Show first 5
                true_sig = ['None', 'Long', 'Short'][y_true[idx]]
                pred_sig = ['None', 'Long', 'Short'][predicted_signals[idx]]
                conf = confidences[idx]
                s1_prob = stage1_probs[idx]
                s2_prob = stage2_probs[idx]

                status = "✅" if y_true[idx] == predicted_signals[idx] else "❌"

                logger.info(f"\n  {status} [{timestamps[idx]}]")
                logger.info(f"     True: {true_sig} | Predicted: {pred_sig}")
                logger.info(f"     Confidence: {conf:.3f}")
                logger.info(f"     Stage 1 prob: {s1_prob:.3f}")
                if s2_prob is not None:
                    logger.info(f"     Stage 2 prob: {s2_prob:.3f}")

        # Find false positives (predicted reversal but actually none)
        fp_indices = np.where((y_true == 0) & (predicted_signals > 0))[0]

        if len(fp_indices) > 0:
            logger.info(f"\n⚠️  False Positive Examples (predicted reversal, but actually none): {len(fp_indices)}")
            for idx in fp_indices[:3]:  # Show first 3
                pred_sig = ['None', 'Long', 'Short'][predicted_signals[idx]]
                conf = confidences[idx]
                s1_prob = stage1_probs[idx]

                logger.info(f"\n  [{timestamps[idx]}]")
                logger.info(f"     True: None | Predicted: {pred_sig}")
                logger.info(f"     Confidence: {conf:.3f}")
                logger.info(f"     Stage 1 prob: {s1_prob:.3f}")

        # Save results
        self.save_results(timestamps, y_true, predicted_signals, confidences, stage1_probs, stage2_probs)

    def save_results(self, timestamps, y_true, y_pred, confidences, stage1_probs, stage2_probs):
        """Save prediction results"""
        logger.info("\n" + "="*80)
        logger.info("Saving Results")
        logger.info("="*80)

        # Create results dataframe
        results_df = pd.DataFrame({
            'timestamp': timestamps,
            'true_signal': y_true,
            'predicted_signal': y_pred,
            'confidence': confidences,
            'stage1_prob': stage1_probs,
            'stage2_prob': [p if p is not None else np.nan for p in stage2_probs]
        })

        # Convert numeric signals to names
        signal_map = {0: 'none', 1: 'long', 2: 'short'}
        results_df['true_signal_name'] = results_df['true_signal'].map(signal_map)
        results_df['predicted_signal_name'] = results_df['predicted_signal'].map(signal_map)

        # Save to CSV
        output_file = Path('models/trained/test_predictions.csv')
        results_df.to_csv(output_file, index=False)
        logger.info(f"✅ Predictions saved to: {output_file}")

        # Save summary statistics
        summary = {
            'evaluation_date': datetime.now().isoformat(),
            'test_samples': len(y_true),
            'overall_accuracy': float(np.mean(y_pred == y_true)),
            'distribution': {
                'true': {
                    'none': int(np.sum(y_true == 0)),
                    'long': int(np.sum(y_true == 1)),
                    'short': int(np.sum(y_true == 2))
                },
                'predicted': {
                    'none': int(np.sum(y_pred == 0)),
                    'long': int(np.sum(y_pred == 1)),
                    'short': int(np.sum(y_pred == 2))
                }
            },
            'stage1_performance': {
                'true_positives': int(np.sum((y_true > 0) & (y_pred > 0))),
                'false_positives': int(np.sum((y_true == 0) & (y_pred > 0))),
                'true_negatives': int(np.sum((y_true == 0) & (y_pred == 0))),
                'false_negatives': int(np.sum((y_true > 0) & (y_pred == 0)))
            }
        }

        summary_file = Path('models/trained/evaluation_summary.json')
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)

        logger.info(f"✅ Summary saved to: {summary_file}")


def main():
    logger.info("="*80)
    logger.info("TWO-STAGE REVERSAL DETECTION - EVALUATION")
    logger.info("="*80)

    # Setup paths
    models_dir = Path(__file__).parent.parent / 'models' / 'trained'
    data_dir = Path(__file__).parent.parent / 'data' / 'training_v3_reversal'

    # Create evaluator
    evaluator = ReversalEvaluator(models_dir=models_dir, data_dir=data_dir)

    # Load models
    evaluator.load_models()

    # Load test data
    X_test, y_test, timestamps = evaluator.load_test_data(sequence_length=20)

    # Evaluate
    evaluator.evaluate(X_test, y_test, timestamps)

    logger.info("\n" + "="*80)
    logger.info("✅ EVALUATION COMPLETE!")
    logger.info("="*80)


if __name__ == '__main__':
    main()
