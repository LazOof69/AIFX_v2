#!/usr/bin/env python3
"""
Historical Backtest with ML Signal Generation
Generates signals from historical market data using ML model
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import requests
from chart_generator import ChartGenerator

# Database connection
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'aifx_v2_dev',
    'user': 'postgres',
    'password': 'postgres'
}

# ML API endpoint
ML_API_URL = 'http://localhost:8000'

class HistoricalBacktest:
    """
    Historical backtest using ML-generated signals
    """

    def __init__(self, pair: str, timeframe: str, period: str):
        self.pair = pair
        self.timeframe = timeframe
        self.period = period
        self.conn = None

        # Backtest parameters
        self.initial_balance = 10000.0
        self.risk_per_trade = 0.02
        self.position_size = 1.0

        # Results
        self.trades = []
        self.equity_curve = []
        self.current_balance = self.initial_balance

    def connect_db(self):
        """Connect to database"""
        self.conn = psycopg2.connect(**DB_CONFIG)
        print(f"✅ Connected to database")

    def disconnect_db(self):
        """Disconnect from database"""
        if self.conn:
            self.conn.close()

    def load_market_data(self, days_back: int = 90) -> pd.DataFrame:
        """
        Load historical market data

        Args:
            days_back: Number of days of historical data

        Returns:
            DataFrame with market data
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)

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

        print(f"📊 Loaded {len(df)} candles from {start_date.date()} to {end_date.date()}")
        return df

    def generate_signal_from_ml(self, candles: list) -> dict:
        """
        Generate trading signal using ML API

        Args:
            candles: List of recent candles

        Returns:
            Signal dictionary
        """
        try:
            # Prepare data for ML API
            payload = {
                'pair': self.pair,
                'timeframe': self.timeframe,
                'candles': candles[-100:]  # Use last 100 candles
            }

            # Call ML prediction endpoint
            response = requests.post(
                f'{ML_API_URL}/predict',
                json=payload,
                timeout=10
            )

            if response.status_code == 200:
                result = response.json()
                return {
                    'signal': result.get('prediction', 'standby'),
                    'confidence': result.get('confidence', 0.5)
                }
            else:
                # Fallback: simple technical analysis
                return self._simple_technical_signal(candles)

        except Exception as e:
            # Fallback on error
            return self._simple_technical_signal(candles)

    def _simple_technical_signal(self, candles: list) -> dict:
        """
        Simple technical analysis fallback

        Args:
            candles: List of candles

        Returns:
            Signal dictionary
        """
        if len(candles) < 20:
            return {'signal': 'standby', 'confidence': 0.0}

        # Calculate simple moving averages
        closes = [c['close'] for c in candles[-20:]]
        sma_5 = np.mean(closes[-5:])
        sma_20 = np.mean(closes)

        # Simple crossover strategy
        if sma_5 > sma_20 * 1.001:  # 0.1% above
            return {'signal': 'long', 'confidence': 0.6}
        elif sma_5 < sma_20 * 0.999:  # 0.1% below
            return {'signal': 'short', 'confidence': 0.6}
        else:
            return {'signal': 'standby', 'confidence': 0.5}

    def calculate_pip_value(self, pair: str) -> float:
        """Calculate pip value"""
        if 'JPY' in pair:
            return 0.01
        return 0.0001

    def run_backtest(self) -> dict:
        """
        Run historical backtest with ML signal generation

        Returns:
            Backtest metrics
        """
        print(f"\n🔄 Running Historical Backtest: {self.pair} {self.period} ({self.timeframe})")
        print("=" * 70)

        # Load market data
        market_df = self.load_market_data(days_back=90)

        if market_df.empty:
            print("❌ No market data available")
            return None

        # Convert to list of dicts for easier processing
        candles = market_df.to_dict('records')

        # Simulation variables
        current_position = None
        current_entry_price = None
        current_entry_time = None
        current_entry_idx = None

        pip_value = self.calculate_pip_value(self.pair)

        # Process each candle
        for idx, candle in enumerate(candles):
            # Need at least 20 candles for signal generation
            if idx < 20:
                continue

            # Generate signal using ML
            signal_data = self.generate_signal_from_ml(candles[:idx+1])
            signal = signal_data['signal']
            confidence = signal_data['confidence']

            timestamp = candle['timestamp']
            close_price = candle['close']

            # Entry logic
            if current_position is None:
                if signal in ['long', 'short']:
                    current_position = signal
                    current_entry_price = close_price
                    current_entry_time = timestamp
                    current_entry_idx = idx

                    if idx % 100 == 0:  # Print every 100th entry
                        print(f"  📈 ENTER {signal.upper()}: {close_price:.5f} @ {timestamp}")

            # Exit logic: Signal reversal
            else:
                should_exit = False
                exit_reason = None

                if signal == 'standby':
                    should_exit = True
                    exit_reason = 'signal_to_standby'
                elif (current_position == 'long' and signal == 'short'):
                    should_exit = True
                    exit_reason = 'signal_reversal'
                elif (current_position == 'short' and signal == 'long'):
                    should_exit = True
                    exit_reason = 'signal_reversal'

                if should_exit:
                    # Calculate P&L
                    if current_position == 'long':
                        pips = (close_price - current_entry_price) / pip_value
                    else:
                        pips = (current_entry_price - close_price) / pip_value

                    # P&L calculation
                    pnl = pips * 10 * self.position_size
                    pnl_pct = (pnl / self.current_balance) * 100

                    # Update balance
                    balance_before = self.current_balance
                    self.current_balance += pnl

                    # Duration
                    duration = (timestamp - current_entry_time).total_seconds() / 3600

                    # Record trade
                    trade = {
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

                    if len(self.trades) % 10 == 0:  # Print every 10th trade
                        status = "✅" if pnl > 0 else "❌"
                        print(f"  📉 Trade #{len(self.trades)}: {status} {pnl:+.2f} ({pnl_pct:+.2f}%) | Balance: ${self.current_balance:.2f}")

                    # Reset position
                    current_position = None

                    # Enter new position if signal indicates
                    if signal in ['long', 'short']:
                        current_position = signal
                        current_entry_price = close_price
                        current_entry_time = timestamp
                        current_entry_idx = idx

        # Close any remaining position
        if current_position is not None:
            last_candle = candles[-1]
            close_price = last_candle['close']
            timestamp = last_candle['timestamp']

            if current_position == 'long':
                pips = (close_price - current_entry_price) / pip_value
            else:
                pips = (current_entry_price - close_price) / pip_value

            pnl = pips * 10 * self.position_size
            pnl_pct = (pnl / self.current_balance) * 100
            balance_before = self.current_balance
            self.current_balance += pnl

            trade = {
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

        print("=" * 70)
        print(f"✅ Backtest completed: {len(self.trades)} trades executed")

        # Calculate metrics
        if not self.trades:
            print("⚠️  No trades were executed")
            return None

        metrics = self.calculate_metrics(
            market_df['timestamp'].min(),
            market_df['timestamp'].max()
        )

        return metrics

    def calculate_metrics(self, start_date, end_date) -> dict:
        """Calculate performance metrics"""
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

        # Sharpe ratio
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
            'profit_factor': round(profit_factor, 2) if profit_factor != float('inf') else 999.99,
            'max_drawdown': round(max_drawdown, 2),
            'max_drawdown_pct': round(max_drawdown_pct, 4),
            'sharpe_ratio': round(sharpe_ratio, 4),
            'exit_strategy': 'signal_reversal'
        }

        return metrics

    def save_results(self, metrics: dict):
        """Save results to database"""
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
                final_balance, exit_strategy, notes
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
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
                metrics['sharpe_ratio'], metrics['final_balance'],
                metrics['exit_strategy'], 'Historical backtest with ML-generated signals'
            ))

            backtest_id = cursor.fetchone()[0]

            # Insert trades
            for trade in self.trades:
                trade_query = """
                INSERT INTO backtest_trades (
                    backtest_result_id,
                    entry_time, exit_time, duration_hours,
                    direction, entry_price, exit_price, position_size,
                    exit_reason, exit_signal,
                    profit_loss, profit_loss_pct, profit_loss_pips,
                    balance_before, balance_after
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                """

                cursor.execute(trade_query, (
                    backtest_id,
                    trade['entry_time'], trade['exit_time'], trade['duration_hours'],
                    trade['direction'], trade['entry_price'], trade['exit_price'],
                    trade['position_size'], trade['exit_reason'], trade['exit_signal'],
                    trade['profit_loss'], trade['profit_loss_pct'], trade['profit_loss_pips'],
                    trade['balance_before'], trade['balance_after']
                ))

            self.conn.commit()
            print(f"✅ Saved to database (ID: {backtest_id})")
            return backtest_id

        except Exception as e:
            self.conn.rollback()
            print(f"❌ Error saving: {e}")
            return None
        finally:
            cursor.close()

if __name__ == '__main__':
    print("Historical Backtest Engine with ML Signal Generation")
