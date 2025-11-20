# End-to-End 測試指南 - AIFX_v2

## 📊 系統狀態確認

### ✅ 所有服務運行中

```bash
ML Engine API     (port 8000) ✅ Running
Backend API       (port 3000) ✅ Running
Frontend          (port 5173) ✅ Running
PostgreSQL        (port 5432) ✅ Running
Redis             (port 6379) ✅ Running
```

---

## 🔍 測試流程

### **測試 1: 瀏覽器訪問 Frontend**

**目的:** 驗證 Frontend 正常運行

**步驟:**
1. 打開瀏覽器
2. 訪問: `http://localhost:5173` 或 `http://168.138.182.181`
3. 預期看到: AIFX_v2 登入頁面

**驗證點:**
- ✅ 頁面正常載入
- ✅ 顯示登入表單
- ✅ 無 console 錯誤

---

### **測試 2: 用戶登入**

**目的:** 獲取 JWT token，測試認證流程

**現有測試用戶:**
- Email: `john@example.com`
- Email: `sarah@example.com`
- Email: `demo@example.com`

**步驟:**
1. 在登入頁面輸入用戶名/Email
2. 輸入密碼 (如果不知道密碼，跳到測試 3 註冊新用戶)
3. 點擊登入

**驗證點:**
- ✅ 成功登入跳轉到 Dashboard
- ✅ 顯示用戶名稱
- ✅ LocalStorage 有 token

**檢查方式:**
```javascript
// 在瀏覽器 Console 執行
localStorage.getItem('token')
// 應該看到 JWT token
```

---

### **測試 3: 註冊新用戶** (如果登入失敗)

**目的:** 創建測試用戶

**步驟:**
1. 點擊 "註冊" 或 "Sign Up"
2. 填寫表單:
   - Email: test@test.com
   - Username: testuser
   - Password: Test123456@
   - Confirm Password: Test123456@
   - Full Name: Test User
3. 提交註冊

**驗證點:**
- ✅ 註冊成功
- ✅ 自動登入或跳轉到登入頁

---

### **測試 4: Dashboard 顯示**

**目的:** 驗證 Dashboard 組件載入

**步驟:**
1. 登入後自動進入 Dashboard
2. 觀察頁面內容

**預期看到:**
- ✅ Market Overview (市場概覽)
- ✅ K線圖組件
- ✅ 交易信號列表 (如果有的話)
- ✅ 貨幣對選擇器

**檢查 Console:**
```javascript
// 檢查是否有 API 錯誤
// 應該沒有 CORS 或 404 錯誤
```

---

### **測試 5: 生成交易信號** (關鍵測試)

**目的:** 測試 Frontend → Backend → ML Engine 完整流程

**步驟:**

**方式 A: 通過 UI 操作**
1. 在 Dashboard 或 Trading View 頁面
2. 選擇貨幣對 (例如: EUR/USD)
3. 選擇時間框架 (例如: 1h)
4. 點擊 "獲取信號" 或 "Generate Signal" 按鈕
5. 等待響應 (1-3秒)

**方式 B: 通過 Console 測試**
```javascript
// 在瀏覽器 Console 執行
fetch('/api/v1/trading/signal/EUR/USD?timeframe=1h', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
})
.then(res => res.json())
.then(data => console.log('Signal:', data))
```

**預期響應:**
```json
{
  "success": true,
  "data": {
    "pair": "EUR/USD",
    "timeframe": "1h",
    "signal": "hold" | "buy" | "sell",
    "confidence": 0.XX,
    "price": 1.XXXX,
    "timestamp": "2025-10-30T..."
  }
}
```

**驗證點:**
- ✅ 請求成功 (HTTP 200)
- ✅ 返回 signal 數據
- ✅ signal 為 "hold", "buy" 或 "sell"
- ✅ confidence 在 0-1 之間
- ✅ 頁面顯示信號

---

### **測試 6: 檢查 K線圖**

**目的:** 驗證圖表渲染和信號標記

**步驟:**
1. 進入 Trading View 頁面
2. 選擇貨幣對
3. 觀察圖表

**預期看到:**
- ✅ K線圖正常顯示
- ✅ 有歷史價格數據 (可能是 mock data)
- ✅ 信號標記在圖表上 (buy/sell 箭頭或標記)
- ✅ 時間軸和價格軸正確

**檢查 Console:**
```javascript
// 不應該有 Chart.js 錯誤
// 不應該有數據加載錯誤
```

---

### **測試 7: 後端日誌檢查**

**目的:** 確認 Backend 正確調用 ML Engine

**檢查 Backend 日誌:**
```bash
# 查看最近的 Backend 日誌
tail -f /root/AIFX_v2/backend/logs/app.log

# 或者如果是 console 輸出
pm2 logs backend --lines 50
```

**應該看到:**
```
INFO: User X requesting signal for EUR/USD
INFO: Requesting ML prediction from http://localhost:8000
INFO: ML prediction received: hold (confidence: 0.99)
```

---

### **測試 8: ML Engine 日誌檢查**

**目的:** 確認 ML Engine 收到請求並返回預測

**檢查 ML Engine 日誌:**
```bash
tail -50 /tmp/ml_api_fixed.log | grep -E "predict|prediction|EUR"
```

**應該看到:**
```
INFO: Raw reversal prediction request: EUR/USD 1h (20 candles)
INFO: Model v3.2 requires 38 features
INFO: Technical indicators calculated: XX rows remaining
INFO: ✅ All 38 required features present
INFO: Using raw features (no scaling): (XX, 38)
INFO: Model sequence length: 20
INFO: Prepared sequence: (1, 20, 38)
```

---

## 🧪 API 直接測試

如果 Frontend 有問題，可以直接測試 API：

### **測試 A: ML Engine 直接測試**

```bash
curl -X POST http://localhost:8000/reversal/predict_raw \
  -H 'Content-Type: application/json' \
  -d '{
    "pair": "EUR/USD",
    "timeframe": "1h",
    "data": [
      {"timestamp": "2025-10-30T10:00:00", "open": 1.0850, "high": 1.0865, "low": 1.0845, "close": 1.0860, "volume": 1000},
      {"timestamp": "2025-10-30T11:00:00", "open": 1.0860, "high": 1.0875, "low": 1.0855, "close": 1.0870, "volume": 1100},
      {"timestamp": "2025-10-30T12:00:00", "open": 1.0870, "high": 1.0880, "low": 1.0860, "close": 1.0875, "volume": 1200},
      {"timestamp": "2025-10-30T13:00:00", "open": 1.0875, "high": 1.0890, "low": 1.0870, "close": 1.0885, "volume": 1300},
      {"timestamp": "2025-10-30T14:00:00", "open": 1.0885, "high": 1.0895, "low": 1.0875, "close": 1.0880, "volume": 1400},
      {"timestamp": "2025-10-30T15:00:00", "open": 1.0880, "high": 1.0885, "low": 1.0865, "close": 1.0870, "volume": 1500},
      {"timestamp": "2025-10-30T16:00:00", "open": 1.0870, "high": 1.0880, "low": 1.0860, "close": 1.0875, "volume": 1600},
      {"timestamp": "2025-10-30T17:00:00", "open": 1.0875, "high": 1.0890, "low": 1.0870, "close": 1.0885, "volume": 1700},
      {"timestamp": "2025-10-30T18:00:00", "open": 1.0885, "high": 1.0900, "low": 1.0880, "close": 1.0895, "volume": 1800},
      {"timestamp": "2025-10-30T19:00:00", "open": 1.0895, "high": 1.0905, "low": 1.0885, "close": 1.0890, "volume": 1900},
      {"timestamp": "2025-10-30T20:00:00", "open": 1.0890, "high": 1.0895, "low": 1.0875, "close": 1.0880, "volume": 2000},
      {"timestamp": "2025-10-30T21:00:00", "open": 1.0880, "high": 1.0885, "low": 1.0860, "close": 1.0865, "volume": 2100},
      {"timestamp": "2025-10-30T22:00:00", "open": 1.0865, "high": 1.0870, "low": 1.0850, "close": 1.0855, "volume": 2200},
      {"timestamp": "2025-10-30T23:00:00", "open": 1.0855, "high": 1.0865, "low": 1.0845, "close": 1.0860, "volume": 2300},
      {"timestamp": "2025-10-31T00:00:00", "open": 1.0860, "high": 1.0875, "low": 1.0855, "close": 1.0870, "volume": 2400},
      {"timestamp": "2025-10-31T01:00:00", "open": 1.0870, "high": 1.0880, "low": 1.0860, "close": 1.0875, "volume": 2500},
      {"timestamp": "2025-10-31T02:00:00", "open": 1.0875, "high": 1.0885, "low": 1.0870, "close": 1.0880, "volume": 2600},
      {"timestamp": "2025-10-31T03:00:00", "open": 1.0880, "high": 1.0890, "low": 1.0875, "close": 1.0885, "volume": 2700},
      {"timestamp": "2025-10-31T04:00:00", "open": 1.0885, "high": 1.0895, "low": 1.0880, "close": 1.0890, "volume": 2800},
      {"timestamp": "2025-10-31T05:00:00", "open": 1.0890, "high": 1.0900, "low": 1.0885, "close": 1.0895, "volume": 2900}
    ]
  }' -s | python3 -m json.tool
```

**預期輸出:**
```json
{
  "success": true,
  "data": {
    "pair": "EUR/USD",
    "timeframe": "1h",
    "signal": "hold",
    "confidence": 0.9947,
    "stage1_prob": 0.0031,
    "model_version": "v3.2"
  }
}
```

---

## ❌ 常見問題排查

### **問題 1: Frontend 無法連接 Backend**

**症狀:** Console 顯示 CORS 或 404 錯誤

**檢查:**
```bash
# 確認 Backend 運行
lsof -i :3000

# 檢查 Backend 日誌
tail -50 backend/logs/app.log
```

**解決:**
```bash
# 重啟 Backend
cd /root/AIFX_v2/backend
npm start
```

---

### **問題 2: 無法獲取交易信號**

**症狀:** API 返回 500 錯誤或 timeout

**檢查:**
```bash
# 確認 ML Engine 運行
curl http://localhost:8000/health

# 檢查 ML Engine 日誌
tail -50 /tmp/ml_api_fixed.log
```

**解決:**
```bash
# 重啟 ML Engine
cd /root/AIFX_v2/ml_engine
export LD_PRELOAD=/usr/lib/aarch64-linux-gnu/libgomp.so.1
source venv/bin/activate
uvicorn api.ml_server:app --reload --host 0.0.0.0 --port 8000
```

---

### **問題 3: K線圖不顯示**

**症狀:** 圖表空白或錯誤

**可能原因:**
1. Chart.js 未正確載入
2. 數據格式錯誤
3. yfinance API 不可用 (目前使用 mock data)

**檢查:**
```javascript
// 在瀏覽器 Console
console.log(window.Chart)  // 應該有 Chart 物件
```

---

### **問題 4: 認證失敗**

**症狀:** 401 Unauthorized

**檢查:**
```javascript
// 確認 token 存在
localStorage.getItem('token')

// 如果沒有，重新登入
```

---

## 📝 測試檢查清單

完成以下所有項目表示系統正常運行：

- [ ] **Frontend 可訪問** - http://localhost:5173 正常打開
- [ ] **用戶可登入** - 成功獲取 JWT token
- [ ] **Dashboard 載入** - 頁面無錯誤
- [ ] **選擇貨幣對** - 下拉選單正常工作
- [ ] **生成交易信號** - 點擊按鈕獲得響應
- [ ] **信號顯示正確** - signal, confidence, price 都有值
- [ ] **K線圖顯示** - 圖表渲染成功
- [ ] **Backend 日誌正常** - 有 ML prediction 請求記錄
- [ ] **ML Engine 日誌正常** - 有 predict_raw 請求處理
- [ ] **響應時間 < 3秒** - 用戶體驗良好

---

## 🎯 成功標準

**完整流程成功 = 所有以下都為真:**

1. ✅ 用戶可以登入 Frontend
2. ✅ Frontend 可以請求 Backend API
3. ✅ Backend 可以調用 ML Engine API
4. ✅ ML Engine 返回有效預測
5. ✅ Backend 處理並返回給 Frontend
6. ✅ Frontend 正確顯示交易信號
7. ✅ K線圖顯示價格和信號標記
8. ✅ 整個流程 < 3秒完成

---

## 📊 性能指標

記錄以下指標以評估系統性能：

```
Frontend 載入時間:    ____ 秒
登入響應時間:         ____ 秒
Dashboard 載入時間:   ____ 秒
信號生成時間:         ____ 秒
  - Frontend → Backend:  ____ ms
  - Backend → ML Engine: ____ ms
  - ML Engine 處理:      ____ ms
  - 返回顯示:            ____ ms
K線圖渲染時間:        ____ 秒
```

**目標值:**
- Frontend 載入: < 2秒
- 信號生成總時間: < 3秒
- ML Engine 處理: < 1秒
- K線圖渲染: < 1秒

---

## 🔧 下一步優化

測試完成後可以考慮的優化：

1. **yfinance API 修復** - 解決真實數據獲取問題
2. **Discord Bot 整合** - 測試信號推送到 Discord
3. **WebSocket 實時更新** - 啟用即時價格更新
4. **性能優化** - 減少響應時間
5. **錯誤處理改進** - 更友好的錯誤訊息
6. **用戶體驗優化** - 加載動畫、進度提示

---

**測試完成後請記錄結果並提交 GitHub Issue 或更新 SESSION_NOTES.md**
