# Trading Period Design - 交易週期重新設計

## 概念映射

### 日內交易 (Intraday / Day Trading)
- **中文名稱**: 日內交易
- **英文名稱**: Day Trading / Intraday
- **持倉時長**: 幾分鐘到幾小時（當天必須平倉）
- **技術時間框架**: 15min（推薦）, 1min, 5min, 30min
- **交易特徵**:
  - 🔥 高頻交易，需要緊盯盤面
  - 💰 點差成本較高
  - ⚡ 快速進出，當天平倉
  - 🎯 適合專職交易者
- **風險等級**: ⚠️⚠️⚠️ 高
- **最低資金**: $5,000
- **ML模型**: 15min timeframe model

---

### 周內交易 (Swing Trading)
- **中文名稱**: 周內交易
- **英文名稱**: Swing Trading
- **持倉時長**: 2-10天
- **技術時間框架**: 1h（推薦）, 4h
- **交易特徵**:
  - 📈 波段操作，捕捉短期趨勢
  - 🌙 隔夜持倉，需設止損
  - 💼 適合上班族
  - 🎯 **推薦新手首選**
- **風險等級**: ⚠️⚠️ 中等
- **最低資金**: $2,000
- **ML模型**: 1h timeframe model (v3.2)

---

### 月內交易 (Position Trading)
- **中文名稱**: 月內交易
- **英文名稱**: Position Trading
- **持倉時長**: 數週到1-2個月
- **技術時間框架**: 1d (daily)
- **交易特徵**:
  - 📊 趨勢跟隨，中期持倉
  - 📰 基本面分析重要性增加
  - 💎 容忍短期回撤
  - 🎯 適合耐心投資者
- **風險等級**: ⚠️ 中低
- **最低資金**: $1,000
- **ML模型**: 1d timeframe model

---

### 季內交易 (Long-term Trading)
- **中文名稱**: 季內交易
- **英文名稱**: Long-term Trading / Quarterly
- **持倉時長**: 數月到1年
- **技術時間框架**: 1w (weekly)
- **交易特徵**:
  - 🎯 戰略配置，長期持有
  - 🌍 宏觀經濟視角
  - 📈 經濟週期影響
  - 💰 資金利用率低但穩定
- **風險等級**: ✅ 低
- **最低資金**: $500
- **ML模型**: 1w timeframe model

---

## 技術實現映射

### Backend API 參數映射

```javascript
const PERIOD_TO_TIMEFRAME_MAP = {
  'intraday': '15min',      // 日內交易 → 15分鐘
  'swing': '1h',            // 周內交易 → 1小時（默認）
  'position': '1d',         // 月內交易 → 日線
  'longterm': '1w'          // 季內交易 → 周線
};

// 支持的時間框架（每個週期可選）
const PERIOD_SUPPORTED_TIMEFRAMES = {
  'intraday': ['1min', '5min', '15min', '30min'],
  'swing': ['1h', '4h'],
  'position': ['1d'],
  'longterm': ['1w', '1M']
};
```

### Discord Bot 命令格式

**方案 A: 中文簡化（推薦）**
```
/signal EUR/USD 日內
/signal EUR/USD 周內
/signal EUR/USD 月內
/signal EUR/USD 季內
```

**方案 B: 英文版本**
```
/signal EUR/USD intraday
/signal EUR/USD swing
/signal EUR/USD position
/signal EUR/USD longterm
```

**默認行為**:
```
/signal EUR/USD
→ 默認使用「周內交易」(最適合散戶)
```

---

## 信號展示格式變更

### 當前格式
```
📊 Trading Signal: EUR/USD
🟢 Signal: BUY
💪 Confidence: 85%
⏰ Timeframe: 1H
```

### 新格式
```
📊 Trading Signal: EUR/USD
📈 交易週期: 周內交易 (Swing Trading)
⏰ 持倉時長: 2-10天
🎯 分析週期: 1小時K線

🟢 Signal: BUY
💪 Confidence: 85%
📉 Technical Indicators: ...
```

---

## 數據庫 Schema 考慮

### UserSubscription 表（未來）
```sql
-- 當前
pair VARCHAR(10), -- EUR/USD
timeframe VARCHAR(10), -- 1h

-- 未來（保持兼容）
pair VARCHAR(10), -- EUR/USD
period VARCHAR(20), -- swing
timeframe VARCHAR(10) -- 1h (自動映射，保持向後兼容)
```

### SignalChangeHistory 表（暫不改動）
```sql
-- 保持現有結構
-- timeframe 仍然存儲技術時間框架（1h, 15min等）
```

---

## 實現階段

### Phase 1: Backend API 映射層（1天）
- [ ] 創建 `periodMapper.js` 工具
- [ ] Backend API 接受 `period` 參數
- [ ] 保持 `timeframe` 向後兼容
- [ ] 添加映射日誌

### Phase 2: Discord Bot 命令更新（2天）
- [ ] 更新 `/signal` 命令參數
- [ ] 添加中文週期選項
- [ ] 更新 Embed 展示格式
- [ ] 添加新手引導提示

### Phase 3: 教育和文檔（1天）
- [ ] 更新 README
- [ ] 創建交易週期教育文檔
- [ ] Discord 幫助命令更新

### Phase 4: 訂閱系統遷移（未來）
- [ ] 數據庫 schema 更新
- [ ] 訂閱邏輯遷移
- [ ] 通知系統適配

---

## 風險和挑戰

### 1. ML 模型可用性
**問題**: 並非所有時間框架都有訓練好的模型
**解決方案**:
- ✅ 周內交易（1h）- 已有 v3.2 模型
- ⚠️ 日內交易（15min）- 需確認模型
- ❌ 月內交易（1d）- 可能需要訓練
- ❌ 季內交易（1w）- 可能需要訓練

### 2. 用戶習慣遷移
**問題**: 現有用戶習慣使用 timeframe 參數
**解決方案**:
- 兩套參數並存6個月
- 逐步引導遷移
- 保持向後兼容

### 3. 訂閱系統複雜性
**問題**: 現有訂閱基於 timeframe，改動影響面大
**解決方案**:
- Phase 1-2 暫不改動訂閱
- 先在信號查詢實現
- Phase 4 再遷移訂閱系統

---

## 用戶體驗流程

### 新用戶首次使用
```
用戶: /signal EUR/USD

Bot:
📊 請選擇交易週期 | Choose Trading Period

🔥 日內交易 (Day Trading)
   當天買賣，快進快出
   持倉時間：幾分鐘-幾小時
   風險：⚠️⚠️⚠️ 高 | 最低資金：$5,000

📈 周內交易 (Swing Trading) ⭐ 推薦新手
   波段操作，捕捉短期趨勢
   持倉時間：2-10天
   風險：⚠️⚠️ 中等 | 最低資金：$2,000

📊 月內交易 (Position Trading)
   趨勢跟隨，中期持倉
   持倉時間：數週-2個月
   風險：⚠️ 中低 | 最低資金：$1,000

🎯 季內交易 (Long-term Trading)
   戰略配置，長期持有
   持倉時間：數月-1年
   風險：✅ 低 | 最低資金：$500

💡 提示：首次使用建議選擇「周內交易」，適合上班族和新手
```

### 熟悉用戶快速查詢
```
用戶: /signal EUR/USD 周內

Bot: [直接返回信號，無需二次確認]
📊 Trading Signal: EUR/USD
📈 交易週期: 周內交易 (Swing Trading)
🟢 Signal: BUY
💪 Confidence: 85%
...
```

---

## 推薦實現方案

### 🎯 最終推薦

1. **Backend**:
   - 統一使用 `period` 作為主要參數
   - 保留 `timeframe` 參數向後兼容（6個月後棄用警告）

2. **Discord Bot**:
   - 使用中文簡化版：`/signal EUR/USD 周內`
   - 默認週期：周內交易
   - 首次使用顯示教育Embed

3. **ML Engine**:
   - 保持現有 timeframe 參數不變
   - Backend 做映射轉換

4. **訂閱系統**:
   - Phase 1-2 暫不改動
   - Phase 4 再考慮遷移

---

## 測試計劃

### 單元測試
- [ ] Period to timeframe 映射測試
- [ ] 向後兼容性測試
- [ ] 無效參數處理測試

### 集成測試
- [ ] Discord Bot 命令測試
- [ ] Backend API 測試
- [ ] ML Engine 調用測試

### 用戶測試
- [ ] 新用戶體驗測試
- [ ] 熟悉用戶遷移測試
- [ ] 中英文切換測試
