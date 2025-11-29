# 📊 回測報告 (Backtest Reports)

## 📍 報告位置

此目錄包含歷史回測的報告和圖表：

```
/root/AIFX_v2/ml_engine/backtest/reports/
├── historical_backtest_report.html    # HTML回測報告
└── backtest_charts/                   # 圖表目錄
    ├── win_rate_by_period_All.png    # 勝率柱狀圖
    ├── profit_factor_by_pair.png      # 盈虧比圖
    ├── equity_curve_All.png           # 權益曲線
    ├── trade_distribution_All.png     # 交易分布
    ├── performance_heatmap.png        # 性能熱圖
    └── drawdown_All.png               # 回撤圖
```

## 🚀 查看報告的方法

### 方法1：啟動HTTP服務器（推薦）

在此目錄啟動簡易HTTP服務器：

```bash
cd /root/AIFX_v2/ml_engine/backtest/reports
python3 -m http.server 8888
```

然後用瀏覽器訪問：
```
http://144.24.41.178:8888/historical_backtest_report.html
```

### 方法2：直接打開HTML文件

如果您在伺服器上有GUI：

```bash
firefox /root/AIFX_v2/ml_engine/backtest/reports/historical_backtest_report.html
# 或
google-chrome /root/AIFX_v2/ml_engine/backtest/reports/historical_backtest_report.html
```

### 方法3：複製到本地電腦

使用 `scp` 複製整個報告目錄到本地：

```bash
# 在您的本地電腦執行
scp -r root@144.24.41.178:/root/AIFX_v2/ml_engine/backtest/reports ./backtest_reports
```

然後在本地打開 `backtest_reports/historical_backtest_report.html`

## 📊 報告內容

### 回測配置
- **貨幣對：** EUR/USD, USD/JPY, GBP/USD
- **交易週期：** 日內(15min)、周內(1h)、月內(1d)、季內(1w)
- **出場策略：** 信號反轉（Signal Reversal Exit）
- **初始資金：** $10,000
- **數據期間：** 最近90天歷史市場數據
- **信號來源：** ML模型預測 + 技術分析後備（SMA交叉）

### 性能指標（8個）
1. **勝率 (Win Rate)** - 盈利交易數 / 總交易數
2. **總交易次數** - 所有完成的交易
3. **盈利交易 / 虧損交易** - 分類統計
4. **平均盈利 vs 平均虧損** - 每筆交易平均金額
5. **盈虧比 (Profit Factor)** - 總盈利 / 總虧損
6. **總收益率** - 淨盈利 / 初始資金
7. **最大回撤 (Max Drawdown)** - 權益曲線最大跌幅
8. **夏普比率 (Sharpe Ratio)** - 風險調整後收益

### 圖表說明
1. **勝率柱狀圖** - 按交易週期比較勝率（日內/周內/月內/季內）
2. **盈虧比圖** - 按貨幣對比較盈虧比
3. **權益曲線** - 賬戶餘額隨時間變化，標記盈虧點
4. **交易分布** - 盈虧分布直方圖 + 勝率餅圖
5. **性能熱圖** - 貨幣對 vs 週期勝率熱圖
6. **回撤圖** - 最大回撤時間序列分析

## 💾 數據庫查詢

所有回測結果也儲存在PostgreSQL資料庫中：

```sql
-- 查看所有回測結果摘要
SELECT pair, period, timeframe, total_trades, win_rate,
       profit_factor, net_profit, max_drawdown_pct, sharpe_ratio
FROM backtest_results
ORDER BY pair, period;

-- 查看最佳表現
SELECT * FROM backtest_results
ORDER BY net_profit DESC
LIMIT 5;

-- 查看交易明細
SELECT bt.entry_time, bt.exit_time, bt.direction,
       bt.entry_price, bt.exit_price, bt.profit_loss, bt.profit_loss_pips
FROM backtest_trades bt
JOIN backtest_results br ON bt.backtest_result_id = br.id
WHERE br.pair = 'EUR/USD' AND br.period = 'swing'
ORDER BY bt.entry_time;
```

## 🔄 重新運行回測

如果需要重新運行回測：

```bash
cd /root/AIFX_v2/ml_engine
python3 backtest/run_historical_backtest.py
```

新的報告會自動生成並覆蓋此目錄的文件。

## 📝 注意事項

⚠️ **風險警告**
- 這是歷史模擬回測結果，不代表未來表現
- 實際交易涉及滑點、手續費等額外成本
- 過去的表現不保證未來的結果
- 請謹慎交易，做好風險管理

## 📞 技術支援

如有問題，請查看：
- 回測引擎代碼：`/root/AIFX_v2/ml_engine/backtest/historical_backtest.py`
- 圖表生成器：`/root/AIFX_v2/ml_engine/backtest/chart_generator.py`
- 執行腳本：`/root/AIFX_v2/ml_engine/backtest/run_historical_backtest.py`

---

生成時間：2025-11-29
系統版本：AIFX v2
引擎：ML-Powered Historical Backtest Engine
