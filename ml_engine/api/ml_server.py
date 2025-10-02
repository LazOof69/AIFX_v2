"""
ML Server API for AIFX_v2
FastAPI-based REST API for machine learning predictions and model training
"""

from fastapi import FastAPI, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Optional, Any
import yaml
import logging
from datetime import datetime, timezone, timedelta
import sys
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.price_predictor import PricePredictor
from data_processing.preprocessor import DataPreprocessor, load_data_from_dict

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
        predictor.load_model(latest_model)
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

        # Save the trained model
        model_path = predictor.save_model()

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
        "input_shape": predictor.model.input_shape,
        "output_shape": predictor.model.output_shape,
        "total_params": predictor.model.count_params(),
        "trainable_params": sum([tf.size(w).numpy() for w in predictor.model.trainable_weights]),
        "model_path": predictor.get_latest_model_path()
    }

    return {
        "success": True,
        "data": model_info,
        "error": None,
        "timestamp": get_current_timestamp()
    }


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
            "docs": "/docs"
        },
        "timestamp": get_current_timestamp()
    }


# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return {
        "success": False,
        "data": None,
        "error": exc.detail,
        "timestamp": get_current_timestamp()
    }


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return {
        "success": False,
        "data": None,
        "error": "Internal server error",
        "timestamp": get_current_timestamp()
    }


# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    logger.info("ML Engine API starting up...")
    logger.info(f"Environment: {config.get('environment', 'development')}")
    logger.info(f"Model loaded: {predictor.model is not None}")


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