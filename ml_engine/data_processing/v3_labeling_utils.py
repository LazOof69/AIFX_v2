#!/usr/bin/env python3
"""
v3.0 Data Labeling Utilities

Provides helper functions for labeling trading opportunities and position monitoring data.
These utilities implement the labeling algorithms defined in ML_V3_ARCHITECTURE_DESIGN.md

Author: AI-assisted
Created: 2025-10-13
"""

import numpy as np
import pandas as pd
from typing import Dict, Tuple, Optional, List


class TradingSimulator:
    """Simulates trade execution for labeling purposes"""

    @staticmethod
    def calculate_sl(df: pd.DataFrame, index: int, direction: str = 'long',
                     lookback: int = 20, atr_multiplier: float = 2.0) -> float:
        """
        Calculate optimal stop loss based on recent swing lows/highs

        Args:
            df: DataFrame with OHLC and ATR
            index: Current candle index
            direction: 'long' or 'short'
            lookback: Number of candles to look back for swing points
            atr_multiplier: ATR multiplier for buffer

        Returns:
            float: Stop loss price level
        """
        start_idx = max(0, index - lookback)

        if direction == 'long':
            # SL below recent swing low
            swing_low = df.iloc[start_idx:index + 1]['low'].min()
            atr_buffer = df.iloc[index]['atr_14'] * atr_multiplier
            sl = swing_low - atr_buffer
        else:
            # SL above recent swing high
            swing_high = df.iloc[start_idx:index + 1]['high'].max()
            atr_buffer = df.iloc[index]['atr_14'] * atr_multiplier
            sl = swing_high + atr_buffer

        return sl

    @staticmethod
    def calculate_tp(entry_price: float, sl: float, direction: str = 'long',
                     rr: float = 2.0) -> float:
        """
        Calculate take profit based on risk-reward ratio

        Args:
            entry_price: Entry price
            sl: Stop loss price
            direction: 'long' or 'short'
            rr: Risk-reward ratio (e.g., 2.0 = 2:1)

        Returns:
            float: Take profit price level
        """
        risk = abs(entry_price - sl)

        if direction == 'long':
            tp = entry_price + (risk * rr)
        else:
            tp = entry_price - (risk * rr)

        return tp

    @staticmethod
    def simulate_trade(df: pd.DataFrame, entry_index: int, entry_price: float,
                       sl: float, tp: float, direction: str,
                       max_duration: int = 5) -> Dict:
        """
        Simulate trade execution and return outcome

        Args:
            df: DataFrame with OHLC data
            entry_index: Index of entry candle
            entry_price: Entry price
            sl: Stop loss
            tp: Take profit
            direction: 'long' or 'short'
            max_duration: Maximum candles to hold (days)

        Returns:
            dict: Trade outcome with hit_tp, hit_sl, rr, duration, exit_price, pnl_pips, pnl_pct
        """
        max_idx = min(entry_index + max_duration + 1, len(df))

        for i in range(entry_index + 1, max_idx):
            low = df.iloc[i]['low']
            high = df.iloc[i]['high']

            if direction == 'long':
                # Check SL first (more conservative)
                if low <= sl:
                    return {
                        'hit_tp': False,
                        'hit_sl': True,
                        'rr': -1.0,
                        'duration': i - entry_index,
                        'exit_price': sl,
                        'pnl_pips': (sl - entry_price) * 10000,
                        'pnl_pct': (sl - entry_price) / entry_price
                    }
                elif high >= tp:
                    risk = abs(entry_price - sl)
                    reward = abs(tp - entry_price)
                    return {
                        'hit_tp': True,
                        'hit_sl': False,
                        'rr': reward / risk if risk > 0 else 0.0,
                        'duration': i - entry_index,
                        'exit_price': tp,
                        'pnl_pips': (tp - entry_price) * 10000,
                        'pnl_pct': (tp - entry_price) / entry_price
                    }
            else:  # short
                # Check SL first
                if high >= sl:
                    return {
                        'hit_tp': False,
                        'hit_sl': True,
                        'rr': -1.0,
                        'duration': i - entry_index,
                        'exit_price': sl,
                        'pnl_pips': (entry_price - sl) * 10000,
                        'pnl_pct': (entry_price - sl) / entry_price
                    }
                elif low <= tp:
                    risk = abs(entry_price - sl)
                    reward = abs(entry_price - tp)
                    return {
                        'hit_tp': True,
                        'hit_sl': False,
                        'rr': reward / risk if risk > 0 else 0.0,
                        'duration': i - entry_index,
                        'exit_price': tp,
                        'pnl_pips': (entry_price - tp) * 10000,
                        'pnl_pct': (entry_price - tp) / entry_price
                    }

        # Max duration reached, no hit - exit at market
        exit_price = df.iloc[max_idx - 1]['close']

        if direction == 'long':
            pnl_pips = (exit_price - entry_price) * 10000
            pnl_pct = (exit_price - entry_price) / entry_price
        else:
            pnl_pips = (entry_price - exit_price) * 10000
            pnl_pct = (entry_price - exit_price) / entry_price

        return {
            'hit_tp': False,
            'hit_sl': False,
            'rr': 0.0,
            'duration': max_duration,
            'exit_price': exit_price,
            'pnl_pips': pnl_pips,
            'pnl_pct': pnl_pct
        }


class SetupQualityAnalyzer:
    """Analyzes trading setup quality for confidence scoring"""

    @staticmethod
    def calculate_setup_confidence(df: pd.DataFrame, index: int) -> float:
        """
        Calculate confidence score based on technical setup quality

        Higher confidence if:
        - Clear trend (ADX > 25)
        - Strong momentum
        - Multiple indicators aligned
        - Reasonable volatility
        - Good support/resistance levels

        Args:
            df: DataFrame with technical indicators
            index: Current candle index

        Returns:
            float: Confidence score (0.0-1.0)
        """
        confidence = 0.5  # Base confidence

        row = df.iloc[index]

        # 1. Trend strength (ADX)
        adx = row.get('adx_14', 0)
        if adx > 30:
            confidence += 0.15
        elif adx > 25:
            confidence += 0.10
        elif adx > 20:
            confidence += 0.05

        # 2. RSI in good range (not overbought/oversold)
        rsi = row.get('rsi_14', 50)
        if 35 < rsi < 65:
            confidence += 0.10
        elif 40 < rsi < 60:
            confidence += 0.05

        # 3. MACD momentum
        macd_hist = row.get('macd_histogram', 0)
        if abs(macd_hist) > 0.0005:
            confidence += 0.10

        # 4. Volatility (ATR normalized)
        atr = row.get('atr_14', 0)
        close = row.get('close', 1.0)
        atr_normalized = atr / close if close > 0 else 0

        if 0.005 < atr_normalized < 0.015:  # Reasonable volatility
            confidence += 0.10
        elif atr_normalized < 0.005:  # Too low
            confidence += 0.02
        elif atr_normalized > 0.020:  # Too high
            confidence -= 0.05

        # 5. Price position relative to moving averages
        close = row.get('close', 0)
        sma_20 = row.get('sma_20', 0)
        sma_50 = row.get('sma_50', 0)

        if sma_20 > 0 and sma_50 > 0:
            # Bullish setup: price > SMA20 > SMA50
            if close > sma_20 > sma_50:
                confidence += 0.10
            # Bearish setup: price < SMA20 < SMA50
            elif close < sma_20 < sma_50:
                confidence += 0.10

        return min(confidence, 1.0)

    @staticmethod
    def analyze_indicators_alignment(df: pd.DataFrame, index: int) -> Dict:
        """
        Analyze if multiple indicators agree on direction

        Returns:
            dict: {
                'bullish_count': int,
                'bearish_count': int,
                'neutral_count': int,
                'alignment_score': float (0-1)
            }
        """
        row = df.iloc[index]

        bullish = 0
        bearish = 0
        neutral = 0

        # 1. RSI
        rsi = row.get('rsi_14', 50)
        if rsi > 55:
            bullish += 1
        elif rsi < 45:
            bearish += 1
        else:
            neutral += 1

        # 2. MACD
        macd_hist = row.get('macd_histogram', 0)
        if macd_hist > 0.0001:
            bullish += 1
        elif macd_hist < -0.0001:
            bearish += 1
        else:
            neutral += 1

        # 3. Moving Average trend
        sma_20 = row.get('sma_20', 0)
        sma_50 = row.get('sma_50', 0)
        if sma_20 > sma_50:
            bullish += 1
        elif sma_20 < sma_50:
            bearish += 1
        else:
            neutral += 1

        # 4. Stochastic
        stoch_k = row.get('stoch_k', 50)
        if stoch_k > 60:
            bullish += 1
        elif stoch_k < 40:
            bearish += 1
        else:
            neutral += 1

        # Calculate alignment score
        total = bullish + bearish + neutral
        if total > 0:
            # Higher score if most indicators agree
            max_agreement = max(bullish, bearish)
            alignment_score = max_agreement / total
        else:
            alignment_score = 0.0

        return {
            'bullish_count': bullish,
            'bearish_count': bearish,
            'neutral_count': neutral,
            'alignment_score': alignment_score
        }


class MonitoringSimulator:
    """Simulates position monitoring scenarios for Mode 2 labeling"""

    @staticmethod
    def simulate_from_checkpoint(df: pd.DataFrame, current_index: int,
                                  current_price: float, sl: float, tp: float,
                                  direction: str, lookforward: int = 4) -> Dict:
        """
        Simulate continuing to hold position from checkpoint

        Args:
            df: DataFrame with OHLC
            current_index: Current monitoring checkpoint
            current_price: Current price
            sl: Current stop loss
            tp: Current take profit
            direction: 'long' or 'short'
            lookforward: Days to simulate forward

        Returns:
            dict: Outcome with final_pnl, exit_reason, duration
        """
        return TradingSimulator.simulate_trade(
            df, current_index, current_price, sl, tp, direction, lookforward
        )

    @staticmethod
    def calculate_immediate_exit(entry_price: float, current_price: float,
                                  direction: str) -> Dict:
        """
        Calculate outcome if exiting immediately

        Returns:
            dict: {final_pnl: float, exit_price: float}
        """
        if direction == 'long':
            pnl_pips = (current_price - entry_price) * 10000
            pnl_pct = (current_price - entry_price) / entry_price
        else:
            pnl_pips = (entry_price - current_price) * 10000
            pnl_pct = (entry_price - current_price) / entry_price

        return {
            'final_pnl': pnl_pips,
            'exit_price': current_price,
            'pnl_pct': pnl_pct
        }

    @staticmethod
    def calculate_partial_exit(entry_price: float, current_price: float,
                                sl: float, tp: float, direction: str,
                                df: pd.DataFrame, current_index: int,
                                lookforward: int = 4) -> Dict:
        """
        Simulate taking partial profit (50%) and continuing with rest

        Returns:
            dict: {final_pnl: float}
        """
        # Immediate partial profit (50%)
        immediate_exit = MonitoringSimulator.calculate_immediate_exit(
            entry_price, current_price, direction
        )
        partial_pnl = immediate_exit['final_pnl'] * 0.5

        # Move SL to breakeven for remaining 50%
        remaining_outcome = TradingSimulator.simulate_trade(
            df, current_index, current_price, entry_price, tp, direction, lookforward
        )

        # Total P&L = 50% immediate + 50% continued
        total_pnl = partial_pnl + (remaining_outcome['pnl_pips'] * 0.5)

        return {
            'final_pnl': total_pnl,
            'partial_pnl': partial_pnl,
            'remaining_pnl': remaining_outcome['pnl_pips'] * 0.5
        }

    @staticmethod
    def calculate_trailing_sl(current_price: float, current_sl: float,
                               position: Dict, df: pd.DataFrame,
                               current_index: int) -> float:
        """
        Calculate new trailing stop loss position

        Logic:
        - If profit >= 50% to TP: Move SL to breakeven
        - If profit >= 80% to TP: Move SL to 50% profit level

        Returns:
            float: New stop loss price
        """
        entry_price = position['entry_price']
        tp = position['take_profit']
        direction = position['direction']

        if direction == 'long':
            # Calculate progress to TP
            total_distance = tp - entry_price
            current_distance = current_price - entry_price

            if total_distance > 0:
                progress_pct = (current_distance / total_distance) * 100

                if progress_pct >= 80:
                    # Move SL to 50% profit level
                    new_sl = entry_price + (total_distance * 0.5)
                elif progress_pct >= 50:
                    # Move SL to breakeven
                    new_sl = entry_price
                else:
                    new_sl = current_sl
            else:
                new_sl = current_sl

        else:  # short
            total_distance = entry_price - tp
            current_distance = entry_price - current_price

            if total_distance > 0:
                progress_pct = (current_distance / total_distance) * 100

                if progress_pct >= 80:
                    # Move SL to 50% profit level
                    new_sl = entry_price - (total_distance * 0.5)
                elif progress_pct >= 50:
                    # Move SL to breakeven
                    new_sl = entry_price
                else:
                    new_sl = current_sl
            else:
                new_sl = current_sl

        return new_sl

    @staticmethod
    def detect_reversal(df: pd.DataFrame, current_index: int, direction: str,
                        lookforward: int = 4) -> bool:
        """
        Detect if a reversal occurs in the lookforward period

        Returns:
            bool: True if reversal detected
        """
        if current_index + lookforward >= len(df):
            return False

        current_price = df.iloc[current_index]['close']

        # Get future prices
        future_slice = df.iloc[current_index + 1:current_index + lookforward + 1]

        if direction == 'long':
            # Reversal if price drops significantly
            future_low = future_slice['low'].min()
            drop_pct = (current_price - future_low) / current_price

            # Consider reversal if drops > 0.3%
            return drop_pct > 0.003

        else:  # short
            # Reversal if price rises significantly
            future_high = future_slice['high'].max()
            rise_pct = (future_high - current_price) / current_price

            # Consider reversal if rises > 0.3%
            return rise_pct > 0.003


# Convenience functions for external use

def label_entry_opportunity(candle_index: int, df: pd.DataFrame,
                            lookforward: int = 5) -> Dict:
    """
    Label if this candle represents a good entry opportunity

    This is a placeholder - full implementation in v3_labeler_mode1.py

    Returns:
        dict: {
            'signal': 0 or 1,
            'direction': 'long' or 'short' or None,
            'confidence': float,
            'actual_rr': float,
            'actual_outcome': 0 or 1,
            'sl': float,
            'tp': float
        }
    """
    # Will be implemented in mode1 labeler
    pass


def label_monitoring_action(position: Dict, current_index: int,
                            df: pd.DataFrame, lookforward: int = 4) -> Dict:
    """
    Label optimal action for position at current monitoring checkpoint

    This is a placeholder - full implementation in v3_labeler_mode2.py

    Returns:
        dict: {
            'action': 0 (Hold), 1 (Exit), 2 (TakePartial), 3 (AdjustSL),
            'action_outcome': float (P&L if action taken),
            'actual_reversal': bool,
            'confidence_target': float
        }
    """
    # Will be implemented in mode2 labeler
    pass
