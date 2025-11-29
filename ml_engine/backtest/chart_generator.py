#!/usr/bin/env python3
"""
Chart Generator for Backtest Results
Generates visualizations for backtest performance
"""

import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np
from datetime import datetime
import os

sns.set_style('whitegrid')
plt.rcParams['figure.figsize'] = (12, 8)
plt.rcParams['font.size'] = 10

class ChartGenerator:
    """Generate charts for backtest results"""

    def __init__(self, output_dir: str = '/tmp/backtest_charts'):
        """
        Initialize chart generator

        Args:
            output_dir: Directory to save charts
        """
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate_all_charts(self, metrics_list: list, trades_df: pd.DataFrame, pair: str = 'All'):
        """
        Generate all charts for backtest results

        Args:
            metrics_list: List of metrics dictionaries
            trades_df: DataFrame with all trades
            pair: Currency pair name (for filename)

        Returns:
            List of generated chart file paths
        """
        chart_files = []

        # 1. Win Rate by Period Chart
        chart_files.append(self.plot_win_rate_by_period(metrics_list, pair))

        # 2. Profit Factor by Pair Chart
        chart_files.append(self.plot_profit_factor_by_pair(metrics_list))

        # 3. Equity Curve Chart
        if not trades_df.empty:
            chart_files.append(self.plot_equity_curve(trades_df, pair))

        # 4. Trade Distribution Chart
        if not trades_df.empty:
            chart_files.append(self.plot_trade_distribution(trades_df, pair))

        # 5. Performance Heatmap
        chart_files.append(self.plot_performance_heatmap(metrics_list))

        # 6. Drawdown Chart
        if not trades_df.empty:
            chart_files.append(self.plot_drawdown(trades_df, pair))

        print(f"✅ Generated {len(chart_files)} charts in {self.output_dir}")
        return chart_files

    def plot_win_rate_by_period(self, metrics_list: list, pair: str) -> str:
        """Plot win rate by trading period"""
        df = pd.DataFrame(metrics_list)

        fig, ax = plt.subplots(figsize=(12, 6))

        periods = df['period'].unique()
        win_rates = []
        period_labels = []

        period_names = {
            'intraday': '日內 (15min)',
            'swing': '周內 (1h)',
            'position': '月內 (1d)',
            'longterm': '季內 (1w)'
        }

        for period in ['intraday', 'swing', 'position', 'longterm']:
            period_data = df[df['period'] == period]
            if not period_data.empty:
                win_rate = period_data['win_rate'].mean()
                win_rates.append(win_rate)
                period_labels.append(period_names.get(period, period))

        colors = ['#2ecc71' if wr >= 50 else '#e74c3c' for wr in win_rates]
        bars = ax.bar(period_labels, win_rates, color=colors, alpha=0.7, edgecolor='black')

        # Add value labels on bars
        for bar, wr in zip(bars, win_rates):
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{wr:.1f}%',
                   ha='center', va='bottom', fontweight='bold')

        # Add 50% reference line
        ax.axhline(y=50, color='gray', linestyle='--', alpha=0.5, label='50% Baseline')

        ax.set_ylabel('Win Rate (%)', fontsize=12, fontweight='bold')
        ax.set_title(f'勝率 by Trading Period - {pair}', fontsize=14, fontweight='bold')
        ax.set_ylim(0, max(win_rates) * 1.2 if win_rates else 100)
        ax.legend()
        ax.grid(axis='y', alpha=0.3)

        filename = os.path.join(self.output_dir, f'win_rate_by_period_{pair}.png')
        plt.tight_layout()
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        plt.close()

        print(f"  📊 Generated: {filename}")
        return filename

    def plot_profit_factor_by_pair(self, metrics_list: list) -> str:
        """Plot profit factor by currency pair"""
        df = pd.DataFrame(metrics_list)

        fig, ax = plt.subplots(figsize=(12, 6))

        pairs = df.groupby('pair')['profit_factor'].mean().sort_values(ascending=False)

        colors = ['#2ecc71' if pf >= 1 else '#e74c3c' for pf in pairs.values]
        bars = ax.barh(pairs.index, pairs.values, color=colors, alpha=0.7, edgecolor='black')

        # Add value labels
        for bar, pf in zip(bars, pairs.values):
            width = bar.get_width()
            label_x = width if width > 0 else 0
            ax.text(label_x, bar.get_y() + bar.get_height()/2.,
                   f' {pf:.2f}',
                   va='center', ha='left' if width > 0 else 'right',
                   fontweight='bold')

        ax.axvline(x=1.0, color='gray', linestyle='--', alpha=0.5, label='Breakeven (1.0)')

        ax.set_xlabel('Profit Factor', fontsize=12, fontweight='bold')
        ax.set_title('盈虧比 (Profit Factor) by Currency Pair', fontsize=14, fontweight='bold')
        ax.legend()
        ax.grid(axis='x', alpha=0.3)

        filename = os.path.join(self.output_dir, 'profit_factor_by_pair.png')
        plt.tight_layout()
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        plt.close()

        print(f"  📊 Generated: {filename}")
        return filename

    def plot_equity_curve(self, trades_df: pd.DataFrame, pair: str) -> str:
        """Plot equity curve over time"""
        fig, ax = plt.subplots(figsize=(14, 7))

        trades_df = trades_df.sort_values('exit_time')
        equity = trades_df['balance_after'].values
        times = pd.to_datetime(trades_df['exit_time'])

        ax.plot(times, equity, linewidth=2, color='#3498db', label='Equity')
        ax.fill_between(times, equity, alpha=0.3, color='#3498db')

        # Add initial balance line
        initial_balance = trades_df['balance_before'].iloc[0]
        ax.axhline(y=initial_balance, color='gray', linestyle='--', alpha=0.5, label=f'Initial: ${initial_balance:,.0f}')

        # Highlight wins/losses
        wins = trades_df[trades_df['profit_loss'] > 0]
        losses = trades_df[trades_df['profit_loss'] < 0]

        if not wins.empty:
            ax.scatter(pd.to_datetime(wins['exit_time']), wins['balance_after'],
                      color='#2ecc71', s=50, alpha=0.6, marker='^', label='Win')
        if not losses.empty:
            ax.scatter(pd.to_datetime(losses['exit_time']), losses['balance_after'],
                      color='#e74c3c', s=50, alpha=0.6, marker='v', label='Loss')

        ax.set_xlabel('Date', fontsize=12, fontweight='bold')
        ax.set_ylabel('Account Balance ($)', fontsize=12, fontweight='bold')
        ax.set_title(f'權益曲線 (Equity Curve) - {pair}', fontsize=14, fontweight='bold')
        ax.legend(loc='best')
        ax.grid(True, alpha=0.3)

        # Format y-axis as currency
        ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x:,.0f}'))

        filename = os.path.join(self.output_dir, f'equity_curve_{pair}.png')
        plt.tight_layout()
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        plt.close()

        print(f"  📊 Generated: {filename}")
        return filename

    def plot_trade_distribution(self, trades_df: pd.DataFrame, pair: str) -> str:
        """Plot profit/loss distribution"""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

        # P&L distribution histogram
        profits = trades_df['profit_loss'].values

        ax1.hist(profits, bins=30, color='#3498db', alpha=0.7, edgecolor='black')
        ax1.axvline(x=0, color='red', linestyle='--', linewidth=2, label='Breakeven')
        ax1.axvline(x=np.mean(profits), color='green', linestyle='--', linewidth=2, label=f'Mean: ${np.mean(profits):.2f}')

        ax1.set_xlabel('Profit/Loss ($)', fontsize=12, fontweight='bold')
        ax1.set_ylabel('Frequency', fontsize=12, fontweight='bold')
        ax1.set_title('交易盈虧分布 (P&L Distribution)', fontsize=12, fontweight='bold')
        ax1.legend()
        ax1.grid(True, alpha=0.3)

        # Win/Loss pie chart
        wins = len(trades_df[trades_df['profit_loss'] > 0])
        losses = len(trades_df[trades_df['profit_loss'] < 0])

        labels = ['Wins', 'Losses']
        sizes = [wins, losses]
        colors = ['#2ecc71', '#e74c3c']
        explode = (0.05, 0)

        ax2.pie(sizes, explode=explode, labels=labels, colors=colors,
               autopct='%1.1f%%', shadow=True, startangle=90,
               textprops={'fontsize': 12, 'fontweight': 'bold'})
        ax2.set_title(f'勝率統計\nTotal: {wins + losses} trades', fontsize=12, fontweight='bold')

        filename = os.path.join(self.output_dir, f'trade_distribution_{pair}.png')
        plt.tight_layout()
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        plt.close()

        print(f"  📊 Generated: {filename}")
        return filename

    def plot_performance_heatmap(self, metrics_list: list) -> str:
        """Plot performance heatmap (pair vs period)"""
        df = pd.DataFrame(metrics_list)

        # Create pivot table
        pivot = df.pivot_table(
            values='win_rate',
            index='pair',
            columns='period',
            aggfunc='mean'
        )

        # Reorder columns
        column_order = ['intraday', 'swing', 'position', 'longterm']
        pivot = pivot[[col for col in column_order if col in pivot.columns]]

        # Rename columns
        pivot.columns = ['日內', '周內', '月內', '季內']

        fig, ax = plt.subplots(figsize=(10, 6))

        sns.heatmap(pivot, annot=True, fmt='.1f', cmap='RdYlGn', center=50,
                   cbar_kws={'label': 'Win Rate (%)'}, linewidths=1, linecolor='black',
                   ax=ax, vmin=0, vmax=100)

        ax.set_title('勝率熱圖 (Win Rate Heatmap) - Pair vs Period', fontsize=14, fontweight='bold')
        ax.set_xlabel('Trading Period', fontsize=12, fontweight='bold')
        ax.set_ylabel('Currency Pair', fontsize=12, fontweight='bold')

        filename = os.path.join(self.output_dir, 'performance_heatmap.png')
        plt.tight_layout()
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        plt.close()

        print(f"  📊 Generated: {filename}")
        return filename

    def plot_drawdown(self, trades_df: pd.DataFrame, pair: str) -> str:
        """Plot drawdown chart"""
        fig, ax = plt.subplots(figsize=(14, 6))

        trades_df = trades_df.sort_values('exit_time')
        balance = trades_df['balance_after'].values
        times = pd.to_datetime(trades_df['exit_time'])

        # Calculate drawdown
        peak = np.maximum.accumulate(balance)
        drawdown = balance - peak
        drawdown_pct = (drawdown / peak) * 100

        ax.fill_between(times, 0, drawdown_pct, color='#e74c3c', alpha=0.5, label='Drawdown')
        ax.plot(times, drawdown_pct, color='#c0392b', linewidth=2)

        # Highlight max drawdown
        max_dd_idx = np.argmin(drawdown_pct)
        max_dd_value = drawdown_pct[max_dd_idx]
        max_dd_time = times.iloc[max_dd_idx]

        ax.scatter([max_dd_time], [max_dd_value], color='red', s=200, marker='v',
                  label=f'Max DD: {max_dd_value:.2f}%', zorder=5, edgecolor='black', linewidth=2)

        ax.set_xlabel('Date', fontsize=12, fontweight='bold')
        ax.set_ylabel('Drawdown (%)', fontsize=12, fontweight='bold')
        ax.set_title(f'最大回撤 (Maximum Drawdown) - {pair}', fontsize=14, fontweight='bold')
        ax.legend(loc='lower left')
        ax.grid(True, alpha=0.3)
        ax.set_ylim(min(drawdown_pct) * 1.2, 5)

        filename = os.path.join(self.output_dir, f'drawdown_{pair}.png')
        plt.tight_layout()
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        plt.close()

        print(f"  📊 Generated: {filename}")
        return filename

if __name__ == '__main__':
    print("Chart Generator for Backtest Results")
    print("Use run_backtest.py to generate charts")
