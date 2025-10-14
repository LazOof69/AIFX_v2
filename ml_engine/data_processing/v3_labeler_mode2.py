#!/usr/bin/env python3
"""
v3.0 Mode 2: Position Monitoring Labeler

Labels optimal actions for open positions at monitoring checkpoints.

Algorithm:
1. Take good entries from Mode 1 as simulated open positions
2. Create monitoring checkpoints every N hours (simulated as candles)
3. For each checkpoint, simulate 4 possible actions: Hold, Exit, TakePartial, AdjustSL
4. Label with the action that yields the best outcome in hindsight
5. Calculate confidence and reversal probability

Author: AI-assisted
Created: 2025-10-13
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from pathlib import Path
import logging

from .v3_labeling_utils import (
    MonitoringSimulator,
    SetupQualityAnalyzer
)

logger = logging.getLogger(__name__)


class PositionMonitoringLabeler:
    """Labels position monitoring checkpoints for Mode 2 training"""

    def __init__(self, checkpoint_interval: int = 1, lookforward: int = 4):
        """
        Initialize monitoring labeler

        Args:
            checkpoint_interval: Candles between monitoring checkpoints (1 = every candle)
            lookforward: Days to look forward for outcome evaluation
        """
        self.checkpoint_interval = checkpoint_interval
        self.lookforward = lookforward

        self.simulator = MonitoringSimulator()
        self.quality_analyzer = SetupQualityAnalyzer()

    def create_monitoring_dataset(self, df: pd.DataFrame, mode1_labels: pd.DataFrame,
                                   verbose: bool = True) -> List[Dict]:
        """
        Create monitoring dataset from good entries

        Args:
            df: DataFrame with OHLC and indicators
            mode1_labels: DataFrame with Mode 1 labels (from v3_labeler_mode1)
            verbose: Print progress

        Returns:
            List[Dict]: List of monitoring checkpoint labels
        """
        # Filter to good entries only
        good_entries = mode1_labels[mode1_labels['mode1_signal'] == 1].copy()

        if verbose:
            logger.info(f"Creating Mode 2 monitoring dataset from {len(good_entries)} good entries")

        monitoring_data = []

        for entry_idx, entry_row in good_entries.iterrows():
            # Get entry info
            entry_index = df.index.get_loc(entry_idx)
            entry_price = entry_row['mode1_entry_price']
            sl = entry_row['mode1_sl']
            tp = entry_row['mode1_tp']
            direction = entry_row['mode1_direction']

            # Create position dict
            position = {
                'entry_index': entry_index,
                'entry_price': entry_price,
                'stop_loss': sl,
                'take_profit': tp,
                'direction': direction
            }

            # Create checkpoints
            checkpoints = self._create_checkpoints(df, position, entry_index)

            monitoring_data.extend(checkpoints)

        if verbose:
            logger.info(f"Created {len(monitoring_data)} monitoring checkpoints")
            self._print_action_distribution(monitoring_data)

        return monitoring_data

    def _create_checkpoints(self, df: pd.DataFrame, position: Dict,
                            entry_index: int) -> List[Dict]:
        """
        Create monitoring checkpoints for one position

        Returns:
            List[Dict]: Monitoring checkpoint labels
        """
        checkpoints = []
        max_duration = min(position.get('duration', 5), 5)  # Max 5 days

        # Start monitoring from next candle after entry
        start_index = entry_index + 1

        for i in range(start_index, min(entry_index + max_duration + 1, len(df))):
            # Check interval
            if (i - start_index) % self.checkpoint_interval != 0:
                continue

            # Skip if not enough future data
            if i + self.lookforward >= len(df):
                break

            current_price = df.iloc[i]['close']

            # Check if position still open (not hit SL/TP)
            if not self._is_position_open(df, entry_index, i, position):
                break

            # Label this checkpoint
            label = self.label_checkpoint(df, i, current_price, position)

            if label is not None:
                # Add metadata
                label['checkpoint_index'] = i
                label['entry_index'] = entry_index
                label['candles_held'] = i - entry_index
                label['entry_price'] = position['entry_price']
                label['direction'] = position['direction']

                checkpoints.append(label)

        return checkpoints

    def _is_position_open(self, df: pd.DataFrame, entry_index: int,
                          current_index: int, position: Dict) -> bool:
        """
        Check if position is still open (hasn't hit SL or TP)

        Returns:
            bool: True if position is still open
        """
        sl = position['stop_loss']
        tp = position['take_profit']
        direction = position['direction']

        # Check all candles from entry to current
        for i in range(entry_index + 1, current_index + 1):
            low = df.iloc[i]['low']
            high = df.iloc[i]['high']

            if direction == 'long':
                if low <= sl or high >= tp:
                    return False
            else:  # short
                if high >= sl or low <= tp:
                    return False

        return True

    def label_checkpoint(self, df: pd.DataFrame, checkpoint_index: int,
                         current_price: float, position: Dict) -> Optional[Dict]:
        """
        Label optimal action for monitoring checkpoint

        Args:
            df: DataFrame with OHLC
            checkpoint_index: Index of monitoring checkpoint
            current_price: Current price
            position: Position info dict

        Returns:
            dict: Label with action, outcome, reversal, etc.
        """
        entry_price = position['entry_price']
        sl = position['stop_loss']
        tp = position['take_profit']
        direction = position['direction']

        # Simulate 4 possible actions
        actions = {}

        # Action 0: Hold
        hold_outcome = self.simulator.simulate_from_checkpoint(
            df, checkpoint_index, current_price, sl, tp, direction, self.lookforward
        )
        actions[0] = hold_outcome['pnl_pips']

        # Action 1: Exit now
        exit_outcome = self.simulator.calculate_immediate_exit(
            entry_price, current_price, direction
        )
        actions[1] = exit_outcome['final_pnl']

        # Action 2: Take partial profit (50%)
        partial_outcome = self.simulator.calculate_partial_exit(
            entry_price, current_price, sl, tp, direction,
            df, checkpoint_index, self.lookforward
        )
        actions[2] = partial_outcome['final_pnl']

        # Action 3: Adjust SL (trailing stop)
        new_sl = self.simulator.calculate_trailing_sl(
            current_price, sl, position, df, checkpoint_index
        )

        # Only consider this if SL actually moves
        if abs(new_sl - sl) > 0.0001:
            adjusted_outcome = self.simulator.simulate_from_checkpoint(
                df, checkpoint_index, current_price, new_sl, tp, direction, self.lookforward
            )
            actions[3] = adjusted_outcome['pnl_pips']
        else:
            # No adjustment needed, same as hold
            actions[3] = actions[0]

        # Determine best action
        best_action = max(actions, key=actions.get)
        best_outcome = actions[best_action]

        # Detect reversal
        reversal = self.simulator.detect_reversal(
            df, checkpoint_index, direction, self.lookforward
        )

        # Calculate confidence (how much better is best action vs second best)
        sorted_outcomes = sorted(actions.values(), reverse=True)
        if len(sorted_outcomes) >= 2:
            best_pnl = sorted_outcomes[0]
            second_best_pnl = sorted_outcomes[1]

            # If best is significantly better, higher confidence
            if abs(best_pnl) > 1:  # Avoid division by very small numbers
                confidence = min(abs(best_pnl - second_best_pnl) / abs(best_pnl), 1.0)
            else:
                confidence = 0.5
        else:
            confidence = 0.5

        # Adjust confidence based on setup quality
        setup_confidence = self.quality_analyzer.calculate_setup_confidence(df, checkpoint_index)
        final_confidence = (confidence + setup_confidence) / 2

        return {
            'action': best_action,
            'action_outcome': best_outcome,
            'actual_reversal': int(reversal),
            'confidence_target': final_confidence,
            'hold_outcome': actions[0],
            'exit_outcome': actions[1],
            'partial_outcome': actions[2],
            'adjust_sl_outcome': actions[3],
            'current_price': current_price,
            'sl': sl,
            'tp': tp,
            'new_sl': new_sl if best_action == 3 else sl
        }

    def convert_to_dataframe(self, monitoring_data: List[Dict]) -> Tuple[pd.DataFrame, np.ndarray]:
        """
        Convert monitoring data to DataFrame for training

        Args:
            monitoring_data: List of monitoring checkpoints

        Returns:
            Tuple[pd.DataFrame, np.ndarray]: (Feature DataFrame, Labels array)
        """
        # Extract features
        features = []
        labels = []

        for checkpoint in monitoring_data:
            # Features will be extracted from df during training
            # For now, store metadata
            features.append({
                'checkpoint_index': checkpoint['checkpoint_index'],
                'entry_index': checkpoint['entry_index'],
                'entry_price': checkpoint['entry_price'],
                'current_price': checkpoint['current_price'],
                'direction': checkpoint['direction'],
                'candles_held': checkpoint['candles_held']
            })

            # Labels
            labels.append({
                'action': checkpoint['action'],
                'confidence': checkpoint['confidence_target'],
                'reversal': checkpoint['actual_reversal'],
                'outcome': checkpoint['action_outcome']
            })

        features_df = pd.DataFrame(features)
        labels_df = pd.DataFrame(labels)

        return features_df, labels_df

    def _print_action_distribution(self, monitoring_data: List[Dict]):
        """Print statistics about labeled actions"""
        if not monitoring_data:
            return

        total = len(monitoring_data)
        actions = [cp['action'] for cp in monitoring_data]

        hold_count = actions.count(0)
        exit_count = actions.count(1)
        partial_count = actions.count(2)
        adjust_sl_count = actions.count(3)

        logger.info(f"\n{'='*60}")
        logger.info(f"Mode 2 Labeling Results")
        logger.info(f"{'='*60}")
        logger.info(f"Total checkpoints: {total}")
        logger.info(f"  Hold:        {hold_count:>5} ({hold_count/total*100:>5.1f}%)")
        logger.info(f"  Exit:        {exit_count:>5} ({exit_count/total*100:>5.1f}%)")
        logger.info(f"  Take Partial: {partial_count:>5} ({partial_count/total*100:>5.1f}%)")
        logger.info(f"  Adjust SL:   {adjust_sl_count:>5} ({adjust_sl_count/total*100:>5.1f}%)")

        # Average confidence
        avg_confidence = np.mean([cp['confidence_target'] for cp in monitoring_data])
        logger.info(f"\nAverage confidence: {avg_confidence:.3f}")

        # Reversal rate
        reversal_rate = np.mean([cp['actual_reversal'] for cp in monitoring_data])
        logger.info(f"Reversal rate: {reversal_rate*100:.1f}%")

        logger.info(f"{'='*60}\n")


# Convenience function for external use
def label_monitoring_checkpoints(df: pd.DataFrame, mode1_labels: pd.DataFrame,
                                  checkpoint_interval: int = 1, lookforward: int = 4,
                                  verbose: bool = True) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Label monitoring checkpoints for Mode 2 training

    Args:
        df: DataFrame with OHLC and indicators
        mode1_labels: DataFrame with Mode 1 labels
        checkpoint_interval: Candles between checkpoints
        lookforward: Days to look forward
        verbose: Print progress

    Returns:
        Tuple[pd.DataFrame, pd.DataFrame]: (Features DataFrame, Labels DataFrame)
    """
    labeler = PositionMonitoringLabeler(
        checkpoint_interval=checkpoint_interval,
        lookforward=lookforward
    )

    monitoring_data = labeler.create_monitoring_dataset(df, mode1_labels, verbose=verbose)

    return labeler.convert_to_dataframe(monitoring_data)


# Example usage
if __name__ == '__main__':
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Example: Create monitoring dataset
    # df = pd.read_csv('data/processed/EURUSD_yfinance_processed.csv', index_col=0, parse_dates=True)
    # mode1_labels = pd.read_csv('mode1_labels.csv', index_col=0, parse_dates=True)
    # features_df, labels_df = label_monitoring_checkpoints(df, mode1_labels)
    # print(f"Created {len(features_df)} monitoring checkpoints")

    print("Mode 2 Position Monitoring Labeler loaded successfully")
