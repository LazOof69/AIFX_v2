#!/usr/bin/env python3
"""
Profitable Reversal Labeling System v2.0

基於實際交易獲利邏輯的反轉檢測，而非完美頂部/底部。

核心思想：
- 不需要精確頂底
- 只要在轉折附近進場能獲利 ≥ min_pips
- 風險回報比合理 (R:R > 1.5)
- 基於實戰可交易性

預期：大幅增加訓練樣本 (68 → 500+)

Author: AI-assisted
Created: 2025-10-15
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class ProfitableReversalLabeler:
    """
    基於獲利潛力的反轉點標籤生成器

    與舊版ReversalPointLabeler的區別：
    - 舊版: 尋找Swing High/Low (前後20天極值) + 驗證反轉100+ pips
    - 新版: 對每個點計算做多/做空的獲利潛力，滿足條件即標記

    優勢：
    - 更多訓練樣本 (5-10倍)
    - 更符合實戰交易邏輯
    - 不需要完美時機
    """

    def __init__(self,
                 lookforward_days: int = 10,
                 min_pips: float = 30.0,
                 risk_reward_ratio: float = 1.5,
                 max_loss_pips: float = 50.0):
        """
        初始化標籤生成器

        Args:
            lookforward_days: 持倉週期 (天)
                短線: 10天 (2週)
                中線: 20天 (4週)
                長線: 30天 (6週)
            min_pips: 最小獲利目標 (pips)
                保守: 50, 中等: 30, 激進: 20
            risk_reward_ratio: 最小風險回報比
                保守: 2.0, 中等: 1.5, 激進: 1.0
            max_loss_pips: 最大可接受虧損 (pips)
                用於過濾極端風險的機會
        """
        self.lookforward = lookforward_days
        self.min_pips = min_pips
        self.rr_ratio = risk_reward_ratio
        self.max_loss = max_loss_pips

        logger.info(f"Initialized ProfitableReversalLabeler")
        logger.info(f"  Lookforward: {lookforward_days} days ({lookforward_days*24//24} days)")
        logger.info(f"  Min profit: {min_pips} pips")
        logger.info(f"  Risk:Reward: 1:{risk_reward_ratio}")
        logger.info(f"  Max loss: {max_loss_pips} pips")

    def calculate_profit_potential(self,
                                   df: pd.DataFrame,
                                   index: int) -> Dict:
        """
        計算某個時間點做多/做空的獲利潛力

        Args:
            df: DataFrame with OHLC data
            index: 當前時間點索引

        Returns:
            dict: {
                'long_profit': 做多最大獲利 (pips),
                'long_loss': 做多最大虧損 (pips),
                'long_rr': 做多風險回報比,
                'short_profit': 做空最大獲利 (pips),
                'short_loss': 做空最大虧損 (pips),
                'short_rr': 做空風險回報比,
                'entry_price': 進場價格
            }
        """
        # 檢查是否有足夠的未來數據
        if index + self.lookforward >= len(df):
            return None

        # 進場價格（使用收盤價，實戰中更接近實際執行價）
        entry_price = df.iloc[index]['close']

        # 獲取未來數據窗口
        future_window = df.iloc[index+1:index+self.lookforward+1]

        if len(future_window) < self.lookforward:
            return None

        # 做多分析
        future_high = future_window['high'].max()
        future_low = future_window['low'].min()

        long_profit_pips = (future_high - entry_price) * 10000
        long_loss_pips = (entry_price - future_low) * 10000

        # 做空分析
        short_profit_pips = (entry_price - future_low) * 10000
        short_loss_pips = (future_high - entry_price) * 10000

        # 計算風險回報比（避免除以0）
        long_rr = long_profit_pips / max(long_loss_pips, 5.0) if long_loss_pips > 0 else 999
        short_rr = short_profit_pips / max(short_loss_pips, 5.0) if short_loss_pips > 0 else 999

        return {
            'long_profit': long_profit_pips,
            'long_loss': long_loss_pips,
            'long_rr': long_rr,
            'short_profit': short_profit_pips,
            'short_loss': short_loss_pips,
            'short_rr': short_rr,
            'entry_price': entry_price
        }

    def is_valid_long_signal(self, potential: Dict) -> bool:
        """
        判斷是否為有效的做多信號

        條件：
        1. 獲利潛力 >= min_pips
        2. 風險回報比 > risk_reward_ratio
        3. 最大虧損 <= max_loss_pips (風險可控)

        Args:
            potential: calculate_profit_potential() 返回值

        Returns:
            bool: 是否為有效做多信號
        """
        if potential is None:
            return False

        return (potential['long_profit'] >= self.min_pips and
                potential['long_rr'] >= self.rr_ratio and
                potential['long_loss'] <= self.max_loss)

    def is_valid_short_signal(self, potential: Dict) -> bool:
        """
        判斷是否為有效的做空信號

        條件：同做多，但方向相反

        Args:
            potential: calculate_profit_potential() 返回值

        Returns:
            bool: 是否為有效做空信號
        """
        if potential is None:
            return False

        return (potential['short_profit'] >= self.min_pips and
                potential['short_rr'] >= self.rr_ratio and
                potential['short_loss'] <= self.max_loss)

    def calculate_signal_confidence(self,
                                    df: pd.DataFrame,
                                    index: int,
                                    potential: Dict,
                                    signal_type: str) -> float:
        """
        計算信號置信度

        基於：
        1. 獲利幅度（越大越好）
        2. 風險回報比（越高越好）
        3. 技術指標確認（RSI, MACD, ADX等）

        Args:
            df: DataFrame with OHLC and indicators
            index: 當前索引
            potential: 獲利潛力字典
            signal_type: 'long' 或 'short'

        Returns:
            float: 置信度 (0.0-1.0)
        """
        row = df.iloc[index]
        confidence = 0.5  # 基礎置信度

        # Factor 1: 獲利幅度 (0-0.25)
        if signal_type == 'long':
            profit = potential['long_profit']
            rr = potential['long_rr']
        else:
            profit = potential['short_profit']
            rr = potential['short_rr']

        # 獲利超過最小要求越多，置信度越高
        profit_bonus = min(0.15, (profit - self.min_pips) / 200)
        confidence += profit_bonus

        # Factor 2: 風險回報比 (0-0.15)
        rr_bonus = min(0.15, (rr - self.rr_ratio) / 10)
        confidence += rr_bonus

        # Factor 3: RSI位置 (0-0.1)
        if not pd.isna(row.get('rsi_14')):
            rsi = row['rsi_14']
            if signal_type == 'long' and rsi < 35:  # 超賣
                confidence += 0.1
            elif signal_type == 'long' and rsi < 45:
                confidence += 0.05
            elif signal_type == 'short' and rsi > 65:  # 超買
                confidence += 0.1
            elif signal_type == 'short' and rsi > 55:
                confidence += 0.05

        # Factor 4: MACD動能 (0-0.1)
        if not pd.isna(row.get('macd')) and not pd.isna(row.get('macd_signal')):
            macd_diff = row['macd'] - row['macd_signal']

            if signal_type == 'long' and macd_diff > 0:  # MACD金叉
                confidence += min(0.1, abs(macd_diff) * 100)
            elif signal_type == 'short' and macd_diff < 0:  # MACD死叉
                confidence += min(0.1, abs(macd_diff) * 100)

        # Factor 5: ADX趨勢強度 (0-0.1)
        if not pd.isna(row.get('adx_14')):
            adx = row['adx_14']
            if adx > 25:  # 強勢趨勢
                confidence += 0.1
            elif adx > 20:
                confidence += 0.05

        return min(1.0, confidence)

    def label_all_reversals(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        掃描整個DataFrame，標記所有可獲利的交易機會

        Args:
            df: DataFrame with OHLC and technical indicators

        Returns:
            pd.DataFrame: 標籤數據，包含：
                - signal: 0 (none), 1 (long), 2 (short)
                - confidence: 0.0-1.0
                - entry_price: 進場價格
                - expected_profit: 預期獲利 (pips)
                - expected_loss: 預期虧損 (pips)
                - risk_reward: 風險回報比
                - timeframe: 時間框架
        """
        logger.info(f"Labeling profitable reversals for {len(df)} candles")
        logger.info(f"Scanning with {self.lookforward}-day lookforward window...")

        labels = []
        long_count = 0
        short_count = 0
        conflict_count = 0  # 同時滿足做多和做空條件的點

        for i in range(len(df) - self.lookforward):
            # 計算獲利潛力
            potential = self.calculate_profit_potential(df, i)

            if potential is None:
                # 數據不足，標記為無信號
                labels.append({
                    'signal': 0,
                    'confidence': 0.0,
                    'entry_price': df.iloc[i]['close'],
                    'expected_profit': 0.0,
                    'expected_loss': 0.0,
                    'risk_reward': 0.0,
                    'timeframe': f'{self.lookforward}D'
                })
                continue

            # 判斷信號
            is_long = self.is_valid_long_signal(potential)
            is_short = self.is_valid_short_signal(potential)

            if is_long and is_short:
                # 衝突：兩個方向都可以獲利
                # 選擇風險回報比更高的
                conflict_count += 1
                if potential['long_rr'] >= potential['short_rr']:
                    is_short = False
                else:
                    is_long = False

            if is_long:
                long_count += 1
                signal = 1
                confidence = self.calculate_signal_confidence(df, i, potential, 'long')
                expected_profit = potential['long_profit']
                expected_loss = potential['long_loss']
                risk_reward = potential['long_rr']

            elif is_short:
                short_count += 1
                signal = 2
                confidence = self.calculate_signal_confidence(df, i, potential, 'short')
                expected_profit = potential['short_profit']
                expected_loss = potential['short_loss']
                risk_reward = potential['short_rr']

            else:
                # 無信號：不滿足獲利或風險條件
                signal = 0
                confidence = 0.0
                expected_profit = 0.0
                expected_loss = 0.0
                risk_reward = 0.0

            labels.append({
                'signal': signal,
                'confidence': confidence,
                'entry_price': potential['entry_price'],
                'expected_profit': expected_profit,
                'expected_loss': expected_loss,
                'risk_reward': risk_reward,
                'timeframe': f'{self.lookforward}D'
            })

        # 補齊最後lookforward個樣本（無法計算獲利潛力）
        for i in range(len(df) - self.lookforward, len(df)):
            labels.append({
                'signal': 0,
                'confidence': 0.0,
                'entry_price': df.iloc[i]['close'],
                'expected_profit': 0.0,
                'expected_loss': 0.0,
                'risk_reward': 0.0,
                'timeframe': f'{self.lookforward}D'
            })

        logger.info(f"\nLabeling complete:")
        logger.info(f"  Total candles: {len(labels)}")
        logger.info(f"  LONG signals: {long_count} ({100*long_count/len(labels):.2f}%)")
        logger.info(f"  SHORT signals: {short_count} ({100*short_count/len(labels):.2f}%)")
        logger.info(f"  Total reversal signals: {long_count + short_count} ({100*(long_count+short_count)/len(labels):.2f}%)")
        logger.info(f"  NO SIGNAL: {len(labels) - long_count - short_count} ({100*(len(labels)-long_count-short_count)/len(labels):.2f}%)")
        logger.info(f"  Conflicts resolved: {conflict_count}")

        return pd.DataFrame(labels)


def main():
    """測試新標籤生成器"""
    import sys
    sys.path.append(str(Path(__file__).parent.parent))

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # 加載測試數據
    data_dir = Path(__file__).parent.parent / 'data' / 'training_v3'
    features_file = data_dir / 'EURUSD_mode1_train_features.csv'

    if not features_file.exists():
        logger.error(f"Test data not found: {features_file}")
        return

    logger.info(f"Loading test data from {features_file}")
    df = pd.read_csv(features_file, index_col=0, parse_dates=True)

    # 測試新標籤生成器
    logger.info("\n" + "="*80)
    logger.info("Testing ProfitableReversalLabeler")
    logger.info("="*80)

    labeler = ProfitableReversalLabeler(
        lookforward_days=10,    # 短線
        min_pips=30,
        risk_reward_ratio=1.5,
        max_loss_pips=50
    )

    labels = labeler.label_all_reversals(df)

    # 統計分析
    logger.info(f"\n" + "="*80)
    logger.info("Label Statistics")
    logger.info("="*80)

    long_labels = labels[labels['signal'] == 1]
    short_labels = labels[labels['signal'] == 2]

    if len(long_labels) > 0:
        logger.info(f"\nLONG signals ({len(long_labels)}):")
        logger.info(f"  Avg confidence: {long_labels['confidence'].mean():.3f}")
        logger.info(f"  Avg expected profit: {long_labels['expected_profit'].mean():.1f} pips")
        logger.info(f"  Avg expected loss: {long_labels['expected_loss'].mean():.1f} pips")
        logger.info(f"  Avg R:R: {long_labels['risk_reward'].mean():.2f}")

    if len(short_labels) > 0:
        logger.info(f"\nSHORT signals ({len(short_labels)}):")
        logger.info(f"  Avg confidence: {short_labels['confidence'].mean():.3f}")
        logger.info(f"  Avg expected profit: {short_labels['expected_profit'].mean():.1f} pips")
        logger.info(f"  Avg expected loss: {short_labels['expected_loss'].mean():.1f} pips")
        logger.info(f"  Avg R:R: {short_labels['risk_reward'].mean():.2f}")

    # 保存測試結果
    output_file = Path(__file__).parent.parent / 'data' / 'test_profitable_labels.csv'
    labels.to_csv(output_file, index=False)
    logger.info(f"\n✅ Test labels saved to: {output_file}")


if __name__ == '__main__':
    main()
