# 明天開始測試指南

## 重要資訊
- **專案位置（WSL）**: `~/AIFX_v2`
- **原始位置（Windows）**: `/mnt/c/Users/butte/OneDrive/桌面/code projects/AIFX_v2`
- **Backend Port**: 3000
- **Frontend Port**: 5173

## 當前狀態
- ✅ Backend 在 WSL 可以運行（無資料庫模式）
- ✅ Health endpoint 可用: http://localhost:3000/api/v1/health
- ⚠️ 資料庫相關程式碼已註解（需要 PostgreSQL）
- ⚠️ API routes 已註解

## 快速啟動

### 1. 啟動 Backend（健康檢查模式）
```bash
cd ~/AIFX_v2/backend
npm run dev
```

### 2. 測試結構（不需要資料庫）
```bash
cd ~/AIFX_v2
./quick-test.sh
```

### 3. 啟動 Frontend
```bash
cd ~/AIFX_v2/frontend
npm install  # 第一次需要
npm run dev
```
瀏覽器打開: http://localhost:5173

## 如果要完整測試（需要資料庫）

### A. 安裝 PostgreSQL
```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo service postgresql start
sudo -u postgres psql -c "CREATE DATABASE aifx_v2_dev;"
```

### B. 取消註解程式碼

**檔案 1: `~/AIFX_v2/backend/src/server.js` (第 23-36 行)**
取消註解:
```javascript
// Test database connection
const dbConnected = await testConnection();
if (!dbConnected) {
  console.error('❌ Failed to connect to database. Exiting...');
  process.exit(1);
}

// Sync database models (only in development)
if (process.env.NODE_ENV === 'development') {
  await syncDatabase(false, true);
}

// Import models to ensure relationships are established
require('./models');
```

**檔案 2: `~/AIFX_v2/backend/src/app.js` (第 121-127 行)**
取消註解:
```javascript
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/market', require('./routes/market'));
app.use('/api/v1/trading', require('./routes/trading'));
app.use('/api/v1/notifications', require('./routes/notifications'));
```

### C. 運行 Migrations 和 Seeders
```bash
cd ~/AIFX_v2/backend
npm run migrate
npm run seed
```

### D. 重啟 Backend
```bash
npm run dev
```

### E. 測試 API
```bash
cd ~/AIFX_v2
./test-api.sh
```

## 測試帳號
```
Email: john@example.com
Password: password123
```

## 常見問題

### Q: Backend 無法啟動
```bash
# 殺掉所有 node 進程
pkill -9 node

# 重新啟動
cd ~/AIFX_v2/backend
npm run dev
```

### Q: PostgreSQL 未運行
```bash
sudo service postgresql status
sudo service postgresql start
```

### Q: npm install 很慢
確保在 WSL 原生路徑 (`~/AIFX_v2`)，不要在 `/mnt/c/...`

## 已修復的問題
1. ✅ `iconv-lite` 模組損壞 → 已透過在 WSL 原生檔案系統重裝修復
2. ✅ `app.js` 中 `package.json` 路徑錯誤 → 已從 `../../` 改為 `../`
3. ✅ Express 載入 hang 住 → WSL 原生檔案系統解決

## 專案文件參考
- **完整文檔**: `~/AIFX_v2/README.md`
- **測試指南**: `~/AIFX_v2/TESTING_ALL_PHASES.md`
- **API 文檔**: `~/AIFX_v2/backend/docs/API.md`
- **快速開始**: `~/AIFX_v2/QUICK_START.md`
- **專案狀態**: `~/AIFX_v2/PROJECT_STATUS.md`

## 需要幫助？
執行 Claude Code 並說明你遇到的問題，參考這個文件可以快速恢復上下文。

---
**建立時間**: 2025-09-30
**最後測試**: Backend health endpoint 正常運行