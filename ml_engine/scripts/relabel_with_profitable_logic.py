#!/usr/bin/env python3
"""
Relabel Training Data with Profitable Reversal Logic

使用新的基於獲利潛力的標籤邏輯重新標記訓練數據

配置：短線交易
- lookforward: 10天 (2週持倉)
- min_pips: 30 (獲利目標)
- risk_reward: 1.5 (賺1.5虧1)

預期：樣本從68個 → 500-800個

Author: AI-assisted
Created: 2025-10-15
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import pandas as pd
import numpy as np
import logging
import json
from datetime import datetime
from typing import Dict, List, Tuple, Optional

from data_processing.profitable_reversal_labeler import ProfitableReversalLabeler

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RelabelingPipeline:
    """重新標記訓練數據的管道"""

    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir)
        self.input_dir = self.data_dir / 'training_v3'
        self.output_dir = self.data_dir / 'training_v3_profitable'
        self.output_dir.mkdir(exist_ok=True)

        logger.info(f"Input directory: {self.input_dir}")
        logger.info(f"Output directory: {self.output_dir}")

    def load_features(self, split: str) -> pd.DataFrame:
        """加載特徵數據"""
        filename = f'EURUSD_mode1_{split}_features.csv'
        filepath = self.input_dir / filename

        if not filepath.exists():
            logger.error(f"Features file not found: {filepath}")
            return None

        logger.info(f"Loading {split} features from {filepath}")
        df = pd.read_csv(filepath, index_col=0, parse_dates=True)
        logger.info(f"Loaded {len(df)} samples")

        return df

    def relabel_split(self, split: str, labeler: ProfitableReversalLabeler):
        """重新標記某個數據集"""
        logger.info(f"\n{'='*80}")
        logger.info(f"Relabeling {split.upper()} split")
        logger.info(f"{'='*80}")

        # 加載特徵
        features = self.load_features(split)
        if features is None:
            return None

        # 生成新標籤
        labels = labeler.label_all_reversals(features)

        # 保存特徵（複製到新目錄）
        features_file = self.output_dir / f'EURUSD_profitable_{split}_features.csv'
        features.to_csv(features_file)
        logger.info(f"✅ Saved features to {features_file}")

        # 保存標籤
        labels_file = self.output_dir / f'EURUSD_profitable_{split}_labels.csv'
        labels.to_csv(labels_file, index=False)
        logger.info(f"✅ Saved labels to {labels_file}")

        # 生成統計信息
        stats = self.generate_statistics(features, labels, split)

        # 保存元數據
        metadata = {
            'pair': 'EURUSD',
            'version': '3.0-profitable',
            'labeling_method': 'profit_potential',
            'split': split,
            'relabeled_date': datetime.now().isoformat(),
            'total_samples': len(features),
            'date_range': {
                'start': str(features.index[0].date()),
                'end': str(features.index[-1].date())
            },
            'labeler_config': {
                'lookforward_days': labeler.lookforward,
                'min_pips': labeler.min_pips,
                'risk_reward_ratio': labeler.rr_ratio,
                'max_loss_pips': labeler.max_loss
            },
            'statistics': stats
        }

        metadata_file = self.output_dir / f'EURUSD_profitable_{split}_metadata.json'
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        logger.info(f"✅ Saved metadata to {metadata_file}")

        return labels, stats

    def generate_statistics(self, features: pd.DataFrame,
                           labels: pd.DataFrame,
                           split: str) -> Dict:
        """生成標籤統計信息"""
        logger.info(f"\n{'='*80}")
        logger.info(f"Statistics for {split.upper()}")
        logger.info(f"{'='*80}")

        none_count = (labels['signal'] == 0).sum()
        long_count = (labels['signal'] == 1).sum()
        short_count = (labels['signal'] == 2).sum()
        total_signals = long_count + short_count

        stats = {
            'total_samples': len(labels),
            'signal_distribution': {
                'none': int(none_count),
                'none_pct': float(100 * none_count / len(labels)),
                'long': int(long_count),
                'long_pct': float(100 * long_count / len(labels)),
                'short': int(short_count),
                'short_pct': float(100 * short_count / len(labels)),
                'total_signals': int(total_signals),
                'total_signals_pct': float(100 * total_signals / len(labels))
            }
        }

        # Long信號統計
        if long_count > 0:
            long_labels = labels[labels['signal'] == 1]
            stats['long_signals'] = {
                'count': int(long_count),
                'avg_confidence': float(long_labels['confidence'].mean()),
                'avg_expected_profit': float(long_labels['expected_profit'].mean()),
                'avg_expected_loss': float(long_labels['expected_loss'].mean()),
                'avg_risk_reward': float(long_labels['risk_reward'].mean()),
                'min_profit': float(long_labels['expected_profit'].min()),
                'max_profit': float(long_labels['expected_profit'].max()),
                'min_rr': float(long_labels['risk_reward'].min()),
                'max_rr': float(long_labels['risk_reward'].max())
            }

        # Short信號統計
        if short_count > 0:
            short_labels = labels[labels['signal'] == 2]
            stats['short_signals'] = {
                'count': int(short_count),
                'avg_confidence': float(short_labels['confidence'].mean()),
                'avg_expected_profit': float(short_labels['expected_profit'].mean()),
                'avg_expected_loss': float(short_labels['expected_loss'].mean()),
                'avg_risk_reward': float(short_labels['risk_reward'].mean()),
                'min_profit': float(short_labels['expected_profit'].min()),
                'max_profit': float(short_labels['expected_profit'].max()),
                'min_rr': float(short_labels['risk_reward'].min()),
                'max_rr': float(short_labels['risk_reward'].max())
            }

        # 打印統計
        logger.info(f"\nSignal Distribution:")
        logger.info(f"  None:  {none_count:>4} ({stats['signal_distribution']['none_pct']:.2f}%)")
        logger.info(f"  Long:  {long_count:>4} ({stats['signal_distribution']['long_pct']:.2f}%)")
        logger.info(f"  Short: {short_count:>4} ({stats['signal_distribution']['short_pct']:.2f}%)")
        logger.info(f"  Total signals: {total_signals:>4} ({stats['signal_distribution']['total_signals_pct']:.2f}%)")

        if long_count > 0:
            logger.info(f"\nLONG Signal Quality:")
            logger.info(f"  Avg confidence: {stats['long_signals']['avg_confidence']:.3f}")
            logger.info(f"  Avg expected profit: {stats['long_signals']['avg_expected_profit']:.1f} pips")
            logger.info(f"  Avg expected loss: {stats['long_signals']['avg_expected_loss']:.1f} pips")
            logger.info(f"  Avg R:R: {stats['long_signals']['avg_risk_reward']:.2f}")
            logger.info(f"  Profit range: [{stats['long_signals']['min_profit']:.1f}, {stats['long_signals']['max_profit']:.1f}] pips")

        if short_count > 0:
            logger.info(f"\nSHORT Signal Quality:")
            logger.info(f"  Avg confidence: {stats['short_signals']['avg_confidence']:.3f}")
            logger.info(f"  Avg expected profit: {stats['short_signals']['avg_expected_profit']:.1f} pips")
            logger.info(f"  Avg expected loss: {stats['short_signals']['avg_expected_loss']:.1f} pips")
            logger.info(f"  Avg R:R: {stats['short_signals']['avg_risk_reward']:.2f}")
            logger.info(f"  Profit range: [{stats['short_signals']['min_profit']:.1f}, {stats['short_signals']['max_profit']:.1f}] pips")

        return stats

    def compare_with_old_labels(self, split: str):
        """對比新舊標籤"""
        logger.info(f"\n{'='*80}")
        logger.info(f"Comparing Old vs New Labels ({split.upper()})")
        logger.info(f"{'='*80}")

        # 加載舊標籤
        old_labels_file = self.data_dir / 'training_v3_reversal' / f'EURUSD_reversal_mode1_{split}_labels.csv'
        if not old_labels_file.exists():
            logger.warning(f"Old labels file not found: {old_labels_file}")
            return

        old_labels = pd.read_csv(old_labels_file)

        # 加載新標籤
        new_labels_file = self.output_dir / f'EURUSD_profitable_{split}_labels.csv'
        new_labels = pd.read_csv(new_labels_file)

        # 對比統計
        old_signals = (old_labels['signal'] > 0).sum()
        new_signals = (new_labels['signal'] > 0).sum()

        logger.info(f"\nLabel Comparison:")
        logger.info(f"  Old method (Swing Point):")
        logger.info(f"    Total signals: {old_signals}")
        logger.info(f"    Long: {(old_labels['signal'] == 1).sum()}")
        logger.info(f"    Short: {(old_labels['signal'] == 2).sum()}")
        logger.info(f"    Percentage: {100*old_signals/len(old_labels):.2f}%")

        logger.info(f"\n  New method (Profit Potential):")
        logger.info(f"    Total signals: {new_signals}")
        logger.info(f"    Long: {(new_labels['signal'] == 1).sum()}")
        logger.info(f"    Short: {(new_labels['signal'] == 2).sum()}")
        logger.info(f"    Percentage: {100*new_signals/len(new_labels):.2f}%")

        logger.info(f"\n  Improvement:")
        logger.info(f"    Signal increase: {new_signals - old_signals} (+{100*(new_signals/old_signals - 1):.1f}%)")


def main():
    """主執行函數"""
    logger.info("="*80)
    logger.info("RELABELING WITH PROFITABLE REVERSAL LOGIC")
    logger.info("="*80)

    logger.info("\nConfiguration:")
    logger.info("  Trading style: SHORT-TERM")
    logger.info("  Lookforward: 10 days (2 weeks holding)")
    logger.info("  Min profit: 30 pips")
    logger.info("  Risk:Reward: 1:1.5")
    logger.info("  Max loss: 50 pips")

    # 初始化管道
    data_dir = Path(__file__).parent.parent / 'data'
    pipeline = RelabelingPipeline(data_dir)

    # 初始化標籤生成器（短線配置）
    labeler = ProfitableReversalLabeler(
        lookforward_days=10,    # 短線
        min_pips=30,
        risk_reward_ratio=1.5,
        max_loss_pips=50
    )

    # 重新標記所有數據集
    splits = ['train', 'val', 'test']
    all_stats = {}

    for split in splits:
        result = pipeline.relabel_split(split, labeler)
        if result:
            labels, stats = result
            all_stats[split] = stats

            # 對比舊標籤
            pipeline.compare_with_old_labels(split)

    # 保存總體統計
    summary_file = pipeline.output_dir / 'relabeling_summary.json'
    summary = {
        'relabeling_date': datetime.now().isoformat(),
        'method': 'profitable_reversal_detection',
        'config': {
            'lookforward_days': 10,
            'min_pips': 30,
            'risk_reward_ratio': 1.5,
            'max_loss_pips': 50,
            'trading_style': 'short-term'
        },
        'splits': all_stats
    }

    with open(summary_file, 'w') as f:
        json.dump(summary, f, indent=2)

    logger.info(f"\n{'='*80}")
    logger.info("✅ RELABELING COMPLETE!")
    logger.info(f"{'='*80}")
    logger.info(f"\nOutput directory: {pipeline.output_dir}")
    logger.info(f"Summary saved to: {summary_file}")

    # 最終統計
    logger.info(f"\n{'='*80}")
    logger.info("FINAL STATISTICS")
    logger.info(f"{'='*80}")

    for split in splits:
        if split in all_stats:
            stats = all_stats[split]
            total = stats['total_samples']
            signals = stats['signal_distribution']['total_signals']
            pct = stats['signal_distribution']['total_signals_pct']

            logger.info(f"\n{split.upper()}:")
            logger.info(f"  Total samples: {total}")
            logger.info(f"  Reversal signals: {signals} ({pct:.2f}%)")
            logger.info(f"  Long: {stats['signal_distribution']['long']} ({stats['signal_distribution']['long_pct']:.2f}%)")
            logger.info(f"  Short: {stats['signal_distribution']['short']} ({stats['signal_distribution']['short_pct']:.2f}%)")


if __name__ == '__main__':
    main()
