#!/usr/bin/env python3
"""
Run Backtest for All Pairs and Periods
Executes backtests and generates reports with charts
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backtest_engine import BacktestEngine
from chart_generator import ChartGenerator
import psycopg2
import pandas as pd
from datetime import datetime

# Configuration
PAIRS = ['EUR/USD', 'USD/JPY', 'GBP/USD']
PERIODS = {
    'intraday': '15min',
    'swing': '1h',
    'position': '1d',
    'longterm': '1w'
}

def generate_html_report(metrics_list: list, chart_files: list, output_file: str = '/tmp/backtest_report.html'):
    """
    Generate HTML report with metrics and charts

    Args:
        metrics_list: List of all backtest metrics
        chart_files: List of chart file paths
        output_file: Output HTML file path
    """
    df = pd.DataFrame(metrics_list)

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>回測報告 - Backtest Report</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #34495e;
            margin-top: 30px;
            border-left: 5px solid #3498db;
            padding-left: 15px;
        }}
        .summary {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }}
        .metric-card {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }}
        .metric-card.green {{
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }}
        .metric-card.red {{
            background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
        }}
        .metric-card .label {{
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 5px;
        }}
        .metric-card .value {{
            font-size: 32px;
            font-weight: bold;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background-color: #3498db;
            color: white;
            font-weight: bold;
        }}
        tr:hover {{
            background-color: #f5f5f5;
        }}
        .positive {{
            color: #27ae60;
            font-weight: bold;
        }}
        .negative {{
            color: #e74c3c;
            font-weight: bold;
        }}
        .chart {{
            margin: 20px 0;
            text-align: center;
        }}
        .chart img {{
            max-width: 100%;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }}
        .footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #7f8c8d;
        }}
        .highlight {{
            background-color: #fff3cd;
            padding: 2px 6px;
            border-radius: 3px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 AIFX v2 回測報告 (Backtest Report)</h1>
        <p><strong>生成時間:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        <p><strong>回測策略:</strong> 信號反轉出場 (Signal Reversal Exit)</p>
        <p><strong>回測對象:</strong> {', '.join(PAIRS)} × {len(PERIODS)} 個交易週期</p>

        <h2>📈 Overall Performance Summary</h2>
        <div class="summary">
            <div class="metric-card">
                <div class="label">總交易次數</div>
                <div class="value">{df['total_trades'].sum()}</div>
            </div>
            <div class="metric-card {'green' if df['win_rate'].mean() >= 50 else 'red'}">
                <div class="label">平均勝率</div>
                <div class="value">{df['win_rate'].mean():.1f}%</div>
            </div>
            <div class="metric-card {'green' if df['profit_factor'].mean() >= 1 else 'red'}">
                <div class="label">平均盈虧比</div>
                <div class="value">{df['profit_factor'].mean():.2f}</div>
            </div>
            <div class="metric-card {'green' if df['net_profit'].sum() > 0 else 'red'}">
                <div class="label">總淨盈利</div>
                <div class="value">${df['net_profit'].sum():,.0f}</div>
            </div>
            <div class="metric-card green">
                <div class="label">夏普比率 (平均)</div>
                <div class="value">{df['sharpe_ratio'].mean():.2f}</div>
            </div>
            <div class="metric-card red">
                <div class="label">最大回撤 (平均)</div>
                <div class="value">{df['max_drawdown_pct'].mean():.2f}%</div>
            </div>
        </div>

        <h2>📋 Detailed Results by Pair & Period</h2>
        <table>
            <thead>
                <tr>
                    <th>Pair</th>
                    <th>Period</th>
                    <th>Timeframe</th>
                    <th>Total Trades</th>
                    <th>Win Rate</th>
                    <th>Profit Factor</th>
                    <th>Net Profit</th>
                    <th>Max DD%</th>
                    <th>Sharpe Ratio</th>
                </tr>
            </thead>
            <tbody>
"""

    for _, row in df.iterrows():
        profit_class = 'positive' if row['net_profit'] > 0 else 'negative'
        win_rate_class = 'positive' if row['win_rate'] >= 50 else 'negative'

        html += f"""
                <tr>
                    <td><strong>{row['pair']}</strong></td>
                    <td>{row['period']}</td>
                    <td>{row['timeframe']}</td>
                    <td>{row['total_trades']}</td>
                    <td class="{win_rate_class}">{row['win_rate']:.1f}%</td>
                    <td class="{profit_class}">{row['profit_factor']:.2f}</td>
                    <td class="{profit_class}">${row['net_profit']:,.2f}</td>
                    <td class="negative">{row['max_drawdown_pct']:.2f}%</td>
                    <td>{row['sharpe_ratio']:.2f}</td>
                </tr>
"""

    html += """
            </tbody>
        </table>

        <h2>📊 Performance Charts</h2>
"""

    # Add charts
    for chart_file in chart_files:
        if os.path.exists(chart_file):
            chart_name = os.path.basename(chart_file).replace('_', ' ').replace('.png', '').title()
            html += f"""
        <div class="chart">
            <h3>{chart_name}</h3>
            <img src="{chart_file}" alt="{chart_name}">
        </div>
"""

    html += """
        <h2>🎯 Key Insights</h2>
        <ul>
"""

    # Best performing pair
    best_pair = df.loc[df['net_profit'].idxmax()]
    html += f"""
            <li><strong>最佳貨幣對:</strong> <span class="highlight">{best_pair['pair']}</span>
                ({best_pair['period']}) with ${best_pair['net_profit']:,.2f} profit
                ({best_pair['win_rate']:.1f}% win rate)</li>
"""

    # Best period
    period_avg = df.groupby('period').agg({'net_profit': 'sum', 'win_rate': 'mean'}).sort_values('net_profit', ascending=False)
    best_period = period_avg.index[0]
    html += f"""
            <li><strong>最佳交易週期:</strong> <span class="highlight">{best_period}</span>
                with total profit ${period_avg.loc[best_period, 'net_profit']:,.2f}
                (avg win rate: {period_avg.loc[best_period, 'win_rate']:.1f}%)</li>
"""

    # Overall win rate
    overall_win_rate = df['win_rate'].mean()
    html += f"""
            <li><strong>整體表現:</strong> Average win rate across all pairs and periods:
                <span class="highlight">{overall_win_rate:.1f}%</span></li>
"""

    html += f"""
        </ul>

        <h2>⚠️ Risk Warnings</h2>
        <p style="color: #e74c3c; font-weight: bold;">
            ⚠️ 這是回測結果，不代表未來表現。實際交易涉及重大損失風險。
        </p>
        <p>
            • 回測結果基於歷史數據，市場條件可能發生變化<br>
            • 實際交易可能涉及滑點、手續費等額外成本<br>
            • 過去的表現不保證未來的結果<br>
            • 請謹慎交易，做好風險管理
        </p>

        <div class="footer">
            <p>🤖 Generated by AIFX v2 Backtest Engine</p>
            <p>Report generated at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </div>
    </div>
</body>
</html>
"""

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"\n✅ HTML report generated: {output_file}")
    return output_file

def main():
    """Main execution function"""
    print("=" * 80)
    print("🚀 AIFX v2 Backtest Engine")
    print("=" * 80)
    print(f"\n📋 Configuration:")
    print(f"   Pairs: {', '.join(PAIRS)}")
    print(f"   Periods: {', '.join(PERIODS.keys())}")
    print(f"   Strategy: Signal Reversal Exit")
    print(f"   Initial Balance: $10,000")
    print(f"   Risk per Trade: 2%")
    print("\n" + "=" * 80)

    all_metrics = []
    all_trades = []

    # Run backtests for all combinations
    for pair in PAIRS:
        for period, timeframe in PERIODS.items():
            print(f"\n🔄 Running backtest: {pair} - {period} ({timeframe})")

            engine = BacktestEngine(pair, timeframe, period)
            engine.connect_db()

            try:
                metrics = engine.run_backtest()

                if metrics:
                    # Save results to database
                    backtest_id = engine.save_results(metrics)

                    if backtest_id:
                        all_metrics.append(metrics)
                        all_trades.extend(engine.trades)
                        print(f"✅ Backtest saved with ID: {backtest_id}")
                else:
                    print(f"⚠️  Skipped: No signals/data available")

            except Exception as e:
                print(f"❌ Error during backtest: {e}")
                import traceback
                traceback.print_exc()

            finally:
                engine.disconnect_db()

    # Generate charts and report
    if all_metrics:
        print("\n" + "=" * 80)
        print("📊 Generating Charts and Report...")
        print("=" * 80)

        chart_gen = ChartGenerator()
        trades_df = pd.DataFrame(all_trades)

        chart_files = chart_gen.generate_all_charts(all_metrics, trades_df, 'All')

        # Generate HTML report
        report_file = generate_html_report(all_metrics, chart_files)

        print("\n" + "=" * 80)
        print("✅ BACKTEST COMPLETED SUCCESSFULLY!")
        print("=" * 80)
        print(f"\n📄 Report: {report_file}")
        print(f"📊 Charts: /tmp/backtest_charts/")
        print(f"💾 Results saved to database: backtest_results & backtest_trades tables")
        print(f"\n🎯 Total backtests: {len(all_metrics)}")
        print(f"📈 Total trades: {len(all_trades)}")

        # Print summary
        df = pd.DataFrame(all_metrics)
        print(f"\n📊 Summary:")
        print(f"   Average Win Rate: {df['win_rate'].mean():.2f}%")
        print(f"   Average Profit Factor: {df['profit_factor'].mean():.2f}")
        print(f"   Total Net Profit: ${df['net_profit'].sum():,.2f}")
        print(f"   Average Sharpe Ratio: {df['sharpe_ratio'].mean():.2f}")
        print("\n" + "=" * 80)
    else:
        print("\n❌ No backtests were completed successfully")

if __name__ == '__main__':
    main()
