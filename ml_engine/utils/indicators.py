"""
Technical Indicators Calculation Module

Provides functions to calculate various technical indicators for forex trading.
"""

import pandas as pd
import numpy as np

def calculate_sma(df, period=20):
    """Calculate Simple Moving Average"""
    return df['close'].rolling(window=period).mean()

def calculate_ema(df, period=20):
    """Calculate Exponential Moving Average"""
    return df['close'].ewm(span=period, adjust=False).mean()

def calculate_rsi(df, period=14):
    """Calculate Relative Strength Index"""
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def calculate_macd(df, fast=12, slow=26, signal=9):
    """Calculate MACD (Moving Average Convergence Divergence)"""
    ema_fast = df['close'].ewm(span=fast, adjust=False).mean()
    ema_slow = df['close'].ewm(span=slow, adjust=False).mean()
    macd = ema_fast - ema_slow
    signal_line = macd.ewm(span=signal, adjust=False).mean()
    histogram = macd - signal_line
    return macd, signal_line, histogram

def calculate_bollinger_bands(df, period=20, std_dev=2):
    """Calculate Bollinger Bands"""
    sma = calculate_sma(df, period)
    std = df['close'].rolling(window=period).std()
    upper_band = sma + (std * std_dev)
    lower_band = sma - (std * std_dev)
    return upper_band, sma, lower_band

def calculate_atr(df, period=14):
    """Calculate Average True Range"""
    high_low = df['high'] - df['low']
    high_close = np.abs(df['high'] - df['close'].shift())
    low_close = np.abs(df['low'] - df['close'].shift())

    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = ranges.max(axis=1)
    atr = true_range.rolling(window=period).mean()
    return atr

def calculate_stochastic(df, k_period=14, d_period=3):
    """Calculate Stochastic Oscillator"""
    low_min = df['low'].rolling(window=k_period).min()
    high_max = df['high'].rolling(window=k_period).max()

    k = 100 * ((df['close'] - low_min) / (high_max - low_min))
    d = k.rolling(window=d_period).mean()
    return k, d

def calculate_obv(df):
    """Calculate On-Balance Volume"""
    obv = [0]
    for i in range(1, len(df)):
        if df['close'].iloc[i] > df['close'].iloc[i-1]:
            obv.append(obv[-1] + df['close'].iloc[i])
        elif df['close'].iloc[i] < df['close'].iloc[i-1]:
            obv.append(obv[-1] - df['close'].iloc[i])
        else:
            obv.append(obv[-1])
    return pd.Series(obv, index=df.index)

def calculate_momentum(df, period=10):
    """Calculate Momentum"""
    return df['close'].diff(period)

def calculate_roc(df, period=12):
    """Calculate Rate of Change"""
    return ((df['close'] - df['close'].shift(period)) / df['close'].shift(period)) * 100

def calculate_williams_r(df, period=14):
    """Calculate Williams %R"""
    high_max = df['high'].rolling(window=period).max()
    low_min = df['low'].rolling(window=period).min()
    williams_r = -100 * ((high_max - df['close']) / (high_max - low_min))
    return williams_r

def calculate_cci(df, period=20):
    """Calculate Commodity Channel Index"""
    tp = (df['high'] + df['low'] + df['close']) / 3
    sma_tp = tp.rolling(window=period).mean()
    mad = tp.rolling(window=period).apply(lambda x: np.abs(x - x.mean()).mean())
    cci = (tp - sma_tp) / (0.015 * mad)
    return cci

def calculate_adx(df, period=14):
    """Calculate Average Directional Index"""
    # Calculate +DM and -DM
    high_diff = df['high'].diff()
    low_diff = -df['low'].diff()

    plus_dm = high_diff.where((high_diff > low_diff) & (high_diff > 0), 0)
    minus_dm = low_diff.where((low_diff > high_diff) & (low_diff > 0), 0)

    # Calculate ATR
    atr = calculate_atr(df, period)

    # Calculate +DI and -DI
    plus_di = 100 * (plus_dm.rolling(window=period).mean() / atr)
    minus_di = 100 * (minus_dm.rolling(window=period).mean() / atr)

    # Calculate DX and ADX
    dx = 100 * np.abs(plus_di - minus_di) / (plus_di + minus_di)
    adx = dx.rolling(window=period).mean()

    return adx

def calculate_model_indicators(df, features_list=None):
    """
    Calculate ONLY the technical indicators needed by the model

    This function is optimized for the profitable reversal model v3.1 which uses 12 features.
    Maximum lookback period is 50 (sma_50), so it only requires ~60 candles of data
    instead of 200+ needed by calculate_all_indicators().

    Args:
        df: DataFrame with OHLC data (open, high, low, close)
        features_list: List of feature names to calculate. If None, uses default 12 features.

    Returns:
        DataFrame with selected technical indicators added
    """
    df = df.copy()

    # Default features for profitable reversal model v3.1
    if features_list is None:
        features_list = [
            'sma_20', 'sma_50', 'ema_12', 'ema_26', 'rsi_14',
            'macd', 'macd_signal', 'macd_histogram', 'bb_width',
            'atr_14', 'stoch_k', 'adx_14'
        ]

    # Calculate only requested indicators
    if 'sma_20' in features_list:
        df['sma_20'] = calculate_sma(df, 20)

    if 'sma_50' in features_list:
        df['sma_50'] = calculate_sma(df, 50)

    if 'ema_12' in features_list:
        df['ema_12'] = calculate_ema(df, 12)

    if 'ema_26' in features_list:
        df['ema_26'] = calculate_ema(df, 26)

    if 'rsi_14' in features_list:
        df['rsi_14'] = calculate_rsi(df, 14)

    if any(x in features_list for x in ['macd', 'macd_signal', 'macd_histogram']):
        macd, signal, histogram = calculate_macd(df)
        df['macd'] = macd
        df['macd_signal'] = signal
        df['macd_histogram'] = histogram

    if 'bb_width' in features_list or any(x in features_list for x in ['bb_upper', 'bb_middle', 'bb_lower']):
        bb_upper, bb_middle, bb_lower = calculate_bollinger_bands(df)
        df['bb_upper'] = bb_upper
        df['bb_middle'] = bb_middle
        df['bb_lower'] = bb_lower
        df['bb_width'] = bb_upper - bb_lower

    if 'atr_14' in features_list:
        df['atr_14'] = calculate_atr(df, 14)

    if 'stoch_k' in features_list or 'stoch_d' in features_list:
        stoch_k, stoch_d = calculate_stochastic(df)
        df['stoch_k'] = stoch_k
        df['stoch_d'] = stoch_d

    if 'adx_14' in features_list:
        df['adx_14'] = calculate_adx(df, 14)

    # Drop rows with NaN values (from indicator calculations)
    # With max lookback of 50, this should only remove ~50 rows instead of 200+
    df = df.dropna()

    return df


def calculate_all_indicators(df):
    """
    Calculate all technical indicators and add them to the dataframe

    Args:
        df: DataFrame with OHLC data (open, high, low, close)

    Returns:
        DataFrame with all technical indicators added
    """
    df = df.copy()

    # Moving Averages
    df['sma_20'] = calculate_sma(df, 20)
    df['sma_50'] = calculate_sma(df, 50)
    df['sma_200'] = calculate_sma(df, 200)
    df['ema_12'] = calculate_ema(df, 12)
    df['ema_26'] = calculate_ema(df, 26)

    # RSI
    df['rsi_14'] = calculate_rsi(df, 14)

    # MACD
    macd, signal, histogram = calculate_macd(df)
    df['macd'] = macd
    df['macd_signal'] = signal
    df['macd_histogram'] = histogram

    # Bollinger Bands
    bb_upper, bb_middle, bb_lower = calculate_bollinger_bands(df)
    df['bb_upper'] = bb_upper
    df['bb_middle'] = bb_middle
    df['bb_lower'] = bb_lower
    df['bb_width'] = bb_upper - bb_lower

    # ATR
    df['atr_14'] = calculate_atr(df, 14)

    # Stochastic
    stoch_k, stoch_d = calculate_stochastic(df)
    df['stoch_k'] = stoch_k
    df['stoch_d'] = stoch_d

    # OBV (if volume available, otherwise skip)
    if 'volume' in df.columns:
        df['obv'] = calculate_obv(df)

    # Momentum Indicators
    df['momentum_10'] = calculate_momentum(df, 10)
    df['roc_12'] = calculate_roc(df, 12)

    # Williams %R
    df['williams_r'] = calculate_williams_r(df, 14)

    # CCI
    df['cci_20'] = calculate_cci(df, 20)

    # ADX
    df['adx_14'] = calculate_adx(df, 14)

    # Price-based features
    df['price_change'] = df['close'].pct_change()
    df['price_range'] = df['high'] - df['low']
    df['body_size'] = np.abs(df['close'] - df['open'])

    # Drop rows with NaN values (from indicator calculations)
    df = df.dropna()

    return df
