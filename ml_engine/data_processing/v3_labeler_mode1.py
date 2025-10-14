#!/usr/bin/env python3
"""
v3.0 Mode 1: Entry Evaluation Labeler

Labels each historical candle as "Good Entry" or "Bad Entry" by simulating trades
and evaluating outcomes in hindsight.

Algorithm:
1. For each candle, simulate both LONG and SHORT entries
2. Calculate optimal SL/TP based on recent price action
3. Simulate trade execution over next 1-5 days
4. Label as "Good" if trade hits TP with RR >= 2.0
5. Calculate confidence based on technical setup quality

Author: AI-assisted
Created: 2025-10-13
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
from pathlib import Path
import logging

from .v3_labeling_utils import (
    TradingSimulator,
    SetupQualityAnalyzer
)

logger = logging.getLogger(__name__)


class EntryEvaluationLabeler:
    """Labels entry opportunities for Mode 1 training"""

    def __init__(self, lookforward_days: int = 5, min_rr: float = 2.0,
                 min_confidence: float = 0.4):
        """
        Initialize entry labeler

        Args:
            lookforward_days: Maximum days to hold trade
            min_rr: Minimum risk-reward ratio for "good" entry
            min_confidence: Minimum confidence threshold
        """
        self.lookforward_days = lookforward_days
        self.min_rr = min_rr
        self.min_confidence = min_confidence

        self.simulator = TradingSimulator()
        self.quality_analyzer = SetupQualityAnalyzer()

    def label_single_candle(self, df: pd.DataFrame, index: int) -> Dict:
        """
        Label if this candle represents a good entry opportunity

        Args:
            df: DataFrame with OHLC and indicators
            index: Index of candle to label

        Returns:
            dict: Label data for this candle
        """
        # Skip if not enough future data
        if index + self.lookforward_days >= len(df):
            return self._create_no_label()

        # Skip if missing required indicators
        row = df.iloc[index]
        if pd.isna(row.get('atr_14')) or pd.isna(row.get('close')):
            return self._create_no_label()

        entry_price = row['close']

        # Simulate LONG entry
        long_result = self._simulate_direction(df, index, entry_price, 'long')

        # Simulate SHORT entry
        short_result = self._simulate_direction(df, index, entry_price, 'short')

        # Determine if good entry exists
        long_good = long_result['hit_tp'] and long_result['rr'] >= self.min_rr
        short_good = short_result['hit_tp'] and short_result['rr'] >= self.min_rr

        if long_good or short_good:
            # Choose the better direction
            if long_good and short_good:
                best = long_result if long_result['rr'] > short_result['rr'] else short_result
                best_direction = 'long' if long_result['rr'] > short_result['rr'] else 'short'
            elif long_good:
                best = long_result
                best_direction = 'long'
            else:
                best = short_result
                best_direction = 'short'

            # Calculate confidence
            base_confidence = self.quality_analyzer.calculate_setup_confidence(df, index)

            # Adjust confidence based on RR achieved
            rr_bonus = min((best['rr'] - self.min_rr) * 0.1, 0.2)
            confidence = min(base_confidence + rr_bonus, 1.0)

            return {
                'signal': 1,  # Good entry
                'direction': best_direction,
                'confidence': confidence,
                'actual_rr': best['rr'],
                'actual_outcome': 1,  # Win
                'sl': best['sl'],
                'tp': best['tp'],
                'entry_price': entry_price,
                'duration': best['duration'],
                'pnl_pips': best['pnl_pips'],
                'pnl_pct': best['pnl_pct'],
                'exit_price': best['exit_price']
            }
        else:
            # Bad entry (both directions failed)
            return {
                'signal': 0,  # Bad entry
                'direction': None,
                'confidence': 0.0,
                'actual_rr': 0.0,
                'actual_outcome': 0,  # Loss
                'sl': None,
                'tp': None,
                'entry_price': entry_price,
                'duration': 0,
                'pnl_pips': 0.0,
                'pnl_pct': 0.0,
                'exit_price': None
            }

    def _simulate_direction(self, df: pd.DataFrame, index: int,
                            entry_price: float, direction: str) -> Dict:
        """
        Simulate trade in one direction

        Returns:
            dict: Simulation result with sl, tp, and outcome
        """
        # Calculate SL
        sl = self.simulator.calculate_sl(df, index, direction)

        # Calculate TP (RR = 2.0 for labeling)
        tp = self.simulator.calculate_tp(entry_price, sl, direction, rr=2.0)

        # Simulate trade
        outcome = self.simulator.simulate_trade(
            df, index, entry_price, sl, tp, direction, self.lookforward_days
        )

        # Add SL/TP to result
        outcome['sl'] = sl
        outcome['tp'] = tp

        return outcome

    def _create_no_label(self) -> Dict:
        """Create a null label for skipped candles"""
        return {
            'signal': -1,  # No label
            'direction': None,
            'confidence': 0.0,
            'actual_rr': 0.0,
            'actual_outcome': 0,
            'sl': None,
            'tp': None,
            'entry_price': None,
            'duration': 0,
            'pnl_pips': 0.0,
            'pnl_pct': 0.0,
            'exit_price': None
        }

    def label_dataset(self, df: pd.DataFrame, start_index: int = 0,
                      end_index: int = None, verbose: bool = True) -> pd.DataFrame:
        """
        Label entire dataset

        Args:
            df: DataFrame with OHLC and indicators
            start_index: Start labeling from this index
            end_index: End labeling at this index (None = end of df)
            verbose: Print progress

        Returns:
            pd.DataFrame: DataFrame with label columns added
        """
        if end_index is None:
            end_index = len(df) - self.lookforward_days

        if verbose:
            logger.info(f"Labeling {end_index - start_index} candles for Mode 1 (Entry Evaluation)")
            logger.info(f"  Lookforward: {self.lookforward_days} days")
            logger.info(f"  Min RR: {self.min_rr}")

        labels = []

        for i in range(start_index, end_index):
            if verbose and i % 100 == 0:
                logger.info(f"  Progress: {i - start_index}/{end_index - start_index} ({(i - start_index) / (end_index - start_index) * 100:.1f}%)")

            label = self.label_single_candle(df, i)
            labels.append(label)

        # Convert to DataFrame
        labels_df = pd.DataFrame(labels, index=df.index[start_index:end_index])

        # Add prefix to avoid column conflicts
        labels_df = labels_df.add_prefix('mode1_')

        if verbose:
            self._print_label_stats(labels_df)

        return labels_df

    def _print_label_stats(self, labels_df: pd.DataFrame):
        """Print labeling statistics"""
        total = len(labels_df)
        good_entries = (labels_df['mode1_signal'] == 1).sum()
        bad_entries = (labels_df['mode1_signal'] == 0).sum()
        no_label = (labels_df['mode1_signal'] == -1).sum()

        logger.info(f"\n{'='*60}")
        logger.info(f"Mode 1 Labeling Results")
        logger.info(f"{'='*60}")
        logger.info(f"Total candles: {total}")
        logger.info(f"  Good entries: {good_entries} ({good_entries/total*100:.1f}%)")
        logger.info(f"  Bad entries:  {bad_entries} ({bad_entries/total*100:.1f}%)")
        logger.info(f"  No label:     {no_label} ({no_label/total*100:.1f}%)")

        # Direction distribution (for good entries)
        good_mask = labels_df['mode1_signal'] == 1
        if good_mask.sum() > 0:
            long_count = (labels_df.loc[good_mask, 'mode1_direction'] == 'long').sum()
            short_count = (labels_df.loc[good_mask, 'mode1_direction'] == 'short').sum()

            logger.info(f"\nGood Entry Directions:")
            logger.info(f"  Long:  {long_count} ({long_count/good_mask.sum()*100:.1f}%)")
            logger.info(f"  Short: {short_count} ({short_count/good_mask.sum()*100:.1f}%)")

        # Average confidence for good entries
        if good_mask.sum() > 0:
            avg_confidence = labels_df.loc[good_mask, 'mode1_confidence'].mean()
            logger.info(f"\nAverage confidence: {avg_confidence:.3f}")

        # Average RR achieved
        if good_mask.sum() > 0:
            avg_rr = labels_df.loc[good_mask, 'mode1_actual_rr'].mean()
            logger.info(f"Average RR achieved: {avg_rr:.2f}")

        logger.info(f"{'='*60}\n")


class AdaptiveEntryLabeler(EntryEvaluationLabeler):
    """
    Advanced labeler with adaptive RR targets

    Instead of fixed RR=2.0, this labeler uses multiple RR targets (1.5, 2.0, 2.5, 3.0)
    and labels based on which RR is achievable.
    """

    def __init__(self, lookforward_days: int = 5, rr_targets: List[float] = None,
                 min_confidence: float = 0.4):
        """
        Initialize adaptive entry labeler

        Args:
            lookforward_days: Maximum days to hold trade
            rr_targets: List of RR targets to test (default: [1.5, 2.0, 2.5, 3.0])
            min_confidence: Minimum confidence threshold
        """
        super().__init__(lookforward_days, min_rr=2.0, min_confidence=min_confidence)

        if rr_targets is None:
            self.rr_targets = [1.5, 2.0, 2.5, 3.0]
        else:
            self.rr_targets = sorted(rr_targets)

    def label_single_candle(self, df: pd.DataFrame, index: int) -> Dict:
        """
        Label with adaptive RR targets

        Tests multiple RR targets and labels with the best achievable RR
        """
        # Skip if not enough future data
        if index + self.lookforward_days >= len(df):
            return self._create_no_label()

        # Skip if missing required indicators
        row = df.iloc[index]
        if pd.isna(row.get('atr_14')) or pd.isna(row.get('close')):
            return self._create_no_label()

        entry_price = row['close']

        # Test all RR targets for both directions
        best_result = None
        best_rr = 0.0
        best_direction = None

        for direction in ['long', 'short']:
            sl = self.simulator.calculate_sl(df, index, direction)

            for rr_target in self.rr_targets:
                tp = self.simulator.calculate_tp(entry_price, sl, direction, rr=rr_target)

                outcome = self.simulator.simulate_trade(
                    df, index, entry_price, sl, tp, direction, self.lookforward_days
                )

                if outcome['hit_tp'] and outcome['rr'] > best_rr:
                    best_rr = outcome['rr']
                    best_result = outcome
                    best_result['sl'] = sl
                    best_result['tp'] = tp
                    best_direction = direction

        # Label based on best achievable RR
        if best_rr >= self.min_rr:
            # Good entry
            base_confidence = self.quality_analyzer.calculate_setup_confidence(df, index)
            rr_bonus = min((best_rr - self.min_rr) * 0.1, 0.2)
            confidence = min(base_confidence + rr_bonus, 1.0)

            return {
                'signal': 1,
                'direction': best_direction,
                'confidence': confidence,
                'actual_rr': best_rr,
                'actual_outcome': 1,
                'sl': best_result['sl'],
                'tp': best_result['tp'],
                'entry_price': entry_price,
                'duration': best_result['duration'],
                'pnl_pips': best_result['pnl_pips'],
                'pnl_pct': best_result['pnl_pct'],
                'exit_price': best_result['exit_price']
            }
        else:
            # Bad entry
            return {
                'signal': 0,
                'direction': None,
                'confidence': 0.0,
                'actual_rr': 0.0,
                'actual_outcome': 0,
                'sl': None,
                'tp': None,
                'entry_price': entry_price,
                'duration': 0,
                'pnl_pips': 0.0,
                'pnl_pct': 0.0,
                'exit_price': None
            }


# Convenience function for external use
def label_entry_opportunities(df: pd.DataFrame, lookforward_days: int = 5,
                               min_rr: float = 2.0, adaptive: bool = False,
                               verbose: bool = True) -> pd.DataFrame:
    """
    Label entry opportunities in dataset

    Args:
        df: DataFrame with OHLC and technical indicators
        lookforward_days: Maximum days to hold trade
        min_rr: Minimum risk-reward ratio
        adaptive: Use adaptive RR labeler
        verbose: Print progress

    Returns:
        pd.DataFrame: DataFrame with mode1_* label columns
    """
    if adaptive:
        labeler = AdaptiveEntryLabeler(lookforward_days=lookforward_days, min_confidence=0.4)
    else:
        labeler = EntryEvaluationLabeler(lookforward_days=lookforward_days, min_rr=min_rr)

    return labeler.label_dataset(df, verbose=verbose)


# Example usage
if __name__ == '__main__':
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Example: Load data and label
    # df = pd.read_csv('data/processed/EURUSD_yfinance_processed.csv', index_col=0, parse_dates=True)
    # labels_df = label_entry_opportunities(df, lookforward_days=5, min_rr=2.0)
    # print(labels_df.head())

    print("Mode 1 Entry Evaluation Labeler loaded successfully")
