#!/usr/bin/env python3
"""
Daily Incremental Training Script (Phase 5 Refactored)
Performs daily fine-tuning with new market data

ARCHITECTURAL CHANGE (Phase 5 Microservices Refactoring):
- ❌ OLD: Direct PostgreSQL access via psycopg2
- ✅ NEW: Backend API access via backend_api_client
- Following microservices architecture principles (CLAUDE.md)

Features:
- Fetches latest market data from Backend API (was: PostgreSQL)
- Loads existing best model via Backend API (was: database query)
- Performs incremental training (fine-tuning)
- Saves new model version via Backend API (was: database INSERT)
- Logs training results via Backend API (was: database INSERT/UPDATE)
- Publishes Redis events (unchanged - Redis is OK for services)

Schedule: Daily at UTC 01:00 (via cron)

Usage:
    python daily_incremental_training.py [--pairs EURUSD,GBPUSD] [--timeframes 1h,4h]
"""

import os
import sys
import argparse
import logging
from datetime import datetime, timedelta
from pathlib import Path
import json
import numpy as np
import pandas as pd
import redis
import tensorflow as tf
from tensorflow import keras

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Phase 5: Import Backend API Client instead of psycopg2
from services.backend_api_client import get_client

# Setup logging
log_dir = Path(__file__).parent.parent / 'logs' / 'training'
log_dir.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / f'daily_training_{datetime.now().strftime("%Y%m%d")}.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Environment variables
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
MODELS_DIR = Path(__file__).parent.parent / 'saved_models_v2'


class DailyTrainer:
    """Daily incremental training orchestrator (Phase 5 Refactored)"""

    def __init__(self, pairs, timeframes):
        self.pairs = pairs
        self.timeframes = timeframes
        # Phase 5: Use Backend API client instead of database connection
        self.api_client = None
        self.redis_client = None
        self.training_log_id = None
        self.start_time = datetime.utcnow()

        logger.info("✅ DailyTrainer initialized (Backend API mode)")

    def connect_backend_api(self):
        """Connect to Backend API (Phase 5 Refactored)"""
        try:
            logger.info("🔗 Initializing Backend API client...")
            self.api_client = get_client()

            # Test connection with health check
            health = self.api_client.check_health()
            logger.info(f"✅ Backend API connected: {health.get('status')}")
            return True
        except Exception as e:
            logger.error(f"❌ Backend API connection failed: {e}")
            return False

    def connect_redis(self):
        """Connect to Redis for event publishing"""
        try:
            logger.info("🔗 Connecting to Redis...")
            self.redis_client = redis.from_url(REDIS_URL)
            self.redis_client.ping()
            logger.info("✅ Redis connected")
            return True
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            return False

    def publish_event(self, channel, data):
        """Publish event to Redis"""
        if not self.redis_client:
            logger.warning("⚠️ Redis not connected, event not published")
            return

        try:
            message = json.dumps({
                'timestamp': datetime.utcnow().isoformat(),
                'channel': channel,
                'data': data
            })
            self.redis_client.publish(channel, message)
            logger.debug(f"📢 Published event to {channel}")
        except Exception as e:
            logger.error(f"❌ Failed to publish event: {e}")

    def create_training_log(self, dataset_size):
        """
        Create training log entry via Backend API (Phase 5 Refactored)

        OLD: Direct database INSERT to model_training_log
        NEW: Backend API call to log_training_session()
        """
        try:
            time_range = {
                'start': (self.start_time - timedelta(days=1)).isoformat(),
                'end': self.start_time.isoformat()
            }

            # Phase 5: Use Backend API instead of SQL INSERT
            # Note: We need a model_id for log_training_session
            # For now, we'll create a placeholder or skip this until we have model_id
            # This is a known limitation that needs Backend API enhancement

            logger.info(f"⚠️ Training log creation deferred until model registration")
            logger.info(f"   Dataset size: {dataset_size}")
            logger.info(f"   Time range: {time_range}")

            # TODO: Backend API needs endpoint for creating training log without model_id
            # Or: Create training log after model version is registered

            # Publish training started event
            self.publish_event('ml:training_started', {
                'trainingType': 'incremental',
                'modelType': 'lstm',
                'datasetSize': dataset_size,
                'startedAt': self.start_time.isoformat()
            })

            return None  # Will create after model registration

        except Exception as e:
            logger.error(f"❌ Failed to create training log: {e}")
            return None

    def update_training_log(self, status, metrics=None, error_message=None):
        """
        Update training log with results (Phase 5 - Limited Implementation)

        Note: Backend API doesn't have UPDATE endpoint for training logs yet
        This is a known gap that needs Backend API enhancement
        """
        try:
            duration = (datetime.utcnow() - self.start_time).total_seconds()

            logger.info(f"✅ Training completed: {status}")
            logger.info(f"   Metrics: {metrics}")
            logger.info(f"   Duration: {duration:.2f}s")

            # Publish training completed event
            self.publish_event('ml:training_completed', {
                'status': status,
                'metrics': metrics,
                'duration': duration,
                'completedAt': datetime.utcnow().isoformat()
            })

            # TODO: Backend API needs endpoint for updating training logs
            # For now, we only publish events

        except Exception as e:
            logger.error(f"❌ Failed to update training log: {e}")

    def fetch_new_data(self, days_back=1):
        """
        Fetch new market data and labeled signals from Backend API (Phase 5 Refactored)

        OLD: Direct SQL queries to market_data and trading_signals tables
        NEW: Backend API calls to get_market_data() and get_historical_signals()

        Args:
            days_back: Number of days to fetch (default: 1)

        Returns:
            Dict with 'market_data' and 'signals' keys
        """
        try:
            # Calculate date range
            end_date = self.start_time
            start_date = end_date - timedelta(days=days_back)

            logger.info(f"📊 Fetching data from {start_date} to {end_date} via Backend API")

            all_market_data = []
            all_signals = []

            # Fetch data for each pair and timeframe combination
            for pair in self.pairs:
                for timeframe in self.timeframes:
                    # Phase 5: Fetch market data via Backend API
                    logger.info(f"   Fetching market data: {pair} {timeframe}")
                    result = self.api_client.get_market_data(
                        pair=pair,
                        timeframe=timeframe,
                        start_date=start_date.isoformat(),
                        end_date=end_date.isoformat(),
                        limit=10000
                    )

                    market_data = result.get('marketData', [])
                    all_market_data.extend(market_data)
                    logger.info(f"     ✓ Fetched {len(market_data)} candles")

                    # Phase 5: Fetch labeled signals via Backend API
                    logger.info(f"   Fetching signals: {pair} {timeframe}")
                    result = self.api_client.get_historical_signals(
                        pair=pair,
                        start_date=start_date.isoformat(),
                        end_date=end_date.isoformat(),
                        limit=10000
                    )

                    signals = result.get('signals', [])
                    all_signals.extend(signals)
                    logger.info(f"     ✓ Fetched {len(signals)} labeled signals")

            logger.info(f"✅ Total: {len(all_market_data)} market data, {len(all_signals)} signals")

            return {
                'market_data': all_market_data,
                'signals': all_signals
            }

        except Exception as e:
            logger.error(f"❌ Failed to fetch data from Backend API: {e}")
            return None

    def prepare_training_data(self, raw_data):
        """
        Prepare training data from raw API data

        Args:
            raw_data: Dict with market_data and signals

        Returns:
            Tuple of (X_train, y_train)
        """
        try:
            logger.info("📊 Preparing training data...")

            market_df = pd.DataFrame(raw_data['market_data'])
            signals_df = pd.DataFrame(raw_data['signals'])

            if len(market_df) == 0 or len(signals_df) == 0:
                logger.warning("⚠️ Insufficient data for training")
                return None, None

            # Convert timestamps
            market_df['timestamp'] = pd.to_datetime(market_df['timestamp'])
            signals_df['createdAt'] = pd.to_datetime(signals_df['createdAt'])

            features = []
            labels = []

            for _, signal in signals_df.iterrows():
                # Find corresponding market data
                mask = (
                    (market_df['pair'] == signal['pair']) &
                    (market_df['timeframe'] == signal['timeframe']) &
                    (market_df['timestamp'] <= signal['createdAt'])
                )

                recent_data = market_df[mask].tail(60)  # Last 60 candles

                if len(recent_data) < 60:
                    continue

                # Extract OHLCV features
                feature_vector = recent_data[['open', 'high', 'low', 'close', 'volume']].values

                # Normalize
                feature_vector = (feature_vector - feature_vector.mean(axis=0)) / (feature_vector.std(axis=0) + 1e-8)

                features.append(feature_vector)

                # Label: 0 = loss, 1 = win
                label = 1 if signal['actualOutcome'] == 'win' else 0
                labels.append(label)

            X_train = np.array(features)
            y_train = np.array(labels)

            logger.info(f"✅ Training data prepared: X={X_train.shape}, y={y_train.shape}")

            return X_train, y_train

        except Exception as e:
            logger.error(f"❌ Failed to prepare training data: {e}")
            return None, None

    def load_best_model(self):
        """
        Load the current best performing model via Backend API (Phase 5 Refactored)

        OLD: Direct SQL query to model_versions table
        NEW: Backend API call to get_model_versions()
        """
        try:
            logger.info("📦 Loading best model via Backend API...")

            # Phase 5: Use Backend API to find production model
            result = self.api_client.get_model_versions(
                model_name='signal_predictor',
                status='production',
                limit=1
            )

            models = result.get('models', [])

            if not models or len(models) == 0:
                logger.warning("⚠️ No production model found, will train from scratch")
                return None

            model_info = models[0]
            model_path = Path(model_info['modelPath'])

            if not model_path.exists():
                logger.warning(f"⚠️ Model file not found: {model_path}")
                return None

            model = keras.models.load_model(model_path)
            logger.info(f"✅ Loaded model: {model_info['name']}:{model_info['version']}")

            return model

        except Exception as e:
            logger.error(f"❌ Failed to load model via Backend API: {e}")
            return None

    def incremental_train(self, model, X_train, y_train, epochs=5):
        """
        Perform incremental training (fine-tuning)

        Args:
            model: Existing model to fine-tune
            X_train: Training features
            y_train: Training labels
            epochs: Number of training epochs

        Returns:
            Tuple of (model, metrics)
        """
        try:
            logger.info(f"🚀 Starting incremental training ({epochs} epochs)...")

            # Compile with lower learning rate for fine-tuning
            model.compile(
                optimizer=keras.optimizers.Adam(learning_rate=0.0001),
                loss='binary_crossentropy',
                metrics=['accuracy']
            )

            # Train
            history = model.fit(
                X_train, y_train,
                epochs=epochs,
                batch_size=32,
                validation_split=0.2,
                verbose=1
            )

            # Extract metrics
            metrics = {
                'loss': float(history.history['loss'][-1]),
                'accuracy': float(history.history['accuracy'][-1]),
                'val_loss': float(history.history['val_loss'][-1]),
                'val_accuracy': float(history.history['val_accuracy'][-1])
            }

            logger.info(f"✅ Training completed: {metrics}")

            return model, metrics

        except Exception as e:
            logger.error(f"❌ Training failed: {e}")
            return None, None

    def save_model_version(self, model, metrics):
        """
        Save new model version via Backend API (Phase 5 Refactored)

        OLD: Direct SQL INSERT to model_versions table
        NEW: Backend API call to register_model_version()
        """
        try:
            logger.info("💾 Saving model version via Backend API...")

            # Generate version number
            version = f"v_daily_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

            # Save model file
            model_path = MODELS_DIR / f"{version}.h5"
            MODELS_DIR.mkdir(parents=True, exist_ok=True)
            model.save(model_path)

            logger.info(f"✅ Model saved: {model_path}")

            # Phase 5: Register model via Backend API
            result = self.api_client.register_model_version(
                model_name='signal_predictor',
                version=version,
                algorithm='LSTM',
                model_path=str(model_path),
                hyperparameters={
                    'layers': 3,
                    'units': 128,
                    'dropout': 0.2,
                    'learning_rate': 0.0001,
                },
                training_metrics=metrics,
                description=f'Daily incremental training {datetime.utcnow().strftime("%Y-%m-%d")}'
            )

            model_version_id = result.get('modelId')
            logger.info(f"✅ Model version registered via API: {model_version_id}")

            # Now create training log with model_id
            if model_version_id and self.training_log_id is None:
                try:
                    log_result = self.api_client.log_training_session(
                        model_id=model_version_id,
                        model_version=version,
                        training_type='incremental',
                        data_start_date=(self.start_time - timedelta(days=1)).isoformat(),
                        data_end_date=self.start_time.isoformat(),
                        num_samples=len(metrics) if isinstance(metrics, dict) else 0,
                        training_metrics=metrics,
                        duration=(datetime.utcnow() - self.start_time).total_seconds(),
                        notes='Daily incremental training'
                    )
                    self.training_log_id = log_result.get('logId')
                    logger.info(f"✅ Training log created: {self.training_log_id}")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to create training log: {e}")

            return version, model_version_id

        except Exception as e:
            logger.error(f"❌ Failed to save model version via Backend API: {e}")
            return None, None

    def run(self):
        """Execute daily training workflow (Phase 5 Refactored)"""
        try:
            logger.info("=" * 80)
            logger.info("🚀 DAILY INCREMENTAL TRAINING STARTED (Backend API Mode)")
            logger.info(f"⏰ Time: {self.start_time.isoformat()}")
            logger.info(f"📊 Pairs: {', '.join(self.pairs)}")
            logger.info(f"⏱️ Timeframes: {', '.join(self.timeframes)}")
            logger.info("=" * 80)

            # Step 1: Connect to Backend API
            if not self.connect_backend_api():
                raise Exception("Backend API connection failed")

            if not self.connect_redis():
                logger.warning("⚠️ Redis connection failed, events will not be published")

            # Step 2: Fetch new data via Backend API
            raw_data = self.fetch_new_data(days_back=1)
            if not raw_data:
                raise Exception("Failed to fetch data from Backend API")

            # Step 3: Create training log (deferred)
            dataset_size = len(raw_data['market_data']) + len(raw_data['signals'])
            self.create_training_log(dataset_size)

            # Step 4: Prepare training data
            X_train, y_train = self.prepare_training_data(raw_data)

            if X_train is None or len(X_train) < 10:
                logger.warning("⚠️ Insufficient training data (< 10 samples)")
                self.update_training_log('skipped', error_message='Insufficient data')
                return

            # Step 5: Load existing model via Backend API
            model = self.load_best_model()

            if model is None:
                logger.warning("⚠️ No existing model, skipping incremental training")
                self.update_training_log('skipped', error_message='No base model')
                return

            # Step 6: Incremental training
            model, metrics = self.incremental_train(model, X_train, y_train, epochs=5)

            if model is None:
                raise Exception("Training failed")

            # Step 7: Save new model version via Backend API
            version, model_id = self.save_model_version(model, metrics)

            if not version:
                raise Exception("Failed to save model version")

            # Step 8: Update training log
            self.update_training_log('completed', metrics)

            logger.info("=" * 80)
            logger.info("✅ DAILY INCREMENTAL TRAINING COMPLETED")
            logger.info(f"📊 Metrics: {metrics}")
            logger.info(f"📦 Model Version: {version}")
            logger.info(f"⏱️ Duration: {(datetime.utcnow() - self.start_time).total_seconds():.2f}s")
            logger.info("=" * 80)

        except Exception as e:
            logger.error(f"❌ Daily training failed: {e}", exc_info=True)

            if self.training_log_id:
                self.update_training_log('failed', error_message=str(e))

        finally:
            # Cleanup
            if self.api_client:
                logger.info("✅ Backend API client session ended")

            if self.redis_client:
                self.redis_client.close()
                logger.info("✅ Redis connection closed")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Daily Incremental Training (Backend API Mode)')

    parser.add_argument(
        '--pairs',
        type=str,
        default='EUR/USD,GBP/USD,USD/JPY',
        help='Currency pairs (comma-separated)'
    )

    parser.add_argument(
        '--timeframes',
        type=str,
        default='1h,4h',
        help='Timeframes (comma-separated)'
    )

    args = parser.parse_args()

    pairs = [p.strip() for p in args.pairs.split(',')]
    timeframes = [t.strip() for t in args.timeframes.split(',')]

    trainer = DailyTrainer(pairs, timeframes)
    trainer.run()


if __name__ == '__main__':
    main()
