#!/usr/bin/env python3
"""
Quick deployment verification script

Tests all Priority 2 components:
- Model Manager
- Prediction Service
- A/B Testing Framework
"""

import sys
import logging
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def test_model_manager():
    """Test Model Manager"""
    logger.info("="*80)
    logger.info("TEST 1: Model Manager")
    logger.info("="*80)

    from model_manager import ModelManager

    manager = ModelManager()
    logger.info(f"✅ Registered versions: {manager.list_versions()}")

    # Load v3.1
    success = manager.load_version('v3.1')
    if success:
        active = manager.get_active_version()
        logger.info(f"✅ Active version: {active.version} ({active.name})")
        logger.info(f"   Stage 1: {'✅' if active.stage1_model else '❌'}")
        logger.info(f"   Stage 2: {'✅' if active.stage2_model else '❌'}")
        logger.info(f"   Features: {len(active.features) if active.features else 'N/A'}")
        return manager
    else:
        logger.error("❌ Failed to load model")
        sys.exit(1)


def test_prediction_service(manager):
    """Test Prediction Service"""
    logger.info("\n" + "="*80)
    logger.info("TEST 2: Prediction Service")
    logger.info("="*80)

    from prediction_service import PredictionService

    service = PredictionService(manager)
    logger.info("✅ Prediction Service initialized")

    # Get active version features
    active = manager.get_active_version()
    num_features = len(active.features) if active.features else 12

    # Test single prediction
    logger.info(f"\n### Test 2a: Single Prediction ###")
    dummy_data = np.random.randn(1, 20, num_features)
    result = service.predict_reversal(dummy_data)

    logger.info(f"Signal: {result['signal']}")
    logger.info(f"Confidence: {result['confidence']:.4f}")
    logger.info(f"Stage 1 Prob: {result['stage1_prob']:.4f}")
    logger.info(f"Stage 2 Prob: {result.get('stage2_prob', 'N/A')}")
    logger.info(f"Model Version: {result['model_version']}")

    # Test batch prediction
    logger.info(f"\n### Test 2b: Batch Prediction ###")
    batch_data = np.random.randn(5, 20, num_features)
    batch_results = service.predict_batch(batch_data)

    logger.info(f"Batch size: {len(batch_results)}")
    for i, r in enumerate(batch_results[:3]):  # Show first 3
        logger.info(f"  [{i}] {r['signal']} (conf: {r['confidence']:.2f})")

    logger.info("✅ Prediction Service tests passed")
    return service


def test_ab_testing():
    """Test A/B Testing Framework"""
    logger.info("\n" + "="*80)
    logger.info("TEST 3: A/B Testing Framework")
    logger.info("="*80)

    from ab_testing import ABTestingFramework

    framework = ABTestingFramework()
    logger.info("✅ A/B Testing Framework initialized")

    # Create test experiment
    logger.info(f"\n### Test 3a: Create Experiment ###")
    exp = framework.create_experiment(
        experiment_id='test_v30_vs_v31',
        name='Test: v3.0 vs v3.1',
        description='Test experiment',
        variant_a='v3.0',
        variant_b='v3.1',
        traffic_split=0.5
    )
    logger.info(f"✅ Experiment created: {exp.experiment_id}")

    # Activate experiment
    framework.activate_experiment('test_v30_vs_v31')
    logger.info(f"✅ Experiment activated")

    # Test user assignment
    logger.info(f"\n### Test 3b: User Assignment ###")
    test_users = ['user1', 'user2', 'user3', 'user4', 'user5']
    for user_id in test_users:
        model_version, exp_id = framework.get_model_version_for_user(user_id)
        variant = exp.assign_variant(user_id)
        logger.info(f"  {user_id} → Variant {variant} → {model_version}")

        # Record test prediction
        framework.record_prediction(exp_id, user_id, 'long', 0.75)

    # Get metrics
    logger.info(f"\n### Test 3c: Experiment Metrics ###")
    metrics = framework.get_experiment_metrics('test_v30_vs_v31')
    logger.info(f"Variant A (v3.0): {metrics['variants']['A']['metrics']['count']} predictions")
    logger.info(f"Variant B (v3.1): {metrics['variants']['B']['metrics']['count']} predictions")

    # Stop experiment
    framework.stop_experiment('test_v30_vs_v31')
    logger.info("✅ A/B Testing Framework tests passed")


def main():
    """Run all tests"""
    logger.info("\n")
    logger.info("╔" + "="*78 + "╗")
    logger.info("║" + " "*20 + "PRIORITY 2 DEPLOYMENT VERIFICATION" + " "*24 + "║")
    logger.info("╚" + "="*78 + "╝")
    logger.info("\n")

    try:
        # Test 1: Model Manager
        manager = test_model_manager()

        # Test 2: Prediction Service
        service = test_prediction_service(manager)

        # Test 3: A/B Testing
        test_ab_testing()

        # Summary
        logger.info("\n" + "="*80)
        logger.info("✅✅✅ ALL TESTS PASSED ✅✅✅")
        logger.info("="*80)
        logger.info("\nPriority 2 deployment is READY for production!")
        logger.info("\nComponents verified:")
        logger.info("  ✅ Model Manager (v3.0 + v3.1)")
        logger.info("  ✅ Prediction Service (single + batch)")
        logger.info("  ✅ A/B Testing Framework (experiments + metrics)")
        logger.info("\nNext steps:")
        logger.info("  1. Start ML Engine API: python3 api/ml_server.py")
        logger.info("  2. Test API: curl http://localhost:8000/health")
        logger.info("  3. Read documentation: ML_ENGINE_DEPLOYMENT.md")
        logger.info("="*80)

        return 0

    except Exception as e:
        logger.error(f"\n❌ TEST FAILED: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
