#!/usr/bin/env python3
"""
Weekly Full Training Script
Performs complete model retraining with larger dataset

Features:
- Fetches last 30 days of market data from PostgreSQL
- Trains model from scratch (full retrain)
- Saves new model version
- Logs training results to database
- Publishes Redis events

Schedule: Weekly on Sunday at UTC 01:00 (via cron)

Usage:
    python weekly_full_training.py [--pairs EURUSD,GBPUSD] [--days 30]
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
import psycopg2
from psycopg2.extras import RealDictCursor
import redis
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Setup logging
log_dir = Path(__file__).parent.parent / 'logs' / 'training'
log_dir.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / f'weekly_training_{datetime.now().strftime("%Y%m%d")}.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Environment variables
DB_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/aifx_v2')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
MODELS_DIR = Path(__file__).parent.parent / 'saved_models_v2'


class WeeklyTrainer:
    """Weekly full training orchestrator"""

    def __init__(self, pairs, timeframes, days_back=30):
        self.pairs = pairs
        self.timeframes = timeframes
        self.days_back = days_back
        self.db_conn = None
        self.redis_client = None
        self.training_log_id = None
        self.start_time = datetime.utcnow()

    def connect_database(self):
        """Connect to PostgreSQL database"""
        try:
            logger.info("🔗 Connecting to PostgreSQL...")
            self.db_conn = psycopg2.connect(DB_URL)
            logger.info("✅ PostgreSQL connected")
            return True
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
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
        """Create training log entry in database"""
        try:
            cursor = self.db_conn.cursor(cursor_factory=RealDictCursor)

            query = """
                INSERT INTO model_training_log (
                    training_type, model_type, dataset_size, data_time_range,
                    status, started_at
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """

            time_range = {
                'start': (self.start_time - timedelta(days=self.days_back)).isoformat(),
                'end': self.start_time.isoformat()
            }

            cursor.execute(query, (
                'full',
                'lstm',
                dataset_size,
                json.dumps(time_range),
                'running',
                self.start_time
            ))

            result = cursor.fetchone()
            self.training_log_id = result['id']
            self.db_conn.commit()

            logger.info(f"✅ Training log created: {self.training_log_id}")

            # Publish training started event
            self.publish_event('ml:training_started', {
                'trainingLogId': self.training_log_id,
                'trainingType': 'full',
                'modelType': 'lstm',
                'datasetSize': dataset_size,
                'startedAt': self.start_time.isoformat()
            })

            return self.training_log_id

        except Exception as e:
            logger.error(f"❌ Failed to create training log: {e}")
            return None

    def update_training_log(self, status, metrics=None, error_message=None):
        """Update training log with results"""
        try:
            cursor = self.db_conn.cursor()

            duration = (datetime.utcnow() - self.start_time).total_seconds()

            query = """
                UPDATE model_training_log
                SET status = %s, metrics = %s, error_message = %s,
                    training_duration = %s, completed_at = %s
                WHERE id = %s
            """

            cursor.execute(query, (
                status,
                json.dumps(metrics) if metrics else None,
                error_message,
                duration,
                datetime.utcnow(),
                self.training_log_id
            ))

            self.db_conn.commit()
            logger.info(f"✅ Training log updated: {status}")

            # Publish training completed event
            self.publish_event('ml:training_completed', {
                'trainingLogId': self.training_log_id,
                'status': status,
                'metrics': metrics,
                'duration': duration,
                'completedAt': datetime.utcnow().isoformat()
            })

        except Exception as e:
            logger.error(f"❌ Failed to update training log: {e}")

    def fetch_training_data(self):
        """Fetch training data from database"""
        try:
            cursor = self.db_conn.cursor(cursor_factory=RealDictCursor)

            # Calculate date range
            end_date = self.start_time
            start_date = end_date - timedelta(days=self.days_back)

            logger.info(f"📊 Fetching {self.days_back} days of data from {start_date} to {end_date}")

            # Fetch market data
            pairs_str = "','".join(self.pairs)
            timeframes_str = "','".join(self.timeframes)

            query = f"""
                SELECT
                    md.pair,
                    md.timeframe,
                    md.timestamp,
                    md.open,
                    md.high,
                    md.low,
                    md.close,
                    md.volume,
                    md.technical_indicators
                FROM market_data md
                WHERE md.pair IN ('{pairs_str}')
                  AND md.timeframe IN ('{timeframes_str}')
                  AND md.timestamp >= %s
                  AND md.timestamp <= %s
                ORDER BY md.timestamp ASC
            """

            cursor.execute(query, (start_date, end_date))
            market_data = cursor.fetchall()

            logger.info(f"✅ Fetched {len(market_data)} market data records")

            # Fetch labeled signals
            signals_query = f"""
                SELECT
                    ts.pair,
                    ts.timeframe,
                    ts.created_at as timestamp,
                    ts.signal,
                    ts.confidence,
                    ts.entry_price,
                    ts.factors,
                    ts.actual_outcome,
                    ts.actual_pnl_percent
                FROM trading_signals ts
                WHERE ts.pair IN ('{pairs_str}')
                  AND ts.timeframe IN ('{timeframes_str}')
                  AND ts.created_at >= %s
                  AND ts.created_at <= %s
                  AND ts.actual_outcome != 'pending'
                ORDER BY ts.created_at ASC
            """

            cursor.execute(signals_query, (start_date, end_date))
            signals = cursor.fetchall()

            logger.info(f"✅ Fetched {len(signals)} labeled signals")

            return {
                'market_data': market_data,
                'signals': signals
            }

        except Exception as e:
            logger.error(f"❌ Failed to fetch data: {e}")
            return None

    def prepare_training_data(self, raw_data):
        """Prepare training data from raw database data"""
        try:
            logger.info("📊 Preparing training data...")

            market_df = pd.DataFrame(raw_data['market_data'])
            signals_df = pd.DataFrame(raw_data['signals'])

            if len(market_df) == 0 or len(signals_df) == 0:
                logger.warning("⚠️ Insufficient data for training")
                return None, None, None, None

            features = []
            labels = []

            for _, signal in signals_df.iterrows():
                # Find corresponding market data
                mask = (
                    (market_df['pair'] == signal['pair']) &
                    (market_df['timeframe'] == signal['timeframe']) &
                    (market_df['timestamp'] <= signal['timestamp'])
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
                label = 1 if signal['actual_outcome'] == 'win' else 0
                labels.append(label)

            X = np.array(features)
            y = np.array(labels)

            # Split train/validation
            split_idx = int(len(X) * 0.8)
            X_train = X[:split_idx]
            y_train = y[:split_idx]
            X_val = X[split_idx:]
            y_val = y[split_idx:]

            logger.info(f"✅ Training data prepared:")
            logger.info(f"   Train: X={X_train.shape}, y={y_train.shape}")
            logger.info(f"   Val:   X={X_val.shape}, y={y_val.shape}")

            return X_train, y_train, X_val, y_val

        except Exception as e:
            logger.error(f"❌ Failed to prepare training data: {e}")
            return None, None, None, None

    def build_model(self, input_shape):
        """Build new LSTM model"""
        try:
            logger.info(f"🏗️ Building model with input shape: {input_shape}")

            model = keras.Sequential([
                layers.Input(shape=input_shape),
                layers.LSTM(128, return_sequences=True),
                layers.Dropout(0.3),
                layers.LSTM(64, return_sequences=False),
                layers.Dropout(0.3),
                layers.Dense(32, activation='relu'),
                layers.Dropout(0.2),
                layers.Dense(1, activation='sigmoid')
            ])

            model.compile(
                optimizer=keras.optimizers.Adam(learning_rate=0.001),
                loss='binary_crossentropy',
                metrics=['accuracy']
            )

            logger.info("✅ Model built successfully")
            logger.info(f"   Total parameters: {model.count_params():,}")

            return model

        except Exception as e:
            logger.error(f"❌ Failed to build model: {e}")
            return None

    def full_train(self, model, X_train, y_train, X_val, y_val, epochs=50):
        """Perform full training from scratch"""
        try:
            logger.info(f"🚀 Starting full training ({epochs} epochs)...")

            # Callbacks
            early_stopping = keras.callbacks.EarlyStopping(
                monitor='val_loss',
                patience=10,
                restore_best_weights=True
            )

            reduce_lr = keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=5,
                min_lr=0.00001
            )

            # Train
            history = model.fit(
                X_train, y_train,
                epochs=epochs,
                batch_size=32,
                validation_data=(X_val, y_val),
                callbacks=[early_stopping, reduce_lr],
                verbose=1
            )

            # Extract metrics
            metrics = {
                'loss': float(history.history['loss'][-1]),
                'accuracy': float(history.history['accuracy'][-1]),
                'val_loss': float(history.history['val_loss'][-1]),
                'val_accuracy': float(history.history['val_accuracy'][-1]),
                'epochs_trained': len(history.history['loss'])
            }

            logger.info(f"✅ Training completed: {metrics}")

            return model, metrics

        except Exception as e:
            logger.error(f"❌ Training failed: {e}")
            return None, None

    def save_model_version(self, model, metrics):
        """Save new model version to database"""
        try:
            logger.info("💾 Saving model version...")

            # Generate version number
            version = f"v_weekly_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

            # Save model file
            model_path = MODELS_DIR / f"{version}.h5"
            MODELS_DIR.mkdir(parents=True, exist_ok=True)
            model.save(model_path)

            logger.info(f"✅ Model saved: {model_path}")

            # Create database record
            cursor = self.db_conn.cursor(cursor_factory=RealDictCursor)

            query = """
                INSERT INTO model_versions (
                    version, model_type, model_path, training_log_id,
                    metrics, status, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """

            cursor.execute(query, (
                version,
                'lstm',
                str(model_path),
                self.training_log_id,
                json.dumps(metrics),
                'staging',  # New models start in staging
                datetime.utcnow()
            ))

            result = cursor.fetchone()
            model_version_id = result['id']

            self.db_conn.commit()

            logger.info(f"✅ Model version created: {model_version_id}")

            return version, model_version_id

        except Exception as e:
            logger.error(f"❌ Failed to save model version: {e}")
            return None, None

    def run(self):
        """Execute weekly training workflow"""
        try:
            logger.info("=" * 80)
            logger.info("🚀 WEEKLY FULL TRAINING STARTED")
            logger.info(f"⏰ Time: {self.start_time.isoformat()}")
            logger.info(f"📊 Pairs: {', '.join(self.pairs)}")
            logger.info(f"⏱️ Timeframes: {', '.join(self.timeframes)}")
            logger.info(f"📅 Days back: {self.days_back}")
            logger.info("=" * 80)

            # Step 1: Connect to services
            if not self.connect_database():
                raise Exception("Database connection failed")

            if not self.connect_redis():
                logger.warning("⚠️ Redis connection failed, events will not be published")

            # Step 2: Fetch training data
            raw_data = self.fetch_training_data()
            if not raw_data:
                raise Exception("Failed to fetch data")

            # Step 3: Create training log
            dataset_size = len(raw_data['market_data']) + len(raw_data['signals'])
            self.create_training_log(dataset_size)

            # Step 4: Prepare training data
            X_train, y_train, X_val, y_val = self.prepare_training_data(raw_data)

            if X_train is None or len(X_train) < 100:
                logger.warning("⚠️ Insufficient training data (< 100 samples)")
                self.update_training_log('skipped', error_message='Insufficient data')
                return

            # Step 5: Build model
            model = self.build_model(input_shape=X_train.shape[1:])

            if model is None:
                raise Exception("Failed to build model")

            # Step 6: Full training
            model, metrics = self.full_train(model, X_train, y_train, X_val, y_val, epochs=50)

            if model is None:
                raise Exception("Training failed")

            # Step 7: Save new model version
            version, model_id = self.save_model_version(model, metrics)

            if not version:
                raise Exception("Failed to save model version")

            # Step 8: Update training log
            self.update_training_log('completed', metrics)

            logger.info("=" * 80)
            logger.info("✅ WEEKLY FULL TRAINING COMPLETED")
            logger.info(f"📊 Metrics: {metrics}")
            logger.info(f"📦 Model Version: {version}")
            logger.info(f"⏱️ Duration: {(datetime.utcnow() - self.start_time).total_seconds():.2f}s")
            logger.info("=" * 80)

        except Exception as e:
            logger.error(f"❌ Weekly training failed: {e}", exc_info=True)

            if self.training_log_id:
                self.update_training_log('failed', error_message=str(e))

        finally:
            # Cleanup
            if self.db_conn:
                self.db_conn.close()
                logger.info("✅ Database connection closed")

            if self.redis_client:
                self.redis_client.close()
                logger.info("✅ Redis connection closed")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Weekly Full Training')

    parser.add_argument(
        '--pairs',
        type=str,
        default='EUR/USD,GBP/USD,USD/JPY,AUD/USD,USD/CAD',
        help='Currency pairs (comma-separated)'
    )

    parser.add_argument(
        '--timeframes',
        type=str,
        default='1h,4h,1d',
        help='Timeframes (comma-separated)'
    )

    parser.add_argument(
        '--days',
        type=int,
        default=30,
        help='Number of days to fetch for training'
    )

    args = parser.parse_args()

    pairs = [p.strip() for p in args.pairs.split(',')]
    timeframes = [t.strip() for t in args.timeframes.split(',')]

    trainer = WeeklyTrainer(pairs, timeframes, days_back=args.days)
    trainer.run()


if __name__ == '__main__':
    main()
