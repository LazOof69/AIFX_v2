"""
Data Processing Utilities for ML Training

Provides functions for normalizing, scaling, and preparing data for ML models.
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, MinMaxScaler

def normalize_data(data, method='standard'):
    """
    Normalize data using specified method

    Args:
        data: numpy array or pandas DataFrame
        method: 'standard' (zero mean, unit variance) or 'minmax' (0-1 range)

    Returns:
        tuple: (normalized_data, scaler)
    """
    if method == 'standard':
        scaler = StandardScaler()
    elif method == 'minmax':
        scaler = MinMaxScaler()
    else:
        raise ValueError(f"Unknown normalization method: {method}")

    normalized = scaler.fit_transform(data)
    return normalized, scaler

def create_sequences(data, labels, sequence_length):
    """
    Create sequences for LSTM training

    Args:
        data: 2D array of features (samples x features)
        labels: 1D array of labels
        sequence_length: Number of time steps in each sequence

    Returns:
        tuple: (X_sequences, y_labels)
    """
    X, y = [], []

    for i in range(sequence_length, len(data)):
        X.append(data[i-sequence_length:i])
        y.append(labels[i])

    return np.array(X), np.array(y)

def split_train_test(X, y, test_size=0.2, shuffle=False):
    """
    Split data into training and testing sets

    Args:
        X: Features array
        y: Labels array
        test_size: Proportion of data for testing (default: 0.2)
        shuffle: Whether to shuffle data before splitting (default: False for time series)

    Returns:
        tuple: (X_train, X_test, y_train, y_test)
    """
    if shuffle:
        indices = np.random.permutation(len(X))
        X = X[indices]
        y = y[indices]

    split_idx = int(len(X) * (1 - test_size))

    X_train = X[:split_idx]
    X_test = X[split_idx:]
    y_train = y[:split_idx]
    y_test = y[split_idx:]

    return X_train, X_test, y_train, y_test

def handle_missing_values(df, method='forward_fill'):
    """
    Handle missing values in dataframe

    Args:
        df: pandas DataFrame
        method: 'forward_fill', 'backward_fill', 'interpolate', or 'drop'

    Returns:
        pandas DataFrame with missing values handled
    """
    if method == 'forward_fill':
        return df.fillna(method='ffill')
    elif method == 'backward_fill':
        return df.fillna(method='bfill')
    elif method == 'interpolate':
        return df.interpolate(method='linear')
    elif method == 'drop':
        return df.dropna()
    else:
        raise ValueError(f"Unknown method: {method}")

def remove_outliers(df, columns=None, n_std=3):
    """
    Remove outliers using standard deviation method

    Args:
        df: pandas DataFrame
        columns: List of column names to check for outliers (default: all numeric columns)
        n_std: Number of standard deviations for outlier threshold (default: 3)

    Returns:
        pandas DataFrame with outliers removed
    """
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()

    df_clean = df.copy()

    for col in columns:
        mean = df_clean[col].mean()
        std = df_clean[col].std()
        lower_bound = mean - (n_std * std)
        upper_bound = mean + (n_std * std)

        df_clean = df_clean[(df_clean[col] >= lower_bound) & (df_clean[col] <= upper_bound)]

    return df_clean

def add_time_features(df):
    """
    Add time-based features from datetime index

    Args:
        df: pandas DataFrame with datetime index

    Returns:
        pandas DataFrame with time features added
    """
    df = df.copy()

    if isinstance(df.index, pd.DatetimeIndex):
        df['hour'] = df.index.hour
        df['day_of_week'] = df.index.dayofweek
        df['day_of_month'] = df.index.day
        df['month'] = df.index.month
        df['quarter'] = df.index.quarter

        # Cyclical encoding for time features
        df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
        df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
        df['day_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
        df['day_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)
        df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
        df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)

    return df

def calculate_returns(df, periods=[1, 5, 10, 20]):
    """
    Calculate returns over different periods

    Args:
        df: pandas DataFrame with 'close' column
        periods: List of periods for return calculation

    Returns:
        pandas DataFrame with return columns added
    """
    df = df.copy()

    for period in periods:
        df[f'return_{period}'] = df['close'].pct_change(period)

    return df

def calculate_volatility(df, window=20):
    """
    Calculate rolling volatility

    Args:
        df: pandas DataFrame with 'close' column
        window: Rolling window size (default: 20)

    Returns:
        pandas Series with volatility values
    """
    returns = df['close'].pct_change()
    volatility = returns.rolling(window=window).std() * np.sqrt(window)
    return volatility
