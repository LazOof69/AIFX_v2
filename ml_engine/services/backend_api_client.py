"""
Backend API Client for ML Engine

This module provides a Python client for ML Engine to communicate with Backend APIs.
Following microservices architecture principles (CLAUDE.md):
- ML Engine MUST NOT access database directly
- All data access goes through Backend REST APIs
- Uses API Key authentication

Author: Claude Code
Created: 2025-11-21
"""

import os
import requests
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BackendAPIClient:
    """
    Backend API Client for ML Engine

    Provides methods to:
    - Fetch training data (market data, signals, trades)
    - Submit predictions
    - Register model versions
    - Log training sessions
    """

    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None):
        """
        Initialize Backend API Client

        Args:
            base_url (str, optional): Backend API base URL. Defaults to env var.
            api_key (str, optional): ML Engine API key. Defaults to env var.
        """
        self.base_url = base_url or os.getenv('BACKEND_API_URL', 'http://localhost:3000')
        self.api_key = api_key or os.getenv('ML_ENGINE_API_KEY', 'dev_ml_engine_key_replace_in_production')

        # Remove trailing slash
        if self.base_url.endswith('/'):
            self.base_url = self.base_url[:-1]

        # Setup session with default headers
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
            'X-Service-Name': 'ml-engine',
        })

        logger.info(f"BackendAPIClient initialized: {self.base_url}")

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """
        Make HTTP request to Backend API

        Args:
            method (str): HTTP method (GET, POST, PUT, DELETE)
            endpoint (str): API endpoint (e.g., '/api/v1/ml/health')
            **kwargs: Additional arguments for requests

        Returns:
            dict: Response data

        Raises:
            requests.HTTPError: If request fails
        """
        url = f"{self.base_url}{endpoint}"

        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()

            data = response.json()

            # Backend API returns {success, data, error, metadata}
            if not data.get('success'):
                error_msg = data.get('error', {}).get('message', 'Unknown error')
                raise Exception(f"API Error: {error_msg}")

            return data.get('data')

        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed: {method} {url} - {str(e)}")
            raise

    # ============================================================================
    # Health Check
    # ============================================================================

    def check_health(self) -> Dict[str, Any]:
        """
        Check Backend API health

        Returns:
            dict: Health status
        """
        return self._request('GET', '/api/v1/ml/health')

    # ============================================================================
    # Training Data APIs
    # ============================================================================

    def get_market_data(
        self,
        pair: str,
        timeframe: str = '1h',
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 1000,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get market data for training

        Args:
            pair (str): Currency pair (e.g., 'EUR/USD')
            timeframe (str): Timeframe ('1h', '4h', '1d')
            start_date (str, optional): Start date (ISO format)
            end_date (str, optional): End date (ISO format)
            limit (int): Number of records to fetch
            offset (int): Pagination offset

        Returns:
            dict: {pair, timeframe, marketData[], pagination}
        """
        params = {
            'timeframe': timeframe,
            'limit': limit,
            'offset': offset,
        }

        if start_date:
            params['startDate'] = start_date
        if end_date:
            params['endDate'] = end_date

        # URL encode the pair to handle slashes
        from urllib.parse import quote
        encoded_pair = quote(pair, safe='')

        return self._request('GET', f'/api/v1/ml/training-data/market/{encoded_pair}', params=params)

    def get_historical_signals(
        self,
        pair: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 1000,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get historical trading signals

        Args:
            pair (str, optional): Currency pair filter
            start_date (str, optional): Start date (ISO format)
            end_date (str, optional): End date (ISO format)
            limit (int): Number of records to fetch
            offset (int): Pagination offset

        Returns:
            dict: {signals[], pagination}
        """
        params = {
            'limit': limit,
            'offset': offset,
        }

        if pair:
            params['pair'] = pair
        if start_date:
            params['startDate'] = start_date
        if end_date:
            params['endDate'] = end_date

        return self._request('GET', '/api/v1/ml/training-data/signals', params=params)

    def get_user_trades(
        self,
        pair: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 1000,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get user trading history

        Args:
            pair (str, optional): Currency pair filter
            start_date (str, optional): Start date (ISO format)
            end_date (str, optional): End date (ISO format)
            limit (int): Number of records to fetch
            offset (int): Pagination offset

        Returns:
            dict: {trades[], pagination}
        """
        params = {
            'limit': limit,
            'offset': offset,
        }

        if pair:
            params['pair'] = pair
        if start_date:
            params['startDate'] = start_date
        if end_date:
            params['endDate'] = end_date

        return self._request('GET', '/api/v1/ml/training-data/trades', params=params)

    def get_training_data_stats(self, pair: Optional[str] = None) -> Dict[str, Any]:
        """
        Get training data statistics

        Args:
            pair (str, optional): Currency pair filter

        Returns:
            dict: {marketData, signals, trades} with counts and date ranges
        """
        params = {}
        if pair:
            params['pair'] = pair

        return self._request('GET', '/api/v1/ml/training-data/stats', params=params)

    # ============================================================================
    # Model Management APIs
    # ============================================================================

    def register_model_version(
        self,
        model_name: str,
        version: str,
        algorithm: str,
        hyperparameters: Dict[str, Any],
        training_metrics: Dict[str, Any],
        training_data_info: Dict[str, Any],
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Register a new model version

        Args:
            model_name (str): Model name (e.g., 'signal_predictor_v2')
            version (str): Version string (e.g., '2.0.0')
            algorithm (str): Algorithm name (e.g., 'LSTM', 'RandomForest')
            hyperparameters (dict): Model hyperparameters
            training_metrics (dict): Training performance metrics
            training_data_info (dict): Information about training data
            description (str, optional): Model description

        Returns:
            dict: {modelId, modelName, version, message}
        """
        payload = {
            'modelName': model_name,
            'version': version,
            'algorithm': algorithm,
            'hyperparameters': hyperparameters,
            'trainingMetrics': training_metrics,
            'trainingDataInfo': training_data_info,
        }

        if description:
            payload['description'] = description

        return self._request('POST', '/api/v1/ml/models/version', json=payload)

    def update_model_status(
        self,
        model_id: str,
        status: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Update model status

        Args:
            model_id (str): Model ID
            status (str, optional): Status ('trained', 'testing', 'deployed', 'retired')
            is_active (bool, optional): Whether model is active

        Returns:
            dict: {modelId, status, isActive, message}
        """
        payload = {}
        if status:
            payload['status'] = status
        if is_active is not None:
            payload['isActive'] = is_active

        return self._request('PUT', f'/api/v1/ml/models/{model_id}/status', json=payload)

    def get_model_versions(
        self,
        model_name: Optional[str] = None,
        is_active: Optional[bool] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get model versions

        Args:
            model_name (str, optional): Filter by model name
            is_active (bool, optional): Filter by active status
            limit (int): Number of records
            offset (int): Pagination offset

        Returns:
            dict: {models[], pagination}
        """
        params = {
            'limit': limit,
            'offset': offset,
        }

        if model_name:
            params['modelName'] = model_name
        if is_active is not None:
            params['isActive'] = str(is_active).lower()

        return self._request('GET', '/api/v1/ml/models', params=params)

    def log_training_session(
        self,
        model_id: str,
        model_version: str,
        training_type: str,
        data_start_date: str,
        data_end_date: str,
        num_samples: int,
        training_metrics: Dict[str, Any],
        validation_metrics: Dict[str, Any],
        hyperparameters: Dict[str, Any],
        duration: int,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Log a training session

        Args:
            model_id (str): Model ID
            model_version (str): Model version
            training_type (str): Training type ('full', 'incremental')
            data_start_date (str): Training data start date
            data_end_date (str): Training data end date
            num_samples (int): Number of training samples
            training_metrics (dict): Training metrics
            validation_metrics (dict): Validation metrics
            hyperparameters (dict): Hyperparameters used
            duration (int): Training duration in seconds
            notes (str, optional): Additional notes

        Returns:
            dict: {logId, modelId, message}
        """
        payload = {
            'modelVersion': model_version,
            'trainingType': training_type,
            'dataStartDate': data_start_date,
            'dataEndDate': data_end_date,
            'numSamples': num_samples,
            'trainingMetrics': training_metrics,
            'validationMetrics': validation_metrics,
            'hyperparameters': hyperparameters,
            'duration': duration,
        }

        if notes:
            payload['notes'] = notes

        return self._request('POST', f'/api/v1/ml/models/{model_id}/training-logs', json=payload)

    # ============================================================================
    # Prediction APIs
    # ============================================================================

    def submit_prediction(
        self,
        pair: str,
        timeframe: str,
        signal: str,
        confidence: float,
        factors: Dict[str, float],
        entry_price: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        risk_reward_ratio: Optional[float] = None,
        position_size: Optional[float] = None,
        signal_strength: str = 'moderate',
        market_condition: Optional[str] = None,
        technical_data: Optional[Dict[str, Any]] = None,
        model_version_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Submit a new prediction

        Args:
            pair (str): Currency pair
            timeframe (str): Timeframe
            signal (str): Signal type ('buy', 'sell', 'hold')
            confidence (float): Confidence score (0.0-1.0)
            factors (dict): Prediction factors {technical, sentiment, pattern}
            entry_price (float): Recommended entry price
            stop_loss (float, optional): Stop loss level
            take_profit (float, optional): Take profit level
            risk_reward_ratio (float, optional): Risk/reward ratio
            position_size (float, optional): Recommended position size
            signal_strength (str): Signal strength ('weak', 'moderate', 'strong')
            market_condition (str, optional): Market condition
            technical_data (dict, optional): Technical indicator values
            model_version_id (str, optional): Model version ID

        Returns:
            dict: {predictionId, signal, pair, confidence, message}
        """
        payload = {
            'pair': pair,
            'timeframe': timeframe,
            'signal': signal,
            'confidence': confidence,
            'factors': factors,
            'entryPrice': entry_price,
            'signalStrength': signal_strength,
        }

        if stop_loss is not None:
            payload['stopLoss'] = stop_loss
        if take_profit is not None:
            payload['takeProfit'] = take_profit
        if risk_reward_ratio is not None:
            payload['riskRewardRatio'] = risk_reward_ratio
        if position_size is not None:
            payload['positionSize'] = position_size
        if market_condition:
            payload['marketCondition'] = market_condition
        if technical_data:
            payload['technicalData'] = technical_data
        if model_version_id:
            payload['modelVersionId'] = model_version_id

        return self._request('POST', '/api/v1/ml/predictions', json=payload)

    def update_prediction_outcome(
        self,
        prediction_id: str,
        outcome: str,
        actual_pnl: Optional[float] = None,
        actual_pnl_percent: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Update prediction outcome

        Args:
            prediction_id (str): Prediction ID
            outcome (str): Outcome ('win', 'loss', 'breakeven')
            actual_pnl (float, optional): Actual P&L
            actual_pnl_percent (float, optional): Actual P&L percentage

        Returns:
            dict: {outcome, actualPnL, actualPnLPercent, message}
        """
        payload = {
            'outcome': outcome,
        }

        if actual_pnl is not None:
            payload['actualPnL'] = actual_pnl
        if actual_pnl_percent is not None:
            payload['actualPnLPercent'] = actual_pnl_percent

        return self._request('PUT', f'/api/v1/ml/predictions/{prediction_id}/outcome', json=payload)

    def get_recent_predictions(
        self,
        pair: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get recent predictions

        Args:
            pair (str, optional): Filter by pair
            limit (int): Number of records
            offset (int): Pagination offset

        Returns:
            dict: {predictions[], pagination}
        """
        params = {
            'limit': limit,
            'offset': offset,
        }

        if pair:
            params['pair'] = pair

        return self._request('GET', '/api/v1/ml/predictions', params=params)

    def get_prediction_accuracy(
        self,
        pair: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get prediction accuracy statistics

        Args:
            pair (str, optional): Filter by pair
            start_date (str, optional): Start date
            end_date (str, optional): End date

        Returns:
            dict: {overall, byPair, byTimeframe} statistics
        """
        params = {}

        if pair:
            params['pair'] = pair
        if start_date:
            params['startDate'] = start_date
        if end_date:
            params['endDate'] = end_date

        return self._request('GET', '/api/v1/ml/predictions/accuracy', params=params)


# Singleton instance
_client_instance = None


def get_client() -> BackendAPIClient:
    """
    Get singleton BackendAPIClient instance

    Returns:
        BackendAPIClient: Singleton client instance
    """
    global _client_instance

    if _client_instance is None:
        _client_instance = BackendAPIClient()

    return _client_instance


# Example usage
if __name__ == '__main__':
    # Initialize client
    client = get_client()

    # Test health check
    print("Testing Backend API Client...")
    health = client.check_health()
    print(f"✅ Health Check: {health}")

    # Test get training data stats
    stats = client.get_training_data_stats(pair='EUR/USD')
    print(f"✅ Training Data Stats: {stats}")
