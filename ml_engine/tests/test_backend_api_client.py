#!/usr/bin/env python3
"""
ML Engine Backend API Client Tests - Phase 5

Tests to verify ML Engine can use Backend APIs correctly
Following microservices architecture principles (CLAUDE.md)

Author: Claude Code
Created: 2025-11-21
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.backend_api_client import BackendAPIClient, get_client
from datetime import datetime
import time

# Test state
test_model_id = None
test_prediction_id = None

# Colors for console output
class Colors:
    RESET = '\033[0m'
    GREEN = '\033[32m'
    RED = '\033[31m'
    YELLOW = '\033[33m'
    BLUE = '\033[34m'
    MAGENTA = '\033[35m'


def print_header(title):
    """Print test section header"""
    print(f"\n{'='*80}")
    print(f"   {title}")
    print(f"{'='*80}\n")


def print_test(name):
    """Print test name"""
    print(f"{Colors.BLUE}🧪 Testing: {name}{Colors.RESET}")


def print_success(message):
    """Print success message"""
    print(f"{Colors.GREEN}✅ PASSED: {message}{Colors.RESET}\n")


def print_error(message, error):
    """Print error message"""
    print(f"{Colors.RED}❌ FAILED: {message}{Colors.RESET}")
    print(f"   Error: {error}")
    print()


def print_info(message):
    """Print info message"""
    print(f"   {message}")


# ============================================================================
# Test 1: Health Check
# ============================================================================

def test_health_check(client):
    """Test Backend API health check"""
    print_test("1. Backend API Health Check")
    try:
        health = client.check_health()
        print_info(f"Status: {health.get('status')}")
        print_info(f"Service: {health.get('service')}")
        print_success("1. Backend API Health Check")
        return True
    except Exception as e:
        print_error("1. Backend API Health Check", str(e))
        return False


# ============================================================================
# Test 2: Register Model Version
# ============================================================================

def test_register_model_version(client):
    """Test registering a new model version"""
    global test_model_id

    print_test("2. Register Model Version")
    try:
        # Generate unique version using timestamp
        unique_version = f"3.0.0-phase5-{int(time.time())}"

        model_data = {
            'model_name': 'signal_predictor_v3',
            'version': unique_version,
            'algorithm': 'LSTM',
            'hyperparameters': {
                'layers': 3,
                'units': 128,
                'dropout': 0.2,
                'learning_rate': 0.001,
            },
            'training_metrics': {
                'accuracy': 0.87,
                'precision': 0.85,
                'recall': 0.89,
                'f1_score': 0.87,
                'loss': 0.21,
            },
            'training_data_info': {
                'start_date': '2024-01-01',
                'end_date': '2024-11-21',
                'total_samples': 150000,
                'features': 50,
            },
            'description': 'Test model for Phase 5 ML Engine refactoring',
        }

        result = client.register_model_version(**model_data)
        test_model_id = result.get('modelId')

        print_info(f"Model registered: {result.get('modelName')}")
        print_info(f"Version: {result.get('version')}")
        print_info(f"Model ID: {test_model_id}")
        print_success("2. Register Model Version")
        return True
    except Exception as e:
        print_error("2. Register Model Version", str(e))
        return False


# ============================================================================
# Test 3: Update Model Status
# ============================================================================

def test_update_model_status(client):
    """Test updating model status"""
    print_test("3. Update Model Status")
    try:
        if not test_model_id:
            raise Exception("No test model ID available")

        result = client.update_model_status(
            model_id=test_model_id,
            status='deployed',
            is_active=True
        )

        print_info(f"Model status: {result.get('status')}")
        print_info(f"Is active: {result.get('isActive')}")
        print_success("3. Update Model Status")
        return True
    except Exception as e:
        print_error("3. Update Model Status", str(e))
        return False


# ============================================================================
# Test 4: Log Training Session
# ============================================================================

def test_log_training_session(client):
    """Test logging a training session"""
    print_test("4. Log Training Session")
    try:
        if not test_model_id:
            raise Exception("No test model ID available")

        result = client.log_training_session(
            model_id=test_model_id,
            model_version='3.0.0-phase5',
            training_type='full',
            data_start_date='2024-01-01',
            data_end_date='2024-11-21',
            num_samples=150000,
            training_metrics={
                'accuracy': 0.87,
                'loss': 0.21,
                'epochs': 50,
                'trainSamples': 120000,
            },
            validation_metrics={
                'accuracy': 0.85,
                'loss': 0.24,
                'valSamples': 30000,
            },
            hyperparameters={
                'batch_size': 32,
                'learning_rate': 0.001,
            },
            duration=7200,
            notes='Phase 5 test training session'
        )

        print_info(f"Training log ID: {result.get('logId')}")
        print_success("4. Log Training Session")
        return True
    except Exception as e:
        print_error("4. Log Training Session", str(e))
        return False


# ============================================================================
# Test 5: Submit Prediction
# ============================================================================

def test_submit_prediction(client):
    """Test submitting a prediction"""
    global test_prediction_id

    print_test("5. Submit Prediction")
    try:
        prediction_data = {
            'pair': 'EUR/USD',
            'timeframe': '1h',
            'signal': 'buy',
            'confidence': 0.87,
            'factors': {
                'technical': 0.85,
                'sentiment': 0.89,
                'pattern': 0.87,
            },
            'entry_price': 1.0950,
            'stop_loss': 1.0900,
            'take_profit': 1.1050,
            'risk_reward_ratio': 2.0,
            'position_size': 2.5,
            'signal_strength': 'strong',
            'market_condition': 'trending',
            'technical_data': {
                'sma_20': 1.0920,
                'rsi': 62,
                'macd': 0.0015,
            },
            'model_version_id': test_model_id,
        }

        result = client.submit_prediction(**prediction_data)
        test_prediction_id = result.get('predictionId')

        print_info(f"Prediction ID: {test_prediction_id}")
        print_info(f"Signal: {result.get('signal')} {result.get('pair')}")
        print_info(f"Confidence: {result.get('confidence')}")
        print_success("5. Submit Prediction")
        return True
    except Exception as e:
        print_error("5. Submit Prediction", str(e))
        return False


# ============================================================================
# Test 6: Update Prediction Outcome
# ============================================================================

def test_update_prediction_outcome(client):
    """Test updating prediction outcome"""
    print_test("6. Update Prediction Outcome")
    try:
        if not test_prediction_id:
            raise Exception("No test prediction ID available")

        result = client.update_prediction_outcome(
            prediction_id=test_prediction_id,
            outcome='win',
            actual_pnl=150.75,
            actual_pnl_percent=2.8
        )

        print_info(f"Outcome: {result.get('outcome')}")
        print_info(f"P&L: ${result.get('actualPnL')}")
        print_info(f"P&L %: {result.get('actualPnLPercent')}%")
        print_success("6. Update Prediction Outcome")
        return True
    except Exception as e:
        print_error("6. Update Prediction Outcome", str(e))
        return False


# ============================================================================
# Test 7: Get Prediction Accuracy
# ============================================================================

def test_get_prediction_accuracy(client):
    """Test getting prediction accuracy statistics"""
    print_test("7. Get Prediction Accuracy")
    try:
        result = client.get_prediction_accuracy(pair='EUR/USD')

        overall = result.get('overall', {})
        print_info(f"Total predictions: {overall.get('totalPredictions')}")
        print_info(f"Win rate: {overall.get('winRate')}%")
        print_info(f"Average P&L: ${overall.get('averagePnL')}")
        print_success("7. Get Prediction Accuracy")
        return True
    except Exception as e:
        print_error("7. Get Prediction Accuracy", str(e))
        return False


# ============================================================================
# Test 8: Get Market Data
# ============================================================================

def test_get_market_data(client):
    """Test getting market data for training"""
    print_test("8. Get Market Data")
    try:
        result = client.get_market_data(
            pair='EUR/USD',
            timeframe='1h',
            limit=100
        )

        market_data = result.get('marketData', [])
        pagination = result.get('pagination', {})

        print_info(f"Pair: {result.get('pair')}")
        print_info(f"Timeframe: {result.get('timeframe')}")
        print_info(f"Records fetched: {len(market_data)}")
        print_info(f"Total available: {pagination.get('total')}")
        print_success("8. Get Market Data")
        return True
    except Exception as e:
        print_error("8. Get Market Data", str(e))
        return False


# ============================================================================
# Test 9: Get Historical Signals
# ============================================================================

def test_get_historical_signals(client):
    """Test getting historical signals"""
    print_test("9. Get Historical Signals")
    try:
        result = client.get_historical_signals(
            pair='EUR/USD',
            limit=50
        )

        signals = result.get('signals', [])
        pagination = result.get('pagination', {})

        print_info(f"Signals fetched: {len(signals)}")
        print_info(f"Total available: {pagination.get('total')}")
        print_success("9. Get Historical Signals")
        return True
    except Exception as e:
        print_error("9. Get Historical Signals", str(e))
        return False


# ============================================================================
# Test 10: Get User Trades
# ============================================================================

def test_get_user_trades(client):
    """Test getting user trades"""
    print_test("10. Get User Trades")
    try:
        result = client.get_user_trades(
            pair='EUR/USD',
            limit=50
        )

        trades = result.get('trades', [])
        pagination = result.get('pagination', {})

        print_info(f"Trades fetched: {len(trades)}")
        print_info(f"Total available: {pagination.get('total')}")
        print_success("10. Get User Trades")
        return True
    except Exception as e:
        print_error("10. Get User Trades", str(e))
        return False


# ============================================================================
# Test 11: Get Training Data Stats
# ============================================================================

def test_get_training_data_stats(client):
    """Test getting training data statistics"""
    print_test("11. Get Training Data Stats")
    try:
        result = client.get_training_data_stats(pair='EUR/USD')

        market_data = result.get('marketData', {})
        signals = result.get('signals', {})
        trades = result.get('trades', {})

        print_info(f"Market data records: {market_data.get('count')}")
        print_info(f"Signals records: {signals.get('count')}")
        print_info(f"Trades records: {trades.get('count')}")
        print_success("11. Get Training Data Stats")
        return True
    except Exception as e:
        print_error("11. Get Training Data Stats", str(e))
        return False


# ============================================================================
# Test 12: Get Model Versions
# ============================================================================

def test_get_model_versions(client):
    """Test getting model versions"""
    print_test("12. Get Model Versions")
    try:
        result = client.get_model_versions(
            model_name='signal_predictor_v3',
            limit=10
        )

        models = result.get('models', [])
        pagination = result.get('pagination', {})

        print_info(f"Found {len(models)} model versions")
        if models:
            print_info(f"Latest model: {models[0].get('name')}:{models[0].get('version')}")
        print_success("12. Get Model Versions")
        return True
    except Exception as e:
        print_error("12. Get Model Versions", str(e))
        return False


# ============================================================================
# Test 13: Verify No Direct Database Access
# ============================================================================

def test_no_direct_database_access():
    """Verify backend_api_client.py has no database imports"""
    print_test("13. Verify No Direct Database Access")
    try:
        client_path = Path(__file__).parent.parent / 'services' / 'backend_api_client.py'
        client_code = client_path.read_text()

        forbidden_imports = [
            'psycopg2',
            'sqlalchemy',
            'import database',
            'from database',
        ]

        violations = []
        for forbidden in forbidden_imports:
            if forbidden in client_code:
                violations.append(forbidden)

        if violations:
            raise Exception(f"Found direct database access: {', '.join(violations)}")

        print_info('✓ No database imports found')
        print_info('✓ Uses requests for API calls only')
        print_info('✓ Follows microservices architecture')
        print_success("13. Verify No Direct Database Access")
        return True
    except Exception as e:
        print_error("13. Verify No Direct Database Access", str(e))
        return False


# ============================================================================
# Test 14: Invalid API Key (should fail)
# ============================================================================

def test_invalid_api_key():
    """Test that invalid API key is rejected"""
    print_test("14. Invalid API Key (should fail)")
    try:
        # Create client with invalid key
        invalid_client = BackendAPIClient(api_key='invalid_key_12345')

        try:
            invalid_client.check_health()
            raise Exception("Should have failed with invalid API key")
        except Exception as e:
            if '403' in str(e) or 'Forbidden' in str(e):
                print_info("Correctly rejected invalid API key (403)")
                print_success("14. Invalid API Key (should fail)")
                return True
            else:
                raise e
    except Exception as e:
        print_error("14. Invalid API Key (should fail)", str(e))
        return False


# ============================================================================
# Main Test Runner
# ============================================================================

def run_tests():
    """Run all tests"""
    print_header("ML Engine Backend API Client Tests - Phase 5")

    # Initialize client
    client = get_client()
    print(f"Base URL: {client.base_url}")
    print(f"API Key: {client.api_key[:20]}...")
    print()

    # Define tests
    tests = [
        (test_health_check, client),
        (test_register_model_version, client),
        (test_update_model_status, client),
        (test_log_training_session, client),
        (test_submit_prediction, client),
        (test_update_prediction_outcome, client),
        (test_get_prediction_accuracy, client),
        (test_get_market_data, client),
        (test_get_historical_signals, client),
        (test_get_user_trades, client),
        (test_get_training_data_stats, client),
        (test_get_model_versions, client),
        (test_no_direct_database_access, None),
        (test_invalid_api_key, None),
    ]

    passed = 0
    failed = 0

    for test_func, *args in tests:
        try:
            if args and args[0] is not None:
                result = test_func(args[0])
            else:
                result = test_func()

            if result:
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print_error(f"Test {test_func.__name__}", str(e))
            failed += 1

    # Summary
    print_header("Test Summary")
    print(f"{Colors.GREEN}✅ Passed: {passed}{Colors.RESET}")
    print(f"{Colors.RED}❌ Failed: {failed}{Colors.RESET}")
    print(f"{Colors.BLUE}📊 Total:  {len(tests)}{Colors.RESET}")
    print()

    if failed == 0:
        print(f"{Colors.GREEN}🎉 All tests passed!{Colors.RESET}\n")
        return 0
    else:
        print(f"{Colors.YELLOW}⚠️  Some tests failed. Please review the errors above.{Colors.RESET}\n")
        return 1


if __name__ == '__main__':
    exit_code = run_tests()
    sys.exit(exit_code)
