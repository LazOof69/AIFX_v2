# ML Engine Documentation

**最後更新**: 2025-11-20
**整理行動**: ULTRATHINK 目錄清理

---

## 📁 文檔結構

```
ml_engine/docs/
├── setup/           - 設置和部署指南
├── training/        - 訓練相關文檔
└── archive/         - 歸檔文檔
    ├── phase2/      - Phase 2 開發歷史
    └── sessions/    - 會議記錄
```

---

## 🛠️ setup/ - 設置指南

### **DEPLOYMENT_GUIDE.md** (7.2K)
ML Engine 部署指南
```bash
# 查看部署文檔
cat docs/setup/DEPLOYMENT_GUIDE.md
```
- 環境配置
- 依賴安裝
- 服務啟動
- 故障排除

### **CRON_SETUP.md** (8.0K)
定時任務設置指南
```bash
# 查看 Cron 設置
cat docs/setup/CRON_SETUP.md
```
- 每日訓練任務
- 每週訓練任務
- Crontab 配置

### **DATA_COLLECTION_GUIDE.md** (5.9K)
數據收集指南
```bash
# 查看數據收集指南
cat docs/setup/DATA_COLLECTION_GUIDE.md
```
- yfinance 使用
- 數據格式
- 儲存策略

### **ECONOMIC_CALENDAR_SETUP.md** (7.7K)
經濟日曆設置
```bash
# 查看經濟日曆設置
cat docs/setup/ECONOMIC_CALENDAR_SETUP.md
```
- 日曆 API 配置
- 數據更新機制
- 事件追蹤

---

## 🎓 training/ - 訓練文檔

### **ML_DATA_STRATEGY.md** (22K)
機器學習數據策略
```bash
# 查看數據策略
cat docs/training/ML_DATA_STRATEGY.md
```
- 數據收集策略
- 特徵工程
- 標籤生成邏輯
- 訓練數據準備

### **FUNDAMENTAL_EVENT_DESIGN.md** (12K)
基本面事件設計
```bash
# 查看基本面設計
cat docs/training/FUNDAMENTAL_EVENT_DESIGN.md
```
- 經濟事件影響分析
- 基本面特徵設計
- 事件驅動策略

### **ML_ENGINE_TODO.md** (11K)
ML Engine 待辦事項
```bash
# 查看待辦清單
cat docs/training/ML_ENGINE_TODO.md
```
- 開發計劃
- 功能需求
- 優化項目

---

## 📦 archive/ - 歸檔文檔

### Phase 2 開發歷史 (`archive/phase2/`)

Phase 2 完整開發記錄（已完成，僅供參考）：

#### **PHASE2_MVP_PLAN.md** (41K)
Phase 2 MVP 計劃
- 目標設定
- 功能規劃
- 技術方案

#### **PHASE2_WEEK2_PLAN.md** (11K)
第 2 週開發計劃
- 週計劃
- 任務分解
- 時間安排

#### **PHASE2_WEEK2_COMPLETION.md** (5.5K)
第 2 週完成報告
- 完成項目
- 測試結果
- 問題總結

#### **PHASE2_WEEK2_RESULTS.md** (11K)
第 2 週結果分析
- 性能指標
- 模型評估
- 改進建議

---

### 會議記錄 (`archive/sessions/`)

開發會議和總結（已歸檔）：

#### **SESSION_SUMMARY_2025-10-15.md** (12K)
2025-10-15 會議總結
- 討論內容
- 決策記錄
- 行動項目

#### **WEEK2_SUMMARY.md** (6.4K)
第 2 週工作總結
- 週進度
- 問題與解決
- 下週計劃

---

## 🎯 快速導航

### 初次設置
```bash
# 1. 查看部署指南
cat docs/setup/DEPLOYMENT_GUIDE.md

# 2. 設置定時任務
cat docs/setup/CRON_SETUP.md

# 3. 配置數據收集
cat docs/setup/DATA_COLLECTION_GUIDE.md
```

### 訓練模型
```bash
# 1. 了解數據策略
cat docs/training/ML_DATA_STRATEGY.md

# 2. 查看待辦事項
cat docs/training/ML_ENGINE_TODO.md

# 3. 基本面特徵設計
cat docs/training/FUNDAMENTAL_EVENT_DESIGN.md
```

### 查看歷史
```bash
# Phase 2 開發歷史
ls docs/archive/phase2/

# 會議記錄
ls docs/archive/sessions/
```

---

## 📊 文檔統計

| 類別 | 數量 | 說明 |
|------|------|------|
| **設置指南** | 4 | 部署、Cron、數據、經濟日曆 |
| **訓練文檔** | 3 | 數據策略、基本面、TODO |
| **Phase 2 歷史** | 4 | 計劃、完成、結果報告 |
| **會議記錄** | 2 | 會議總結、週總結 |
| **總計** | 13 | 已分類整理 |

---

**整理完成**: 2025-11-20
**方法**: ULTRATHINK 深度分析
