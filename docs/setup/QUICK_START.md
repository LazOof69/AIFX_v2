# AIFX v2 快速開始指南

## 🚀 5 分鐘快速啟動

### 前置條件檢查

```bash
# 檢查 Node.js (需要 >= 18.0)
node --version

# 檢查 npm
npm --version

# 檢查 PostgreSQL (可選)
psql --version

# 檢查 Redis (可選)
redis-cli --version
```

---

## 📦 安裝步驟

### 1. 進入專案目錄

```bash
cd "/mnt/c/Users/butte/OneDrive/桌面/code projects/AIFX_v2"
```

### 2. 安裝後端依賴

```bash
cd backend
npm install
```

### 3. 安裝前端依賴

```bash
cd ../frontend
npm install
cd ..
```

---

## ⚙️ 配置

### 1. 後端配置

```bash
# 檢查 .env 文件
cat backend/.env

# 如果不存在，從範例複製
cp backend/.env.example backend/.env

# 編輯配置 (根據需要)
nano backend/.env
```

**重要配置項：**
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aifx_v2_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
```

### 2. 前端配置

```bash
# 檢查前端配置
cat frontend/.env

# 如果不存在
cp frontend/.env.example frontend/.env
```

---

## 🗄️ 資料庫設置

### 選項 A: 使用 PostgreSQL (推薦)

```bash
# 1. 啟動 PostgreSQL
sudo service postgresql start

# 2. 創建資料庫
sudo -u postgres psql -c "CREATE DATABASE aifx_v2_dev;"

# 3. 運行遷移
cd backend
npm run migrate

# 4. 填充測試資料 (可選)
npm run seed
```

### 選項 B: 跳過資料庫 (測試前端)

如果暫時不需要資料庫，可以先測試前端：
- 後端 API 會返回錯誤，但前端可以正常顯示
- 適合測試 UI 和路由

---

## 🚀 啟動服務

### 方法 1: 手動啟動 (推薦用於開發)

**終端 1 - 啟動後端：**
```bash
cd backend
npm run dev
```
後端將在 http://localhost:3000 運行

**終端 2 - 啟動前端：**
```bash
cd frontend
npm run dev
```
前端將在 http://localhost:5173 運行

### 方法 2: 使用 tmux/screen (同時運行)

```bash
# 使用 tmux
tmux new-session -d -s aifx_backend 'cd backend && npm run dev'
tmux new-session -d -s aifx_frontend 'cd frontend && npm run dev'

# 查看日誌
tmux attach -t aifx_backend  # Ctrl+B, D 退出
tmux attach -t aifx_frontend

# 停止服務
tmux kill-session -t aifx_backend
tmux kill-session -t aifx_frontend
```

---

## 🧪 驗證安裝

### 1. 運行快速測試

```bash
# 運行結構檢查
./quick-test.sh

# 運行完整測試（包括單元測試）
./quick-test.sh --run-tests
```

### 2. 測試後端 API

```bash
# 確保後端正在運行
curl http://localhost:3000/health

# 應該返回 "OK" 或類似響應
```

### 3. 測試前端

打開瀏覽器訪問：http://localhost:5173

應該看到登入頁面。

---

## 🔑 測試帳號

如果執行了 `npm run seed`，可以使用這些測試帳號：

```
帳號 1:
Email: john@example.com
Password: password123

帳號 2:
Email: sarah@example.com
Password: trader2023

帳號 3:
Email: demo@example.com
Password: demo1234
```

---

## 📝 常見問題

### Q1: PostgreSQL 連接失敗

**問題：** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**解決方案：**
```bash
# 檢查 PostgreSQL 狀態
sudo service postgresql status

# 啟動 PostgreSQL
sudo service postgresql start

# 檢查資料庫是否存在
sudo -u postgres psql -l | grep aifx
```

### Q2: Redis 連接失敗

**問題：** `Error: Redis connection refused`

**解決方案：**
```bash
# Redis 不是必須的，可以暫時跳過
# 如果需要啟動：
sudo service redis-server start

# 測試連接
redis-cli ping  # 應返回 PONG
```

### Q3: 前端無法連接後端

**問題：** API 請求失敗

**解決方案：**
```bash
# 1. 檢查後端是否運行
curl http://localhost:3000/health

# 2. 檢查前端配置
cat frontend/.env
# 確保: VITE_API_URL=http://localhost:3000/api/v1

# 3. 清除緩存並重啟
cd frontend
rm -rf node_modules/.vite
npm run dev
```

### Q4: 測試失敗

**問題：** `npm test` 失敗

**解決方案：**
```bash
cd backend

# 清除緩存
rm -rf node_modules
npm install

# 清除 Jest 緩存
npm test -- --clearCache

# 重新運行
npm test
```

### Q5: 端口已被占用

**問題：** `Port 3000 is already in use`

**解決方案：**
```bash
# 查找占用端口的進程
lsof -i :3000  # 或 netstat -ano | grep 3000

# 結束進程
kill -9 <PID>

# 或更改端口 (backend/.env)
PORT=3001
```

---

## 🛠️ 開發工具

### VS Code 推薦擴展

- ESLint
- Prettier
- ES7+ React/Redux/React-Native snippets
- REST Client
- PostgreSQL
- GitLens

### Chrome 擴展

- React Developer Tools
- Redux DevTools
- JSON Formatter

---

## 📚 下一步

### 1. 閱讀文檔

- [完整 README](README.md)
- [API 文檔](backend/docs/API.md)
- [資料庫結構](backend/DATABASE_SCHEMA.md)
- [測試指南](backend/TESTING.md)

### 2. 探索功能

- 註冊新帳號
- 設定交易偏好
- 查看交易信號
- 探索市場總覽
- 自訂通知設定

### 3. 運行測試

```bash
# 後端單元測試
cd backend
npm test

# 測試覆蓋率
npm run test:coverage

# API 端點測試（確保服務器運行）
../test-api.sh
```

### 4. 開發新功能

參考 [CLAUDE.md](CLAUDE.md) 了解開發規範和最佳實踐。

---

## 🔄 更新專案

```bash
# 拉取最新代碼
git pull

# 更新後端依賴
cd backend
npm install

# 運行新的遷移
npm run migrate

# 更新前端依賴
cd ../frontend
npm install

# 重啟服務
```

---

## 🛑 停止服務

```bash
# 方法 1: 在終端按 Ctrl+C

# 方法 2: 如果使用 tmux
tmux kill-session -t aifx_backend
tmux kill-session -t aifx_frontend

# 方法 3: 結束所有 Node 進程（謹慎使用）
pkill -f "node"
```

---

## 📊 監控和日誌

### 查看後端日誌

```bash
# 實時查看日誌
cd backend
npm run dev

# 或查看日誌文件（如果配置了）
tail -f logs/app.log
```

### 查看資料庫

```bash
# 連接資料庫
sudo -u postgres psql aifx_v2_dev

# 查看表
\dt

# 查看用戶
SELECT * FROM users;

# 查看信號
SELECT * FROM trading_signals ORDER BY created_at DESC LIMIT 10;

# 退出
\q
```

### 查看 Redis 緩存

```bash
# 連接 Redis
redis-cli

# 查看所有 key
KEYS *

# 查看特定 key
GET forex:price:EUR/USD

# 查看 TTL
TTL forex:price:EUR/USD

# 退出
EXIT
```

---

## 🎯 性能優化建議

### 開發環境

- 使用 `npm run dev` 啟用熱重載
- 開啟 React DevTools
- 使用 Redux DevTools (如果使用 Redux)

### 生產環境

```bash
# 建構前端
cd frontend
npm run build

# 啟動生產模式後端
cd ../backend
NODE_ENV=production npm start
```

---

## ✅ 檢查清單

完成以下步驟確保系統正常運行：

- [ ] Node.js 已安裝 (>= 18.0)
- [ ] PostgreSQL 已安裝並運行
- [ ] Redis 已安裝並運行 (可選)
- [ ] 後端依賴已安裝
- [ ] 前端依賴已安裝
- [ ] 資料庫已創建
- [ ] 遷移已執行
- [ ] 後端服務運行在 3000 端口
- [ ] 前端服務運行在 5173 端口
- [ ] 可以訪問登入頁面
- [ ] 可以成功登入
- [ ] API 請求正常

---

## 🆘 獲取幫助

如果遇到問題：

1. 檢查 [完整測試指南](TESTING_ALL_PHASES.md)
2. 查看 [故障排除](#常見問題)
3. 查看日誌輸出
4. 檢查環境配置
5. 重新安裝依賴

---

## 🎉 成功！

如果所有步驟都完成了，恭喜你！AIFX v2 系統已經成功運行。

開始探索功能，或閱讀文檔學習更多內容。

Happy Trading! 📈💰