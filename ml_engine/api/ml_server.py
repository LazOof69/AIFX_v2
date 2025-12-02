"""
ML Server API for AIFX_v2
FastAPI-based REST API for machine learning predictions and model training
"""

# Fix for libgomp static TLS block error on ARM64
# MUST be done before any other imports
import os
import ctypes

# Disable curl-cffi for yfinance to avoid impersonation errors in systemd
# MUST be set before any import of yfinance or curl_cffi
os.environ['YF_NO_CURL_CFFI'] = '1'

# First, try to load the system libgomp
try:
    ctypes.CDLL('/usr/lib/aarch64-linux-gnu/libgomp.so.1', mode=ctypes.RTLD_GLOBAL)
except Exception:
    pass

# Then try to load sklearn's libgomp with RTLD_GLOBAL to reserve TLS early
try:
    sklearn_libgomp = '/root/AIFX_v2/ml_engine/venv/lib/python3.9/site-packages/scikit_learn.libs/libgomp-d22c30c5.so.1.0.0'
    if os.path.exists(sklearn_libgomp):
        ctypes.CDLL(sklearn_libgomp, mode=ctypes.RTLD_GLOBAL)
except Exception:
    pass

# Now import sklearn BEFORE torch to ensure TLS is allocated correctly
import sklearn
import numpy as np

from fastapi import FastAPI, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Optional, Any
import yaml
import logging
from datetime import datetime, timezone, timedelta
import sys
import os
import tensorflow as tf

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.price_predictor import PricePredictor
from data_processing.preprocessor import DataPreprocessor, load_data_from_dict
from data_processing.twelvedata_fetcher import TwelveDataFetcher

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# GMT+8 timezone
GMT_PLUS_8 = timezone(timedelta(hours=8))

def get_current_timestamp() -> str:
    """Get current timestamp in GMT+8"""
    return datetime.now(GMT_PLUS_8).isoformat()

# Load configuration
CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.yaml')
with open(CONFIG_PATH, 'r') as f:
    config = yaml.safe_load(f)

# Initialize FastAPI app
api_config = config.get('api', {})
app = FastAPI(
    title=api_config.get('title', 'AIFX_v2 ML Engine API'),
    description=api_config.get('description', 'Machine Learning API for forex price prediction'),
    version=api_config.get('version', '1.0.0')
)

# CORS configuration
cors_origins = api_config.get('cors_origins', ['http://localhost:3000', 'http://localhost:5173'])
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize model and preprocessor
preprocessor = DataPreprocessor(config)
predictor = PricePredictor(config)

# Try to load the latest model if available
latest_model = predictor.get_latest_model_path()
if latest_model:
    try:
        predictor.load_model(latest_model, preprocessor)
        logger.info(f"Loaded existing model from {latest_model}")
    except Exception as e:
        logger.warning(f"Could not load existing model: {e}")


# Pydantic models for request/response validation
class MarketDataPoint(BaseModel):
    """Single market data point"""
    timestamp: Optional[str] = None
    open: float
    high: float
    low: float
    close: float
    volume: Optional[float] = 0.0


class PredictionRequest(BaseModel):
    """Request model for price prediction"""
    pair: str = Field(..., description="Currency pair (e.g., EUR/USD)")
    timeframe: str = Field(default="1h", description="Timeframe")
    data: List[MarketDataPoint] = Field(..., description="Historical market data")
    add_indicators: bool = Field(default=True, description="Whether to add technical indicators")

    @validator('pair')
    def validate_pair(cls, v):
        if not v or '/' not in v:
            raise ValueError('Invalid currency pair format. Expected XXX/XXX')
        return v

    @validator('data')
    def validate_data(cls, v):
        if len(v) < 60:
            raise ValueError('Insufficient data points. Need at least 60 data points for prediction')
        return v


class PredictionResponse(BaseModel):
    """Response model for price prediction - follows claude.md format"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: str

    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "prediction": "buy",
                    "confidence": 0.75,
                    "predicted_price": 1.08543,
                    "factors": {
                        "technical": 0.75,
                        "sentiment": 0.5,
                        "pattern": 0.5
                    },
                    "timestamp": "2025-01-15T10:30:00Z"
                },
                "error": None,
                "timestamp": "2025-01-15T10:30:00Z"
            }
        }


class TrainingRequest(BaseModel):
    """Request model for model training"""
    pair: str = Field(..., description="Currency pair for training")
    data: List[MarketDataPoint] = Field(..., description="Historical market data for training")
    epochs: Optional[int] = Field(default=None, description="Number of training epochs")
    batch_size: Optional[int] = Field(default=None, description="Batch size for training")
    validation_split: Optional[float] = Field(default=None, description="Validation split ratio")

    @validator('data')
    def validate_training_data(cls, v):
        if len(v) < 100:
            raise ValueError('Insufficient data for training. Need at least 100 data points')
        return v


class TrainingResponse(BaseModel):
    """Response model for training"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: str


class HealthResponse(BaseModel):
    """Response model for health check"""
    status: str
    model_loaded: bool
    model_version: str
    timestamp: str
    environment: str


# API Endpoints

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint
    Returns the status of the ML engine
    """
    return HealthResponse(
        status="healthy",
        model_loaded=predictor.model is not None,
        model_version=predictor.model_version,
        timestamp=get_current_timestamp(),
        environment=config.get('environment', 'development')
    )


@app.post("/predict", response_model=PredictionResponse, tags=["Prediction"])
async def predict_price(request: PredictionRequest):
    """
    Predict future price movement

    Returns prediction following the claude.md ML Model Integration format:
    {
        "prediction": "buy" | "sell" | "hold",
        "confidence": 0.0-1.0,
        "predicted_price": float,
        "factors": {
            "technical": 0.0-1.0,
            "sentiment": 0.0-1.0,
            "pattern": 0.0-1.0
        },
        "timestamp": ISO8601
    }
    """
    try:
        logger.info(f"Received prediction request for {request.pair} with {len(request.data)} data points")

        # Check if model is loaded
        if predictor.model is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Model not trained or loaded. Please train the model first."
            )

        # Convert request data to DataFrame format
        data_dict = {
            'timeSeries': [point.dict() for point in request.data]
        }
        df = load_data_from_dict(data_dict)

        # Prepare data for prediction
        X = preprocessor.prepare_prediction_data(df, add_indicators=request.add_indicators)

        # Make prediction
        prediction_result = predictor.predict(X, return_confidence=True)

        # Add pair and timeframe to result
        prediction_result['pair'] = request.pair
        prediction_result['timeframe'] = request.timeframe

        return PredictionResponse(
            success=True,
            data=prediction_result,
            error=None,
            timestamp=get_current_timestamp()
        )

    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return PredictionResponse(
            success=False,
            data=None,
            error=str(e),
            timestamp=get_current_timestamp()
        )

    except Exception as e:
        logger.error(f"Prediction error: {str(e)}", exc_info=True)
        return PredictionResponse(
            success=False,
            data=None,
            error=f"Prediction failed: {str(e)}",
            timestamp=get_current_timestamp()
        )


@app.post("/train", response_model=TrainingResponse, tags=["Training"])
async def train_model(request: TrainingRequest, background_tasks: BackgroundTasks):
    """
    Train the LSTM model with provided data

    Training can be run in the background for large datasets
    """
    try:
        logger.info(f"Received training request for {request.pair} with {len(request.data)} data points")

        # Convert request data to DataFrame format
        data_dict = {
            'timeSeries': [point.dict() for point in request.data]
        }
        df = load_data_from_dict(data_dict)

        # Prepare training data
        X_train, y_train, X_test, y_test = preprocessor.prepare_training_data(
            df,
            add_indicators=True
        )

        logger.info(f"Training data prepared: X_train={X_train.shape}, X_test={X_test.shape}")

        # Build model if not exists
        if predictor.model is None:
            input_shape = (X_train.shape[1], X_train.shape[2])
            predictor.build_model(input_shape)

        # Train the model
        # Override config with request parameters if provided
        if request.epochs:
            config['model']['training']['epochs'] = request.epochs
        if request.batch_size:
            config['model']['training']['batch_size'] = request.batch_size
        if request.validation_split:
            config['model']['training']['validation_split'] = request.validation_split

        history = predictor.train(X_train, y_train, X_test, y_test, verbose=1)

        # Evaluate model
        metrics = predictor.evaluate(X_test, y_test)

        # Save the trained model with fitted scaler
        model_path = predictor.save_model(preprocessor=preprocessor)

        training_result = {
            "pair": request.pair,
            "model_path": model_path,
            "training_samples": len(X_train),
            "test_samples": len(X_test),
            "epochs_completed": len(history['loss']),
            "final_loss": float(history['loss'][-1]),
            "final_val_loss": float(history.get('val_loss', [0])[-1]),
            "metrics": metrics,
            "model_version": predictor.model_version
        }

        logger.info(f"Training completed successfully: {training_result}")

        return TrainingResponse(
            success=True,
            data=training_result,
            error=None,
            timestamp=get_current_timestamp()
        )

    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return TrainingResponse(
            success=False,
            data=None,
            error=str(e),
            timestamp=get_current_timestamp()
        )

    except Exception as e:
        logger.error(f"Training error: {str(e)}", exc_info=True)
        return TrainingResponse(
            success=False,
            data=None,
            error=f"Training failed: {str(e)}",
            timestamp=get_current_timestamp()
        )


@app.get("/model/info", tags=["Model"])
async def get_model_info():
    """
    Get information about the current model
    """
    if predictor.model is None:
        return {
            "success": False,
            "data": None,
            "error": "No model loaded",
            "timestamp": get_current_timestamp()
        }

    model_info = {
        "version": predictor.model_version,
        "input_shape": str(predictor.model.input_shape),
        "output_shape": str(predictor.model.output_shape),
        "total_params": int(predictor.model.count_params()),
        "trainable_params": int(sum([int(tf.size(w).numpy()) for w in predictor.model.trainable_weights])),
        "model_path": predictor.get_latest_model_path()
    }

    return {
        "success": True,
        "data": model_info,
        "error": None,
        "timestamp": get_current_timestamp()
    }


@app.get("/market-data/{pair}", tags=["Market Data"])
async def get_market_data(
    pair: str,
    timeframe: str = '1h',
    limit: int = 100
):
    """
    Fetch historical market data using Twelve Data API

    - **pair**: Currency pair (e.g., EUR/USD)
    - **timeframe**: Timeframe (1min, 5min, 15min, 30min, 1h, 4h, 1d, 1w, 1M)
    - **limit**: Number of candles to fetch (default: 100)
    """
    try:
        logger.info(f"Market data request: {pair}, {timeframe}, limit={limit}")

        result = TwelveDataFetcher.fetch_historical_data(pair, timeframe, limit)

        if not result['success']:
            raise HTTPException(
                status_code=404,
                detail=result.get('error', 'Failed to fetch market data')
            )

        return {
            "success": True,
            "data": {
                "timeSeries": result['timeSeries'],
                "metadata": result['metadata']
            },
            "error": None,
            "timestamp": get_current_timestamp()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Market data error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint with API information
    """
    return {
        "name": api_config.get('title', 'AIFX_v2 ML Engine API'),
        "version": api_config.get('version', '1.0.0'),
        "description": api_config.get('description', 'Machine Learning API for forex price prediction'),
        "endpoints": {
            "health": "/health",
            "predict": "/predict",
            "train": "/train",
            "model_info": "/model/info",
            "market_data": "/market-data/{pair}",
            "docs": "/docs"
        },
        "timestamp": get_current_timestamp()
    }


# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "data": None,
            "error": exc.detail,
            "timestamp": get_current_timestamp()
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "data": None,
            "error": "Internal server error",
            "timestamp": get_current_timestamp()
        }
    )


# Import reversal prediction modules
try:
    from api.model_manager import ModelManager
    from api.prediction_service import PredictionService
    from api.ab_testing import ABTestingFramework
    from api.reversal_api import router as reversal_router

    # Initialize model manager, prediction service, and A/B testing
    model_manager = ModelManager()
    prediction_service = None
    ab_framework = ABTestingFramework()

    # Mount reversal API router
    app.include_router(reversal_router)
    logger.info("✅ Reversal prediction API routes mounted")
except ImportError as e:
    logger.warning(f"⚠️ Could not load reversal prediction modules: {e}")
    model_manager = None
    prediction_service = None
    ab_framework = None


# Import sentiment analyzer and create endpoint
try:
    from services.sentiment_analyzer import SentimentAnalyzer
    sentiment_analyzer = SentimentAnalyzer()
    logger.info("✅ Sentiment Analyzer initialized")

    class SentimentRequest(BaseModel):
        """Request model for sentiment analysis"""
        pair: str = Field(..., description="Currency pair (e.g., EUR/USD)")
        timeframe: str = Field(default="1h", description="Timeframe for sentiment analysis")

    @app.post("/sentiment/analyze", tags=["Sentiment"])
    async def analyze_sentiment(request: SentimentRequest):
        """
        Analyze market sentiment for a currency pair

        Returns sentiment analysis including:
        - News sentiment score
        - Central bank policy sentiment
        - Combined sentiment signal
        - Confidence level
        - Article counts
        """
        try:
            logger.info(f"Sentiment analysis request: {request.pair}, timeframe={request.timeframe}")

            result = sentiment_analyzer.analyze_sentiment(request.pair, request.timeframe)

            return {
                "success": True,
                "data": result,
                "error": None,
                "timestamp": get_current_timestamp()
            }

        except Exception as e:
            logger.error(f"Sentiment analysis error: {str(e)}", exc_info=True)
            return {
                "success": False,
                "data": None,
                "error": f"Sentiment analysis failed: {str(e)}",
                "timestamp": get_current_timestamp()
            }

    @app.get("/sentiment/health", tags=["Sentiment"])
    async def sentiment_health():
        """
        Check sentiment analysis service health
        """
        try:
            has_finbert = sentiment_analyzer.sentiment_model is not None
            has_vader = sentiment_analyzer.vader_analyzer is not None
            has_newsapi = bool(sentiment_analyzer.news_api_key)

            return {
                "success": True,
                "data": {
                    "status": "healthy",
                    "models": {
                        "finbert": "loaded" if has_finbert else "not_loaded",
                        "vader": "loaded" if has_vader else "not_loaded"
                    },
                    "news_sources": {
                        "newsapi": "configured" if has_newsapi else "not_configured",
                        "google_news_rss": "available"
                    },
                    "cache_size": len(sentiment_analyzer.cache),
                    "cache_ttl_seconds": sentiment_analyzer.cache_ttl
                },
                "error": None,
                "timestamp": get_current_timestamp()
            }
        except Exception as e:
            return {
                "success": False,
                "data": None,
                "error": str(e),
                "timestamp": get_current_timestamp()
            }

    logger.info("✅ Sentiment API endpoints registered")

except ImportError as e:
    logger.warning(f"⚠️ Could not load sentiment analyzer: {e}")
    sentiment_analyzer = None


# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    global prediction_service

    logger.info("="*80)
    logger.info("ML Engine API starting up...")
    logger.info("="*80)
    logger.info(f"Environment: {config.get('environment', 'development')}")
    logger.info(f"Legacy model loaded: {predictor.model is not None}")

    # Load reversal detection models
    if model_manager:
        logger.info("\n### Loading Reversal Detection Models ###")
        if model_manager.auto_load_best_version():
            prediction_service = PredictionService(model_manager)
            # Attach to router for dependency injection
            reversal_router.prediction_service = prediction_service

            active_version = model_manager.get_active_version()
            logger.info(f"✅ Active reversal model: {active_version.version} ({active_version.name})")
            logger.info(f"   - Stage 1: {'✅ Loaded' if active_version.stage1_model else '❌ Not loaded'}")
            logger.info(f"   - Stage 2: {'✅ Loaded' if active_version.stage2_model else '❌ Not loaded'}")
            logger.info(f"   - Threshold: {active_version.threshold}")
        else:
            logger.warning("⚠️ Failed to load reversal detection models")

    # Initialize A/B testing framework
    if ab_framework:
        logger.info("\n### Initializing A/B Testing Framework ###")
        # Attach to router for dependency injection
        reversal_router.ab_framework = ab_framework
        logger.info(f"✅ A/B Testing Framework initialized")

        # List existing experiments
        experiments = ab_framework.list_experiments()
        if experiments:
            logger.info(f"   - {len(experiments)} existing experiment(s)")
            for exp in experiments:
                logger.info(f"     • {exp['experiment_id']}: {exp['name']} ({'Active' if exp['active'] else 'Inactive'})")
        else:
            logger.info(f"   - No existing experiments")

    logger.info("="*80)
    logger.info("✅ ML Engine API startup complete")
    logger.info("="*80)


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("ML Engine API shutting down...")


if __name__ == "__main__":
    import uvicorn

    server_config = config.get('server', {})
    uvicorn.run(
        "ml_server:app",
        host=server_config.get('host', '0.0.0.0'),
        port=server_config.get('port', 8000),
        reload=server_config.get('reload', True),
        log_level=server_config.get('log_level', 'info')
    )