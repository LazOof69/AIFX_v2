# AIFX v2 Scripts Directory

**最後更新**: 2025-11-20
**整理行動**: ULTRATHINK 腳本精簡

---

## 📁 目錄結構

```
scripts/
├── monitoring/     - 系統監控腳本
├── testing/        - 測試腳本
├── maintenance/    - 維護腳本
└── archive/        - 歸檔腳本（舊版本/不常用）
```

---

## 🚀 根目錄核心腳本（4 個）

保留在專案根目錄的核心腳本：

### 1. **setup.sh** (13K)
**用途**: 初始化專案設置
```bash
./setup.sh
```
- 安裝依賴
- 配置資料庫
- 設置環境變數
- 初始化服務

### 2. **check_services.sh** (2.6K)
**用途**: 檢查所有服務狀態
```bash
./check_services.sh
```
- ✅ Backend (port 3000)
- ✅ ML Engine (port 8000)
- ✅ Frontend (port 5173)
- ✅ PostgreSQL
- ✅ Redis
- ✅ Discord Bot

### 3. **start-all-services.sh** (4.6K)
**用途**: 啟動所有 AIFX v2 服務
```bash
./start-all-services.sh
```
- 啟動 Backend
- 啟動 ML Engine
- 啟動 Frontend
- 啟動 Discord Bot

### 4. **stop-all-services.sh** (1.9K)
**用途**: 停止所有 AIFX v2 服務
```bash
./stop-all-services.sh
```
- 停止所有運行的服務
- 清理進程

---

## 📊 monitoring/ - 系統監控腳本

### **system_health_test.sh** (4.8K)
**用途**: 完整系統健康檢查
```bash
./scripts/monitoring/system_health_test.sh
```
- 檢查所有服務狀態
- 測試 API 端點
- 檢查資料庫連接
- 生成健康報告

**最後更新**: 2025-11-17

---

## 🧪 testing/ - 測試腳本

### Shell 測試腳本

#### **quick-test.sh** (6.5K)
**用途**: 快速結構測試
```bash
./scripts/testing/quick-test.sh
```
- 檢查專案結構
- 驗證檔案存在
- 快速健全性檢查

#### **test-api.sh** (6.2K)
**用途**: API 端點測試
```bash
./scripts/testing/test-api.sh
```
- 測試 Backend API
- 測試 ML Engine API
- 驗證回應格式

#### **test_e2e_ml.sh** (1.2K)
**用途**: ML 引擎端對端測試
```bash
./scripts/testing/test_e2e_ml.sh
```
- 測試 ML 預測端點
- 驗證模型回應

---

### Node.js 測試腳本

#### **test_discord_integration.js** (4.4K)
**用途**: Discord Bot 整合測試
```bash
node scripts/testing/test_discord_integration.js
```
- 測試 Discord Bot 連接
- 測試指令功能
- 驗證通知系統

#### **test_full_system_diagnosis.js** (14K)
**用途**: 完整系統診斷（最全面）
```bash
node scripts/testing/test_full_system_diagnosis.js
```
- 完整系統檢查
- 所有服務診斷
- 生成詳細報告
- **推薦用於完整系統驗證**

#### **test_market_data_collector.js** (5.4K)
**用途**: 市場數據收集測試
```bash
node scripts/testing/test_market_data_collector.js
```
- 測試市場數據收集
- 驗證資料庫寫入
- 檢查數據完整性

#### **test_signal_end_to_end.js** (3.7K)
**用途**: 交易信號端對端測試
```bash
node scripts/testing/test_signal_end_to_end.js
```
- 測試信號生成流程
- 從數據收集到信號輸出
- 端對端驗證

#### **test_signal_monitoring.js** (4.6K)
**用途**: 信號監控服務測試
```bash
node scripts/testing/test_signal_monitoring.js
```
- 測試信號監控邏輯
- 驗證反轉檢測
- 檢查通知觸發

---

## 🔧 maintenance/ - 維護腳本

### **verify-system.sh** (7.9K)
**用途**: 系統驗證和診斷
```bash
./scripts/maintenance/verify-system.sh
```
- 驗證系統配置
- 檢查依賴
- 診斷常見問題
- 生成修復建議

**最後更新**: 2025-10-27

---

## 📦 archive/ - 歸檔腳本

舊版本或不常用的腳本（僅供參考）：

### **check-services.sh** (2.4K)
- 舊版服務檢查腳本
- 已被 `check_services.sh` 取代
- 最後更新: 2025-10-22

### **start-services.sh** (915B)
- 簡化版服務啟動腳本
- 已被 `start-all-services.sh` 取代

### **start_frontend.sh** (1.6K)
- 只啟動 Frontend 的腳本
- 用途有限，已歸檔

### **test-all-apis.sh** (1.2K)
- 簡化版 API 測試
- 已被 `test-api.sh` 取代

---

## 🎯 使用建議

### 日常使用
```bash
# 檢查服務狀態
./check_services.sh

# 啟動所有服務
./start-all-services.sh

# 停止所有服務
./stop-all-services.sh
```

### 測試和驗證
```bash
# 快速測試
./scripts/testing/quick-test.sh

# 完整系統診斷（推薦）
node scripts/testing/test_full_system_diagnosis.js

# API 測試
./scripts/testing/test-api.sh
```

### 系統監控
```bash
# 健康檢查
./scripts/monitoring/system_health_test.sh

# 系統驗證
./scripts/maintenance/verify-system.sh
```

---

## 📊 腳本統計

| 類別 | 數量 | 位置 |
|------|------|------|
| **核心腳本** | 4 | 根目錄 |
| **監控** | 1 | scripts/monitoring/ |
| **測試** | 8 | scripts/testing/ |
| **維護** | 1 | scripts/maintenance/ |
| **歸檔** | 4 | scripts/archive/ |
| **總計** | 18 |  |

---

## 🔄 腳本維護原則

### 新增腳本規則
- **核心腳本** (根目錄): 只放最常用的 4 個
- **監控腳本** → `scripts/monitoring/`
- **測試腳本** → `scripts/testing/`
- **維護腳本** → `scripts/maintenance/`
- **舊版本/不常用** → `scripts/archive/`

### 命名規範
- 使用小寫和底線: `script_name.sh`
- 或使用破折號: `script-name.sh`
- 保持一致性

### 文檔要求
每個腳本應包含：
- 用途說明
- 使用範例
- 更新日期
- 依賴說明

---

## 📝 變更歷史

### 2025-11-20 - ULTRATHINK 腳本精簡
- 從 18 個根目錄腳本 → 4 個核心腳本
- 創建 scripts/ 分類目錄
- 移動 14 個腳本到子目錄
- 建立完整文檔

**減少**: 78% 根目錄混亂
**改善**: 100% 腳本已分類

---

**整理完成**: 2025-11-20
**方法**: ULTRATHINK 深度分析
**效果**: 根目錄清晰，腳本分類明確
