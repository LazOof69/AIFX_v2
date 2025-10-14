#!/usr/bin/env python3
"""
v3.0 Reversal Point Labeling System

Identifies swing low/high reversal points and generates dynamic risk management labels.

Two-mode labeling:
- Mode 1: Reversal point detection (entry signals)
- Mode 2: Dynamic risk management (misjudge + reversal probabilities)

Key Features:
- User-configurable timeframe (D1/H4/H1)
- Swing point detection with configurable lookback
- Misjudge probability for stop-loss decisions
- Reversal probability for take-profit decisions

Author: AI-assisted
Created: 2025-10-14
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class TimeframeConfig:
    """Configuration for different timeframes"""

    CONFIGS = {
        'D1': {
            'name': 'Daily',
            'lookback_bars': 20,        # 20 days before/after for swing detection
            'min_reversal_pips': 100,   # Minimum 100 pips move to confirm reversal
            'lookforward_bars': 20,     # Look 20 days ahead to verify reversal
            'monitor_duration': 10,     # Monitor position for 10 days
            'description': 'Daily timeframe - 1-2 signals per month'
        },
        'H4': {
            'name': '4-Hour',
            'lookback_bars': 30,        # 5 days (30 * 4h)
            'min_reversal_pips': 50,
            'lookforward_bars': 60,     # 10 days
            'monitor_duration': 30,     # 5 days
            'description': '4-hour timeframe - 1-2 signals per week'
        },
        'H1': {
            'name': '1-Hour',
            'lookback_bars': 48,        # 2 days
            'min_reversal_pips': 30,
            'lookforward_bars': 120,    # 5 days
            'monitor_duration': 72,     # 3 days
            'description': '1-hour timeframe - 2-3 signals per week'
        }
    }

    @classmethod
    def get_config(cls, timeframe: str) -> Dict:
        """Get configuration for specified timeframe"""
        if timeframe not in cls.CONFIGS:
            logger.warning(f"Unknown timeframe {timeframe}, defaulting to D1")
            timeframe = 'D1'
        return cls.CONFIGS[timeframe]


class ReversalPointLabeler:
    """
    Identifies swing low/high reversal points for Mode 1 training
    """

    def __init__(self, timeframe: str = 'D1'):
        """
        Initialize reversal point labeler

        Args:
            timeframe: Time frame to use ('D1', 'H4', 'H1')
        """
        self.timeframe = timeframe
        self.config = TimeframeConfig.get_config(timeframe)

        logger.info(f"Initialized ReversalPointLabeler for {self.config['name']}")
        logger.info(f"Config: {self.config['description']}")

    def is_swing_low(self, df: pd.DataFrame, index: int) -> bool:
        """
        Check if current candle is a swing low

        A swing low is when the low price is lower than all surrounding candles
        within the lookback window.

        Args:
            df: DataFrame with OHLC data
            index: Index to check

        Returns:
            bool: True if this is a swing low
        """
        lookback = self.config['lookback_bars']

        # Need enough data before and after
        if index < lookback or index + lookback >= len(df):
            return False

        current_low = df.iloc[index]['low']

        # Check if current low is minimum in the window
        window_start = index - lookback
        window_end = index + lookback + 1
        window_lows = df.iloc[window_start:window_end]['low']

        return current_low == window_lows.min()

    def is_swing_high(self, df: pd.DataFrame, index: int) -> bool:
        """
        Check if current candle is a swing high

        A swing high is when the high price is higher than all surrounding candles
        within the lookback window.

        Args:
            df: DataFrame with OHLC data
            index: Index to check

        Returns:
            bool: True if this is a swing high
        """
        lookback = self.config['lookback_bars']

        # Need enough data before and after
        if index < lookback or index + lookback >= len(df):
            return False

        current_high = df.iloc[index]['high']

        # Check if current high is maximum in the window
        window_start = index - lookback
        window_end = index + lookback + 1
        window_highs = df.iloc[window_start:window_end]['high']

        return current_high == window_highs.max()

    def verify_reversal(self, df: pd.DataFrame, index: int, direction: str) -> Tuple[bool, float]:
        """
        Verify that price actually reversed after this point

        Args:
            df: DataFrame with OHLC data
            index: Index of potential reversal point
            direction: 'long' (from swing low) or 'short' (from swing high)

        Returns:
            tuple: (is_valid_reversal, move_in_pips)
        """
        lookforward = self.config['lookforward_bars']
        min_pips = self.config['min_reversal_pips']

        # Get future data window
        future_end = min(index + lookforward, len(df))
        future_data = df.iloc[index:future_end]

        if len(future_data) < 2:
            return False, 0.0

        if direction == 'long':
            # Check if price moved up from swing low
            entry_price = df.iloc[index]['low']
            future_high = future_data['high'].max()
            move_pips = (future_high - entry_price) * 10000

            return move_pips >= min_pips, move_pips

        else:  # short
            # Check if price moved down from swing high
            entry_price = df.iloc[index]['high']
            future_low = future_data['low'].min()
            move_pips = (entry_price - future_low) * 10000

            return move_pips >= min_pips, move_pips

    def calculate_reversal_confidence(self, df: pd.DataFrame, index: int,
                                     move_pips: float) -> float:
        """
        Calculate confidence score for reversal signal

        Based on:
        - Magnitude of reversal (more pips = higher confidence)
        - Technical indicator alignment
        - Volatility conditions

        Args:
            df: DataFrame with indicators
            index: Index of reversal point
            move_pips: Size of reversal move in pips

        Returns:
            float: Confidence score (0.0-1.0)
        """
        row = df.iloc[index]
        confidence = 0.5  # Base confidence

        # Factor 1: Reversal magnitude (0-0.2)
        # Larger moves get higher confidence
        pip_bonus = min(0.2, (move_pips - self.config['min_reversal_pips']) / 500)
        confidence += pip_bonus

        # Factor 2: ADX strength (0-0.15)
        if not pd.isna(row.get('adx_14')):
            if row['adx_14'] > 25:
                confidence += 0.15
            elif row['adx_14'] > 20:
                confidence += 0.10

        # Factor 3: RSI position (0-0.1)
        if not pd.isna(row.get('rsi_14')):
            rsi = row['rsi_14']
            if rsi < 30 or rsi > 70:  # Oversold/overbought
                confidence += 0.1
            elif 35 < rsi < 65:  # Healthy range
                confidence += 0.05

        # Factor 4: MACD momentum (0-0.1)
        if not pd.isna(row.get('macd')) and not pd.isna(row.get('macd_signal')):
            macd_diff = abs(row['macd'] - row['macd_signal'])
            if macd_diff > 0.001:
                confidence += 0.1
            elif macd_diff > 0.0005:
                confidence += 0.05

        # Factor 5: Volatility check (0-0.05)
        if not pd.isna(row.get('atr_14')):
            # Moderate volatility is good
            atr_pct = (row['atr_14'] / row['close']) * 100
            if 0.5 < atr_pct < 2.0:
                confidence += 0.05

        return min(1.0, confidence)

    def label_all_reversals(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Scan entire DataFrame and label all reversal points

        Args:
            df: DataFrame with OHLC and technical indicators

        Returns:
            pd.DataFrame: Labels with columns:
                - signal: 0 (none), 1 (long), 2 (short)
                - confidence: 0.0-1.0
                - entry_price: Reversal point price
                - move_pips: Size of reversal move
                - timeframe: Timeframe used
        """
        logger.info(f"Labeling reversals for {len(df)} candles using {self.timeframe} timeframe")

        labels = []
        swing_lows_found = 0
        swing_highs_found = 0
        valid_longs = 0
        valid_shorts = 0

        for i in range(len(df)):
            label = {
                'signal': 0,  # 0=none, 1=long, 2=short
                'confidence': 0.0,
                'entry_price': df.iloc[i]['close'],
                'move_pips': 0.0,
                'timeframe': self.timeframe
            }

            # Check for swing low (potential long entry)
            if self.is_swing_low(df, i):
                swing_lows_found += 1
                is_valid, move_pips = self.verify_reversal(df, i, 'long')

                if is_valid:
                    valid_longs += 1
                    label['signal'] = 1  # Long
                    label['entry_price'] = df.iloc[i]['low']
                    label['move_pips'] = move_pips
                    label['confidence'] = self.calculate_reversal_confidence(df, i, move_pips)

                    logger.debug(f"Valid LONG at index {i} ({df.iloc[i].name}): "
                               f"{move_pips:.1f} pips, confidence {label['confidence']:.2f}")

            # Check for swing high (potential short entry)
            elif self.is_swing_high(df, i):
                swing_highs_found += 1
                is_valid, move_pips = self.verify_reversal(df, i, 'short')

                if is_valid:
                    valid_shorts += 1
                    label['signal'] = 2  # Short
                    label['entry_price'] = df.iloc[i]['high']
                    label['move_pips'] = move_pips
                    label['confidence'] = self.calculate_reversal_confidence(df, i, move_pips)

                    logger.debug(f"Valid SHORT at index {i} ({df.iloc[i].name}): "
                               f"{move_pips:.1f} pips, confidence {label['confidence']:.2f}")

            labels.append(label)

        logger.info(f"Reversal labeling complete:")
        logger.info(f"  - Swing lows detected: {swing_lows_found}")
        logger.info(f"  - Swing highs detected: {swing_highs_found}")
        logger.info(f"  - Valid LONG signals: {valid_longs}")
        logger.info(f"  - Valid SHORT signals: {valid_shorts}")
        logger.info(f"  - Total reversal signals: {valid_longs + valid_shorts}")

        return pd.DataFrame(labels)


class DynamicRiskLabeler:
    """
    Generates dynamic risk management labels for Mode 2 training

    For each reversal entry point, this labeler creates monitoring checkpoints
    and calculates misjudge probability and reversal probability at each point.
    """

    def __init__(self, timeframe: str = 'D1'):
        """
        Initialize dynamic risk labeler

        Args:
            timeframe: Time frame to use ('D1', 'H4', 'H1')
        """
        self.timeframe = timeframe
        self.config = TimeframeConfig.get_config(timeframe)

        logger.info(f"Initialized DynamicRiskLabeler for {self.config['name']}")

    def calculate_misjudge_probability(self, df: pd.DataFrame, entry_idx: int,
                                       current_idx: int, direction: str,
                                       entry_price: float) -> float:
        """
        Calculate probability that the entry was a misjudge (should stop loss)

        Logic:
        - If price moves against position, check if it continues
        - Higher drawdown + continued adverse movement = higher misjudge probability

        Args:
            df: DataFrame with OHLC data
            entry_idx: Index of entry
            current_idx: Current checkpoint index
            direction: 'long' or 'short'
            entry_price: Entry price

        Returns:
            float: Misjudge probability (0.0-1.0)
        """
        current_price = df.iloc[current_idx]['close']

        # Calculate current drawdown
        if direction == 'long':
            drawdown_pct = (entry_price - current_price) / entry_price
            is_losing = current_price < entry_price
        else:  # short
            drawdown_pct = (current_price - entry_price) / entry_price
            is_losing = current_price > entry_price

        if not is_losing:
            # Position is winning, low misjudge probability
            return 0.1

        # Look ahead to see if drawdown continues
        lookforward = min(10, len(df) - current_idx - 1)
        if lookforward < 2:
            return 0.3  # Not enough data, moderate probability

        future_data = df.iloc[current_idx:current_idx + lookforward]

        if direction == 'long':
            future_min = future_data['low'].min()
            continues_down = future_min < current_price * 0.98  # Drops 2%+
        else:
            future_max = future_data['high'].max()
            continues_down = future_max > current_price * 1.02  # Rises 2%+

        # Calculate misjudge probability
        if continues_down:
            # Drawdown continues - likely misjudge
            misjudge_prob = min(0.95, 0.4 + (abs(drawdown_pct) * 10))
        else:
            # Drawdown stops - might be temporary
            misjudge_prob = min(0.45, 0.2 + (abs(drawdown_pct) * 5))

        return misjudge_prob

    def calculate_reversal_probability(self, df: pd.DataFrame, entry_idx: int,
                                       current_idx: int, direction: str,
                                       entry_price: float) -> float:
        """
        Calculate probability that price is about to reverse (should take profit)

        Logic:
        - If position is winning, check if momentum is slowing
        - Look for signs of reversal: weakening trend, overbought/oversold

        Args:
            df: DataFrame with OHLC and indicators
            entry_idx: Index of entry
            current_idx: Current checkpoint index
            direction: 'long' or 'short'
            entry_price: Entry price

        Returns:
            float: Reversal probability (0.0-1.0)
        """
        current_price = df.iloc[current_idx]['close']

        # Calculate current profit
        if direction == 'long':
            profit_pct = (current_price - entry_price) / entry_price
            is_winning = current_price > entry_price
        else:  # short
            profit_pct = (entry_price - current_price) / entry_price
            is_winning = current_price < entry_price

        if not is_winning:
            # Position is losing, low reversal probability
            return 0.1

        # Look ahead to see if price reverses
        lookforward = min(10, len(df) - current_idx - 1)
        if lookforward < 2:
            return 0.3  # Not enough data

        future_data = df.iloc[current_idx:current_idx + lookforward]

        if direction == 'long':
            future_max = future_data['high'].max()
            future_min = future_data['low'].min()
            momentum_continues = future_max > current_price * 1.01
            reverses = future_min < current_price * 0.98
        else:
            future_max = future_data['high'].max()
            future_min = future_data['low'].min()
            momentum_continues = future_min < current_price * 0.99
            reverses = future_max > current_price * 1.02

        # Calculate reversal probability
        if reverses and not momentum_continues:
            # Clear reversal signal
            reversal_prob = min(0.90, 0.5 + (profit_pct * 8))
        elif reverses:
            # Reversal but also continuation - mixed signal
            reversal_prob = min(0.60, 0.3 + (profit_pct * 5))
        elif not momentum_continues:
            # Momentum slowing but no clear reversal
            reversal_prob = min(0.50, 0.2 + (profit_pct * 3))
        else:
            # Momentum continues strong
            reversal_prob = 0.1

        return reversal_prob

    def generate_monitoring_checkpoints(self, df: pd.DataFrame, entry_idx: int,
                                        direction: str, entry_price: float) -> List[Dict]:
        """
        Generate monitoring checkpoints for a position

        Args:
            df: DataFrame with OHLC and indicators
            entry_idx: Index of entry
            direction: 'long' or 'short'
            entry_price: Entry price

        Returns:
            list: List of checkpoint dictionaries
        """
        monitor_duration = self.config['monitor_duration']
        max_idx = min(entry_idx + monitor_duration, len(df) - 1)

        checkpoints = []

        for current_idx in range(entry_idx + 1, max_idx + 1):
            current_price = df.iloc[current_idx]['close']
            bars_held = current_idx - entry_idx

            # Calculate P&L
            if direction == 'long':
                pnl_pct = (current_price - entry_price) / entry_price
                pnl_pips = (current_price - entry_price) * 10000
            else:
                pnl_pct = (entry_price - current_price) / entry_price
                pnl_pips = (entry_price - current_price) * 10000

            # Calculate probabilities
            misjudge_prob = self.calculate_misjudge_probability(
                df, entry_idx, current_idx, direction, entry_price
            )
            reversal_prob = self.calculate_reversal_probability(
                df, entry_idx, current_idx, direction, entry_price
            )

            # Determine recommended action
            if misjudge_prob > 0.5:
                action = 'stop_loss'
            elif reversal_prob > 0.5:
                action = 'take_profit'
            else:
                action = 'hold'

            checkpoint = {
                'entry_idx': entry_idx,
                'current_idx': current_idx,
                'bars_held': bars_held,
                'direction': direction,
                'entry_price': entry_price,
                'current_price': current_price,
                'pnl_pct': pnl_pct,
                'pnl_pips': pnl_pips,
                'misjudge_probability': misjudge_prob,
                'reversal_probability': reversal_prob,
                'action': action,
                'timeframe': self.timeframe
            }

            checkpoints.append(checkpoint)

        return checkpoints

    def label_all_positions(self, df: pd.DataFrame,
                           reversal_labels: pd.DataFrame) -> pd.DataFrame:
        """
        Generate monitoring checkpoints for all reversal entry points

        Args:
            df: DataFrame with OHLC and indicators
            reversal_labels: DataFrame from ReversalPointLabeler.label_all_reversals()

        Returns:
            pd.DataFrame: All monitoring checkpoints
        """
        logger.info("Generating dynamic risk management labels...")

        all_checkpoints = []

        # Find all valid entry signals
        entry_signals = reversal_labels[reversal_labels['signal'] > 0]
        logger.info(f"Found {len(entry_signals)} entry signals to monitor")

        for idx, signal in entry_signals.iterrows():
            direction = 'long' if signal['signal'] == 1 else 'short'
            entry_price = signal['entry_price']

            checkpoints = self.generate_monitoring_checkpoints(
                df, idx, direction, entry_price
            )

            all_checkpoints.extend(checkpoints)

            logger.debug(f"Generated {len(checkpoints)} checkpoints for "
                        f"{direction.upper()} entry at index {idx}")

        logger.info(f"Total monitoring checkpoints generated: {len(all_checkpoints)}")

        if len(all_checkpoints) == 0:
            logger.warning("No checkpoints generated!")
            return pd.DataFrame()

        return pd.DataFrame(all_checkpoints)


def main():
    """Test the reversal labeling system"""
    import sys
    sys.path.append(str(Path(__file__).parent.parent))

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Load test data
    data_dir = Path(__file__).parent.parent / 'data' / 'training_v3'
    features_file = data_dir / 'EURUSD_mode1_train_features.csv'

    if not features_file.exists():
        logger.error(f"Test data not found: {features_file}")
        return

    logger.info(f"Loading test data from {features_file}")
    df = pd.read_csv(features_file, index_col=0, parse_dates=True)

    # Test Mode 1: Reversal point detection
    logger.info("\n=== Testing Mode 1: Reversal Point Detection ===")
    reversal_labeler = ReversalPointLabeler(timeframe='D1')
    reversal_labels = reversal_labeler.label_all_reversals(df)

    logger.info(f"\nMode 1 Results:")
    logger.info(f"Total candles: {len(reversal_labels)}")
    logger.info(f"Long signals: {(reversal_labels['signal'] == 1).sum()}")
    logger.info(f"Short signals: {(reversal_labels['signal'] == 2).sum()}")
    logger.info(f"No signal: {(reversal_labels['signal'] == 0).sum()}")

    # Test Mode 2: Dynamic risk management
    logger.info("\n=== Testing Mode 2: Dynamic Risk Management ===")
    risk_labeler = DynamicRiskLabeler(timeframe='D1')
    risk_labels = risk_labeler.label_all_positions(df, reversal_labels)

    if len(risk_labels) > 0:
        logger.info(f"\nMode 2 Results:")
        logger.info(f"Total checkpoints: {len(risk_labels)}")
        logger.info(f"Hold actions: {(risk_labels['action'] == 'hold').sum()}")
        logger.info(f"Stop loss actions: {(risk_labels['action'] == 'stop_loss').sum()}")
        logger.info(f"Take profit actions: {(risk_labels['action'] == 'take_profit').sum()}")
        logger.info(f"Avg misjudge prob: {risk_labels['misjudge_probability'].mean():.2f}")
        logger.info(f"Avg reversal prob: {risk_labels['reversal_probability'].mean():.2f}")


if __name__ == '__main__':
    main()
