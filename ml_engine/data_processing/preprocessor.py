"""
Data Preprocessing Module for AIFX_v2 ML Engine
Handles data cleaning, normalization, and feature engineering for time series data
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler, StandardScaler, RobustScaler
from typing import Tuple, List, Dict, Optional, Union
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class DataPreprocessor:
    """
    Preprocesses forex market data for LSTM model training and prediction
    """

    def __init__(self, config: Dict):
        """
        Initialize the preprocessor with configuration

        Args:
            config: Configuration dictionary containing preprocessing parameters
        """
        self.config = config
        self.sequence_length = config.get('data', {}).get('sequence_length', 60)
        self.features = config.get('data', {}).get('features', ['open', 'high', 'low', 'close', 'volume'])
        self.target = config.get('data', {}).get('target', 'close')
        self.scaler_type = config.get('data', {}).get('scaler', 'minmax')
        self.feature_range = config.get('data', {}).get('feature_range', [0, 1])

        # Initialize scalers
        self.feature_scaler = self._get_scaler()
        self.target_scaler = self._get_scaler()

        logger.info(f"DataPreprocessor initialized with sequence_length={self.sequence_length}")

    def _get_scaler(self):
        """Get the appropriate scaler based on configuration"""
        if self.scaler_type == 'minmax':
            return MinMaxScaler(feature_range=tuple(self.feature_range))
        elif self.scaler_type == 'standard':
            return StandardScaler()
        elif self.scaler_type == 'robust':
            return RobustScaler()
        else:
            logger.warning(f"Unknown scaler type: {self.scaler_type}, using MinMaxScaler")
            return MinMaxScaler(feature_range=tuple(self.feature_range))

    def validate_data(self, data: pd.DataFrame) -> Tuple[bool, str]:
        """
        Validate input data

        Args:
            data: Input DataFrame

        Returns:
            Tuple of (is_valid, error_message)
        """
        if data is None or len(data) == 0:
            return False, "Data is empty"

        min_data_points = self.config.get('data', {}).get('min_data_points', 100)
        if len(data) < min_data_points:
            return False, f"Insufficient data points. Need at least {min_data_points}, got {len(data)}"

        # Check for required columns
        missing_cols = [col for col in self.features if col not in data.columns]
        if missing_cols:
            return False, f"Missing required columns: {missing_cols}"

        # Check for excessive missing values
        max_missing_ratio = self.config.get('data', {}).get('max_missing_ratio', 0.1)
        missing_ratio = data[self.features].isnull().sum().sum() / (len(data) * len(self.features))
        if missing_ratio > max_missing_ratio:
            return False, f"Too many missing values: {missing_ratio:.2%} > {max_missing_ratio:.2%}"

        return True, ""

    def clean_data(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Clean the input data

        Args:
            data: Input DataFrame

        Returns:
            Cleaned DataFrame
        """
        df = data.copy()

        # Remove duplicates
        df = df.drop_duplicates()

        # Handle missing values
        # Forward fill first, then backward fill
        df[self.features] = df[self.features].fillna(method='ffill').fillna(method='bfill')

        # Remove any remaining rows with NaN values
        df = df.dropna(subset=self.features)

        # Remove outliers using IQR method
        for feature in self.features:
            if feature != 'volume':  # Don't remove outliers from volume
                Q1 = df[feature].quantile(0.25)
                Q3 = df[feature].quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 3 * IQR
                upper_bound = Q3 + 3 * IQR
                df = df[(df[feature] >= lower_bound) & (df[feature] <= upper_bound)]

        # Sort by timestamp if available
        if 'timestamp' in df.columns:
            df = df.sort_values('timestamp')
        elif df.index.name == 'timestamp' or isinstance(df.index, pd.DatetimeIndex):
            df = df.sort_index()

        logger.info(f"Data cleaned: {len(data)} -> {len(df)} rows")
        return df

    def add_technical_indicators(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Add technical indicators as features

        Args:
            data: Input DataFrame

        Returns:
            DataFrame with added technical indicators
        """
        df = data.copy()

        # Simple Moving Averages
        for period in [5, 10, 20, 50]:
            df[f'sma_{period}'] = df['close'].rolling(window=period).mean()

        # Exponential Moving Averages
        for period in [12, 26]:
            df[f'ema_{period}'] = df['close'].ewm(span=period, adjust=False).mean()

        # RSI (Relative Strength Index)
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))

        # MACD
        ema12 = df['close'].ewm(span=12, adjust=False).mean()
        ema26 = df['close'].ewm(span=26, adjust=False).mean()
        df['macd'] = ema12 - ema26
        df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()

        # Bollinger Bands
        df['bb_middle'] = df['close'].rolling(window=20).mean()
        bb_std = df['close'].rolling(window=20).std()
        df['bb_upper'] = df['bb_middle'] + (bb_std * 2)
        df['bb_lower'] = df['bb_middle'] - (bb_std * 2)

        # Price rate of change
        df['roc'] = df['close'].pct_change(periods=10) * 100

        # Volume indicators
        if 'volume' in df.columns:
            df['volume_sma'] = df['volume'].rolling(window=20).mean()
            df['volume_ratio'] = df['volume'] / df['volume_sma']

        # Drop NaN values created by indicators
        df = df.dropna()

        logger.info(f"Added technical indicators: {len(df.columns)} features")
        return df

    def create_sequences(
        self,
        data: np.ndarray,
        sequence_length: Optional[int] = None
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Create sequences for LSTM model

        Args:
            data: Input data array
            sequence_length: Length of sequences (uses config default if None)

        Returns:
            Tuple of (X, y) where X is sequences and y is targets
        """
        if sequence_length is None:
            sequence_length = self.sequence_length

        X, y = [], []

        for i in range(len(data) - sequence_length):
            X.append(data[i:i + sequence_length, :-1])  # All features except target
            y.append(data[i + sequence_length, -1])  # Target value

        return np.array(X), np.array(y)

    def scale_features(self, data: pd.DataFrame, fit: bool = True) -> np.ndarray:
        """
        Scale features using the configured scaler

        Args:
            data: Input DataFrame
            fit: Whether to fit the scaler (True for training data)

        Returns:
            Scaled numpy array
        """
        if fit:
            scaled_data = self.feature_scaler.fit_transform(data)
            logger.info("Feature scaler fitted")
        else:
            scaled_data = self.feature_scaler.transform(data)

        return scaled_data

    def scale_target(self, data: np.ndarray, fit: bool = True) -> np.ndarray:
        """
        Scale target variable

        Args:
            data: Input array (should be 2D)
            fit: Whether to fit the scaler

        Returns:
            Scaled array
        """
        if len(data.shape) == 1:
            data = data.reshape(-1, 1)

        if fit:
            scaled_data = self.target_scaler.fit_transform(data)
            logger.info("Target scaler fitted")
        else:
            scaled_data = self.target_scaler.transform(data)

        return scaled_data

    def inverse_scale_target(self, data: np.ndarray) -> np.ndarray:
        """
        Inverse transform scaled target values

        Args:
            data: Scaled data array

        Returns:
            Original scale array
        """
        if len(data.shape) == 1:
            data = data.reshape(-1, 1)

        return self.target_scaler.inverse_transform(data)

    def prepare_training_data(
        self,
        data: pd.DataFrame,
        add_indicators: bool = True
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Prepare data for model training

        Args:
            data: Raw input DataFrame
            add_indicators: Whether to add technical indicators

        Returns:
            Tuple of (X_train, y_train, X_test, y_test)
        """
        logger.info("Preparing training data...")

        # Validate data
        is_valid, error_msg = self.validate_data(data)
        if not is_valid:
            raise ValueError(f"Data validation failed: {error_msg}")

        # Clean data
        df = self.clean_data(data)

        # Add technical indicators if requested
        if add_indicators:
            df = self.add_technical_indicators(df)

        # Select features and target
        feature_cols = [col for col in df.columns if col not in ['timestamp']]
        df_features = df[feature_cols]

        # Scale features
        scaled_features = self.scale_features(df_features, fit=True)

        # Create sequences
        X, y = self.create_sequences(scaled_features)

        # Split into train and test sets
        train_size = int(len(X) * self.config.get('data', {}).get('train_size', 0.8))

        X_train, X_test = X[:train_size], X[train_size:]
        y_train, y_test = y[:train_size], y[train_size:]

        logger.info(f"Training data prepared: X_train={X_train.shape}, X_test={X_test.shape}")

        return X_train, y_train, X_test, y_test

    def prepare_prediction_data(
        self,
        data: pd.DataFrame,
        add_indicators: bool = True
    ) -> np.ndarray:
        """
        Prepare data for prediction

        Args:
            data: Raw input DataFrame
            add_indicators: Whether to add technical indicators

        Returns:
            Prepared data array ready for prediction
        """
        logger.info("Preparing prediction data...")

        # Clean data
        df = self.clean_data(data)

        # Add technical indicators if requested
        if add_indicators:
            df = self.add_technical_indicators(df)

        # Select features
        feature_cols = [col for col in df.columns if col not in ['timestamp']]
        df_features = df[feature_cols]

        # Scale features (without fitting)
        scaled_features = self.scale_features(df_features, fit=False)

        # Take the last sequence_length points
        if len(scaled_features) >= self.sequence_length:
            X = scaled_features[-self.sequence_length:]
            X = X.reshape(1, self.sequence_length, -1)
        else:
            raise ValueError(
                f"Not enough data points for prediction. "
                f"Need {self.sequence_length}, got {len(scaled_features)}"
            )

        logger.info(f"Prediction data prepared: X={X.shape}")

        return X


def load_data_from_dict(data_dict: Dict) -> pd.DataFrame:
    """
    Load data from dictionary format (API response)

    Args:
        data_dict: Dictionary with time series data

    Returns:
        DataFrame with parsed data
    """
    if 'timeSeries' in data_dict:
        df = pd.DataFrame(data_dict['timeSeries'])
    elif 'data' in data_dict:
        df = pd.DataFrame(data_dict['data'])
    else:
        df = pd.DataFrame(data_dict)

    # Convert string columns to numeric
    numeric_columns = ['open', 'high', 'low', 'close', 'volume']
    for col in numeric_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # Parse timestamp if available
    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp')
    elif 'time' in df.columns:
        df['timestamp'] = pd.to_datetime(df['time'])
        df = df.sort_values('timestamp')

    return df