# AIFX v2 開發任務清單

**最後更新**: 2025-10-13
**當前階段**: Phase 3 - 交易生命週期管理系統 v3.0 (Week 1 進行中)

---

## 🎯 專案願景

從「價格預測」轉型為「風險報酬評估 + 持倉監控」的**完整交易生命週期管理系統**

**核心價值**：
- 進場信號評估（風險報酬比 > 2.0）
- 用戶回報持倉
- 實時監控（每分鐘）
- 智能出場提醒

---

## 📊 整體進度總覽

| 階段 | 狀態 | 進度 | 完成日期 |
|------|------|------|----------|
| **Phase 1**: 基礎系統建設 | ✅ 完成 | 100% | 2025-09-30 |
| **Phase 2**: ML v1.0 + v2.0 | ✅ 完成 | 100% | 2025-10-12 |
| **Phase 3**: 交易生命週期 v3.0 | 🔄 進行中 | **18%** | - |

**Phase 3 詳細進度**:
- Week 1 (資料庫+後端): **73%** (11/15 任務完成)
- Week 2 (ML v3.0): 0%
- Week 3 (ML API): 0%
- Week 4 (Discord+前端): 0%

---

## ✅ Phase 1: 基礎系統（已完成）

### 後端 Backend
- [x] Node.js + Express.js 架構
- [x] PostgreSQL + Sequelize ORM
- [x] Redis 緩存
- [x] JWT 認證系統
- [x] 5 個控制器（auth, market, trading, preferences, notification）
- [x] 99+ 單元測試（>70% 覆蓋率）

### 前端 Frontend
- [x] React 18 + Vite
- [x] 5 個組件（Login, Dashboard, TradingView, Settings, MarketOverview）
- [x] Socket.io 實時更新
- [x] TailwindCSS 響應式設計

### Discord Bot
- [x] Discord.js 基礎實作
- [x] 4 個命令（subscribe, unsubscribe, signal, preferences）
- [x] Redis pub/sub 整合
- [x] Rate limiting（1 通知/分鐘/用戶）
- [x] Rich embeds 通知格式

### 資料庫
- [x] 5 個 Migration 文件
- [x] 4 個 Seeder 文件
- [x] 測試資料

**參考文檔**: `PROJECT_STATUS.md`

---

## ✅ Phase 2: ML Engine v1.0 & v2.0（已完成）

### v1.0 技術指標模型（單輸入 LSTM）
- [x] Python 環境設置
- [x] 28 個技術指標特徵工程
- [x] LSTM 模型架構（142,881 參數）
- [x] 訓練 3 個貨幣對：
  - EURUSD: val_loss 0.839
  - GBPUSD: val_loss 0.816 ⭐
  - USDJPY: val_loss 0.826
- [x] FastAPI ML API 部署（port 8000）

### v2.0 多輸入 LSTM（技術+基本面+事件）

#### Week 1: 基本面數據收集
- [x] 註冊 FRED API key
- [x] 設計 PostgreSQL Schema（3 張表）
- [x] 建立數據收集器（`collect_fundamental_data.py`）
- [x] 收集 **10,409 條基本面數據**（2005-2025）
  - US: 1,294 條
  - EU: 7,826 條
  - GB: 544 條
  - JP: 745 條
- [x] 同步 7,301 個利率日期到 interest_rates 表

#### Week 1-2: 經濟事件日曆
- [x] 建立經濟日曆爬蟲（`collect_economic_calendar.py`）
- [x] 收集 **21,179 條經濟事件**
- [x] 解析高/中/低影響事件
- [x] 設置定時任務（每日 01:00 AM）
- [x] 建立基本面特徵工程（`fundamental_features.py`）
  - 利率差異
  - GDP 增長率
  - 通膨差異
  - 距下個重大事件天數
  - 事件影響分數

#### Week 2: 多輸入模型開發
- [x] 建立 `multi_input_predictor.py`（568 行）
  - Input 1: 技術指標 (60, 28) → LSTM(64) → LSTM(32) → Dense(16)
  - Input 2: 基本面 (7) → Dense(32) → Dense(16)
  - Input 3: 事件特徵 (5) → Dense(16) → Dense(8)
  - Fusion: Concatenate(40) → Dense(64) → Dense(32) → Output(1)
  - 總參數: 42,505
- [x] 自定義 DirectionalAccuracyMetric
- [x] 修改 `prepare_v2_training_data.py` 支持日期範圍
- [x] 修改 `train_v2_pair.py` 支持自定義數據目錄

#### Week 2: EURUSD v2.0 訓練
- [x] 小數據集訓練（191 樣本，2024 only）
  - val_loss: 0.0044
  - 方向準確率: 65.96%
  - **發現**: 小數據集過擬合
- [x] 修復基本面數據 NaN 問題（4/7 特徵為 100% NaN）
- [x] 擴展數據集準備（836 訓練 + 209 測試，2020-2024）
- [x] 擴展數據集訓練
  - 66 epochs（early stopped at epoch 51）
  - Best val_loss: **0.000402** ⭐ 超越目標 0.70
  - Test RMSE: 0.0282
  - Test MAE: 0.0231
  - 方向準確率: **47.60%** ⚠️ 低於隨機 50%

#### Week 2 成果
- ✅ 模型文件: `saved_models_v2/EURUSD_v2_20251012_101920.h5`
- ✅ 數據集擴展完成（191 → 836 樣本，+437%）
- ✅ val_loss 改善 91%（0.0044 → 0.000402）
- ⚠️ **關鍵發現**: MSE loss 優化價格預測，但方向準確率差
  - **問題**: 賺錢靠「方向判斷」和「反轉點識別」，不是「價格精確度」
  - **結論**: 需要重新設計 v3.0

**參考文檔**: `ML_ENGINE_TODO.md`, `ml_engine/WEEK2_SUMMARY.md`

---

## 🚀 Phase 3: v3.0 交易生命週期管理系統（🔄 進行中 - 18%）

**更新日期**: 2025-10-13
**當前狀態**: Week 1 進行中 (73% 完成)
**參考文檔**: `PHASE3_PROGRESS_STATUS.md`, `PHASE3_WEEK1_DAY1_SUMMARY.md`, `PHASE3_WEEK1_DAY2_SUMMARY.md`

### 核心理念

**v2.0 的問題**:
```
❌ 優化目標: 預測精確價格（MSE loss）
❌ 結果: RMSE 很低但方向準確率 47.60%
❌ 無法實際交易使用
```

**v3.0 的目標**:
```
✅ 優化目標: 方向趨勢 + 風險報酬比
✅ 結果: 幫助用戶在「低風險高報酬」時進場
✅ 監控持倉並智能提醒出場
✅ 實際可用於交易決策
```

### 系統流程

```
階段 1: 進場信號評估
  ↓
  ML 模型分析市場 → 發現機會 (RR > 2.0)
  ↓
  Discord 通知: "建議買進 EURUSD @ 1.0850, RR=2.5, SL=1.0820, TP=1.0900"

階段 2: 用戶回報持倉
  ↓
  用戶實際下單 → 回報系統
  "已買進 EURUSD @ 1.0852, 倉位 15%"
  ↓
  系統記錄到 user_positions 表

階段 3: 持續監控（每分鐘）
  ↓
  後端監控服務 → 調用 ML API
  ↓
  ML 模型分析:
  - 趨勢是否延續？
  - 是否接近反轉？
  - 當前風險報酬比？
  - 是否該出場？
  ↓
  記錄到 position_monitoring 表

階段 4: 智能出場提醒
  ↓
  條件觸發（趨勢反轉/達到止盈/持倉過久）
  ↓
  Discord 通知: "建議出場 EURUSD, 當前 1.0895, 盈利 +0.5%, 趨勢開始反轉"
```

---

## 📅 Phase 3 開發計畫（4 週）

### Week 1: 資料庫 + 後端架構（5-7 天 | 🔄 進行中 | 73% 完成）

**實際用時**: Day 1-4 (2025-10-12 至 2025-10-13)
**完成任務**: 11/15
**提交記錄**: `4bee990`, `a073235`, `088bf99`

#### 1.1 資料庫擴展 ⭐ **✅ 100% 完成**

**複用現有表** (參考: PHASE3_CONFLICT_ANALYSIS.md):
- [x] `trading_signals` 表 - 已存在，用於信號記錄（不新增 signals 表）
- [x] `user_trading_history` 表 - 已存在，用於持倉追蹤（不新增 user_positions 表）

**需要新增的表**:
- [x] ✅ 創建 `position_monitoring` 表（監控歷史記錄）
  - Migration: `20251012000001-create-position-monitoring.js`
  - 18 個欄位，7 個索引
  - 支援 4 級通知系統
  - Model: `PositionMonitoring.js` (240 行)

**擴展現有表**:
- [x] ✅ 擴展 `user_preferences.notification_settings` JSONB
  - Migration: `20251012000002-extend-notification-settings.js`
  - 新增 8 個通知控制欄位
  - 向後兼容現有用戶
  - Model 更新: `UserPreferences.js`

- [x] ✅ 創建 Migration 文件
- [x] ✅ 測試資料庫 Schema

#### 1.2 後端 API 設計 ⭐ **✅ 117% 完成** (超出計畫)

**複用現有端點** (參考: PHASE3_CONFLICT_ANALYSIS.md):
- [x] `GET /api/v1/trading/signal/:pair` - 已存在，用於信號查詢
- [x] `POST /api/v1/trading/analyze` - 已存在，用於批量分析
- [x] `GET /api/v1/trading/history` - 已存在，可擴展為持倉查詢
- [x] `POST /api/v1/notifications/send` - 已存在，用於通知發送

**需要新增的端點** (新增 /positions/* 路由):
- [x] ✅ **POST /api/v1/positions/open**
  - Controller: `positionController.openPosition()`
  - Service: `positionService.openPosition()`
  - Joi validation: `openPositionSchema`
  - 測試: ✅ 通過

- [x] ✅ **POST /api/v1/positions/close**
  - Controller: `positionController.closePosition()`
  - Service: `positionService.closePosition()`
  - 支援部分平倉 (exitPercentage)
  - 測試: ✅ 通過 (含 partial close 3 scenarios)

- [x] ✅ **GET /api/v1/positions/:id**
  - Controller: `positionController.getPosition()`
  - Service: `positionService.getPosition()`
  - 支援查詢監控數據
  - 測試: ✅ 通過

- [x] ✅ **GET /api/v1/positions/:id/monitor**
  - Controller: `positionController.getMonitoringHistory()`
  - Service: 調用 `PositionMonitoring.getHistory()`
  - 測試: ✅ 通過

- [x] ✅ **GET /api/v1/positions/user/:userId**
  - Controller: `positionController.getUserPositions()`
  - Service: `positionService.getUserPositions()`
  - 支援分頁和過濾
  - 測試: ✅ 通過

- [x] ✅ **PUT /api/v1/positions/:id/adjust**
  - Controller: `positionController.adjustPosition()`
  - Service: `positionService.adjustPosition()`
  - 測試: ✅ 通過

- [x] ✅ **GET /api/v1/positions/user/:userId/statistics** (額外實現)
  - Controller: `positionController.getPositionStatistics()`
  - Service: `positionService.getPositionStatistics()`
  - 返回: win rate, total P&L, average holding duration
  - 測試: ✅ 通過 (19 trades aggregated)

**實現文件**:
- Routes: `routes/positions.js` (204 行)
- Controller: `positionController.js` (291 行)
- Service: `positionService.js` (517 行)
- Models: `UserTradingHistory.js`, `PositionMonitoring.js`

#### 1.3 持倉監控服務 ⭐ **⏳ 0% (待完成)**

**預計時間**: 2-3 天
**依賴**: ML API (可先用 mock data 測試)

- [ ] ⏳ 創建 `positionMonitor.js` 服務
  - 每分鐘執行一次
  - 查詢所有 open positions
  - 並行調用 ML API 分析 (先用 mock data)
  - 記錄到 position_monitoring 表
  - 判斷是否需要通知用戶
  - 發送 Discord/WebSocket 通知
- [ ] ⏳ 實現追蹤止損邏輯
  - 盈利達 50% TP → 移動 SL 到成本價
  - 盈利達 80% TP → 移動 SL 到 50% TP
- [ ] ⏳ 實現通知條件判斷
  - 建議出場且信心 > 0.7
  - 趨勢反轉概率 > 0.6
  - 達到止損/止盈
  - 持倉超過 24H 無進展
- [ ] ⏳ 錯誤處理和重試機制
- [ ] ⏳ 日誌記錄

**Week 1 總結**:
- **預計時間**: 5-7 天
- **實際用時**: 4 天 (Day 1-4)
- **完成度**: 73% (11/15 任務)
- **狀態**: 🔄 進行中，剩餘監控服務待完成
- **測試報告**: `PHASE3_DAY3-4_TESTING_REPORT.md`

---

### Week 2: ML v3.0 模型開發（7-10 天）

#### 2.1 數據準備（重新標註）

**進場模式標註**:
```python
def label_entry_opportunities(df):
    """
    標註歷史上的「好進場點」

    條件:
    1. 未來 24H 走勢明確（漲幅 > 0.3% 或跌幅 < -0.3%）
    2. 風險報酬比 > 2.0
    3. 最終盈利（達到預期 TP）

    Label:
    - direction: 0=下跌, 1=盤整, 2=上漲
    - has_opportunity: 0/1
    - expected_move: 預期漲跌幅（用於計算 TP）
    - risk_level: 預期最大回撤（用於計算 SL）
    """
```

**持倉監控模式標註**:
```python
def label_exit_recommendations(df, position_info):
    """
    標註「最佳出場點」

    條件:
    1. 局部最大盈利點（之後回撤 > 30%）
    2. 趨勢明確反轉
    3. 達到預設止損/止盈

    Label:
    - recommendation: hold/exit/adjust_sl/take_partial
    - reversal_probability: 0.0~1.0
    - expected_pnl_if_hold: 如果繼續持有的預期盈虧
    """
```

- [ ] 實現進場標註腳本
- [ ] 實現持倉監控標註腳本
- [ ] 重新處理 2020-2024 EURUSD 數據
- [ ] 生成 v3.0 訓練數據集

#### 2.2 模型架構設計

**雙模式預測模型**:
```python
class TradingLifecyclePredictor:
    """
    模式 1: 進場評估（Entry Evaluation）
    Input:
      - 技術指標 (60, 28)
      - 基本面 (7)
      - 事件 (5)
      - 市場狀態 (波動率regime, 趨勢regime, 流動性)

    Output:
      - has_opportunity: Binary (0/1)
      - direction: Classification (long/short/neutral)
      - expected_move: Regression (預期漲跌幅)
      - volatility_forecast: Regression (預期波動率)
      - confidence: 0.0~1.0

    模式 2: 持倉監控（Position Monitoring）
    Input:
      - 所有進場特徵 +
      - 持倉上下文 (entry_price, holding_duration, unrealized_pnl,
                    distance_to_sl, distance_to_tp, max_favorable_move,
                    max_adverse_move)

    Output:
      - trend_continuation_prob: 0.0~1.0
      - trend_reversal_prob: 0.0~1.0
      - recommendation: Classification (hold/exit/adjust_sl/take_partial)
      - expected_pnl_24h: Regression
      - optimal_exit_timing: 0~1440 (分鐘)
    """
```

- [ ] 設計共享特徵提取層（Multi-Input LSTM）
- [ ] 設計進場評估分支
- [ ] 設計持倉監控分支
- [ ] 實現自定義 Loss Function
  ```python
  def trading_loss(y_true, y_pred):
      # 方向最重要 50%
      direction_loss = categorical_crossentropy(...)
      # 風險報酬預測 30%
      rr_loss = mse(expected_move, volatility)
      # 置信度校準 20%
      confidence_loss = binary_crossentropy(...)

      return 0.5 * direction_loss + 0.3 * rr_loss + 0.2 * confidence_loss
  ```

#### 2.3 模型訓練

- [ ] 訓練進場評估模型
  - 目標: 方向準確率 > 55%
  - 目標: RR 預測 MAE < 0.5
  - 目標: 信號品質 precision > 0.65
- [ ] 訓練持倉監控模型
  - 目標: 反轉識別 recall > 0.60
  - 目標: 出場建議 accuracy > 0.60
- [ ] A/B 測試（v2.0 vs v3.0）
- [ ] 生成訓練報告

#### 2.4 回測驗證

- [ ] 實現回測框架（`backtest/trading_simulator.py`）
  ```python
  def backtest(model, test_data, initial_capital=10000):
      """
      根據模型信號進行模擬交易

      返回:
      - 總收益率
      - Sharpe Ratio
      - 最大回撤
      - 勝率
      - 盈虧比
      - 平均持倉時長

      ⚠️ 包含明顯風險警告
      """
  ```
- [ ] 計算交易績效指標
- [ ] 與 buy-and-hold 策略對比
- [ ] 生成回測報告（包含風險警告）

**預計時間**: 7-10 天

---

### Week 3: ML API 升級（5-7 天）

#### 3.1 新增 ML API 端點

- [ ] **POST /api/ml/v3/evaluate_entry**
  ```python
  Request:
  {
    "pair": "EURUSD",
    "user_preferences": {
      "risk_level": 5,
      "max_position_size": 20
    }
  }

  Response:
  {
    "has_opportunity": true,
    "direction": "long",
    "recommended_entry": 1.0850,
    "stop_loss": 1.0820,
    "take_profit": 1.0900,
    "risk_reward_ratio": 2.5,
    "confidence": 0.78,
    "trend_strength": 0.65,
    "reasoning": "Strong upward momentum...",
    "risk_warning": "⚠️ Forex trading carries significant risk..."
  }
  ```

- [ ] **POST /api/ml/v3/analyze_position**
  ```python
  Request:
  {
    "pair": "EURUSD",
    "direction": "long",
    "entry_price": 1.0852,
    "current_price": 1.0883,
    "holding_duration": 45,  # minutes
    "unrealized_pnl": 0.29
  }

  Response:
  {
    "trend_direction": "uptrend",
    "trend_strength": 0.72,
    "reversal_probability": 0.15,
    "current_rr_ratio": 0.27,
    "recommendation": "take_partial",
    "confidence": 0.68,
    "reasoning": "Price approaching take profit...",
    "suggested_exit_percentage": 50,
    "suggested_new_sl": 1.0852,
    "suggested_new_tp": 1.0920
  }
  ```

- [ ] **GET /api/ml/v3/risk-assessment/:pair**
  - 評估當前市場風險等級
  - 檢查未來重大事件
  - 返回風險建議

#### 3.2 API 測試

- [ ] 單元測試（進場評估）
- [ ] 單元測試（持倉分析）
- [ ] 集成測試（Backend → ML API）
- [ ] 負載測試（100 concurrent requests）
- [ ] 延遲測試（目標 < 500ms）

#### 3.3 文檔

- [ ] API 文檔更新
- [ ] 使用範例
- [ ] 錯誤碼說明

**預計時間**: 5-7 天

---

### Week 4: Discord 整合 + 前端展示（5-7 天）

#### 4.1 Discord Bot 升級

**現有功能**（保留）:
- subscribe/unsubscribe 命令
- signal 命令（改為調用 v3.0 API）
- preferences 命令
- Rate limiting

**新增功能**:
- [ ] **/position open** 命令
  ```
  用戶輸入: /position open pair:EURUSD price:1.0852 size:15
  Bot 回應: "✅ 持倉已記錄，開始監控！每分鐘更新一次。"
  ```

- [ ] **/position list** 命令
  ```
  顯示用戶所有開倉位
  - EURUSD Long @ 1.0852, +0.29%, 持倉 45 分鐘
  - GBPUSD Short @ 1.2650, -0.15%, 持倉 2 小時
  ```

- [ ] **/position close** 命令
  ```
  用戶輸入: /position close position_id:123 price:1.0895
  Bot 回應: "✅ 持倉已平倉，盈利 +43 pips (+0.40%)"
  ```

- [ ] 持倉監控通知（自動）
  ```
  📊 Position Update: EURUSD Long

  Entry: 1.0852
  Current: 1.0895
  P&L: +43 pips (+0.40%)

  Trend: Uptrend (strength: 72%)

  ⚠️ Recommendation: TAKE PARTIAL
  Confidence: 68%

  Reasoning: Price approaching take profit. Trend remains
  strong but overbought on RSI. Consider taking 50% profit
  and moving stop loss to breakeven.

  ⚠️ This is advisory only, not financial advice.
  ```

- [ ] 進場信號通知（自動）
  ```
  🔔 Entry Opportunity: EURUSD

  Signal: BUY 📈
  Entry: 1.0850
  Stop Loss: 1.0820 (-30 pips)
  Take Profit: 1.0900 (+50 pips)
  Risk/Reward: 2.5:1

  Confidence: 78%
  Trend Strength: 65%

  Analysis: Strong upward momentum with bullish divergence
  on RSI. Support confirmed at 1.0830. ECB rate decision
  positive for EUR.

  ⚠️ Forex trading carries significant risk. Past performance
  does not guarantee future results. Only trade with capital
  you can afford to lose.

  Use /position open to report your entry.
  ```

#### 4.2 前端展示

- [ ] 創建 **PositionMonitor.jsx** 組件
  - 顯示所有開倉位
  - 實時 P&L 更新（WebSocket）
  - 出場建議提醒
  - 一鍵平倉按鈕

- [ ] 創建 **TradingSignals.jsx** 組件
  - 顯示最新進場信號
  - 風險報酬比視覺化
  - 信號歷史記錄
  - 一鍵回報進場

- [ ] 更新 **Dashboard.jsx**
  - 添加持倉總覽卡片
  - 添加信號通知卡片
  - 實時績效統計

#### 4.3 端到端測試

- [ ] 完整流程測試
  1. ML API 生成進場信號
  2. Discord 通知發送
  3. 用戶回報持倉
  4. 監控服務啟動
  5. 持續分析並記錄
  6. 觸發出場提醒
  7. 用戶回報平倉
  8. 計算績效

- [ ] 壓力測試（100 用戶 x 5 持倉）
- [ ] 延遲測試（監控週期 < 60 秒）
- [ ] 錯誤恢復測試

**預計時間**: 5-7 天

---

## 🎯 Phase 3 成功標準

### 技術指標
- [ ] 方向準確率 > 55%（扣除手續費後可盈利）
- [ ] 進場信號 RR Ratio 預測 MAE < 0.5
- [ ] 反轉識別 Precision > 0.65
- [ ] 出場建議 Recall > 0.60
- [ ] ML API 響應時間 < 500ms（p95）
- [ ] 監控週期穩定 60 秒 ±5 秒

### 業務指標
- [ ] 回測 Sharpe Ratio > 1.0
- [ ] 回測最大回撤 < 15%
- [ ] 回測勝率 > 55%
- [ ] 回測盈虧比 > 1.5
- [ ] 用戶持倉監控覆蓋率 > 95%（無遺漏）

### 用戶體驗
- [ ] Discord 通知延遲 < 5 秒
- [ ] 前端實時更新延遲 < 3 秒
- [ ] 每個 response 包含風險警告
- [ ] 推理說明清晰易懂

---

## 📋 開發檢查清單

### 資料庫設計
- [ ] ER 圖設計完成
- [ ] Migration 文件創建
- [ ] 索引優化（高頻查詢欄位）
- [ ] 測試資料準備
- [ ] 備份策略

### 後端開發
- [ ] API 路由設計
- [ ] Controller 實現
- [ ] Service 層實現
- [ ] 單元測試（>70% 覆蓋率）
- [ ] 集成測試
- [ ] API 文檔

### ML 開發
- [ ] 數據標註腳本
- [ ] 模型架構實現
- [ ] 訓練流程
- [ ] 評估指標計算
- [ ] 回測框架
- [ ] 模型版本管理

### Discord 開發
- [ ] 新命令實現
- [ ] 通知格式設計
- [ ] 錯誤處理
- [ ] Rate limiting 調整
- [ ] 測試（模擬用戶互動）

### 前端開發
- [ ] 新組件設計
- [ ] WebSocket 整合
- [ ] 響應式布局
- [ ] 錯誤處理
- [ ] UI/UX 測試

### 監控服務
- [ ] 定時任務實現
- [ ] 並發處理
- [ ] 錯誤重試
- [ ] 日誌記錄
- [ ] 性能優化

---

## ⚠️ 風險與挑戰

### 技術風險
1. **ML 模型性能**
   - 風險: 方向準確率無法突破 55%
   - 緩解: 調整 loss function, 超參數調優, 特徵工程

2. **監控服務穩定性**
   - 風險: 每分鐘監控 100+ 持倉可能超時
   - 緩解: 並發處理, Redis 緩存, 降級策略

3. **實時性要求**
   - 風險: ML API 響應慢導致監控延遲
   - 緩解: 模型優化, 批量推理, 異步處理

### 合規風險
1. **金融建議責任**
   - 緩解: 每個 response 包含風險警告
   - 緩解: 強調「輔助決策」不是「投資建議」
   - 緩解: 不提供「保證盈利」承諾

2. **用戶資金安全**
   - 緩解: 不直接處理用戶資金
   - 緩解: 不自動下單（僅建議）
   - 緩解: 記錄所有信號用於審計

---

## 📚 參考文檔

### 現有文檔
- `PROJECT_STATUS.md` - Phase 1 完成狀態
- `ML_ENGINE_TODO.md` - Phase 2 詳細記錄
- `ml_engine/WEEK2_SUMMARY.md` - v2.0 訓練總結
- `CLAUDE.md` - 開發規範（Git workflow, 安全規範）
- `backend/docs/API.md` - 現有 API 文檔
- `discord_bot/README.md` - Discord bot 文檔

### 需要創建的文檔
- [ ] `V3_ARCHITECTURE.md` - v3.0 架構設計
- [ ] `V3_ML_DESIGN.md` - v3.0 模型設計
- [ ] `V3_API_DOCS.md` - v3.0 API 完整文檔
- [ ] `POSITION_MONITORING_GUIDE.md` - 持倉監控使用指南
- [ ] `BACKTESTING_RESULTS.md` - 回測結果報告

---

## 🚀 下次對話開始時

### 立即執行的命令

```bash
# 1. 檢查當前狀態
cd /root/AIFX_v2
cat TODO.md

# 2. 檢查 v2.0 模型
ls -lh ml_engine/saved_models_v2/

# 3. 檢查資料庫
PGPASSWORD=postgres psql -h localhost -U postgres -d aifx_v2_dev -c "
SELECT table_name,
       pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;
"

# 4. 檢查服務狀態
screen -ls
```

### 第一步建議

**選擇起點**:

**選項 A**: 從資料庫設計開始（推薦）
- 設計 3 張新表 Schema
- 創建 Migration 文件
- 測試資料庫結構

**選項 B**: 從 ML 模型開始
- 重新標註訓練數據
- 設計 v3.0 雙模式架構
- 訓練進場評估模型

**選項 C**: 從後端 API 開始
- 設計 API 端點
- 實現 Controller 和 Service
- 創建監控服務

---

## 📞 問題確認

在開始 Phase 3 之前，需要確認：

1. **回測結果展示方式**？
   - 選項 A: 只顯示信號準確率（保守）
   - 選項 B: 顯示模擬績效 + 明顯風險警告（推薦）

2. **API Response 風險警告**？
   - 選項 A: 每個 response 都包含
   - 選項 B: API 文檔統一說明

3. **監控通知頻率**？
   - 每分鐘監控，但只在「重要變化」時通知
   - 定義「重要變化」: 建議出場 || 趨勢反轉 || 達到 SL/TP

4. **追蹤止損功能**？
   - 是否自動調整止損？
   - 用戶是否可開關？

5. **實作順序偏好**？
   - 資料庫優先 vs ML 模型優先 vs 後端 API 優先

---

**最後更新**: 2025-10-12
**當前階段**: Phase 3 規劃完成，等待開始實作
**預計完成時間**: 4 週（Week 1-4）
**下一步**: 確認問題 → 選擇起點 → 開始開發
