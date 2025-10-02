# AIFX v2 - 完整測試指南

## 概述

本指南提供所有 10 個開發階段的完整測試步驟，確保系統各個部分正常運作。

---

## 前置準備

### 1. 安裝必要服務

```bash
# 檢查 Node.js 版本
node --version  # 應該 >= 18.0.0

# 檢查 npm 版本
npm --version

# 安裝 PostgreSQL (如果尚未安裝)
# Windows: 下載 https://www.postgresql.org/download/windows/
# WSL/Linux:
sudo apt update
sudo apt install postgresql postgresql-contrib

# 啟動 PostgreSQL
sudo service postgresql start

# 安裝 Redis (如果尚未安裝)
# WSL/Linux:
sudo apt install redis-server
sudo service redis-server start

# Windows: 下載 https://github.com/microsoftarchive/redis/releases
```

### 2. 檢查服務狀態

```bash
# 檢查 PostgreSQL
sudo -u postgres psql -c "SELECT version();"

# 檢查 Redis
redis-cli ping  # 應返回 PONG
```

---

## Phase 1: 專案初始化測試

### 測試目標
驗證專案結構和基本配置是否正確。

### 測試步驟

```bash
# 1. 檢查專案結構
cd "/mnt/c/Users/butte/OneDrive/桌面/code projects/AIFX_v2"
ls -la

# 應該看到:
# - backend/
# - frontend/
# - ml_engine/
# - discord_bot/
# - CLAUDE.md
# - README.md

# 2. 檢查 backend 結構
cd backend
ls -la src/

# 應該看到:
# - config/
# - controllers/
# - middleware/
# - models/
# - routes/
# - services/
# - utils/
# - app.js
# - server.js

# 3. 檢查依賴是否已安裝
ls node_modules/ | wc -l  # 應該有大量的模組

# 4. 檢查環境變數
cat .env

# 應該包含:
# - NODE_ENV
# - PORT
# - DATABASE_URL
# - JWT_SECRET
# 等等
```

### 預期結果
- ✅ 所有目錄結構存在
- ✅ 依賴已安裝
- ✅ 環境變數已配置

---

## Phase 2: 資料庫模型測試

### 測試目標
驗證 Sequelize 模型定義正確。

### 測試步驟

```bash
cd backend

# 1. 檢查模型文件
ls src/models/

# 應該看到:
# - User.js
# - UserPreference.js
# - TradingSignal.js
# - Notification.js
# - (其他模型)

# 2. 驗證模型語法
node -e "require('./src/models/User')" && echo "User model OK"
node -e "require('./src/models/UserPreference')" && echo "UserPreference model OK"
node -e "require('./src/models/TradingSignal')" && echo "TradingSignal model OK"

# 3. 檢查關聯定義
grep -r "hasMany\|belongsTo\|hasOne" src/models/
```

### 預期結果
- ✅ 所有模型文件存在
- ✅ 模型語法正確
- ✅ 關聯正確定義

---

## Phase 3: 認證系統測試

### 測試目標
驗證 JWT 認證、註冊、登入功能。

### 測試步驟

```bash
cd backend

# 1. 檢查認證相關文件
ls src/middleware/auth.js
ls src/controllers/authController.js
ls src/routes/auth.js

# 2. 運行認證測試
npm test -- auth.test.js

# 3. 手動測試 API (需要先啟動服務器)
# Terminal 1: 啟動服務器
npm run dev

# Terminal 2: 測試註冊
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test1234"
  }'

# 應返回成功響應和用戶資訊

# 4. 測試登入
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234"
  }'

# 應返回 accessToken 和 refreshToken

# 5. 測試受保護路由 (使用獲得的 token)
TOKEN="your-access-token-here"
curl -X GET http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer $TOKEN"

# 應返回用戶資料
```

### 預期結果
- ✅ 註冊成功
- ✅ 登入獲得 token
- ✅ Token 可訪問受保護路由
- ✅ 無效 token 被拒絕

---

## Phase 4: 外匯數據服務測試

### 測試目標
驗證外匯數據獲取和緩存功能。

### 測試步驟

```bash
cd backend

# 1. 檢查服務文件
ls src/services/forexDataService.js

# 2. 運行外匯服務測試
npm test -- forexService.test.js

# 3. 測試 API 端點
# 獲取實時價格
curl -X GET http://localhost:3000/api/v1/market/price/EUR%2FUSD \
  -H "Authorization: Bearer $TOKEN"

# 獲取歷史數據
curl -X GET "http://localhost:3000/api/v1/market/history/EUR%2FUSD?timeframe=1hour&limit=100" \
  -H "Authorization: Bearer $TOKEN"

# 獲取市場總覽
curl -X GET http://localhost:3000/api/v1/market/overview \
  -H "Authorization: Bearer $TOKEN"

# 獲取技術指標
curl -X GET "http://localhost:3000/api/v1/market/indicators/EUR%2FUSD?indicators=sma,rsi,macd" \
  -H "Authorization: Bearer $TOKEN"

# 4. 檢查 Redis 緩存
redis-cli
> KEYS *forex*
> GET forex:price:EUR/USD
> TTL forex:price:EUR/USD
> EXIT
```

### 預期結果
- ✅ 價格數據返回正確
- ✅ 歷史數據格式正確
- ✅ 技術指標計算正確
- ✅ 數據已緩存到 Redis

---

## Phase 5: 交易信號服務測試

### 測試目標
驗證交易信號生成邏輯。

### 測試步驟

```bash
cd backend

# 1. 檢查信號服務文件
ls src/services/tradingSignalService.js
ls src/services/technicalAnalysis.js

# 2. 運行信號測試
npm test -- tradingSignals.test.js

# 3. 測試信號生成 API
# 獲取特定貨幣對的信號
curl -X GET http://localhost:3000/api/v1/trading/signal/EUR%2FUSD \
  -H "Authorization: Bearer $TOKEN"

# 獲取所有信號
curl -X GET "http://localhost:3000/api/v1/trading/signals?limit=10&status=active" \
  -H "Authorization: Bearer $TOKEN"

# 獲取個性化推薦
curl -X GET http://localhost:3000/api/v1/trading/recommendation \
  -H "Authorization: Bearer $TOKEN"

# 4. 驗證信號結構
# 檢查返回的信號應包含:
# - pair (貨幣對)
# - action (buy/sell/hold)
# - confidence (0.0-1.0)
# - entryPrice
# - stopLoss
# - takeProfit
# - riskReward
# - technicalFactors
# - sentimentFactors
```

### 預期結果
- ✅ 信號生成成功
- ✅ 包含所有必要字段
- ✅ 置信度在 0-1 之間
- ✅ 止損和止盈位置合理

---

## Phase 6: 偏好設定測試

### 測試目標
驗證用戶偏好設定和通知配置。

### 測試步驟

```bash
cd backend

# 1. 檢查偏好相關文件
ls src/controllers/preferencesController.js
ls src/routes/preferences.js

# 2. 測試獲取偏好
curl -X GET http://localhost:3000/api/v1/preferences \
  -H "Authorization: Bearer $TOKEN"

# 3. 測試更新偏好
curl -X PUT http://localhost:3000/api/v1/preferences \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tradingFrequency": "daytrading",
    "riskLevel": 7,
    "preferredPairs": ["EUR/USD", "GBP/USD", "USD/JPY"],
    "tradingStyle": "trend",
    "indicators": {
      "sma": {"enabled": true, "period": 20},
      "rsi": {"enabled": true, "period": 14}
    }
  }'

# 4. 測試通知設定
curl -X GET http://localhost:3000/api/v1/preferences/notifications \
  -H "Authorization: Bearer $TOKEN"

curl -X PUT http://localhost:3000/api/v1/preferences/notifications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": true,
    "discord": false,
    "browser": true,
    "signalTypes": {
      "buy": true,
      "sell": true,
      "hold": false
    },
    "minConfidence": 75
  }'
```

### 預期結果
- ✅ 偏好讀取成功
- ✅ 偏好更新成功
- ✅ 通知設定正確保存
- ✅ 數據驗證正常

---

## Phase 7: 通知服務測試

### 測試目標
驗證通知創建和推送功能。

### 測試步驟

```bash
cd backend

# 1. 檢查通知服務
ls src/services/notificationService.js
ls src/routes/notifications.js

# 2. 測試獲取通知
curl -X GET "http://localhost:3000/api/v1/notifications?limit=20&isRead=false" \
  -H "Authorization: Bearer $TOKEN"

# 3. 測試標記為已讀
NOTIFICATION_ID="notification-id-here"
curl -X PATCH http://localhost:3000/api/v1/notifications/$NOTIFICATION_ID/read \
  -H "Authorization: Bearer $TOKEN"

# 4. 測試標記所有為已讀
curl -X PATCH http://localhost:3000/api/v1/notifications/read-all \
  -H "Authorization: Bearer $TOKEN"

# 5. 測試刪除通知
curl -X DELETE http://localhost:3000/api/v1/notifications/$NOTIFICATION_ID \
  -H "Authorization: Bearer $TOKEN"

# 6. 檢查數據庫中的通知
# 使用 PostgreSQL
sudo -u postgres psql aifx_v2_dev -c "SELECT id, type, title, is_read FROM notifications LIMIT 5;"
```

### 預期結果
- ✅ 通知列表正確返回
- ✅ 標記已讀功能正常
- ✅ 刪除功能正常
- ✅ 過濾功能正常

---

## Phase 8: React 前端測試

### 測試目標
驗證前端應用功能和 UI。

### 測試步驟

```bash
cd frontend

# 1. 檢查前端文件結構
ls src/components/
# 應該看到:
# - Login.jsx
# - Dashboard.jsx
# - TradingView.jsx
# - Settings.jsx
# - MarketOverview.jsx

ls src/services/
# 應該看到:
# - api.js
# - socket.js

# 2. 安裝依賴 (如果還沒有)
npm install

# 3. 啟動開發服務器
npm run dev

# 4. 在瀏覽器中測試
# 訪問 http://localhost:5173

# 5. 測試登入功能
# - 訪問 /login
# - 輸入測試帳號: john@example.com / password123
# - 檢查是否成功跳轉到 /dashboard

# 6. 測試儀表板
# - 查看績效卡片
# - 查看最新信號列表
# - 點擊快速操作

# 7. 測試交易視圖
# - 訪問 /trading
# - 選擇不同貨幣對
# - 檢查圖表是否顯示
# - 查看技術指標
# - 查看當前信號

# 8. 測試市場總覽
# - 訪問 /market
# - 查看所有貨幣對
# - 測試過濾功能
# - 測試排序功能

# 9. 測試設定頁面
# - 訪問 /settings
# - 更改交易偏好
# - 更改通知設定
# - 保存並驗證

# 10. 測試響應式設計
# - 調整瀏覽器窗口大小
# - 檢查手機/平板視圖
# - 使用 Chrome DevTools 模擬移動設備

# 11. 建構生產版本
npm run build

# 檢查 dist 目錄
ls dist/
```

### 預期結果
- ✅ 前端啟動成功
- ✅ 登入功能正常
- ✅ 所有頁面正常顯示
- ✅ API 連接正常
- ✅ 圖表渲染正常
- ✅ 響應式設計正常

---

## Phase 9: 資料庫測試

### 測試目標
驗證資料庫遷移和種子資料。

### 測試步驟

```bash
cd backend

# 1. 檢查資料庫配置
cat database/config/config.js

# 2. 創建測試資料庫
sudo -u postgres psql -c "CREATE DATABASE aifx_v2_test;"

# 3. 檢查遷移文件
ls database/migrations/
# 應該看到 5 個遷移文件

# 4. 運行遷移
npm run migrate

# 5. 檢查遷移狀態
npm run migrate:status

# 6. 驗證表結構
sudo -u postgres psql aifx_v2_dev -c "\dt"

# 應該看到:
# - users
# - user_preferences
# - trading_signals
# - notifications
# - user_trading_history
# - SequelizeMeta

# 7. 檢查表結構
sudo -u postgres psql aifx_v2_dev -c "\d users"
sudo -u postgres psql aifx_v2_dev -c "\d trading_signals"

# 8. 運行種子
npm run seed

# 9. 驗證種子資料
sudo -u postgres psql aifx_v2_dev -c "SELECT COUNT(*) FROM users;"
sudo -u postgres psql aifx_v2_dev -c "SELECT username, email FROM users;"
sudo -u postgres psql aifx_v2_dev -c "SELECT COUNT(*) FROM trading_signals;"

# 10. 測試回滾
npm run migrate:undo
npm run migrate:status

# 11. 重新遷移
npm run migrate

# 12. 測試重置
npm run db:reset

# 13. 查詢測試
sudo -u postgres psql aifx_v2_dev <<EOF
-- 查詢用戶和偏好
SELECT u.username, up.trading_frequency, up.risk_level
FROM users u
JOIN user_preferences up ON u.id = up.user_id;

-- 查詢最新信號
SELECT pair, action, confidence, status, created_at
FROM trading_signals
ORDER BY created_at DESC
LIMIT 10;

-- 查詢未讀通知
SELECT u.username, n.type, n.title, n.created_at
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.is_read = false;
EOF
```

### 預期結果
- ✅ 遷移成功執行
- ✅ 所有表已創建
- ✅ 種子資料已插入
- ✅ 查詢返回正確結果
- ✅ 回滾功能正常

---

## Phase 10: 測試和文檔驗證

### 測試目標
驗證單元測試、集成測試和覆蓋率。

### 測試步驟

```bash
cd backend

# 1. 運行所有測試
npm test

# 2. 生成覆蓋率報告
npm run test:coverage

# 3. 查看覆蓋率
# 打開 coverage/lcov-report/index.html

# 或在命令行查看
cat coverage/coverage-summary.json

# 4. 運行特定測試
npm test -- auth.test.js
npm test -- forexService.test.js
npm test -- tradingSignals.test.js

# 5. 檢查測試統計
npm test -- --verbose

# 6. 測試監視模式
# npm run test:watch
# (按 Ctrl+C 退出)

# 7. 驗證覆蓋率閾值
# 確保所有指標 >= 70%
grep -A 10 "coverageThreshold" jest.config.js

# 8. 檢查文檔完整性
ls docs/API.md
ls TESTING.md
ls ../README.md

# 9. 驗證 API 文檔
wc -l docs/API.md  # 應該有很多行

grep -c "###" docs/API.md  # 統計端點數量

# 10. 檢查 CI/CD 配置
cat ../.github/workflows/ci.yml
```

### 預期結果
- ✅ 所有測試通過 (99+ tests)
- ✅ 覆蓋率 >70%
- ✅ 文檔完整
- ✅ CI/CD 配置正確

---

## 完整系統集成測試

### 測試場景 1: 完整用戶流程

```bash
# 1. 啟動所有服務
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: 測試腳本

# 2. 註冊新用戶
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "integration_test",
    "email": "integration@test.com",
    "password": "Test12345"
  }'

# 3. 登入
LOGIN_RESPONSE=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "integration@test.com",
    "password": "Test12345"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.accessToken')

# 4. 設定偏好
curl -X PUT http://localhost:3000/api/v1/preferences \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tradingFrequency": "daytrading",
    "riskLevel": 5,
    "preferredPairs": ["EUR/USD", "GBP/USD"]
  }'

# 5. 獲取交易信號
curl -X GET http://localhost:3000/api/v1/trading/signal/EUR%2FUSD \
  -H "Authorization: Bearer $TOKEN"

# 6. 獲取市場數據
curl -X GET http://localhost:3000/api/v1/market/overview \
  -H "Authorization: Bearer $TOKEN"

# 7. 檢查通知
curl -X GET http://localhost:3000/api/v1/notifications \
  -H "Authorization: Bearer $TOKEN"

# 8. 獲取個人資料
curl -X GET http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer $TOKEN"
```

### 測試場景 2: WebSocket 實時連接

```javascript
// 在瀏覽器控制台執行

// 1. 連接 WebSocket
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-access-token'
  }
});

// 2. 監聽連接事件
socket.on('connect', () => {
  console.log('✅ WebSocket connected:', socket.id);
});

// 3. 訂閱交易信號
socket.on('trading:signal', (data) => {
  console.log('📊 New signal:', data);
});

// 4. 訂閱價格更新
socket.emit('subscribe:price', { pair: 'EUR/USD' });
socket.on('price:EUR/USD', (data) => {
  console.log('💰 Price update:', data);
});

// 5. 訂閱通知
socket.on('notification', (data) => {
  console.log('🔔 Notification:', data);
});

// 6. 測試完成後斷開
// socket.disconnect();
```

---

## 性能測試

### 測試 API 響應時間

```bash
# 使用 Apache Bench
ab -n 100 -c 10 -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/market/overview

# 使用 curl 測量時間
time curl -X GET http://localhost:3000/api/v1/trading/signals \
  -H "Authorization: Bearer $TOKEN"

# 預期: < 200ms (p95)
```

### 測試 Redis 緩存

```bash
# 測試緩存命中
redis-cli
> MONITOR

# 在另一個終端多次請求同一端點
for i in {1..10}; do
  curl -X GET http://localhost:3000/api/v1/market/price/EUR%2FUSD \
    -H "Authorization: Bearer $TOKEN" -w "\n"
done

# 檢查 MONITOR 輸出，應該看到:
# - 第一次請求後設置緩存
# - 後續請求從緩存讀取
```

---

## 故障排除

### 問題 1: 資料庫連接失敗

```bash
# 檢查 PostgreSQL 狀態
sudo service postgresql status

# 啟動 PostgreSQL
sudo service postgresql start

# 檢查資料庫是否存在
sudo -u postgres psql -l | grep aifx

# 創建資料庫
sudo -u postgres psql -c "CREATE DATABASE aifx_v2_dev;"
```

### 問題 2: Redis 連接失敗

```bash
# 檢查 Redis 狀態
redis-cli ping

# 啟動 Redis
sudo service redis-server start

# 檢查 Redis 連接
redis-cli
> PING
> EXIT
```

### 問題 3: 測試失敗

```bash
# 清除緩存
rm -rf node_modules package-lock.json
npm install

# 清除 Jest 緩存
npm test -- --clearCache

# 重新運行
npm test
```

### 問題 4: 前端無法連接後端

```bash
# 檢查 .env 配置
cat frontend/.env

# 確保 VITE_API_URL 正確
VITE_API_URL=http://localhost:3000/api/v1

# 檢查後端是否運行
curl http://localhost:3000/health

# 檢查 CORS 設置
# backend/src/app.js 應該有 cors 配置
```

---

## 測試檢查清單

### Backend 測試
- [ ] ✅ 所有單元測試通過
- [ ] ✅ 測試覆蓋率 >70%
- [ ] ✅ 認證 API 正常
- [ ] ✅ 交易信號 API 正常
- [ ] ✅ 市場數據 API 正常
- [ ] ✅ 偏好設定 API 正常
- [ ] ✅ 通知 API 正常
- [ ] ✅ WebSocket 連接正常
- [ ] ✅ Redis 緩存正常
- [ ] ✅ PostgreSQL 查詢正常

### Frontend 測試
- [ ] ✅ 登入頁面正常
- [ ] ✅ 儀表板顯示正常
- [ ] ✅ 交易視圖圖表正常
- [ ] ✅ 設定頁面功能正常
- [ ] ✅ 市場總覽正常
- [ ] ✅ 響應式設計正常
- [ ] ✅ API 調用正常
- [ ] ✅ WebSocket 實時更新正常

### Database 測試
- [ ] ✅ 遷移執行成功
- [ ] ✅ 所有表已創建
- [ ] ✅ 種子資料已插入
- [ ] ✅ 查詢正常執行
- [ ] ✅ 關聯正確設置
- [ ] ✅ 索引已創建

### 整合測試
- [ ] ✅ 完整用戶流程正常
- [ ] ✅ WebSocket 實時通信正常
- [ ] ✅ 緩存策略有效
- [ ] ✅ 錯誤處理正確
- [ ] ✅ 安全措施有效

---

## 測試報告範本

### 測試日期: [填寫日期]

### 測試環境:
- Node.js: [版本]
- PostgreSQL: [版本]
- Redis: [版本]
- OS: [作業系統]

### 測試結果:

#### Phase 1-10 測試
| 階段 | 狀態 | 備註 |
|------|------|------|
| Phase 1: 初始化 | ✅ / ❌ | |
| Phase 2: 資料庫模型 | ✅ / ❌ | |
| Phase 3: 認證系統 | ✅ / ❌ | |
| Phase 4: 外匯服務 | ✅ / ❌ | |
| Phase 5: 交易信號 | ✅ / ❌ | |
| Phase 6: 偏好設定 | ✅ / ❌ | |
| Phase 7: 通知服務 | ✅ / ❌ | |
| Phase 8: React 前端 | ✅ / ❌ | |
| Phase 9: 資料庫 | ✅ / ❌ | |
| Phase 10: 測試文檔 | ✅ / ❌ | |

#### 測試覆蓋率:
- 分支: [百分比]%
- 函數: [百分比]%
- 行: [百分比]%
- 語句: [百分比]%

#### 發現的問題:
1. [問題描述]
2. [問題描述]

#### 建議:
1. [建議內容]
2. [建議內容]

---

## 持續測試

### 開發期間
```bash
# 使用 watch 模式自動運行測試
npm run test:watch
```

### 提交前
```bash
# 運行所有檢查
npm run lint
npm test
npm run test:coverage
```

### 部署前
```bash
# 完整檢查
npm run lint
npm test
npm audit
npm run build  # 前端
```

---

## 自動化測試

CI/CD 管道會自動運行:
1. 代碼檢查 (ESLint)
2. 單元測試
3. 覆蓋率檢查
4. 安全審計
5. 建構驗證

推送到 GitHub 後自動觸發。

---

## 總結

完成所有測試後，您的系統應該:
- ✅ 通過 99+ 單元測試
- ✅ 達到 >70% 代碼覆蓋率
- ✅ 所有 API 端點正常工作
- ✅ 前端與後端完美整合
- ✅ 資料庫正確配置
- ✅ 實時功能正常
- ✅ 安全措施到位

恭喜！您的 AIFX v2 系統已準備就緒！🎉