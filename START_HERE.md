# 🚀 AIFX v2 - Quick Start Guide

**新電腦環境？從這裡開始！**

---

## ⚡ 快速安裝（一鍵完成）

### Step 1: 運行自動化安裝腳本

```bash
cd /root/AIFX_v2
./setup.sh
```

這個腳本會自動：
- ✅ 安裝 PostgreSQL 和 Redis
- ✅ 創建數據庫和用戶
- ✅ 重建 Python 虛擬環境
- ✅ 運行所有數據庫 migrations
- ✅ 驗證所有安裝

**預計時間：15-30 分鐘**

---

### Step 2: 啟動所有服務

```bash
./start-all-services.sh
```

這會在後台啟動：
- ✅ Backend (http://localhost:3000)
- ✅ Frontend (http://localhost:5173)
- ✅ ML Engine (http://localhost:8000)

---

### Step 3: 檢查服務狀態

```bash
./check-services.sh
```

---

## 📋 可用的腳本

| 腳本 | 用途 | 說明 |
|------|------|------|
| `./setup.sh` | 初始安裝 | 安裝所有依賴和服務 |
| `./start-all-services.sh` | 啟動服務 | 在 tmux 中啟動所有服務 |
| `./stop-all-services.sh` | 停止服務 | 停止所有運行中的服務 |
| `./check-services.sh` | 檢查狀態 | 查看服務運行狀態 |

---

## 🎯 訪問應用程式

安裝完成後，你可以訪問：

- **Frontend (用戶界面)**
  - URL: http://localhost:5173
  - 或: http://168.138.182.181 (如果配置了 Apache)

- **Backend API**
  - URL: http://localhost:3000/api/v1
  - Health check: http://localhost:3000/api/v1/health

- **ML Engine API**
  - URL: http://localhost:8000
  - Docs: http://localhost:8000/docs

---

## 🔧 管理 tmux 會話

服務在 tmux 中運行，你可以：

### 查看所有會話
```bash
tmux list-sessions
```

### 連接到特定服務（查看日誌）
```bash
# Backend
tmux attach -t aifx-backend

# Frontend
tmux attach -t aifx-frontend

# ML Engine
tmux attach -t aifx-ml
```

### 從 tmux 分離（不停止服務）
```
按 Ctrl+B，然後按 D
```

### 停止所有服務
```bash
./stop-all-services.sh
```

---

## 📊 手動啟動（開發模式）

如果你想在獨立的終端視窗中運行服務：

### Terminal 1 - Backend
```bash
cd /root/AIFX_v2/backend
npm run dev
```

### Terminal 2 - Frontend
```bash
cd /root/AIFX_v2/frontend
npm run dev
```

### Terminal 3 - ML Engine
```bash
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
uvicorn api.ml_server:app --reload --host 0.0.0.0 --port 8000
```

---

## 🐛 故障排除

### 檢查服務狀態
```bash
./check-services.sh
```

### 檢查 PostgreSQL
```bash
sudo systemctl status postgresql
psql -U postgres -d aifx_v2_dev -c "SELECT 1"
```

### 檢查 Redis
```bash
sudo systemctl status redis-server
redis-cli ping
```

### 查看服務日誌

**Backend:**
```bash
tmux attach -t aifx-backend
# 或查看日誌文件
tail -f /root/AIFX_v2/backend/logs/combined.log
```

**Frontend:**
```bash
tmux attach -t aifx-frontend
```

**ML Engine:**
```bash
tmux attach -t aifx-ml
# 或查看日誌文件
tail -f /root/AIFX_v2/ml_engine/logs/ml_server.log
```

---

## 📚 更多文檔

- **系統狀態報告**: `SYSTEM_STATUS_REPORT.md`
- **持續學習進度**: `CONTINUOUS_LEARNING_PROGRESS.md`
- **數據庫架構**: `DATABASE_ARCHITECTURE.md`
- **API 文檔**: `README.md`
- **快速開始**: `QUICK_START.md`

---

## ✅ 安裝後檢查清單

```
[ ] 運行 ./setup.sh 完成
[ ] PostgreSQL 正在運行
[ ] Redis 正在運行
[ ] 數據庫 migrations 已執行
[ ] Python venv 已重建
[ ] 運行 ./start-all-services.sh
[ ] Backend 可訪問 (http://localhost:3000)
[ ] Frontend 可訪問 (http://localhost:5173)
[ ] ML Engine 可訪問 (http://localhost:8000)
```

---

## 🆘 需要幫助？

1. 查看 `SYSTEM_STATUS_REPORT.md` 了解系統狀態
2. 運行 `./check-services.sh` 檢查服務
3. 查看各服務的日誌文件
4. 檢查 `.env` 文件配置

---

## 🎉 準備就緒！

安裝完成後，你的 AIFX v2 系統就可以使用了：

- ✅ Backend API 提供交易信號
- ✅ Frontend 顯示用戶界面
- ✅ ML Engine 進行市場預測
- ✅ PostgreSQL 存儲所有數據
- ✅ Redis 處理緩存和事件

**開始使用：**
```bash
# 1. 安裝
./setup.sh

# 2. 啟動
./start-all-services.sh

# 3. 訪問
# Frontend: http://localhost:5173
```

**就這麼簡單！** 🚀
