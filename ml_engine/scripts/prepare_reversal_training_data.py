#!/usr/bin/env python3
"""
Prepare Reversal-Based Training Data for ML v3.0

Generates training data for:
- Mode 1: Reversal point detection (entry signals)
- Mode 2: Dynamic risk management (misjudge + reversal probabilities)

Splits:
- Train: 2015-2022 (80%)
- Val: 2023 (10%)
- Test: 2024 (10%)

Author: AI-assisted
Created: 2025-10-14
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import pandas as pd
import numpy as np
import logging
from datetime import datetime
import json

from data_processing.v3_reversal_labeler import ReversalPointLabeler, DynamicRiskLabeler

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ReversalDataPipeline:
    """Pipeline for generating reversal-based training data"""

    def __init__(self, data_dir: Path, timeframe: str = 'D1'):
        self.data_dir = Path(data_dir)
        self.timeframe = timeframe
        self.output_dir = self.data_dir / 'training_v3_reversal'
        self.output_dir.mkdir(exist_ok=True)

        logger.info(f"Initialized pipeline with timeframe: {timeframe}")
        logger.info(f"Output directory: {self.output_dir}")

    def load_features(self, split: str) -> pd.DataFrame:
        """Load feature data for given split"""
        filename = f'EURUSD_mode1_{split}_features.csv'
        filepath = self.data_dir / 'training_v3' / filename

        logger.info(f"Loading {split} features from {filepath}")
        df = pd.read_csv(filepath, index_col=0, parse_dates=True)
        logger.info(f"Loaded {len(df)} samples for {split}")

        return df

    def prepare_mode1_data(self, df: pd.DataFrame, split: str):
        """
        Prepare Mode 1 (Reversal Detection) training data

        Args:
            df: DataFrame with features
            split: 'train', 'val', or 'test'
        """
        logger.info(f"\n{'='*60}")
        logger.info(f"Preparing Mode 1 data for {split.upper()} split")
        logger.info(f"{'='*60}")

        # Label reversal points
        labeler = ReversalPointLabeler(timeframe=self.timeframe)
        labels = labeler.label_all_reversals(df)

        # Save features (use existing features)
        features_file = self.output_dir / f'EURUSD_reversal_mode1_{split}_features.csv'
        df.to_csv(features_file)
        logger.info(f"✅ Saved features to {features_file}")

        # Save labels
        labels_file = self.output_dir / f'EURUSD_reversal_mode1_{split}_labels.csv'
        labels.to_csv(labels_file, index=False)
        logger.info(f"✅ Saved labels to {labels_file}")

        # Save metadata
        metadata = {
            'pair': 'EURUSD',
            'version': '3.0-reversal',
            'mode': 'reversal_detection',
            'timeframe': self.timeframe,
            'split': split,
            'total_samples': len(df),
            'date_range': {
                'start': str(df.index[0].date()),
                'end': str(df.index[-1].date())
            },
            'labels': {
                'none': int((labels['signal'] == 0).sum()),
                'long': int((labels['signal'] == 1).sum()),
                'short': int((labels['signal'] == 2).sum())
            },
            'class_distribution': {
                'none_pct': float((labels['signal'] == 0).mean() * 100),
                'long_pct': float((labels['signal'] == 1).mean() * 100),
                'short_pct': float((labels['signal'] == 2).mean() * 100)
            },
            'avg_confidence': float(labels[labels['signal'] > 0]['confidence'].mean()),
            'avg_move_pips': float(labels[labels['signal'] > 0]['move_pips'].mean()),
            'features': {
                'count': len(df.columns),
                'columns': list(df.columns)
            },
            'generated_at': datetime.now().isoformat()
        }

        metadata_file = self.output_dir / f'EURUSD_reversal_mode1_{split}_metadata.json'
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        logger.info(f"✅ Saved metadata to {metadata_file}")

        # Print summary
        logger.info(f"\n📊 Mode 1 {split.upper()} Summary:")
        logger.info(f"  Total samples: {metadata['total_samples']}")
        logger.info(f"  Long signals: {metadata['labels']['long']} ({metadata['class_distribution']['long_pct']:.2f}%)")
        logger.info(f"  Short signals: {metadata['labels']['short']} ({metadata['class_distribution']['short_pct']:.2f}%)")
        logger.info(f"  No signal: {metadata['labels']['none']} ({metadata['class_distribution']['none_pct']:.2f}%)")
        logger.info(f"  Avg confidence: {metadata['avg_confidence']:.3f}")
        logger.info(f"  Avg reversal move: {metadata['avg_move_pips']:.1f} pips")

        return labels

    def prepare_mode2_data(self, df: pd.DataFrame, mode1_labels: pd.DataFrame, split: str):
        """
        Prepare Mode 2 (Dynamic Risk Management) training data

        Args:
            df: DataFrame with features
            mode1_labels: Labels from Mode 1
            split: 'train', 'val', or 'test'
        """
        logger.info(f"\n{'='*60}")
        logger.info(f"Preparing Mode 2 data for {split.upper()} split")
        logger.info(f"{'='*60}")

        # Generate monitoring checkpoints
        labeler = DynamicRiskLabeler(timeframe=self.timeframe)
        checkpoints = labeler.label_all_positions(df, mode1_labels)

        if len(checkpoints) == 0:
            logger.warning(f"No checkpoints generated for {split}")
            return

        # Save checkpoints
        checkpoints_file = self.output_dir / f'EURUSD_reversal_mode2_{split}_checkpoints.csv'
        checkpoints.to_csv(checkpoints_file, index=False)
        logger.info(f"✅ Saved checkpoints to {checkpoints_file}")

        # Save metadata
        metadata = {
            'pair': 'EURUSD',
            'version': '3.0-reversal',
            'mode': 'dynamic_risk_management',
            'timeframe': self.timeframe,
            'split': split,
            'total_checkpoints': len(checkpoints),
            'action_distribution': {
                'hold': int((checkpoints['action'] == 'hold').sum()),
                'stop_loss': int((checkpoints['action'] == 'stop_loss').sum()),
                'take_profit': int((checkpoints['action'] == 'take_profit').sum())
            },
            'action_distribution_pct': {
                'hold': float((checkpoints['action'] == 'hold').mean() * 100),
                'stop_loss': float((checkpoints['action'] == 'stop_loss').mean() * 100),
                'take_profit': float((checkpoints['action'] == 'take_profit').mean() * 100)
            },
            'avg_misjudge_probability': float(checkpoints['misjudge_probability'].mean()),
            'avg_reversal_probability': float(checkpoints['reversal_probability'].mean()),
            'avg_bars_held': float(checkpoints['bars_held'].mean()),
            'generated_at': datetime.now().isoformat()
        }

        metadata_file = self.output_dir / f'EURUSD_reversal_mode2_{split}_metadata.json'
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        logger.info(f"✅ Saved metadata to {metadata_file}")

        # Print summary
        logger.info(f"\n📊 Mode 2 {split.upper()} Summary:")
        logger.info(f"  Total checkpoints: {metadata['total_checkpoints']}")
        logger.info(f"  Hold: {metadata['action_distribution']['hold']} ({metadata['action_distribution_pct']['hold']:.1f}%)")
        logger.info(f"  Stop Loss: {metadata['action_distribution']['stop_loss']} ({metadata['action_distribution_pct']['stop_loss']:.1f}%)")
        logger.info(f"  Take Profit: {metadata['action_distribution']['take_profit']} ({metadata['action_distribution_pct']['take_profit']:.1f}%)")
        logger.info(f"  Avg misjudge prob: {metadata['avg_misjudge_probability']:.3f}")
        logger.info(f"  Avg reversal prob: {metadata['avg_reversal_probability']:.3f}")

    def run_pipeline(self):
        """Run complete data preparation pipeline"""
        logger.info("\n" + "="*80)
        logger.info("REVERSAL-BASED TRAINING DATA PREPARATION")
        logger.info("="*80)

        splits = ['train', 'val', 'test']

        for split in splits:
            logger.info(f"\n{'#'*80}")
            logger.info(f"# Processing {split.upper()} split")
            logger.info(f"{'#'*80}")

            # Load features
            df = self.load_features(split)

            # Prepare Mode 1 data
            mode1_labels = self.prepare_mode1_data(df, split)

            # Prepare Mode 2 data
            self.prepare_mode2_data(df, mode1_labels, split)

        # Create summary report
        self.create_summary_report()

        logger.info("\n" + "="*80)
        logger.info("✅ DATA PREPARATION COMPLETE!")
        logger.info("="*80)
        logger.info(f"Output directory: {self.output_dir}")

    def create_summary_report(self):
        """Create overall summary report"""
        logger.info(f"\n{'='*80}")
        logger.info("Creating summary report...")
        logger.info(f"{'='*80}")

        summary = {
            'version': '3.0-reversal',
            'timeframe': self.timeframe,
            'generated_at': datetime.now().isoformat(),
            'splits': {}
        }

        for split in ['train', 'val', 'test']:
            mode1_meta_file = self.output_dir / f'EURUSD_reversal_mode1_{split}_metadata.json'
            mode2_meta_file = self.output_dir / f'EURUSD_reversal_mode2_{split}_metadata.json'

            if mode1_meta_file.exists():
                with open(mode1_meta_file) as f:
                    mode1_meta = json.load(f)

                split_summary = {
                    'mode1': {
                        'samples': mode1_meta['total_samples'],
                        'long_signals': mode1_meta['labels']['long'],
                        'short_signals': mode1_meta['labels']['short'],
                        'total_signals': mode1_meta['labels']['long'] + mode1_meta['labels']['short']
                    }
                }

                if mode2_meta_file.exists():
                    with open(mode2_meta_file) as f:
                        mode2_meta = json.load(f)

                    split_summary['mode2'] = {
                        'checkpoints': mode2_meta['total_checkpoints'],
                        'stop_loss_signals': mode2_meta['action_distribution']['stop_loss'],
                        'take_profit_signals': mode2_meta['action_distribution']['take_profit']
                    }

                summary['splits'][split] = split_summary

        # Calculate totals
        total_signals = sum(s['mode1']['total_signals'] for s in summary['splits'].values())
        total_checkpoints = sum(s['mode2']['checkpoints'] for s in summary['splits'].values() if 'mode2' in s)

        summary['totals'] = {
            'reversal_signals': total_signals,
            'monitoring_checkpoints': total_checkpoints
        }

        # Save summary
        summary_file = self.output_dir / 'REVERSAL_DATA_SUMMARY.json'
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)

        logger.info(f"✅ Summary report saved to {summary_file}")

        # Print final summary
        logger.info(f"\n{'='*80}")
        logger.info("📊 OVERALL SUMMARY")
        logger.info(f"{'='*80}")
        logger.info(f"Total reversal signals: {total_signals}")
        logger.info(f"Total monitoring checkpoints: {total_checkpoints}")
        logger.info(f"\nBy split:")
        for split, data in summary['splits'].items():
            logger.info(f"  {split.upper()}:")
            logger.info(f"    Mode 1: {data['mode1']['total_signals']} signals "
                       f"({data['mode1']['long_signals']}L / {data['mode1']['short_signals']}S)")
            if 'mode2' in data:
                logger.info(f"    Mode 2: {data['mode2']['checkpoints']} checkpoints")


def main():
    """Main entry point"""
    data_dir = Path(__file__).parent.parent / 'data'

    if not data_dir.exists():
        logger.error(f"Data directory not found: {data_dir}")
        return

    # Create pipeline and run
    pipeline = ReversalDataPipeline(data_dir, timeframe='D1')
    pipeline.run_pipeline()


if __name__ == '__main__':
    main()
