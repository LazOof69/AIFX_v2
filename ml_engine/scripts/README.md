# ML Engine Scripts

**最後更新**: 2025-11-20
**整理行動**: ULTRATHINK 目錄清理

---

## 📁 目錄結構

```
ml_engine/scripts/
├── deployment/      - 部署腳本
├── testing/         - 測試腳本
├── training/        - 訓練腳本
├── monitoring/      - 監控腳本
└── (工具腳本)       - 數據收集、日曆更新等
```

---

## 🚀 根目錄腳本

### **start.sh** (889B)
主要啟動腳本
```bash
# 啟動 ML Engine
./start.sh
```
功能：
- ✅ 檢查並創建 venv
- ✅ 安裝依賴
- ✅ 創建必要目錄
- ✅ 啟動 ML API 伺服器

**端口**: 8000
**API 文檔**: http://localhost:8000/docs

---

## 📦 deployment/ - 部署腳本

### **deploy_ml_api.sh** (3.9K)
ML API 部署腳本
```bash
# 部署 ML API
./scripts/deployment/deploy_ml_api.sh
```
功能：
- 環境配置檢查
- 依賴安裝
- 服務啟動配置
- 健康檢查

---

## 🧪 testing/ - 測試腳本

### **test_ml_api.sh** (2.7K)
ML API 測試腳本
```bash
# 測試 ML API
./scripts/testing/test_ml_api.sh
```
功能：
- 健康檢查測試
- API 端點測試
- 市場數據測試
- 反轉預測測試

---

## 🎓 training/ - 訓練腳本

### **train_wrapper.sh** (436B)
訓練包裝腳本
```bash
# 訓練模型
./scripts/training/train_wrapper.sh
```
功能：
- 訓練環境準備
- 模型訓練執行
- 訓練日誌記錄

---

## 📊 monitoring/ - 監控腳本

### **check_training_status.sh** (2.2K)
訓練狀態檢查
```bash
# 檢查訓練狀態
./scripts/monitoring/check_training_status.sh
```
功能：
- 檢查訓練進度
- 查看訓練日誌
- 模型性能監控
- 錯誤檢測

---

## 🛠️ 工具腳本

### **start_ml_server.sh** (315B)
簡化版啟動腳本
```bash
# 快速啟動（開發用）
./scripts/start_ml_server.sh
```
功能：
- ARM64 修復（libgomp）
- 直接啟動 uvicorn
- 開發模式（--reload）

### **check_calendar_health.sh**
經濟日曆健康檢查
```bash
# 檢查經濟日曆
./scripts/check_calendar_health.sh
```
功能：
- 檢查日曆數據
- 驗證事件更新
- 數據完整性檢查

### **update_calendar.sh**
更新經濟日曆
```bash
# 更新經濟日曆
./scripts/update_calendar.sh
```
功能：
- 從 API 獲取最新事件
- 更新資料庫
- 清理過期數據

---

## ⏰ 定時任務腳本 (cron/)

### **daily_training.sh**
每日訓練任務
```bash
# Crontab 設置
0 2 * * * /root/AIFX_v2/ml_engine/cron/daily_training.sh
```
功能：
- 每日增量訓練
- 數據更新
- 模型優化

### **weekly_training.sh**
每週訓練任務
```bash
# Crontab 設置
0 3 * * 0 /root/AIFX_v2/ml_engine/cron/weekly_training.sh
```
功能：
- 完整模型重訓
- 性能評估
- 版本管理

---

## 🎯 常用命令

### 啟動服務
```bash
# 完整啟動（生產用）
./start.sh

# 快速啟動（開發用）
./scripts/start_ml_server.sh
```

### 測試
```bash
# API 測試
./scripts/testing/test_ml_api.sh

# 健康檢查
curl http://localhost:8000/health
```

### 訓練
```bash
# 手動訓練
./scripts/training/train_wrapper.sh

# 檢查狀態
./scripts/monitoring/check_training_status.sh
```

### 部署
```bash
# 部署到生產
./scripts/deployment/deploy_ml_api.sh
```

### 維護
```bash
# 更新經濟日曆
./scripts/update_calendar.sh

# 檢查日曆健康
./scripts/check_calendar_health.sh
```

---

## 📊 腳本統計

| 類別 | 數量 | 位置 |
|------|------|------|
| **部署** | 1 | scripts/deployment/ |
| **測試** | 1 | scripts/testing/ |
| **訓練** | 1 | scripts/training/ |
| **監控** | 1 | scripts/monitoring/ |
| **工具** | 3 | scripts/ |
| **定時任務** | 2 | cron/ |
| **主啟動** | 1 | 根目錄 |
| **總計** | 10 |  |

---

## 🔧 腳本維護

### 新增腳本規則
- 部署相關 → `scripts/deployment/`
- 測試相關 → `scripts/testing/`
- 訓練相關 → `scripts/training/`
- 監控相關 → `scripts/monitoring/`
- 定時任務 → `cron/`
- 工具腳本 → `scripts/`

### 命名規範
- 使用小寫和底線: `script_name.sh`
- 清晰描述功能
- 添加註釋說明

---

**整理完成**: 2025-11-20
**方法**: ULTRATHINK 深度分析
