#!/usr/bin/env python3
"""
Reversal Prediction API Routes for AIFX_v2 ML Engine

FastAPI routes for reversal detection and direction classification.
Supports model versioning and A/B testing.

Author: AI-assisted
Created: 2025-10-16
"""

from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Optional, Any
import numpy as np
import pandas as pd
import logging
from datetime import datetime, timezone, timedelta
import sys
import os

# Add parent directory for data_processing import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from model_manager import ModelManager
from prediction_service import PredictionService
from ab_testing import ABTestingFramework
from data_processing.preprocessor import DataPreprocessor
from utils.indicators import calculate_all_indicators

logger = logging.getLogger(__name__)

# GMT+8 timezone
GMT_PLUS_8 = timezone(timedelta(hours=8))


def get_current_timestamp() -> str:
    """Get current timestamp in GMT+8"""
    return datetime.now(GMT_PLUS_8).isoformat()


# Initialize router
router = APIRouter(prefix="/reversal", tags=["Reversal Prediction"])


# Pydantic models for request/response validation

class MarketDataPoint(BaseModel):
    """Single market data point"""
    timestamp: Optional[str] = None
    open: float
    high: float
    low: float
    close: float
    volume: Optional[float] = 0.0


class ReversalPredictionRequest(BaseModel):
    """Request model for reversal prediction"""
    pair: str = Field(..., description="Currency pair (e.g., EUR/USD)")
    timeframe: str = Field(default="1h", description="Timeframe")
    data: List[MarketDataPoint] = Field(..., description="Historical market data (60+ candles)")
    features: Optional[List[float]] = Field(None, description="Preprocessed features (if available)")
    version: Optional[str] = Field(None, description="Model version (v3.0, v3.1, or None for active)")

    @validator('pair')
    def validate_pair(cls, v):
        if not v or '/' not in v:
            raise ValueError('Invalid currency pair format. Expected XXX/XXX')
        return v

    @validator('data')
    def validate_data(cls, v):
        if len(v) < 20:
            raise ValueError('Insufficient data points. Need at least 20 candles for prediction')
        return v


class ReversalPredictionResponse(BaseModel):
    """Response model for reversal prediction"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: str

    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "pair": "EUR/USD",
                    "timeframe": "1h",
                    "signal": "long",
                    "confidence": 0.75,
                    "stage1_prob": 0.82,
                    "stage2_prob": 0.68,
                    "model_version": "v3.1",
                    "factors": {
                        "reversal_detected": True,
                        "direction": "long"
                    },
                    "timestamp": "2025-10-16T10:30:00Z"
                },
                "error": None,
                "timestamp": "2025-10-16T10:30:00+08:00"
            }
        }


class ModelVersionsResponse(BaseModel):
    """Response model for model versions info"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: str


class ComparisonRequest(BaseModel):
    """Request model for version comparison"""
    pair: str
    timeframe: str = "1h"
    data: List[MarketDataPoint]
    features: Optional[List[float]] = None
    versions: List[str] = Field(default=['v3.0', 'v3.1'], description="Versions to compare")


# Dependency: Get prediction service
def get_prediction_service() -> PredictionService:
    """Get prediction service instance (will be injected by main server)"""
    # This will be set by the main ml_server.py when mounting the router
    if not hasattr(router, 'prediction_service'):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Prediction service not initialized"
        )
    return router.prediction_service


# API Endpoints

@router.post("/predict", response_model=ReversalPredictionResponse)
async def predict_reversal(request: ReversalPredictionRequest):
    """
    Predict market reversal using two-stage model

    Returns:
        - signal: 'hold', 'long', or 'short'
        - confidence: Overall confidence (0.0-1.0)
        - stage1_prob: Reversal detection probability
        - stage2_prob: Direction classification probability (if reversal detected)
        - model_version: Version used for prediction
    """
    try:
        logger.info(f"Reversal prediction request: {request.pair} {request.timeframe} (version: {request.version or 'active'})")

        # Get prediction service
        service = get_prediction_service()

        # Preprocess data if features not provided
        if request.features:
            # Features already preprocessed
            features_array = np.array(request.features)
            # Reshape to (1, sequence_length, num_features)
            if features_array.ndim == 2:
                market_data = features_array.reshape(1, features_array.shape[0], features_array.shape[1])
            else:
                market_data = features_array.reshape(1, -1)
        else:
            # TODO: Implement preprocessing from raw market data
            # For now, return error
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Feature preprocessing not yet implemented. Please provide preprocessed features."
            )

        # Make prediction
        prediction = service.predict_reversal(market_data, version=request.version)

        # Format response
        response_data = {
            "pair": request.pair,
            "timeframe": request.timeframe,
            "signal": prediction['signal'],
            "confidence": prediction['confidence'],
            "stage1_prob": prediction['stage1_prob'],
            "stage2_prob": prediction['stage2_prob'],
            "model_version": prediction['model_version'],
            "factors": {
                "reversal_detected": prediction['stage1_prob'] >= 0.5,
                "direction": prediction['signal'] if prediction['signal'] != 'hold' else None
            },
            "timestamp": prediction['timestamp']
        }

        if 'warning' in prediction:
            response_data['warning'] = prediction['warning']

        logger.info(f"Prediction result: {prediction['signal']} (confidence: {prediction['confidence']:.2f})")

        return ReversalPredictionResponse(
            success=True,
            data=response_data,
            error=None,
            timestamp=get_current_timestamp()
        )

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return ReversalPredictionResponse(
            success=False,
            data=None,
            error=str(e),
            timestamp=get_current_timestamp()
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        return ReversalPredictionResponse(
            success=False,
            data=None,
            error=f"Prediction failed: {str(e)}",
            timestamp=get_current_timestamp()
        )


@router.post("/predict_raw", response_model=ReversalPredictionResponse)
async def predict_reversal_raw(request: ReversalPredictionRequest):
    """
    Predict market reversal from RAW market data (with automatic preprocessing)

    This endpoint accepts raw OHLCV data and:
    1. Converts to DataFrame
    2. Calculates technical indicators
    3. Applies saved scaler
    4. Makes prediction

    Returns:
        - signal: 'hold', 'long', or 'short'
        - confidence: Overall confidence (0.0-1.0)
        - stage1_prob: Reversal detection probability
        - stage2_prob: Direction classification probability
    """
    try:
        logger.info(f"Raw reversal prediction request: {request.pair} {request.timeframe} ({len(request.data)} candles)")

        # Get prediction service
        service = get_prediction_service()

        # Convert market data to DataFrame
        data_dict = [
            {
                'timestamp': pd.to_datetime(point.timestamp) if point.timestamp else None,
                'open': point.open,
                'high': point.high,
                'low': point.low,
                'close': point.close,
                'volume': point.volume or 0.0
            }
            for point in request.data
        ]

        df = pd.DataFrame(data_dict)

        # Sort by timestamp if available
        if 'timestamp' in df.columns and df['timestamp'].notna().all():
            df = df.sort_values('timestamp')

        logger.info(f"DataFrame created with {len(df)} rows")

        # Calculate technical indicators
        try:
            df = calculate_all_indicators(df)
            logger.info(f"Technical indicators calculated: {len(df.columns)} total columns")
        except Exception as e:
            logger.error(f"Failed to calculate indicators: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to calculate technical indicators: {str(e)}"
            )

        # Select features for prediction (12 features used by profitable model v3.1)
        # Load from the model's feature file
        import json
        features_path = '/root/AIFX_v2/ml_engine/models/trained/profitable_selected_features.json'
        with open(features_path, 'r') as f:
            features_config = json.load(f)
        expected_features = features_config['features']
        logger.info(f"Loaded {len(expected_features)} expected features from model config")

        # Filter only available features
        available_features = [col for col in expected_features if col in df.columns]
        missing_features = [col for col in expected_features if col not in df.columns]

        if missing_features:
            logger.warning(f"Missing {len(missing_features)} features: {missing_features[:5]}...")

        logger.info(f"Using {len(available_features)} features for prediction")

        df_features = df[available_features].copy()

        # Remove NaN rows (from indicator calculation at start of series)
        # Only drop rows where there are NaN values
        initial_len = len(df_features)
        df_features = df_features.dropna(how='any')
        dropped_rows = initial_len - len(df_features)

        logger.info(f"Dropped {dropped_rows} rows with NaN values, {len(df_features)} rows remaining")

        if len(df_features) < 60:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient data after preprocessing. Need 60+ candles, got {len(df_features)}. Try providing more historical data (150+ candles recommended)."
            )

        logger.info(f"After cleaning: {len(df_features)} rows available")

        # Load scaler and prepare features
        try:
            # Use the profitable model's scaler
            scaler_path = '/root/AIFX_v2/ml_engine/models/trained/profitable_feature_scaler.pkl'

            import joblib
            scaler = joblib.load(scaler_path)
            logger.info(f"Loaded scaler from {scaler_path}")

            # Scale features
            scaled_features = scaler.transform(df_features.values)
            logger.info(f"Features scaled: {scaled_features.shape}")

            # Take last 60 candles for prediction (sequence length = 60)
            sequence_length = 60
            if len(scaled_features) >= sequence_length:
                features_sequence = scaled_features[-sequence_length:]
                # Reshape to (1, sequence_length, num_features) for LSTM
                market_data = features_sequence.reshape(1, sequence_length, -1)
                logger.info(f"Prepared sequence: {market_data.shape}")
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Need {sequence_length} candles, got {len(scaled_features)}"
                )

        except FileNotFoundError:
            logger.error(f"Scaler file not found at {scaler_path}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Model scaler not found. Please train the model first."
            )
        except Exception as e:
            logger.error(f"Error loading scaler or preprocessing: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Preprocessing failed: {str(e)}"
            )

        # Make prediction
        prediction = service.predict_reversal(market_data, version=request.version)

        # Format response
        response_data = {
            "pair": request.pair,
            "timeframe": request.timeframe,
            "signal": prediction['signal'],
            "confidence": prediction['confidence'],
            "stage1_prob": prediction['stage1_prob'],
            "stage2_prob": prediction['stage2_prob'],
            "model_version": prediction['model_version'],
            "factors": {
                "reversal_detected": prediction['stage1_prob'] >= 0.5,
                "direction": prediction['signal'] if prediction['signal'] != 'hold' else None
            },
            "timestamp": prediction['timestamp']
        }

        if 'warning' in prediction:
            response_data['warning'] = prediction['warning']

        logger.info(f"✅ Prediction result: {prediction['signal']} (confidence: {prediction['confidence']:.2f})")

        return ReversalPredictionResponse(
            success=True,
            data=response_data,
            error=None,
            timestamp=get_current_timestamp()
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Raw prediction error: {e}", exc_info=True)
        return ReversalPredictionResponse(
            success=False,
            data=None,
            error=f"Prediction failed: {str(e)}",
            timestamp=get_current_timestamp()
        )


@router.post("/compare_raw", response_model=ReversalPredictionResponse)
async def compare_versions_raw(request: ComparisonRequest):
    """
    Compare predictions from multiple model versions using RAW market data

    Similar to predict_raw but compares multiple model versions
    """
    try:
        logger.info(f"Raw version comparison: {request.pair} {request.timeframe} (versions: {request.versions})")

        # Get prediction service
        service = get_prediction_service()

        # Convert and preprocess data (same as predict_raw)
        data_dict = [
            {
                'timestamp': pd.to_datetime(point.timestamp) if point.timestamp else None,
                'open': point.open,
                'high': point.high,
                'low': point.low,
                'close': point.close,
                'volume': point.volume or 0.0
            }
            for point in request.data
        ]

        df = pd.DataFrame(data_dict)
        if 'timestamp' in df.columns and df['timestamp'].notna().all():
            df = df.sort_values('timestamp')

        # Calculate indicators and prepare features (same preprocessing logic)
        df = calculate_all_indicators(df)

        # Load features from model config
        import json
        features_path = '/root/AIFX_v2/ml_engine/models/trained/profitable_selected_features.json'
        with open(features_path, 'r') as f:
            features_config = json.load(f)
        expected_features = features_config['features']

        available_features = [col for col in expected_features if col in df.columns]
        df_features = df[available_features].dropna()

        if len(df_features) < 60:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient data. Need 60+ candles, got {len(df_features)}"
            )

        # Load scaler and prepare
        import joblib
        scaler_path = '/root/AIFX_v2/ml_engine/models/trained/profitable_feature_scaler.pkl'
        scaler = joblib.load(scaler_path)
        scaled_features = scaler.transform(df_features.values)

        sequence_length = 60
        features_sequence = scaled_features[-sequence_length:]
        market_data = features_sequence.reshape(1, sequence_length, -1)

        # Compare versions
        comparison = service.compare_versions(market_data, request.versions)

        response_data = {
            "pair": request.pair,
            "timeframe": request.timeframe,
            "predictions": comparison['predictions'],
            "consensus": comparison['consensus'],
            "disagreement": comparison['disagreement'],
            "timestamp": comparison['timestamp']
        }

        logger.info(f"Comparison complete: consensus={comparison['consensus']}")

        return ReversalPredictionResponse(
            success=True,
            data=response_data,
            error=None,
            timestamp=get_current_timestamp()
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Raw comparison error: {e}", exc_info=True)
        return ReversalPredictionResponse(
            success=False,
            data=None,
            error=f"Comparison failed: {str(e)}",
            timestamp=get_current_timestamp()
        )


@router.post("/compare", response_model=ReversalPredictionResponse)
async def compare_versions(request: ComparisonRequest):
    """
    Compare predictions from multiple model versions

    Useful for A/B testing and model evaluation
    """
    try:
        logger.info(f"Version comparison request: {request.pair} {request.timeframe}")
        logger.info(f"Comparing versions: {request.versions}")

        # Get prediction service
        service = get_prediction_service()

        # Preprocess data (same as predict endpoint)
        if request.features:
            features_array = np.array(request.features)
            if features_array.ndim == 2:
                market_data = features_array.reshape(1, features_array.shape[0], features_array.shape[1])
            else:
                market_data = features_array.reshape(1, -1)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Feature preprocessing not yet implemented. Please provide preprocessed features."
            )

        # Compare versions
        comparison = service.compare_versions(market_data, request.versions)

        # Format response
        response_data = {
            "pair": request.pair,
            "timeframe": request.timeframe,
            "predictions": comparison['predictions'],
            "consensus": comparison['consensus'],
            "disagreement": comparison['disagreement'],
            "timestamp": comparison['timestamp']
        }

        logger.info(f"Comparison result: consensus={comparison['consensus']}, disagreement={comparison['disagreement']}")

        return ReversalPredictionResponse(
            success=True,
            data=response_data,
            error=None,
            timestamp=get_current_timestamp()
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Comparison error: {e}", exc_info=True)
        return ReversalPredictionResponse(
            success=False,
            data=None,
            error=f"Comparison failed: {str(e)}",
            timestamp=get_current_timestamp()
        )


@router.get("/models", response_model=ModelVersionsResponse)
async def list_models():
    """
    List all available model versions and their status
    """
    try:
        service = get_prediction_service()
        versions_info = service.model_manager.get_versions_info()

        return ModelVersionsResponse(
            success=True,
            data=versions_info,
            error=None,
            timestamp=get_current_timestamp()
        )

    except Exception as e:
        logger.error(f"Error listing models: {e}", exc_info=True)
        return ModelVersionsResponse(
            success=False,
            data=None,
            error=str(e),
            timestamp=get_current_timestamp()
        )


@router.get("/models/{version}", response_model=ModelVersionsResponse)
async def get_model_info(version: str):
    """
    Get detailed information about a specific model version
    """
    try:
        service = get_prediction_service()
        model_info = service.get_model_info(version)

        if 'error' in model_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=model_info['error']
            )

        return ModelVersionsResponse(
            success=True,
            data=model_info,
            error=None,
            timestamp=get_current_timestamp()
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Error getting model info: {e}", exc_info=True)
        return ModelVersionsResponse(
            success=False,
            data=None,
            error=str(e),
            timestamp=get_current_timestamp()
        )


@router.post("/models/{version}/switch", response_model=ModelVersionsResponse)
async def switch_model_version(version: str):
    """
    Switch to a different model version
    """
    try:
        logger.info(f"Switching to model version: {version}")

        service = get_prediction_service()
        success = service.model_manager.switch_version(version)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to switch to version {version}"
            )

        active_version = service.model_manager.get_active_version()

        return ModelVersionsResponse(
            success=True,
            data={
                "message": f"Switched to version {version}",
                "active_version": active_version.get_info()
            },
            error=None,
            timestamp=get_current_timestamp()
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Error switching model version: {e}", exc_info=True)
        return ModelVersionsResponse(
            success=False,
            data=None,
            error=str(e),
            timestamp=get_current_timestamp()
        )


# A/B Testing Endpoints

class ABExperimentRequest(BaseModel):
    """Request model for creating A/B experiment"""
    experiment_id: str
    name: str
    description: str
    variant_a: str = Field(..., description="Model version for variant A")
    variant_b: str = Field(..., description="Model version for variant B")
    traffic_split: float = Field(default=0.5, description="Traffic split for variant A (0.0-1.0)")


class ABExperimentResponse(BaseModel):
    """Response model for A/B experiment operations"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: str


@router.post("/experiments", response_model=ABExperimentResponse, tags=["A/B Testing"])
async def create_experiment(request: ABExperimentRequest):
    """
    Create a new A/B test experiment

    Allows comparing two model versions (e.g., v3.0 vs v3.1)
    """
    try:
        logger.info(f"Creating A/B experiment: {request.experiment_id}")

        # Get A/B testing framework (will be injected)
        if not hasattr(router, 'ab_framework'):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="A/B testing framework not initialized"
            )

        ab_framework: ABTestingFramework = router.ab_framework

        experiment = ab_framework.create_experiment(
            experiment_id=request.experiment_id,
            name=request.name,
            description=request.description,
            variant_a=request.variant_a,
            variant_b=request.variant_b,
            traffic_split=request.traffic_split
        )

        return ABExperimentResponse(
            success=True,
            data=experiment.get_metrics(),
            error=None,
            timestamp=get_current_timestamp()
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Error creating experiment: {e}", exc_info=True)
        return ABExperimentResponse(
            success=False,
            data=None,
            error=str(e),
            timestamp=get_current_timestamp()
        )


@router.post("/experiments/{experiment_id}/activate", response_model=ABExperimentResponse, tags=["A/B Testing"])
async def activate_experiment(experiment_id: str):
    """
    Activate an A/B test experiment

    Once activated, users will be automatically assigned to variants
    """
    try:
        logger.info(f"Activating experiment: {experiment_id}")

        if not hasattr(router, 'ab_framework'):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="A/B testing framework not initialized"
            )

        ab_framework: ABTestingFramework = router.ab_framework

        success = ab_framework.activate_experiment(experiment_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to activate experiment {experiment_id}"
            )

        return ABExperimentResponse(
            success=True,
            data={
                "message": f"Experiment {experiment_id} activated",
                "active_experiment": experiment_id
            },
            error=None,
            timestamp=get_current_timestamp()
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Error activating experiment: {e}", exc_info=True)
        return ABExperimentResponse(
            success=False,
            data=None,
            error=str(e),
            timestamp=get_current_timestamp()
        )


@router.get("/experiments", response_model=ABExperimentResponse, tags=["A/B Testing"])
async def list_experiments():
    """
    List all A/B test experiments
    """
    try:
        if not hasattr(router, 'ab_framework'):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="A/B testing framework not initialized"
            )

        ab_framework: ABTestingFramework = router.ab_framework

        experiments = ab_framework.list_experiments()

        return ABExperimentResponse(
            success=True,
            data={
                "experiments": experiments,
                "active_experiment": ab_framework.active_experiment
            },
            error=None,
            timestamp=get_current_timestamp()
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Error listing experiments: {e}", exc_info=True)
        return ABExperimentResponse(
            success=False,
            data=None,
            error=str(e),
            timestamp=get_current_timestamp()
        )


@router.get("/experiments/{experiment_id}/metrics", response_model=ABExperimentResponse, tags=["A/B Testing"])
async def get_experiment_metrics(experiment_id: str):
    """
    Get metrics for a specific A/B test experiment

    Returns prediction counts, signal distributions, and confidence scores
    for both variants
    """
    try:
        if not hasattr(router, 'ab_framework'):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="A/B testing framework not initialized"
            )

        ab_framework: ABTestingFramework = router.ab_framework

        metrics = ab_framework.get_experiment_metrics(experiment_id)

        if not metrics:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Experiment {experiment_id} not found"
            )

        return ABExperimentResponse(
            success=True,
            data=metrics,
            error=None,
            timestamp=get_current_timestamp()
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Error getting experiment metrics: {e}", exc_info=True)
        return ABExperimentResponse(
            success=False,
            data=None,
            error=str(e),
            timestamp=get_current_timestamp()
        )


@router.post("/experiments/{experiment_id}/stop", response_model=ABExperimentResponse, tags=["A/B Testing"])
async def stop_experiment(experiment_id: str):
    """
    Stop an A/B test experiment

    Stops collecting metrics and deactivates the experiment
    """
    try:
        logger.info(f"Stopping experiment: {experiment_id}")

        if not hasattr(router, 'ab_framework'):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="A/B testing framework not initialized"
            )

        ab_framework: ABTestingFramework = router.ab_framework

        success = ab_framework.stop_experiment(experiment_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to stop experiment {experiment_id}"
            )

        return ABExperimentResponse(
            success=True,
            data={
                "message": f"Experiment {experiment_id} stopped",
                "experiment_id": experiment_id
            },
            error=None,
            timestamp=get_current_timestamp()
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Error stopping experiment: {e}", exc_info=True)
        return ABExperimentResponse(
            success=False,
            data=None,
            error=str(e),
            timestamp=get_current_timestamp()
        )
