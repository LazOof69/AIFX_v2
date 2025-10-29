# AIFX_v2 開發筆記 - 2025-10-29

## 📝 本次 Session 摘要

### ✅ 已完成任務

1. **ML 模型訓練成功**
   - 訓練 50 epochs，達成 99.11% 測試準確率
   - 模型: reversal_mode1 (反轉點檢測)
   - 參數: 39,972 個可訓練參數
   - 模型大小: 527KB
   - 保存位置: `/root/AIFX_v2/ml_engine/models/trained/reversal_mode1_model.h5`

2. **解決 TensorFlow 2.12 相容性問題**
   - 問題: 舊模型使用 `batch_shape` 參數導致反序列化錯誤
   - 解決: 重新訓練模型，生成 TensorFlow 2.12 相容的模型檔案
   - 驗證: 模型成功載入，無任何錯誤

3. **解決 ARM64 架構問題**
   - 問題: `libgomp.so.1: cannot allocate memory in static TLS block`
   - 解決: 創建 `train_wrapper.sh` 使用 `export LD_PRELOAD=/usr/lib/aarch64-linux-gnu/libgomp.so.1`
   - 檔案: `/root/AIFX_v2/ml_engine/train_wrapper.sh`

4. **清理資料源架構**
   - 移除 Alpha Vantage API 整合
   - 移除 Twelve Data API 整合
   - 統一使用 yfinance 作為唯一資料源
   - Backend forexService.js 從 580 行簡化到 280 行

5. **前端 K線圖實作**
   - 組件: `/root/AIFX_v2/frontend/src/components/CandlestickChart.jsx`
   - 功能: 顯示價格歷史 + 交易信號標記
   - Mock data fallback 機制（當 API 不可用時）

6. **Git 提交**
   - Commit f02b361: Backend forexService 清理
   - Commit 3438d91: ML training wrapper
   - Commit e51d721: Frontend mock data fallback
   - Commit 2cc01a0: ML 模型訓練完成
   - 全部已推送到 GitHub

---

## ⚠️ 未解決問題

### 1. ML Engine API 模組匯入錯誤

**問題描述:**
```
WARNING: Could not load reversal prediction modules: No module named 'model_manager'
```

**影響範圍:**
- ML Engine API 基本功能正常（health endpoint 可用）
- `/reversal/predict` 端點可能不可用
- 模型訓練和載入測試正常

**已嘗試解決方案:**
- 修改 `api/ml_server.py` import 路徑：`from api.model_manager import ModelManager`
- 修改 `api/reversal_api.py` import 路徑：`from api.model_manager import ModelManager`
- 問題仍未完全解決

**檔案位置:**
- `/root/AIFX_v2/ml_engine/api/ml_server.py` (line 463-466)
- `/root/AIFX_v2/ml_engine/api/reversal_api.py` (line 25-27)
- `/root/AIFX_v2/ml_engine/api/model_manager.py`
- `/root/AIFX_v2/ml_engine/api/prediction_service.py`
- `/root/AIFX_v2/ml_engine/api/ab_testing.py`

**下次需要:**
- 檢查 Python path 設定
- 驗證 `__init__.py` 是否正確設定
- 測試直接 import 是否成功
- 考慮使用絕對路徑或調整 sys.path

---

### 2. yfinance API 連接問題

**問題描述:**
```
ERROR:yfinance:Failed to get ticker 'EURUSD=X'
ERROR:yfinance:$EURUSD=X: possibly delisted; No timezone found
```

**影響範圍:**
- 無法獲取即時市場數據
- 前端目前使用 mock data 顯示
- 歷史信號仍可從資料庫讀取

**可能原因:**
1. Yahoo Finance API 變更或限制
2. 網路連接問題
3. 貨幣對代號格式變更
4. API rate limiting

**臨時解決方案:**
- Frontend CandlestickChart 實作 mock data generator
- 顯示過去 100 小時的模擬價格數據
- 仍可顯示資料庫中的真實交易信號

**下次需要:**
- 測試不同的貨幣對代號格式
- 檢查 yfinance 套件是否需要更新
- 查看 yfinance 官方文件是否有 API 變更
- 考慮備用數據源（如果 yfinance 不可靠）

**相關檔案:**
- `/root/AIFX_v2/ml_engine/data_processing/yfinance_fetcher.py`
- `/root/AIFX_v2/frontend/src/components/CandlestickChart.jsx` (line 42-46)

---

### 3. Zombie 進程殘留

**問題描述:**
```
root 190366 66.0 0.0 0 0 ? Zs Oct27 1678:37 [uvicorn] <defunct>
```

**影響範圍:**
- 不影響新 ML API 運行
- 佔用極少系統資源
- 但無法被 kill 命令清除

**臨時解決方案:**
- 新的 ML API 進程正常運行在不同 PID
- Zombie 進程不消耗 CPU 或記憶體

**下次需要:**
- 系統重啟（最徹底的解決方案）
- 或等待父進程結束自動回收

---

## 📋 待處理任務清單

### 高優先級

- [ ] **修復 ML API reversal 模組匯入**
  - 檢查 import 路徑設定
  - 驗證所有相依模組存在
  - 測試 `/reversal/predict` 端點

- [ ] **解決 yfinance API 問題**
  - 測試 API 連接
  - 更新 yfinance 套件版本
  - 確認貨幣對代號格式

- [ ] **端到端測試**
  - Frontend → Backend → ML Engine 完整流程
  - 測試信號生成和顯示
  - 驗證 WebSocket 即時更新

### 中優先級

- [ ] **Discord Bot 整合測試**
  - 啟動 Discord Bot: `cd /root/AIFX_v2/discord_bot && node bot.js`
  - 測試 Redis pub/sub 通知機制
  - 驗證信號推送到 Discord

- [ ] **效能優化**
  - 測試 ML prediction API 回應時間
  - 優化前端 chart 渲染效能
  - 檢查 Redis cache hit rate

### 低優先級

- [ ] **清理不需要的檔案**
  - 刪除 `frontend/src/components/MarketOverview_Old.jsx`
  - 刪除 `frontend/src/components/TradingView_Old.jsx`

- [ ] **文檔更新**
  - 更新 API 文檔
  - 記錄模型訓練流程
  - 更新部署指南

---

## 🔧 系統狀態

### 服務運行狀態

```
✅ Backend API (Node.js)
   - Port: 3000
   - Status: Running
   - Data Source: yfinance only

✅ Frontend (React + Vite)
   - Port: 5173
   - Status: Running
   - K線圖: 使用 mock data

✅ ML Engine API (FastAPI)
   - Port: 8000
   - Status: Running
   - Model Loaded: False (因 import 錯誤)
   - Health Endpoint: Working

⚠️ ML Engine Reversal API
   - Status: Import Error
   - Issue: model_manager module not found

❌ Discord Bot
   - Status: Not Running
   - Ready to start when needed

✅ PostgreSQL Database
   - Status: Running
   - Signals: 20 entries available

✅ Redis Cache
   - Status: Running
   - Database: 2 (Discord notifications)
```

### 訓練背景進程

```
Multiple training processes running:
- c21dd6: train_wrapper.sh (completed)
- c13818: Alternative training attempt (completed)
- 5252b4: Initial training attempt (completed)

Training completed successfully at 2025-10-29 12:30:59
Model saved to: models/trained/reversal_mode1_model.h5
```

---

## 📊 模型訓練詳細資訊

### 訓練配置

```yaml
Model Name: reversal_mode1
Version: 3.0-reversal
Architecture: LSTM-based Reversal Detection

Training Parameters:
- Epochs: 50
- Batch Size: 32
- Sequence Length: 20
- Features: 38 technical indicators

Dataset:
- Training Samples: 10,077
- Validation Samples: 2,014
- Test Samples: 4,923
```

### 訓練結果

```
Test Set Performance:
- Loss: 0.0424
- Signal Loss: 0.0587
- Confidence Loss: 0.0039
- Signal Accuracy: 99.11%
- Signal Precision: 99.11%
- Signal Recall: 99.11%
- Confidence MAE: 0.0085

Model Architecture:
- Layer 1: LSTM (64 units)
- Layer 2: Dropout (0.2)
- Layer 3: LSTM (32 units)
- Layer 4: Dropout (0.2)
- Layer 5: Dense (32 units)
- Layer 6: Dropout (0.2)
- Output 1: Signal (3 classes: hold/buy/sell)
- Output 2: Confidence (regression)

Total Parameters: 39,972
Trainable Parameters: 39,972
Model Size: 527KB
```

### 技術指標 (38 個)

模型使用的特徵包括：
- Price Features: Open, High, Low, Close, Volume
- Moving Averages: SMA (5, 10, 20, 50), EMA (5, 10, 20)
- Momentum: RSI, MACD, Stochastic
- Volatility: Bollinger Bands, ATR
- Trend: ADX, CCI
- 其他自定義指標

---

## 🔍 已知限制

1. **yfinance 數據穩定性**
   - Yahoo Finance API 可能不穩定
   - 需要監控 API 可用性
   - 建議實作多重資料源備援（未來）

2. **模型預測延遲**
   - 需要 20 個時間序列數據點
   - 冷啟動時需要累積數據
   - 預測延遲約 1-2 秒

3. **前端即時更新**
   - WebSocket 連接尚未完全測試
   - 信號更新可能有延遲

---

## 💡 下次開發建議

### 立即處理

1. **修復 ML API import 錯誤** (最高優先級)
   ```bash
   cd /root/AIFX_v2/ml_engine
   # 檢查模組路徑
   python -c "import sys; print(sys.path)"
   # 測試 import
   python -c "from api import model_manager"
   ```

2. **測試 reversal prediction**
   ```bash
   curl -X POST http://localhost:8000/reversal/predict \
     -H "Content-Type: application/json" \
     -d '{
       "pair": "EUR/USD",
       "timeframe": "1h",
       "data": [...]
     }'
   ```

3. **驗證 yfinance 連接**
   ```bash
   cd /root/AIFX_v2/ml_engine
   source venv/bin/activate
   python -c "import yfinance as yf; print(yf.Ticker('EURUSD=X').history(period='1d'))"
   ```

### 中期計劃

1. **完整端到端測試**
   - 測試 Frontend 發送請求
   - 驗證 Backend 處理邏輯
   - 確認 ML Engine 回應
   - 檢查 Discord 通知

2. **效能監控**
   - 設定 APM (Application Performance Monitoring)
   - 監控 API 回應時間
   - 追蹤錯誤率

3. **備份與恢復**
   - 定期備份模型檔案
   - 資料庫備份策略
   - 災難恢復計劃

---

## 📚 參考資源

### 重要檔案路徑

```
ML Engine:
- API Server: /root/AIFX_v2/ml_engine/api/ml_server.py
- Reversal API: /root/AIFX_v2/ml_engine/api/reversal_api.py
- Model Manager: /root/AIFX_v2/ml_engine/api/model_manager.py
- Training Script: /root/AIFX_v2/ml_engine/scripts/train_reversal_mode1.py
- Trained Model: /root/AIFX_v2/ml_engine/models/trained/reversal_mode1_model.h5

Backend:
- Forex Service: /root/AIFX_v2/backend/src/services/forexService.js
- Signal Service: /root/AIFX_v2/backend/src/services/tradingSignalService.js
- Notification Service: /root/AIFX_v2/backend/src/services/notificationService.js

Frontend:
- CandlestickChart: /root/AIFX_v2/frontend/src/components/CandlestickChart.jsx
- Dashboard: /root/AIFX_v2/frontend/src/pages/Dashboard.jsx
- TradingView: /root/AIFX_v2/frontend/src/pages/TradingView.jsx

Discord Bot:
- Bot Main: /root/AIFX_v2/discord_bot/bot.js

Configuration:
- ML Config: /root/AIFX_v2/ml_engine/config.yaml
- Backend .env: /root/AIFX_v2/backend/.env
- Frontend .env: /root/AIFX_v2/frontend/.env
```

### 環境變數

```env
# Backend
ML_API_URL=http://localhost:8000
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379

# ML Engine
ENVIRONMENT=development

# Discord Bot
REDIS_DB=2
```

### 啟動命令

```bash
# Backend
cd /root/AIFX_v2/backend && npm start

# Frontend
cd /root/AIFX_v2/frontend && npm run dev

# ML Engine
cd /root/AIFX_v2/ml_engine
export LD_PRELOAD=/usr/lib/aarch64-linux-gnu/libgomp.so.1
source venv/bin/activate
uvicorn api.ml_server:app --reload --host 0.0.0.0 --port 8000

# Discord Bot
cd /root/AIFX_v2/discord_bot && node bot.js
```

---

## 🎯 成功指標

當以下條件都滿足時，系統即可投入生產：

- [ ] ML API reversal 模組成功載入
- [ ] `/reversal/predict` 端點正常回應
- [ ] yfinance 可穩定獲取市場數據
- [ ] Frontend 顯示真實價格（非 mock data）
- [ ] Backend → ML Engine 完整流程測試通過
- [ ] Discord 通知功能正常
- [ ] 所有端點回應時間 < 2 秒
- [ ] 錯誤率 < 1%

---

## 📞 聯絡與支援

如有問題或需要協助：
1. 查看 session notes (本檔案)
2. 檢查 Git 提交歷史
3. 查看錯誤日誌：
   - ML API: `/tmp/ml_api.log`
   - Training: `/tmp/training_log3.txt`
   - Backend: backend logs
   - Frontend: browser console

---

**最後更新:** 2025-10-29 12:45 GMT+8
**下次 Session:** 繼續修復 ML API import 問題
