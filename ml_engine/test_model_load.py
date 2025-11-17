import sys
import os
import yaml
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Fix for libgomp static TLS block error on ARM64
import ctypes
try:
    ctypes.CDLL('/usr/lib/aarch64-linux-gnu/libgomp.so.1', mode=ctypes.RTLD_GLOBAL)
except Exception as e:
    pass

from models.price_predictor import PricePredictor
from data_processing.preprocessor import DataPreprocessor

# Load configuration
with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

# Initialize
preprocessor = DataPreprocessor(config)
predictor = PricePredictor(config)

# Try to load the latest model
latest_model = predictor.get_latest_model_path()
print(f"Latest model path: {latest_model}")

if latest_model:
    try:
        predictor.load_model(latest_model, preprocessor)
        print(f"✅ Model loaded successfully from {latest_model}")
        print(f"Model: {predictor.model}")
        print(f"Model loaded: {predictor.model is not None}")
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        import traceback
        traceback.print_exc()
else:
    print("❌ No model found")
