# AIFX v2 完整設置指南

## 當前狀態

### ✅ 已完成
- PostgreSQL & Redis 已安裝並運行
- Node.js & Python 環境已準備
- 數據庫 schema 已創建（18 個表）
- ML 訓練數據都還在（280MB CSV 文件）
- 已訓練的模型文件都保留

### ⚠️ 需要注意
- 數據庫是**全新的**（沒有歷史交易記錄）
- 需要創建測試用戶
- 需要設置生產環境模型
- 服務尚未啟動

---

## 📋 完整操作步驟

### Step 1: 創建生產環境模型目錄

```bash
cd /root/AIFX_v2/ml_engine

# 創建 production 目錄
mkdir -p models/production

# 複製最新的模型到 production（選擇最佳模型）
# 檢查可用模型
ls -lh checkpoints/
ls -lh models/checkpoints/

# 假設使用最新的 checkpoint（根據實際情況選擇）
# 例如：
cp checkpoints/model_checkpoint_20251007_134915.h5 models/production/forex_model_v1.0.0.h5
cp data/training_v3_profitable/EURUSD_scaler_*.pkl models/production/
```

### Step 2: 創建測試用戶和初始數據

```bash
cd /root/AIFX_v2/backend

# 創建種子數據腳本
cat > database/seeders/20251022000001-demo-users.js << 'EOF'
'use strict';
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash('password123', 10);

    // 創建測試用戶
    await queryInterface.bulkInsert('users', [{
      id: userId,
      username: 'testuser',
      email: 'test@example.com',
      password_hash: passwordHash,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }]);

    // 創建用戶偏好設置
    await queryInterface.bulkInsert('user_preferences', [{
      id: uuidv4(),
      user_id: userId,
      trading_frequency: 'daytrading',
      risk_level: 5,
      preferred_pairs: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
      trading_style: 'mixed',
      indicators: {
        sma: { enabled: true, period: 20 },
        rsi: { enabled: true, period: 14 },
        macd: { enabled: true },
        bb: { enabled: false, period: 20 }
      },
      notification_settings: {
        email: true,
        discord: false,
        browser: true,
        signalTypes: { buy: true, sell: true, hold: false },
        minConfidence: 70
      },
      created_at: new Date(),
      updated_at: new Date()
    }]);

    console.log('✅ Demo user created:');
    console.log('   Email: test@example.com');
    console.log('   Password: password123');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('user_preferences', null, {});
    await queryInterface.bulkDelete('users', null, {});
  }
};
EOF

# 運行種子數據
npx sequelize-cli db:seed:all
```

### Step 3: 創建初始模型版本記錄

```bash
# 在 PostgreSQL 中創建模型版本記錄
sudo -u postgres psql -d aifx_v2_dev << 'EOF'
INSERT INTO model_versions (
  id,
  version_name,
  model_type,
  model_file_path,
  status,
  performance_metrics,
  training_config,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'v1.0.0',
  'full',
  '/root/AIFX_v2/ml_engine/models/production/forex_model_v1.0.0.h5',
  'production',
  '{"accuracy": 0.75, "precision": 0.72, "recall": 0.78}',
  '{"epochs": 50, "batch_size": 32, "learning_rate": 0.001}',
  NOW(),
  NOW()
);

-- 查看創建的版本
SELECT version_name, status, model_file_path FROM model_versions;
EOF
```

### Step 4: 啟動所有服務

```bash
cd /root/AIFX_v2

# 給予執行權限（如果還沒有）
chmod +x start-all-services.sh
chmod +x stop-all-services.sh
chmod +x check-services.sh

# 啟動所有服務
./start-all-services.sh

# 等待 10 秒讓服務啟動
sleep 10

# 檢查服務狀態
./check-services.sh
```

預期輸出：
```
Backend:   ✓ Running (tmux)  ✓ Responding
Frontend:  ✓ Running (tmux)  ✓ Responding
ML Engine: ✓ Running (tmux)  ✓ Responding
```

### Step 5: 測試系統

```bash
# 測試 Backend API
curl http://localhost:3000/api/v1/health

# 測試 ML Engine
curl http://localhost:8000/health

# 測試用戶登入
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "test@example.com", "password": "password123"}'
```

### Step 6: 訪問前端應用

打開瀏覽器：
- **Frontend**: http://localhost:5173
- **Backend API Docs**: http://localhost:3000/api/v1
- **ML Engine Docs**: http://localhost:8000/docs

登入資訊：
- Email: `test@example.com`
- Password: `password123`

### Step 7: 設置 Cron Jobs（持續學習）

```bash
# 編輯 crontab
crontab -e

# 添加以下行：
# 每日增量訓練 - UTC 01:00 (台北時間 09:00)
0 1 * * * /root/AIFX_v2/ml_engine/cron/daily_training.sh >> /root/AIFX_v2/ml_engine/logs/daily_training_cron.log 2>&1

# 每週完整訓練 - 每週日 UTC 01:00
0 1 * * 0 /root/AIFX_v2/ml_engine/cron/weekly_training.sh >> /root/AIFX_v2/ml_engine/logs/weekly_training_cron.log 2>&1

# 保存並退出（按 Ctrl+O, Enter, Ctrl+X）
```

驗證 cron jobs：
```bash
crontab -l
```

### Step 8: 查看服務日誌

**Backend 日誌：**
```bash
tmux attach -t aifx-backend
# 按 Ctrl+B 然後 D 退出（不停止服務）
```

**Frontend 日誌：**
```bash
tmux attach -t aifx-frontend
```

**ML Engine 日誌：**
```bash
tmux attach -t aifx-ml
```

**或查看日誌文件：**
```bash
# Backend
tail -f /root/AIFX_v2/backend/logs/combined.log

# ML Engine
tail -f /root/AIFX_v2/ml_engine/logs/ml_server.log

# Daily Training
tail -f /root/AIFX_v2/ml_engine/logs/daily_training.log
```

---

## 🔄 數據遷移（如果有舊數據庫備份）

如果你有舊電腦的數據庫備份，可以這樣遷移：

### 在舊電腦上導出：
```bash
# 導出整個數據庫
pg_dump -U postgres -d aifx_v2_dev > /tmp/aifx_backup.sql

# 或只導出特定表
pg_dump -U postgres -d aifx_v2_dev \
  -t users \
  -t trading_signals \
  -t user_trading_history \
  > /tmp/aifx_data_backup.sql
```

### 在新電腦上導入：
```bash
# 複製備份文件到新電腦，然後：
sudo -u postgres psql -d aifx_v2_dev < /tmp/aifx_backup.sql

# 或
cat /tmp/aifx_data_backup.sql | sudo -u postgres psql -d aifx_v2_dev
```

---

## 📊 持續學習系統運作方式

### 自動訓練流程

**每日增量訓練（UTC 01:00）：**
1. 從數據庫提取最近 24 小時的交易信號
2. 自動標註信號結果（win/loss/breakeven）
3. 加載當前生產模型
4. Fine-tuning（5 epochs, LR=0.0001）
5. 創建 ModelVersion（狀態：staging）
6. 發布 Redis 事件通知

**每週完整訓練（週日 UTC 01:00）：**
1. 從數據庫提取最近 30 天數據
2. 重新訓練整個模型（50 epochs）
3. 評估性能指標
4. 如果優於當前生產模型，升級為 production
5. 歸檔舊模型

### 手動觸發訓練

**測試日常訓練：**
```bash
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
python scripts/daily_incremental_training.py
```

**測試每週訓練：**
```bash
python scripts/weekly_full_training.py
```

---

## 🛠️ 常用管理命令

### 服務管理
```bash
# 啟動所有服務
./start-all-services.sh

# 停止所有服務
./stop-all-services.sh

# 檢查服務狀態
./check-services.sh

# 查看 tmux 會話
tmux list-sessions

# 連接到特定服務
tmux attach -t aifx-backend
tmux attach -t aifx-frontend
tmux attach -t aifx-ml
```

### 數據庫管理
```bash
# 連接到數據庫
sudo -u postgres psql -d aifx_v2_dev

# 查看所有表
\dt

# 查看特定表記錄數
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM trading_signals;
SELECT COUNT(*) FROM model_versions;

# 查看最新的訓練日誌
SELECT * FROM model_training_logs ORDER BY started_at DESC LIMIT 5;

# 查看生產環境模型
SELECT version_name, status, accuracy, created_at
FROM model_versions
WHERE status = 'production';
```

### 日誌查看
```bash
# 實時查看 Backend 日誌
tail -f /root/AIFX_v2/backend/logs/combined.log

# 實時查看 ML Engine 日誌
tail -f /root/AIFX_v2/ml_engine/logs/ml_server.log

# 查看訓練日誌
tail -f /root/AIFX_v2/ml_engine/logs/daily_training.log
tail -f /root/AIFX_v2/ml_engine/logs/weekly_training.log

# 查看最近 100 行錯誤
grep ERROR /root/AIFX_v2/backend/logs/combined.log | tail -100
```

---

## 🔍 故障排除

### Backend 無法啟動
```bash
# 檢查 PostgreSQL
sudo systemctl status postgresql

# 檢查數據庫連接
sudo -u postgres psql -d aifx_v2_dev -c "SELECT 1"

# 查看 Backend 錯誤日誌
cd /root/AIFX_v2/backend
npm run dev  # 前台運行查看錯誤
```

### ML Engine 無法啟動
```bash
# 檢查 Python 環境
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
python --version
pip list | grep tensorflow

# 測試 ML API
python -c "from api.ml_server import app; print('Import successful')"

# 前台運行
uvicorn api.ml_server:app --reload --host 0.0.0.0 --port 8000
```

### Redis 連接失敗
```bash
# 檢查 Redis 服務
sudo systemctl status redis-server

# 測試連接
redis-cli ping  # 應返回 PONG

# 重啟 Redis
sudo systemctl restart redis-server
```

### 模型預測失敗
```bash
# 檢查模型文件是否存在
ls -lh /root/AIFX_v2/ml_engine/models/production/

# 檢查數據庫中的模型版本
sudo -u postgres psql -d aifx_v2_dev -c \
  "SELECT version_name, status, model_file_path FROM model_versions WHERE status='production';"

# 手動測試模型加載
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
python -c "
from tensorflow import keras
model = keras.models.load_model('models/production/forex_model_v1.0.0.h5')
print('Model loaded successfully')
print('Input shape:', model.input_shape)
print('Output shape:', model.output_shape)
"
```

---

## ✅ 安裝完成檢查清單

```
[ ] PostgreSQL 正在運行
[ ] Redis 正在運行
[ ] 數據庫有 18 個表
[ ] 測試用戶已創建
[ ] 模型文件已複製到 production/
[ ] 模型版本已註冊到數據庫
[ ] Backend 啟動成功（http://localhost:3000）
[ ] Frontend 啟動成功（http://localhost:5173）
[ ] ML Engine 啟動成功（http://localhost:8000）
[ ] 可以登入前端應用
[ ] Cron jobs 已設置（持續學習）
[ ] 日誌文件正常寫入
```

---

## 📚 相關文檔

- **快速開始**: `START_HERE.md`
- **系統狀態**: `SYSTEM_STATUS_REPORT.md`
- **持續學習進度**: `CONTINUOUS_LEARNING_PROGRESS.md`
- **Cron 設置**: `CRON_SETUP.md`
- **API 文檔**: `README.md`

---

## 🎯 下一步建議

1. **啟動服務** - 運行 `./start-all-services.sh`
2. **創建測試用戶** - 按照 Step 2 創建
3. **訪問應用** - http://localhost:5173
4. **開始交易** - 系統會自動生成信號並學習
5. **監控訓練** - 每日/每週自動訓練會記錄到數據庫

**系統現在已經完全就緒！** 🚀
