#!/usr/bin/env python3
"""
Backtest Engine
Backtests trading signals using signal reversal exit strategy
"""

import os
import sys
import psycopg2
import psycopg2.extras
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt

# Database connection
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'aifx_v2_dev',
    'user': 'postgres',
    'password': 'postgres'
}

class BacktestEngine:
    """
    Backtest Engine with Signal Reversal Exit Strategy
    """

    def __init__(self, pair: str, timeframe: str, period: str):
        """
        Initialize backtest engine

        Args:
            pair: Currency pair (e.g., "EUR/USD")
            timeframe: Timeframe (e.g., "1h")
            period: Period name (e.g., "swing")
        """
        self.pair = pair
        self.timeframe = timeframe
        self.period = period
        self.conn = None

        # Backtest parameters
        self.initial_balance = 10000.0
        self.risk_per_trade = 0.02  # 2% risk per trade
        self.position_size = 1.0  # 1 standard lot

        # Results storage
        self.trades = []
        self.equity_curve = []
        self.current_balance = self.initial_balance

    def connect_db(self):
        """Connect to PostgreSQL database"""
        try:
            self.conn = psycopg2.connect(**DB_CONFIG)
            print(f"✅ Connected to database: {DB_CONFIG['database']}")
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            sys.exit(1)

    def disconnect_db(self):
        """Disconnect from database"""
        if self.conn:
            self.conn.close()
            print("✅ Disconnected from database")

    def load_signals(self) -> pd.DataFrame:
        """
        Load trading signals from database

        Returns:
            DataFrame with signals
        """
        query = """
        SELECT
            id,
            pair,
            timeframe,
            timestamp,
            signal,
            confidence,
            ml_prediction,
            technical_score,
            created_at
        FROM trading_signals
        WHERE pair = %s
          AND timeframe = %s
        ORDER BY timestamp ASC
        """

        df = pd.read_sql_query(query, self.conn, params=(self.pair, self.timeframe))
        print(f"📊 Loaded {len(df)} signals for {self.pair} ({self.timeframe})")
        return df

    def load_market_data(self, start_date: datetime, end_date: datetime) -> pd.DataFrame:
        """
        Load market data from database

        Args:
            start_date: Start date
            end_date: End date

        Returns:
            DataFrame with market data
        """
        query = """
        SELECT
            pair,
            timeframe,
            timestamp,
            open,
            high,
            low,
            close,
            volume
        FROM market_data
        WHERE pair = %s
          AND timeframe = %s
          AND timestamp >= %s
          AND timestamp <= %s
        ORDER BY timestamp ASC
        """

        df = pd.read_sql_query(
            query,
            self.conn,
            params=(self.pair, self.timeframe, start_date, end_date)
        )
        print(f"📊 Loaded {len(df)} market data candles")
        return df

    def calculate_pip_value(self, pair: str) -> float:
        """Calculate pip value for currency pair"""
        # Simplified: 1 pip = 0.0001 for most pairs, 0.01 for JPY pairs
        if 'JPY' in pair:
            return 0.01
        return 0.0001

    def run_backtest(self) -> Dict:
        """
        Run backtest with signal reversal exit strategy

        Returns:
            Dictionary with backtest results
        """
        print(f"\n🔄 Running backtest for {self.pair} {self.period} ({self.timeframe})")
        print("=" * 60)

        # Load signals
        signals_df = self.load_signals()

        if signals_df.empty:
            print("❌ No signals found for backtest")
            return None

        # Get date range
        start_date = signals_df['timestamp'].min()
        end_date = signals_df['timestamp'].max()

        # Load market data
        market_df = self.load_market_data(start_date, end_date)

        if market_df.empty:
            print("❌ No market data found for backtest")
            return None

        # Merge signals with market data
        df = pd.merge_asof(
            signals_df.sort_values('timestamp'),
            market_df.sort_values('timestamp'),
            on='timestamp',
            direction='backward',
            suffixes=('_signal', '_market')
        )

        # Run simulation
        current_position = None
        current_entry_price = None
        current_entry_time = None
        current_signal_id = None

        pip_value = self.calculate_pip_value(self.pair)

        for idx, row in df.iterrows():
            signal = row['signal']
            timestamp = row['timestamp']
            close_price = row['close']

            # Entry logic
            if current_position is None:
                if signal in ['long', 'short']:
                    # Open position
                    current_position = signal
                    current_entry_price = close_price
                    current_entry_time = timestamp
                    current_signal_id = row['id']

                    print(f"  📈 ENTER {signal.upper()}: {close_price} @ {timestamp}")

            # Exit logic: Signal reversal or change
            else:
                should_exit = False
                exit_reason = None

                # Exit on signal change/reversal
                if signal == 'standby':
                    should_exit = True
                    exit_reason = 'signal_to_standby'
                elif (current_position == 'long' and signal == 'short'):
                    should_exit = True
                    exit_reason = 'signal_reversal_long_to_short'
                elif (current_position == 'short' and signal == 'long'):
                    should_exit = True
                    exit_reason = 'signal_reversal_short_to_long'

                if should_exit:
                    # Calculate P&L
                    if current_position == 'long':
                        pips = (close_price - current_entry_price) / pip_value
                    else:  # short
                        pips = (current_entry_price - close_price) / pip_value

                    # Simplified P&L calculation (1 lot = $10/pip for most pairs)
                    pnl = pips * 10 * self.position_size
                    pnl_pct = (pnl / self.current_balance) * 100

                    # Update balance
                    balance_before = self.current_balance
                    self.current_balance += pnl

                    # Duration
                    duration = (timestamp - current_entry_time).total_seconds() / 3600

                    # Record trade
                    trade = {
                        'entry_signal_id': current_signal_id,
                        'exit_signal_id': row['id'],
                        'entry_time': current_entry_time,
                        'exit_time': timestamp,
                        'duration_hours': duration,
                        'direction': current_position,
                        'entry_price': current_entry_price,
                        'exit_price': close_price,
                        'position_size': self.position_size,
                        'exit_reason': exit_reason,
                        'exit_signal': signal,
                        'profit_loss': pnl,
                        'profit_loss_pct': pnl_pct,
                        'profit_loss_pips': pips,
                        'balance_before': balance_before,
                        'balance_after': self.current_balance
                    }

                    self.trades.append(trade)
                    self.equity_curve.append({
                        'timestamp': timestamp,
                        'balance': self.current_balance
                    })

                    status = "✅ WIN" if pnl > 0 else "❌ LOSS"
                    print(f"  📉 EXIT {current_position.upper()}: {close_price} @ {timestamp}")
                    print(f"    {status} {pnl:.2f} ({pnl_pct:.2f}%) | {pips:.1f} pips | Balance: ${self.current_balance:.2f}")

                    # Reset position
                    current_position = None
                    current_entry_price = None
                    current_entry_time = None
                    current_signal_id = None

                    # Open new position if signal indicates
                    if signal in ['long', 'short']:
                        current_position = signal
                        current_entry_price = close_price
                        current_entry_time = timestamp
                        current_signal_id = row['id']
                        print(f"  📈 ENTER {signal.upper()}: {close_price} @ {timestamp}")

        # Close any remaining open position
        if current_position is not None:
            print(f"  ⚠️  Closing remaining {current_position.upper()} position at end of data")
            # Use last available price
            last_row = df.iloc[-1]
            close_price = last_row['close']
            timestamp = last_row['timestamp']

            if current_position == 'long':
                pips = (close_price - current_entry_price) / pip_value
            else:
                pips = (current_entry_price - close_price) / pip_value

            pnl = pips * 10 * self.position_size
            pnl_pct = (pnl / self.current_balance) * 100
            balance_before = self.current_balance
            self.current_balance += pnl

            trade = {
                'entry_signal_id': current_signal_id,
                'exit_signal_id': None,
                'entry_time': current_entry_time,
                'exit_time': timestamp,
                'duration_hours': (timestamp - current_entry_time).total_seconds() / 3600,
                'direction': current_position,
                'entry_price': current_entry_price,
                'exit_price': close_price,
                'position_size': self.position_size,
                'exit_reason': 'end_of_data',
                'exit_signal': None,
                'profit_loss': pnl,
                'profit_loss_pct': pnl_pct,
                'profit_loss_pips': pips,
                'balance_before': balance_before,
                'balance_after': self.current_balance
            }

            self.trades.append(trade)

        print("=" * 60)
        print(f"✅ Backtest completed: {len(self.trades)} trades")

        # Calculate metrics
        metrics = self.calculate_metrics(start_date, end_date)

        return metrics

    def calculate_metrics(self, start_date: datetime, end_date: datetime) -> Dict:
        """
        Calculate 8 performance metrics

        Returns:
            Dictionary with all metrics
        """
        if not self.trades:
            print("❌ No trades to calculate metrics")
            return None

        trades_df = pd.DataFrame(self.trades)

        # Basic metrics
        total_trades = len(trades_df)
        winning_trades = len(trades_df[trades_df['profit_loss'] > 0])
        losing_trades = len(trades_df[trades_df['profit_loss'] < 0])
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0

        # Profit metrics
        total_profit = trades_df[trades_df['profit_loss'] > 0]['profit_loss'].sum()
        total_loss = abs(trades_df[trades_df['profit_loss'] < 0]['profit_loss'].sum())
        net_profit = self.current_balance - self.initial_balance
        net_profit_pct = (net_profit / self.initial_balance) * 100

        avg_profit = trades_df[trades_df['profit_loss'] > 0]['profit_loss'].mean() if winning_trades > 0 else 0
        avg_loss = abs(trades_df[trades_df['profit_loss'] < 0]['profit_loss'].mean()) if losing_trades > 0 else 0
        profit_factor = (total_profit / total_loss) if total_loss > 0 else float('inf')

        # Drawdown
        equity_df = pd.DataFrame(self.equity_curve)
        if not equity_df.empty:
            equity_df['peak'] = equity_df['balance'].cummax()
            equity_df['drawdown'] = equity_df['balance'] - equity_df['peak']
            max_drawdown = equity_df['drawdown'].min()
            max_drawdown_pct = (max_drawdown / equity_df['peak'].max()) * 100 if equity_df['peak'].max() > 0 else 0
        else:
            max_drawdown = 0
            max_drawdown_pct = 0

        # Sharpe ratio (simplified: using trade returns)
        returns = trades_df['profit_loss_pct'].values
        if len(returns) > 1:
            avg_return = returns.mean()
            std_return = returns.std()
            sharpe_ratio = (avg_return / std_return * np.sqrt(252)) if std_return > 0 else 0
        else:
            sharpe_ratio = 0

        metrics = {
            'pair': self.pair,
            'period': self.period,
            'timeframe': self.timeframe,
            'start_date': start_date,
            'end_date': end_date,
            'initial_balance': self.initial_balance,
            'final_balance': self.current_balance,
            'risk_per_trade': self.risk_per_trade * 100,

            # 8 Key Metrics
            'total_trades': total_trades,
            'winning_trades': winning_trades,
            'losing_trades': losing_trades,
            'win_rate': round(win_rate, 2),

            'total_profit': round(total_profit, 2),
            'total_loss': round(total_loss, 2),
            'net_profit': round(net_profit, 2),
            'net_profit_pct': round(net_profit_pct, 4),

            'avg_profit': round(avg_profit, 2),
            'avg_loss': round(avg_loss, 2),
            'profit_factor': round(profit_factor, 2),

            'max_drawdown': round(max_drawdown, 2),
            'max_drawdown_pct': round(max_drawdown_pct, 4),
            'sharpe_ratio': round(sharpe_ratio, 4),

            'exit_strategy': 'signal_reversal'
        }

        return metrics

    def save_results(self, metrics: Dict, backtest_id: int = None):
        """
        Save backtest results to database

        Args:
            metrics: Metrics dictionary
            backtest_id: Existing backtest ID (optional)

        Returns:
            Backtest result ID
        """
        cursor = self.conn.cursor()

        try:
            # Insert backtest result
            insert_query = """
            INSERT INTO backtest_results (
                pair, period, timeframe,
                start_date, end_date, initial_balance, risk_per_trade,
                total_trades, winning_trades, losing_trades, win_rate,
                total_profit, total_loss, net_profit, net_profit_pct,
                avg_profit, avg_loss, profit_factor,
                max_drawdown, max_drawdown_pct, sharpe_ratio,
                final_balance, exit_strategy
            ) VALUES (
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s
            ) RETURNING id
            """

            cursor.execute(insert_query, (
                metrics['pair'], metrics['period'], metrics['timeframe'],
                metrics['start_date'], metrics['end_date'],
                metrics['initial_balance'], metrics['risk_per_trade'],
                metrics['total_trades'], metrics['winning_trades'],
                metrics['losing_trades'], metrics['win_rate'],
                metrics['total_profit'], metrics['total_loss'],
                metrics['net_profit'], metrics['net_profit_pct'],
                metrics['avg_profit'], metrics['avg_loss'], metrics['profit_factor'],
                metrics['max_drawdown'], metrics['max_drawdown_pct'],
                metrics['sharpe_ratio'],
                metrics['final_balance'], metrics['exit_strategy']
            ))

            backtest_id = cursor.fetchone()[0]

            # Insert trades
            for trade in self.trades:
                trade_query = """
                INSERT INTO backtest_trades (
                    backtest_result_id,
                    entry_signal_id, exit_signal_id,
                    entry_time, exit_time, duration_hours,
                    direction, entry_price, exit_price, position_size,
                    exit_reason, exit_signal,
                    profit_loss, profit_loss_pct, profit_loss_pips,
                    balance_before, balance_after
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                """

                cursor.execute(trade_query, (
                    backtest_id,
                    trade.get('entry_signal_id'), trade.get('exit_signal_id'),
                    trade['entry_time'], trade['exit_time'], trade['duration_hours'],
                    trade['direction'], trade['entry_price'], trade['exit_price'],
                    trade['position_size'],
                    trade['exit_reason'], trade['exit_signal'],
                    trade['profit_loss'], trade['profit_loss_pct'], trade['profit_loss_pips'],
                    trade['balance_before'], trade['balance_after']
                ))

            self.conn.commit()
            print(f"✅ Saved backtest results (ID: {backtest_id}) with {len(self.trades)} trades")

            return backtest_id

        except Exception as e:
            self.conn.rollback()
            print(f"❌ Error saving results: {e}")
            return None
        finally:
            cursor.close()

if __name__ == '__main__':
    print("Backtest Engine")
    print("Use run_backtest.py to execute backtests")
