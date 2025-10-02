# AIFX_v2 ML Engine

Machine Learning engine for forex price prediction using LSTM neural networks.

## Features

- LSTM-based price prediction model
- FastAPI REST API for predictions and training
- Data preprocessing with technical indicators
- Model versioning and persistence
- Redis caching support
- Comprehensive logging and monitoring

## Project Structure

```
ml_engine/
├── api/
│   ├── __init__.py
│   └── ml_server.py          # FastAPI server
├── models/
│   ├── __init__.py
│   └── price_predictor.py    # LSTM model implementation
├── data_processing/
│   ├── __init__.py
│   └── preprocessor.py       # Data preprocessing
├── utils/
│   └── __init__.py
├── tests/
│   └── __init__.py
├── saved_models/             # Trained model files
├── checkpoints/              # Training checkpoints
├── logs/                     # Log files
├── config.yaml               # Configuration file
├── requirements.txt          # Python dependencies
└── README.md
```

## Installation

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Copy environment configuration:
```bash
cp .env.example .env
```

4. Create necessary directories:
```bash
mkdir -p saved_models checkpoints logs metrics backups
```

## Configuration

Edit `config.yaml` to customize:
- Model architecture (LSTM layers, units, dropout)
- Training parameters (epochs, batch size, learning rate)
- Data processing (sequence length, features, scaling)
- API settings (CORS, rate limiting)

## Running the Server

Start the ML API server:

```bash
python api/ml_server.py
```

Or using uvicorn directly:

```bash
uvicorn api.ml_server:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Health Check
```http
GET /health
```

Returns the status of the ML engine and model information.

### Price Prediction
```http
POST /predict
Content-Type: application/json

{
  "pair": "EUR/USD",
  "timeframe": "1h",
  "data": [
    {
      "timestamp": "2025-01-15T10:00:00Z",
      "open": 1.0850,
      "high": 1.0865,
      "low": 1.0845,
      "close": 1.0860,
      "volume": 1000
    },
    ...
  ],
  "add_indicators": true
}
```

Response follows claude.md ML Model Integration format:
```json
{
  "success": true,
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
  "error": null,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Model Training
```http
POST /train
Content-Type: application/json

{
  "pair": "EUR/USD",
  "data": [...],  // At least 100 data points
  "epochs": 100,
  "batch_size": 32,
  "validation_split": 0.2
}
```

### Model Information
```http
GET /model/info
```

## Model Architecture

The LSTM model consists of:

1. **Input Layer**: Sequences of technical indicators and OHLCV data
2. **LSTM Layers**: Multiple stacked LSTM layers with dropout
3. **Dense Layers**: Fully connected layers for feature extraction
4. **Output Layer**: Single neuron for price prediction

Default configuration:
- 3 LSTM layers: [128, 64, 32] units
- 2 Dense layers: [16, 8] units
- Dropout: 0.2
- Activation: tanh (LSTM), relu (Dense), linear (Output)
- Optimizer: Adam (lr=0.001)
- Loss: Mean Squared Error

## Data Preprocessing

The preprocessor handles:

1. **Data Cleaning**:
   - Remove duplicates
   - Handle missing values
   - Remove outliers

2. **Technical Indicators**:
   - SMA (5, 10, 20, 50 periods)
   - EMA (12, 26 periods)
   - RSI (14 period)
   - MACD
   - Bollinger Bands
   - Rate of Change

3. **Scaling**:
   - MinMax scaling (default)
   - Standard scaling
   - Robust scaling

4. **Sequence Creation**:
   - Creates sequences of configurable length (default: 60)
   - Sliding window approach

## Training the Model

To train a new model:

1. Prepare historical data (at least 100 data points)
2. Send POST request to `/train` endpoint
3. Model will be automatically saved in `saved_models/`
4. Training metrics and checkpoints are stored

Example using curl:
```bash
curl -X POST "http://localhost:8000/train" \
  -H "Content-Type: application/json" \
  -d @training_data.json
```

## Making Predictions

To make predictions:

1. Ensure model is trained and loaded
2. Provide at least 60 recent data points
3. Send POST request to `/predict` endpoint

Example using curl:
```bash
curl -X POST "http://localhost:8000/predict" \
  -H "Content-Type: application/json" \
  -d @prediction_data.json
```

## Integration with Backend

The ML engine is designed to be called from the Node.js backend:

```javascript
const axios = require('axios');

const mlApiUrl = process.env.ML_API_URL || 'http://localhost:8000';

async function getPrediction(pair, marketData) {
  const response = await axios.post(`${mlApiUrl}/predict`, {
    pair: pair,
    timeframe: '1h',
    data: marketData,
    add_indicators: true
  });

  return response.data;
}
```

## Performance Monitoring

The model tracks:
- Training loss and validation loss
- Mean Absolute Error (MAE)
- Mean Squared Error (MSE)
- Root Mean Squared Error (RMSE)
- Directional accuracy

Metrics are logged and can be used to trigger retraining.

## Troubleshooting

### Model not loaded
- Check if model files exist in `saved_models/`
- Train a new model using `/train` endpoint

### Insufficient data
- Provide at least 60 data points for prediction
- Provide at least 100 data points for training

### Memory issues
- Reduce batch size in config
- Reduce sequence length
- Use smaller LSTM units

### GPU not detected
- Install tensorflow-gpu
- Check CUDA and cuDNN installation
- Verify GPU drivers

## Development

Run tests:
```bash
pytest tests/
```

Code formatting:
```bash
black .
flake8 .
```

Type checking:
```bash
mypy .
```

## License

MIT License - See LICENSE file for details