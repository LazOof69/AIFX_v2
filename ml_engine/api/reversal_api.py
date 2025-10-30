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

from api.model_manager import ModelManager
from api.prediction_service import PredictionService
from api.ab_testing import ABTestingFramework
from data_processing.preprocessor import DataPreprocessor
from utils.indicators import calculate_model_indicators

logger = logging.getLogger(__name__)

# GMT+8 timezone
GMT_PLUS_8 = timezone(timedelta(hours=8))


def get_current_timestamp() -> str:
    """Get current timestamp in GMT+8"""
    return datetime.now(GMT_PLUS_8).isoformat()


def get_active_model_config(service: 'PredictionService') -> Dict[str, Any]:
    """
    Get configuration from active model version

    Dynamically loads paths and settings from the currently active model,
    ensuring API preprocessing matches the loaded model's requirements.

    Supports both flat and nested metadata formats for compatibility:
    - v3.2: flat structure with sequence_length at root level
    - v3.1: nested structure with architecture.sequence_length

    Args:
        service: PredictionService instance

    Returns:
        dict: Configuration with:
            - version: Model version string
            - features_path: Path to features JSON
            - metadata_path: Path to metadata JSON
            - scaler_path: Path to scaler PKL
            - features_list: List of feature names
            - sequence_length: LSTM sequence length
            - metadata: Full metadata dict

    Raises:
        HTTPException: If active model not found or config invalid
    """
    active_version = service.model_manager.get_active_version()

    if not active_version:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No active model version loaded"
        )

    logger.info(f"Loading config from active model: {active_version.version}")

    config = {
        'version': active_version.version,
        'features_path': active_version.features_path,
        'metadata_path': active_version.metadata_path,
        'scaler_path': active_version.scaler_path
    }

    # Load features list
    try:
        import json
        with open(config['features_path'], 'r') as f:
            features_data = json.load(f)
            # Handle both dict and list formats
            if isinstance(features_data, dict):
                config['features_list'] = features_data.get('features', features_data)
            else:
                config['features_list'] = features_data

        logger.info(f"  ✅ Loaded {len(config['features_list'])} features from {active_version.version}")
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Features file not found: {config['features_path']}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load features: {str(e)}"
        )

    # Load metadata (support both flat and nested structures)
    try:
        with open(config['metadata_path'], 'r') as f:
            metadata = json.load(f)

            # Try nested structure first (v3.1 format)
            if 'architecture' in metadata:
                config['sequence_length'] = metadata['architecture']['sequence_length']
                logger.info(f"  📐 Sequence length: {config['sequence_length']} (nested format)")
            # Fall back to flat structure (v3.2 format)
            elif 'sequence_length' in metadata:
                config['sequence_length'] = metadata['sequence_length']
                logger.info(f"  📐 Sequence length: {config['sequence_length']} (flat format)")
            else:
                raise ValueError("Metadata missing sequence_length field")

            config['metadata'] = metadata
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Metadata file not found: {config['metadata_path']}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load metadata: {str(e)}"
        )

    logger.info(f"  ✅ Config loaded for {active_version.version}: {len(config['features_list'])} features, seq_len={config['sequence_length']}")

    return config


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

        # Get configuration from active model (supports v3.1, v3.2, etc.)
        config = get_active_model_config(service)
        expected_features = config['features_list']
        logger.info(f"Model {config['version']} requires {len(expected_features)} features")

        # Calculate ONLY the technical indicators needed by the model
        # This optimized function only drops ~50 rows (max lookback) instead of 200+
        try:
            df = calculate_model_indicators(df, features_list=expected_features)
            logger.info(f"Technical indicators calculated: {len(df)} rows remaining after preprocessing")
        except Exception as e:
            logger.error(f"Failed to calculate indicators: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to calculate technical indicators: {str(e)}"
            )

        # Verify all required features are present
        available_features = [col for col in expected_features if col in df.columns]
        missing_features = [col for col in expected_features if col not in df.columns]

        if missing_features:
            logger.error(f"Missing {len(missing_features)} features: {missing_features}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Feature calculation failed. Missing features: {missing_features}"
            )

        logger.info(f"✅ All {len(available_features)} required features present")

        # Select features for model
        df_features = df[expected_features].copy()

        # Use minimum sequence length from active model config
        min_sequence_length = config['sequence_length']

        if len(df_features) < min_sequence_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient data after preprocessing. Need {min_sequence_length}+ candles, got {len(df_features)}. Try providing more historical data (100+ candles recommended)."
            )

        logger.info(f"✅ Preprocessing complete: {len(df_features)} rows available for prediction")

        # Load scaler and prepare features from active model config
        try:
            # Try to load scaler if available
            scaler = None
            if config.get('scaler_path') and os.path.exists(config['scaler_path']):
                try:
                    import joblib
                    scaler = joblib.load(config['scaler_path'])
                    logger.info(f"Loaded scaler from {config['scaler_path']}")
                except Exception as scaler_err:
                    logger.warning(f"Failed to load scaler: {scaler_err}")
                    logger.warning("Continuing without scaling (model may have been trained on raw features)")

            # Scale features or use raw features
            if scaler is not None:
                scaled_features = scaler.transform(df_features.values)
                logger.info(f"Features scaled: {scaled_features.shape}")
            else:
                scaled_features = df_features.values
                logger.info(f"Using raw features (no scaling): {scaled_features.shape}")

            # Use sequence length from config
            sequence_length = config['sequence_length']
            logger.info(f"Model sequence length: {sequence_length}")

            # Take last N candles for prediction
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

        except HTTPException:
            raise  # Re-raise HTTP exceptions
        except Exception as e:
            logger.error(f"Error preprocessing features: {e}", exc_info=True)
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

        # Get configuration from active model (same as predict_raw)
        config = get_active_model_config(service)
        expected_features = config['features_list']

        df = calculate_model_indicators(df, features_list=expected_features)
        df_features = df[expected_features].copy()

        # Use sequence length from active model config
        sequence_length = config['sequence_length']

        if len(df_features) < sequence_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient data. Need {sequence_length}+ candles, got {len(df_features)}"
            )

        # Load scaler and prepare from active model config
        import joblib
        scaler = joblib.load(config['scaler_path'])
        scaled_features = scaler.transform(df_features.values)

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
