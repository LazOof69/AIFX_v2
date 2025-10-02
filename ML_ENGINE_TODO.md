# ML 引擎設置任務清單

**創建日期**: 2025-10-02
**狀態**: 未開始

---

## 📊 當前系統狀態

### ✅ 已運行的服務
- **前端**: http://144.24.41.178 (Vite on port 5173, proxied by Apache)
- **後端**: http://144.24.41.178/api (port 3000, proxied by Apache)
- **PostgreSQL**: Running
- **Redis**: port 6379
- **Apache**: port 80 (反向代理)

### ⏸️ 待啟動的服務
- **ML API**: port 8000 (FastAPI + LSTM 模型)

---

## 🎯 ML 引擎完整設置流程

### 階段 1：Python 環境設置

#### 1. 安裝 Python pip
```bash
sudo apt update
sudo apt install python3-pip -y
python3 -m pip --version
```

#### 2. 創建虛擬環境
```bash
cd /root/AIFX_v2/ml_engine
python3 -m venv venv
source venv/bin/activate
```

#### 3. 安裝 Python 依賴
```bash
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
pip install -r requirements.txt
```

**主要依賴：**
- tensorflow>=2.10.0
- fastapi>=0.100.0
- uvicorn>=0.23.0
- scikit-learn>=1.0.0
- numpy, pandas, scipy
- redis>=4.0.0

#### 4. 創建必要目錄
```bash
cd /root/AIFX_v2/ml_engine
mkdir -p saved_models checkpoints logs metrics backups
```

#### 5. 配置環境變量
```bash
cd /root/AIFX_v2/ml_engine
cp .env.example .env
# 編輯 .env 文件
```

**需要設置的環境變量：**
```env
REDIS_URL=redis://localhost:6379
REDIS_DB=1
ENVIRONMENT=development
LOG_LEVEL=INFO
```

#### 6. 更新 CORS 配置
編輯 `/root/AIFX_v2/ml_engine/config.yaml`:
```yaml
api:
  cors_origins:
    - "http://localhost:3000"
    - "http://localhost:5173"
    - "http://144.24.41.178"      # 添加這行
    - "http://10.0.0.199"          # 添加這行
```

---

### 階段 2：模型訓練

#### 7. 準備訓練數據

需要從 Forex API 獲取歷史數據（至少 100 個數據點）：

```javascript
// 在後端創建一個腳本來獲取歷史數據
// 格式範例：
{
  "pair": "EUR/USD",
  "data": [
    {
      "timestamp": "2025-01-15T10:00:00Z",
      "open": 1.0850,
      "high": 1.0865,
      "low": 1.0845,
      "close": 1.0860,
      "volume": 1000
    },
    // ... 至少 100 個數據點
  ]
}
```

#### 8. 訓練初始模型

**方法 1：通過 API 訓練**
```bash
curl -X POST "http://localhost:8000/train" \
  -H "Content-Type: application/json" \
  -d @training_data.json
```

**方法 2：直接運行 Python 腳本**
```python
# 創建訓練腳本
from models.price_predictor import PricePredictor
from data_processing.preprocessor import DataPreprocessor

# 載入配置和數據
# 訓練模型
# 保存模型
```

---

### 階段 3：服務啟動與整合

#### 9. 啟動 ML API 服務器

**使用 screen 在背景運行：**
```bash
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
screen -dmS ml_api uvicorn api.ml_server:app --host 0.0.0.0 --port 8000
```

**檢查狀態：**
```bash
screen -list
curl http://localhost:8000/health
```

#### 10. 配置後端環境變量

編輯 `/root/AIFX_v2/backend/.env`，添加：
```env
ML_API_URL=http://localhost:8000
ML_API_ENABLED=true
```

#### 11. 更新後端代碼整合 ML 服務

需要修改的文件：
- `/root/AIFX_v2/backend/src/services/tradingSignals.js`
- 添加 ML 預測調用邏輯

**整合範例：**
```javascript
const axios = require('axios');

async function getMLPrediction(pair, marketData) {
  if (!process.env.ML_API_ENABLED) return null;

  try {
    const response = await axios.post(`${process.env.ML_API_URL}/predict`, {
      pair: pair,
      timeframe: '1h',
      data: marketData,
      add_indicators: true
    });

    return response.data;
  } catch (error) {
    logger.error('ML prediction failed:', error);
    return null;
  }
}
```

#### 12. 配置 Apache 代理 ML API

編輯 `/etc/apache2/sites-available/000-default.conf`:
```apache
# 在現有的 ProxyPass 配置之前添加
ProxyPass /ml http://localhost:8000
ProxyPassReverse /ml http://localhost:8000
```

重啟 Apache：
```bash
sudo apachectl configtest
sudo systemctl reload apache2
```

---

### 階段 4：測試驗證

#### 13. 測試 ML API 端點

**健康檢查：**
```bash
curl http://localhost:8000/health
curl http://144.24.41.178/ml/health
```

**預測測試：**
```bash
curl -X POST "http://localhost:8000/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "pair": "EUR/USD",
    "timeframe": "1h",
    "data": [...],
    "add_indicators": true
  }'
```

**模型信息：**
```bash
curl http://localhost:8000/model/info
```

#### 14. 端對端整合測試

1. 從前端發起請求
2. 後端接收並調用 ML API
3. ML 引擎返回預測結果
4. 後端整合預測到交易信號
5. 前端顯示最終信號

**檢查點：**
- [ ] ML API 健康檢查正常
- [ ] 預測 API 返回正確格式
- [ ] 後端成功調用 ML API
- [ ] 前端顯示 ML 增強的信號

---

## 📋 完成檢查清單

- [ ] 1. 安裝 Python pip 套件管理器
- [ ] 2. 在 ml_engine 目錄創建 Python 虛擬環境
- [ ] 3. 安裝 ML 引擎的 Python 依賴
- [ ] 4. 創建必要的目錄
- [ ] 5. 配置 ml_engine/.env 文件
- [ ] 6. 更新 config.yaml 的 CORS 設置
- [ ] 7. 準備歷史市場數據（至少100個數據點）
- [ ] 8. 訓練初始 LSTM 模型
- [ ] 9. 啟動 ML API 服務器（port 8000）
- [ ] 10. 配置後端 .env 添加 ML_API_URL
- [ ] 11. 更新後端代碼整合 ML 預測服務
- [ ] 12. 配置 Apache 代理 ML API
- [ ] 13. 測試 ML API 端點
- [ ] 14. 測試端對端整合

---

## 🔍 重要參考文件

- **ML README**: `/root/AIFX_v2/ml_engine/README.md`
- **配置文件**: `/root/AIFX_v2/ml_engine/config.yaml`
- **依賴清單**: `/root/AIFX_v2/ml_engine/requirements.txt`
- **API 服務器**: `/root/AIFX_v2/ml_engine/api/ml_server.py`
- **模型文件**: `/root/AIFX_v2/ml_engine/models/price_predictor.py`
- **預處理器**: `/root/AIFX_v2/ml_engine/data_processing/preprocessor.py`

---

## 🚀 快速啟動命令（設置完成後）

```bash
# 啟動 ML API 服務器
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
screen -dmS ml_api uvicorn api.ml_server:app --host 0.0.0.0 --port 8000

# 查看日誌
screen -r ml_api

# 停止服務
screen -X -S ml_api quit
```

---

## 📊 預期的 API 結構

設置完成後，完整的 API 結構：

```
http://144.24.41.178/
├── /                    → 前端 (Vite/React)
├── /api/v1/            → 後端 API (Node.js/Express)
│   ├── /auth
│   ├── /trading
│   ├── /market
│   └── /notifications
└── /ml/                → ML API (Python/FastAPI)
    ├── /health
    ├── /predict
    ├── /train
    └── /model/info
```

---

**下次對話時**，只需執行：
```bash
cat /root/AIFX_v2/ML_ENGINE_TODO.md
```
就可以看到完整的待辦事項！
