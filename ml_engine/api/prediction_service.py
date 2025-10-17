#!/usr/bin/env python3
"""
Unified Prediction Service for AIFX_v2 ML Engine

Provides high-level prediction API for reversal detection and direction classification.
Supports multiple model versions and A/B testing.

Author: AI-assisted
Created: 2025-10-16
"""

import numpy as np
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import json

from model_manager import ModelManager, ModelVersion

logger = logging.getLogger(__name__)


class PredictionService:
    """
    Unified prediction service for reversal detection
    """

    def __init__(self, model_manager: ModelManager):
        """
        Initialize prediction service

        Args:
            model_manager: ModelManager instance
        """
        self.model_manager = model_manager
        logger.info("Prediction Service initialized")

    def predict_reversal(self, market_data: np.ndarray, version: str = None) -> Dict:
        """
        Predict reversal using two-stage model

        Args:
            market_data: Preprocessed market data (1, sequence_length, num_features)
            version: Model version to use (None = use active version)

        Returns:
            dict: Prediction result
                - signal: 'none', 'long', or 'short'
                - confidence: Overall confidence (0.0-1.0)
                - stage1_prob: Reversal probability
                - stage2_prob: Direction probability (if reversal detected)
                - model_version: Version used for prediction
                - timestamp: Prediction timestamp
        """
        try:
            # Get model version
            if version:
                model_version = self.model_manager.get_version(version)
                if not model_version or not model_version.is_loaded():
                    logger.error(f"Model version {version} not loaded")
                    raise ValueError(f"Model version {version} not available")
            else:
                model_version = self.model_manager.get_active_version()
                if not model_version:
                    raise ValueError("No active model version")

            logger.info(f"Using model version: {model_version.version}")

            # Validate input shape
            expected_features = len(model_version.features) if model_version.features else None
            if expected_features and market_data.shape[-1] != expected_features:
                raise ValueError(
                    f"Input features mismatch: expected {expected_features}, "
                    f"got {market_data.shape[-1]}"
                )

            # Stage 1: Detect reversal
            stage1_pred = model_version.stage1_model.predict(market_data, verbose=0)
            has_reversal_prob = float(stage1_pred[0][0])

            logger.info(f"Stage 1 prediction: {has_reversal_prob:.4f} (threshold: {model_version.threshold})")

            # Check if reversal detected
            if has_reversal_prob < model_version.threshold:
                # No reversal detected
                result = {
                    'signal': 'hold',  # Changed from 'none' to 'hold' for consistency with backend
                    'confidence': float(1.0 - has_reversal_prob),
                    'stage1_prob': float(has_reversal_prob),
                    'stage2_prob': None,
                    'model_version': model_version.version,
                    'timestamp': datetime.utcnow().isoformat() + 'Z'
                }
                logger.info(f"No reversal detected: {result['signal']}")
                return result

            # Stage 2: Determine direction
            if not model_version.stage2_model:
                logger.warning("Stage 2 model not available, returning hold signal")
                result = {
                    'signal': 'hold',
                    'confidence': float(has_reversal_prob),
                    'stage1_prob': float(has_reversal_prob),
                    'stage2_prob': None,
                    'model_version': model_version.version,
                    'timestamp': datetime.utcnow().isoformat() + 'Z',
                    'warning': 'Stage 2 model not available'
                }
                return result

            stage2_pred = model_version.stage2_model.predict(market_data, verbose=0)
            direction_prob = float(stage2_pred[0][0])

            # 0 = long, 1 = short
            signal = 'short' if direction_prob > 0.5 else 'long'
            direction_confidence = direction_prob if direction_prob > 0.5 else (1.0 - direction_prob)

            # Overall confidence: weighted average (Stage 1: 40%, Stage 2: 60%)
            overall_confidence = (has_reversal_prob * 0.4) + (direction_confidence * 0.6)

            result = {
                'signal': signal,
                'confidence': float(overall_confidence),
                'stage1_prob': float(has_reversal_prob),
                'stage2_prob': float(direction_prob),
                'model_version': model_version.version,
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }

            logger.info(
                f"Reversal detected: {result['signal']} "
                f"(confidence: {result['confidence']:.2f}, "
                f"stage2_prob: {direction_prob:.4f})"
            )

            return result

        except Exception as e:
            logger.error(f"Prediction error: {e}", exc_info=True)
            raise

    def predict_batch(self, market_data_batch: np.ndarray, version: str = None) -> List[Dict]:
        """
        Predict reversals for a batch of market data

        Args:
            market_data_batch: Batch of preprocessed data (batch_size, sequence_length, num_features)
            version: Model version to use

        Returns:
            list: List of prediction results
        """
        try:
            # Get model version
            if version:
                model_version = self.model_manager.get_version(version)
            else:
                model_version = self.model_manager.get_active_version()

            if not model_version or not model_version.is_loaded():
                raise ValueError(f"Model version {version or 'active'} not available")

            batch_size = len(market_data_batch)
            logger.info(f"Batch prediction: {batch_size} samples using {model_version.version}")

            # Stage 1: Batch prediction
            stage1_preds = model_version.stage1_model.predict(market_data_batch, verbose=0)

            results = []
            indices_needing_stage2 = []

            # First pass: identify reversals
            for i in range(batch_size):
                has_reversal_prob = float(stage1_preds[i][0])

                if has_reversal_prob < model_version.threshold:
                    # No reversal
                    results.append({
                        'signal': 'hold',
                        'confidence': float(1.0 - has_reversal_prob),
                        'stage1_prob': float(has_reversal_prob),
                        'stage2_prob': None,
                        'model_version': model_version.version,
                        'timestamp': datetime.utcnow().isoformat() + 'Z'
                    })
                else:
                    # Reversal detected, needs Stage 2
                    results.append({
                        '_needs_stage2': True,
                        '_index': i,
                        'stage1_prob': float(has_reversal_prob)
                    })
                    indices_needing_stage2.append(i)

            # Stage 2: Only for detected reversals
            if len(indices_needing_stage2) > 0 and model_version.stage2_model:
                logger.info(f"Running Stage 2 for {len(indices_needing_stage2)} detected reversals")

                X_stage2 = market_data_batch[indices_needing_stage2]
                stage2_preds = model_version.stage2_model.predict(X_stage2, verbose=0)

                # Update results with Stage 2 predictions
                stage2_idx = 0
                for i, result in enumerate(results):
                    if result.get('_needs_stage2'):
                        direction_prob = float(stage2_preds[stage2_idx][0])
                        signal = 'short' if direction_prob > 0.5 else 'long'
                        direction_confidence = direction_prob if direction_prob > 0.5 else (1.0 - direction_prob)
                        overall_confidence = (result['stage1_prob'] * 0.4) + (direction_confidence * 0.6)

                        results[i] = {
                            'signal': signal,
                            'confidence': float(overall_confidence),
                            'stage1_prob': result['stage1_prob'],
                            'stage2_prob': float(direction_prob),
                            'model_version': model_version.version,
                            'timestamp': datetime.utcnow().isoformat() + 'Z'
                        }
                        stage2_idx += 1
            else:
                # No Stage 2 model available, mark as hold
                for i, result in enumerate(results):
                    if result.get('_needs_stage2'):
                        results[i] = {
                            'signal': 'hold',
                            'confidence': result['stage1_prob'],
                            'stage1_prob': result['stage1_prob'],
                            'stage2_prob': None,
                            'model_version': model_version.version,
                            'timestamp': datetime.utcnow().isoformat() + 'Z',
                            'warning': 'Stage 2 model not available'
                        }

            logger.info(f"Batch prediction completed: {len(results)} results")
            return results

        except Exception as e:
            logger.error(f"Batch prediction error: {e}", exc_info=True)
            raise

    def compare_versions(self, market_data: np.ndarray, versions: List[str]) -> Dict:
        """
        Compare predictions from multiple model versions

        Args:
            market_data: Preprocessed market data
            versions: List of version identifiers

        Returns:
            dict: Comparison results
                - predictions: Dict of predictions by version
                - consensus: Consensus signal (if agreement)
                - disagreement: True if models disagree
        """
        try:
            predictions = {}

            for version in versions:
                try:
                    pred = self.predict_reversal(market_data, version=version)
                    predictions[version] = pred
                except Exception as e:
                    logger.error(f"Prediction failed for version {version}: {e}")
                    predictions[version] = {'error': str(e)}

            # Check for consensus
            signals = [p['signal'] for p in predictions.values() if 'signal' in p]
            consensus = None
            disagreement = False

            if len(signals) > 0:
                # Check if all signals agree
                if len(set(signals)) == 1:
                    consensus = signals[0]
                else:
                    disagreement = True

            return {
                'predictions': predictions,
                'consensus': consensus,
                'disagreement': disagreement,
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }

        except Exception as e:
            logger.error(f"Version comparison error: {e}", exc_info=True)
            raise

    def get_model_info(self, version: str = None) -> Dict:
        """
        Get information about a model version

        Args:
            version: Version identifier (None = active version)

        Returns:
            dict: Model information
        """
        if version:
            model_version = self.model_manager.get_version(version)
        else:
            model_version = self.model_manager.get_active_version()

        if not model_version:
            return {'error': f'Model version {version or "active"} not found'}

        return model_version.get_info()


def main():
    """Test prediction service"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    logger.info("="*80)
    logger.info("Testing Prediction Service")
    logger.info("="*80)

    # Create model manager and load v3.1
    manager = ModelManager()
    manager.load_version('v3.1')

    # Create prediction service
    service = PredictionService(manager)

    # Test with dummy data
    logger.info("\n### Testing single prediction ###")
    dummy_data = np.random.randn(1, 20, 12)  # 12 features for v3.1

    result = service.predict_reversal(dummy_data)
    logger.info(f"Prediction result: {json.dumps(result, indent=2)}")

    # Test batch prediction
    logger.info("\n### Testing batch prediction ###")
    dummy_batch = np.random.randn(5, 20, 12)

    batch_results = service.predict_batch(dummy_batch)
    logger.info(f"Batch results: {len(batch_results)} predictions")
    for i, r in enumerate(batch_results):
        logger.info(f"  [{i}] {r['signal']} (confidence: {r['confidence']:.2f})")

    logger.info("\n" + "="*80)
    logger.info("✅ Prediction Service test completed")
    logger.info("="*80)


if __name__ == '__main__':
    main()
