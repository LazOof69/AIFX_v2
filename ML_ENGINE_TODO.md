# ML 引擎設置任務清單

**最後更新**: 2025-10-07 05:24
**當前狀態**: ✅ 訓練中 - Scaler 修復完成，EURUSD 模型正在訓練

---

## 🎯 **當前進度總覽**

### ✅ **已完成**
- [x] Python 環境設置 (venv)
- [x] 依賴安裝 (TensorFlow, FastAPI, scikit-learn)
- [x] 數據收集 (yfinance - 20+ 年數據)
- [x] 特徵工程 (28 個技術指標)
- [x] 模型訓練準備 (EURUSD/GBPUSD/USDJPY)
- [x] **Scaler 保存/載入功能修復** ✨
- [x] **模型訓練優化** (class_weight, 150 epochs, patience 15) ✨
- [x] ML API 初始化邏輯更新 ✨

### 🔄 **進行中**
- [ ] **EURUSD 模型重新訓練** (使用優化參數 + scaler 保存)
  - Screen session: `eurusd_training`
  - 預計完成時間: 15-30 分鐘
  - Log: `/root/AIFX_v2/ml_engine/logs/eurusd_training_20251007_051718.log`

### ⏳ **待完成**
- [ ] 測試 ML API 預測功能 (scaler 載入驗證)
- [ ] 訓練其他貨幣對 (GBPUSD, USDJPY)
- [ ] 配置 Apache 反向代理 (/ml)
- [ ] 後端整合 ML API
- [ ] 端對端測試

---

## 🚨 **重要：上次修復的問題**

### ❌ **舊問題：Scaler 未保存**
```
錯誤: MinMaxScaler instance is not fitted yet
原因: 訓練時沒有保存 fitted scaler
影響: 預測時無法正確縮放數據
```

### ✅ **已修復**
1. **preprocessor.py**: 添加 `save_scaler()` 和 `load_scaler()` 方法
2. **price_predictor.py**:
   - `save_model(preprocessor=...)` 現在會保存 scaler
   - `load_model(..., preprocessor=...)` 現在會載入 scaler
3. **ml_server.py**: 初始化時傳入 preprocessor 載入 scaler
4. **訓練優化**:
   - 自動計算 class_weight 處理類別不平衡
   - Epochs: 100 → 150
   - Early stopping patience: 10 → 15

---

## 📊 **當前系統狀態**

### ✅ **運行中的服務**
```bash
screen -ls
# 2051407.eurusd_training  (訓練中)
# 2049137.ml_api           (運行中, 但尚未載入新模型)
# 1776712.backend          (運行中)
# 1751201.vite             (運行中)
```

### 📁 **目錄結構**
```
/root/AIFX_v2/ml_engine/
├── saved_models/
│   ├── forex_classifier_EURUSD_*.h5       (舊模型 - 無 scaler)
│   ├── forex_classifier_GBPUSD_*.h5       (舊模型 - 無 scaler)
│   ├── forex_classifier_USDJPY_*.h5       (舊模型 - 無 scaler)
│   └── [等待] 新的 EURUSD 模型 + scaler.pkl
├── data/training/
│   ├── EURUSD_X_train.npy (56M)
│   ├── EURUSD_y_train.npy (34K)
│   └── ... (GBPUSD, USDJPY)
├── logs/
│   └── eurusd_training_20251007_051718.log (訓練中)
└── train_eurusd_test.py (新訓練腳本)
```

---

## 🔄 **接下來要做的步驟**

### **步驟 1: 檢查訓練結果** ⏰ (15-30 分鐘後)

```bash
# 1. 檢查訓練是否完成
screen -ls | grep eurusd_training

# 2. 查看訓練輸出
screen -r eurusd_training
# 按 Ctrl+A 然後 D 離開

# 3. 或查看日誌
tail -100 /root/AIFX_v2/ml_engine/logs/eurusd_training_20251007_051718.log

# 4. 確認模型和 scaler 已保存
cd /root/AIFX_v2/ml_engine
ls -lth saved_models/*.h5 | head -1
ls -lth saved_models/*_scaler.pkl | head -1

# ✅ 預期看到:
# price_predictor_v1.0.0_20251007_*.h5
# price_predictor_v1.0.0_20251007_*_scaler.pkl
```

---

### **步驟 2: 重啟 ML API 載入新模型**

```bash
cd /root/AIFX_v2/ml_engine

# 停止舊的 ML API
screen -X -S ml_api quit

# 啟動新的 ML API (會自動載入最新模型和 scaler)
screen -dmS ml_api bash -c "source venv/bin/activate && uvicorn api.ml_server:app --host 0.0.0.0 --port 8000"

# 等待啟動
sleep 3

# 檢查健康狀態
curl http://localhost:8000/health | python3 -m json.tool

# ✅ 預期看到:
# {
#   "status": "healthy",
#   "model_loaded": true,  ← 必須是 true
#   "model_version": "1.0.0",
#   ...
# }
```

---

### **步驟 3: 測試預測功能** 🎯

```bash
cd /root/AIFX_v2/ml_engine

# 運行測試腳本
./test_ml_api.sh

# ✅ 預期結果:
# [1/4] 健康檢查... ✓ 通過
# [2/4] 根端點... ✓ 通過
# [3/4] 模型信息... ✓ 通過
# [4/4] 預測測試... ✓ 通過
#
# 預測結果應該包含:
# {
#   "success": true,
#   "data": {
#     "prediction": "buy" | "sell" | "hold",
#     "confidence": 0.0-1.0,
#     "predicted_price": ...,
#     ...
#   }
# }
```

---

### **步驟 4: (可選) 訓練其他貨幣對**

```bash
cd /root/AIFX_v2/ml_engine
source venv/bin/activate

# 訓練 GBPUSD (在背景)
screen -dmS gbpusd_training bash -c "python -c '
import sys
sys.path.insert(0, \"/root/AIFX_v2/ml_engine\")
from train_eurusd_test import main
main()
' 2>&1 | tee logs/gbpusd_training_\$(date +%Y%m%d_%H%M%S).log"

# 或使用原始訓練腳本訓練全部
screen -dmS train_all bash -c "source venv/bin/activate && python scripts/train_classifier.py 2>&1 | tee logs/train_all_\$(date +%Y%m%d_%H%M%S).log"
```

---

### **步驟 5: 配置 Apache 反向代理**

```bash
# 編輯 Apache 配置
sudo nano /etc/apache2/sites-available/000-default.conf

# 在 ProxyPass /api 之前添加:
# ML API 代理
ProxyPass /ml http://localhost:8000
ProxyPassReverse /ml http://localhost:8000
ProxyTimeout 60

# 檢查配置語法
sudo apachectl configtest

# 重載 Apache
sudo systemctl reload apache2

# 測試外部訪問
curl http://144.24.41.178/ml/health
```

---

### **步驟 6: 整合後端 API**

```bash
# 1. 配置後端環境變量
nano /root/AIFX_v2/backend/.env

# 添加:
ML_API_URL=http://localhost:8000
ML_API_ENABLED=true

# 2. 修改 tradingSignals.js (參考 DEPLOYMENT_GUIDE.md)
nano /root/AIFX_v2/backend/src/services/tradingSignals.js

# 3. 重啟後端
cd /root/AIFX_v2/backend
pm2 restart aifx-backend
```

---

## 🐛 **故障排查**

### **問題 1: 訓練失敗**
```bash
# 檢查日誌
tail -100 /root/AIFX_v2/ml_engine/logs/eurusd_training_*.log

# 檢查 GPU/內存
nvidia-smi  # 如果有 GPU
free -h     # 內存使用

# 手動重新訓練
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
python train_eurusd_test.py
```

### **問題 2: ML API 啟動失敗**
```bash
# 檢查 screen 輸出
screen -r ml_api

# 檢查端口占用
lsof -i :8000

# 查看詳細日誌
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
uvicorn api.ml_server:app --host 0.0.0.0 --port 8000 --log-level debug
```

### **問題 3: 預測失敗 (Scaler 錯誤)**
```bash
# 檢查 scaler 是否存在
ls -la saved_models/*_scaler.pkl

# 檢查 ML API 日誌
screen -r ml_api

# 如果 scaler 不存在，重新訓練
python train_eurusd_test.py
```

### **問題 4: 模型準確率太低**
```bash
# 調整訓練參數
nano /root/AIFX_v2/ml_engine/config.yaml

# 修改:
training:
  epochs: 200              # 增加 epochs
  early_stopping_patience: 20  # 增加 patience

# 或收集更多數據
python scripts/collect_yfinance_data.py
```

---

## 📋 **完整檢查清單**

### 環境設置 ✅
- [x] Python 虛擬環境
- [x] 依賴安裝 (TensorFlow, FastAPI, etc.)
- [x] 目錄結構創建
- [x] 環境變量配置

### 數據準備 ✅
- [x] yfinance 數據收集 (20+ 年)
- [x] 特徵工程 (28 個指標)
- [x] 訓練數據準備 (3 個貨幣對)

### Scaler 修復 ✅
- [x] preprocessor.py 添加 save/load 方法
- [x] price_predictor.py 支持 scaler
- [x] ml_server.py 載入 scaler
- [x] 訓練腳本更新

### 模型訓練優化 ✅
- [x] Class weight 自動計算
- [x] Epochs 增加到 150
- [x] Early stopping patience 增加到 15

### 待完成
- [ ] EURUSD 模型訓練完成
- [ ] ML API 重啟 (載入新模型)
- [ ] 預測功能測試
- [ ] Apache 反向代理配置
- [ ] 後端整合
- [ ] 端對端測試

---

## 📚 **重要文件參考**

### 文檔
- **部署指南**: `/root/AIFX_v2/ml_engine/DEPLOYMENT_GUIDE.md`
- **數據收集指南**: `/root/AIFX_v2/ml_engine/DATA_COLLECTION_GUIDE.md`
- **ML 策略文檔**: `/root/AIFX_v2/ml_engine/ML_DATA_STRATEGY.md`

### 代碼
- **訓練腳本**: `/root/AIFX_v2/ml_engine/train_eurusd_test.py`
- **ML API**: `/root/AIFX_v2/ml_engine/api/ml_server.py`
- **模型**: `/root/AIFX_v2/ml_engine/models/price_predictor.py`
- **預處理器**: `/root/AIFX_v2/ml_engine/data_processing/preprocessor.py`

### 配置
- **ML 配置**: `/root/AIFX_v2/ml_engine/config.yaml`
- **環境變量**: `/root/AIFX_v2/ml_engine/.env`

### 腳本
- **部署腳本**: `/root/AIFX_v2/ml_engine/deploy_ml_api.sh`
- **測試腳本**: `/root/AIFX_v2/ml_engine/test_ml_api.sh`

---

## 🚀 **快速命令參考**

### 檢查訓練狀態
```bash
screen -ls | grep training
tail -f /root/AIFX_v2/ml_engine/logs/eurusd_training_*.log
```

### 重啟 ML API
```bash
cd /root/AIFX_v2/ml_engine
screen -X -S ml_api quit
screen -dmS ml_api bash -c "source venv/bin/activate && uvicorn api.ml_server:app --host 0.0.0.0 --port 8000"
```

### 測試預測
```bash
cd /root/AIFX_v2/ml_engine
./test_ml_api.sh
```

### 查看所有 screen
```bash
screen -ls
```

### 進入 screen
```bash
screen -r eurusd_training  # 訓練
screen -r ml_api           # ML API
```

---

## 📊 **預期的最終 API 結構**

```
http://144.24.41.178/
├── /                    → 前端 (React + Vite)
├── /api/v1/            → 後端 API (Node.js + Express)
│   ├── /auth
│   ├── /trading
│   ├── /market
│   └── /notifications
└── /ml/                → ML API (Python + FastAPI) ★
    ├── /health
    ├── /predict
    ├── /train
    └── /model/info
```

---

## 💡 **下次開啟 Claude Code 時**

1. **檢查訓練狀態**:
   ```bash
   cat /root/AIFX_v2/ML_ENGINE_TODO.md
   screen -ls
   ```

2. **繼續從步驟 1 開始** (檢查訓練結果)

3. **如果訓練已完成**，執行步驟 2-3 (重啟 ML API + 測試)

---

**最後更新**: 2025-10-07 05:24
**訓練預計完成時間**: ~2025-10-07 05:45
**訓練 screen**: `eurusd_training`
**訓練日誌**: `logs/eurusd_training_20251007_051718.log`
