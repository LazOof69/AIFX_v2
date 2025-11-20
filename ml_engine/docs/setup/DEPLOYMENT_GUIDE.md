# ML API 部署指南

## 🎯 前置條件檢查

✅ **訓練完成**
```bash
# 檢查訓練好的模型
ls -lh /root/AIFX_v2/ml_engine/saved_models/*.h5

# 應該看到 3 個模型檔案（或更多）：
# forex_classifier_EURUSD_*.h5
# forex_classifier_GBPUSD_*.h5
# forex_classifier_USDJPY_*.h5
```

✅ **Python 環境**
```bash
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
python --version  # 應該是 Python 3.x
```

✅ **Redis 運行中**
```bash
redis-cli ping  # 應該返回 PONG
```

---

## 📋 部署步驟

### 步驟 1：啟動 ML API 服務器

**方法 A：使用部署腳本（推薦）**
```bash
cd /root/AIFX_v2/ml_engine
./deploy_ml_api.sh
# 選擇選項 2（screen 背景運行）
```

**方法 B：手動啟動**
```bash
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
screen -dmS ml_api uvicorn api.ml_server:app --host 0.0.0.0 --port 8000

# 查看日誌
screen -r ml_api
# 按 Ctrl+A 然後 D 離開
```

### 步驟 2：測試 ML API

```bash
cd /root/AIFX_v2/ml_engine
./test_ml_api.sh
```

預期輸出：
```
✓ Health Check 通過
✓ Model Info 通過
✓ Prediction 通過
```

### 步驟 3：配置 Apache 反向代理

**編輯 Apache 配置**：
```bash
sudo nano /etc/apache2/sites-available/000-default.conf
```

**在現有的 ProxyPass 配置之前添加**：
```apache
# ML API 代理（添加在 /api 配置之前）
ProxyPass /ml http://localhost:8000
ProxyPassReverse /ml http://localhost:8000
ProxyTimeout 60
```

完整配置範例：
```apache
<VirtualHost *:80>
    ServerAdmin webmaster@localhost
    DocumentRoot /var/www/html

    # ML API 代理
    ProxyPass /ml http://localhost:8000
    ProxyPassReverse /ml http://localhost:8000
    ProxyTimeout 60

    # 後端 API 代理
    ProxyPass /api http://localhost:3000/api
    ProxyPassReverse /api http://localhost:3000/api

    # 前端代理
    ProxyPass / http://localhost:5173/
    ProxyPassReverse / http://localhost:5173/

    # WebSocket 支持（Vite HMR）
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "ws://localhost:5173/$1" [P,L]
</VirtualHost>
```

**重載 Apache**：
```bash
sudo apachectl configtest  # 檢查配置語法
sudo systemctl reload apache2
```

### 步驟 4：測試 Apache 代理

```bash
# 測試本地訪問
curl http://localhost:8000/health
curl http://localhost/ml/health

# 測試外部訪問
curl http://168.138.182.181/ml/health
```

### 步驟 5：配置後端整合 ML API

**編輯後端環境變量**：
```bash
nano /root/AIFX_v2/backend/.env
```

**添加或修改**：
```env
# ML API 配置
ML_API_URL=http://localhost:8000
ML_API_ENABLED=true
```

**重啟後端服務**：
```bash
cd /root/AIFX_v2/backend
pm2 restart aifx-backend
# 或
pm2 restart all
```

### 步驟 6：修改後端代碼調用 ML API

**編輯 tradingSignals.js**：
```bash
nano /root/AIFX_v2/backend/src/services/tradingSignals.js
```

**添加 ML 預測函數**（參考代碼在下方）

### 步驟 7：端對端測試

**測試完整流程**：
```bash
# 1. 從前端登入
# 2. 查看交易信號頁面
# 3. 應該能看到 ML 增強的信號
```

---

## 🔧 後端整合代碼範例

在 `backend/src/services/tradingSignals.js` 中添加：

```javascript
const axios = require('axios');

/**
 * 從 ML API 獲取預測
 */
async function getMLPrediction(pair, marketData) {
  // 檢查 ML API 是否啟用
  if (!process.env.ML_API_ENABLED || process.env.ML_API_ENABLED !== 'true') {
    logger.info('ML API is disabled');
    return null;
  }

  try {
    const response = await axios.post(`${process.env.ML_API_URL}/predict`, {
      pair: pair,
      timeframe: '1h',
      data: marketData,
      add_indicators: true
    }, {
      timeout: 30000 // 30 秒超時
    });

    if (response.data.success) {
      return response.data.data;
    } else {
      logger.error('ML prediction failed:', response.data.error);
      return null;
    }
  } catch (error) {
    logger.error('ML API request failed:', error.message);
    return null;
  }
}

/**
 * 生成增強的交易信號（結合技術分析 + ML）
 */
async function generateEnhancedSignal(pair, marketData) {
  // 1. 獲取技術分析信號（原有邏輯）
  const technicalSignal = await calculateTechnicalSignal(pair, marketData);

  // 2. 獲取 ML 預測
  const mlPrediction = await getMLPrediction(pair, marketData);

  // 3. 如果 ML 不可用，返回純技術信號
  if (!mlPrediction) {
    return {
      ...technicalSignal,
      source: 'technical'
    };
  }

  // 4. 結合技術分析 + ML
  return {
    pair: pair,
    signal: mlPrediction.prediction, // 'buy', 'sell', 'hold'
    confidence: mlPrediction.confidence,
    predicted_price: mlPrediction.predicted_price,
    technical_signal: technicalSignal.signal,
    technical_confidence: technicalSignal.confidence,
    ml_factors: mlPrediction.factors,
    source: 'ml_enhanced',
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  getMLPrediction,
  generateEnhancedSignal
};
```

---

## 📊 驗證部署成功

### ✅ 檢查清單

- [ ] ML API 服務器運行在 port 8000
- [ ] `curl http://localhost:8000/health` 返回成功
- [ ] `curl http://168.138.182.181/ml/health` 返回成功（Apache 代理）
- [ ] 模型已載入（`model_loaded: true`）
- [ ] 後端 `.env` 配置正確
- [ ] 後端可以調用 ML API
- [ ] 前端顯示 ML 增強的信號

### 🔍 常見問題排查

**問題 1：ML API 啟動失敗**
```bash
# 檢查日誌
screen -r ml_api

# 檢查端口占用
lsof -i :8000

# 檢查模型路徑
ls -lh saved_models/
```

**問題 2：Apache 代理 502 錯誤**
```bash
# 檢查 ML API 是否運行
curl http://localhost:8000/health

# 檢查 Apache 錯誤日誌
sudo tail -f /var/log/apache2/error.log

# 檢查防火牆
sudo ufw status
```

**問題 3：後端調用 ML API 超時**
```bash
# 增加超時時間（在 axios 請求中）
timeout: 60000  # 60 秒

# 檢查網路連接
curl -v http://localhost:8000/health
```

---

## 🚀 服務管理命令

```bash
# 啟動 ML API
cd /root/AIFX_v2/ml_engine
./deploy_ml_api.sh

# 停止 ML API
screen -X -S ml_api quit

# 查看 ML API 日誌
screen -r ml_api

# 重啟 ML API
screen -X -S ml_api quit
screen -dmS ml_api bash -c "cd /root/AIFX_v2/ml_engine && source venv/bin/activate && uvicorn api.ml_server:app --host 0.0.0.0 --port 8000"

# 測試 ML API
cd /root/AIFX_v2/ml_engine
./test_ml_api.sh
```

---

## 📈 預期 API 結構（部署完成後）

```
http://168.138.182.181/
├── /                    → 前端 (React + Vite)
├── /api/v1/            → 後端 API (Node.js + Express)
│   ├── /auth
│   ├── /trading
│   ├── /market
│   └── /notifications
└── /ml/                → ML API (Python + FastAPI) ★ 新增
    ├── /health
    ├── /predict
    ├── /train
    └── /model/info
```

---

## 🎉 部署完成

恭喜！ML 引擎現在已經完全整合到 AIFX v2 系統中。

**下一步**：
1. 監控 ML 預測準確率
2. 根據實際表現調整模型參數
3. 收集更多數據重新訓練
4. 實現多模態數據整合（新聞、經濟數據）

**監控指標**：
- ML API 響應時間 < 2 秒
- 預測準確率 > 60%
- API 可用性 > 99%
