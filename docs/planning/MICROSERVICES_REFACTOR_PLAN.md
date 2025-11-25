# AIFX v2 微服務架構重構計劃

**文檔版本**: 1.0
**創建日期**: 2025-11-20
**重構策略**: 漸進式遷移 (Incremental Migration)
**目標**: 實現服務獨立運作,降低耦合,提高可維護性

---

## 📑 目錄

1. [重構目標](#1-重構目標)
2. [架構設計決策](#2-架構設計決策)
3. [目標架構圖](#3-目標架構圖)
4. [漸進式遷移路線圖](#4-漸進式遷移路線圖)
5. [服務邊界定義](#5-服務邊界定義)
6. [API 契約規範](#6-api-契約規範)
7. [數據庫策略](#7-數據庫策略)
8. [實施步驟](#8-實施步驟)
9. [測試策略](#9-測試策略)
10. [風險管理](#10-風險管理)

---

## 1. 重構目標

### 1.1 核心原則

基於用戶需求的四大原則:

```
┌─────────────────────────────────────────────────────────┐
│                   重構核心原則                            │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1️⃣  獨立運作 (Independent Operation)                    │
│      每個服務可獨立啟動、測試、部署、擴展                   │
│      服務故障不會導致整個系統崩潰                          │
│                                                           │
│  2️⃣  簡化流程 (Simplified Process)                       │
│      清晰的服務職責和邊界                                 │
│      減少複雜的依賴關係                                   │
│      統一的錯誤處理和日誌記錄                             │
│                                                           │
│  3️⃣  API 通信 (API-Only Communication)                   │
│      服務間只能通過 REST API 互相調用                     │
│      禁止直接訪問其他服務的數據庫                         │
│      明確的 API 版本管理和契約                            │
│                                                           │
│  4️⃣  上下文管理 (Context Management)                     │
│      在 CLAUDE.md 中記錄架構決策                          │
│      確保 Claude Code 記住重構原則                        │
│      長期維護的架構指南                                   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 1.2 期望成果

| 目標 | 現狀 | 期望 |
|------|------|------|
| **服務獨立性** | Backend/Discord Bot 共享數據庫模型 | 只通過 API 通信 |
| **部署獨立性** | 整體部署,一個服務掛掉影響全部 | 可獨立部署,故障隔離 |
| **測試獨立性** | 測試需要啟動所有服務 | 可獨立測試,使用 Mock |
| **程式碼複雜度** | 耦合度高,難以維護 | 清晰的服務邊界 |
| **錯誤隔離** | 級聯錯誤,難以定位 | 錯誤隔離,易於追蹤 |

---

## 2. 架構設計決策

基於用戶的選擇,制定以下架構決策:

### 2.1 決策記錄

| 決策點 | 選擇 | 理由 |
|-------|------|------|
| **數據庫策略** | 共享數據庫 + API 層 | 簡化數據一致性,Backend 作為數據訪問層 |
| **Discord Bot 架構** | 完全獨立服務 | 符合微服務原則,通過 Backend API 獲取數據 |
| **ML Engine 通信** | 純 REST API | 簡單、標準、易於監控和擴展 |
| **重構策略** | 漸進式遷移 | 保持系統運行,降低風險,逐步完善 |

### 2.2 技術棧確認

```yaml
Services:
  Backend:
    Language: Node.js (Express)
    Port: 3000
    Database: PostgreSQL (直接訪問)
    Cache: Redis
    API: REST + WebSocket

  ML Engine:
    Language: Python (FastAPI)
    Port: 8000
    Database: 無 (通過 Backend API 獲取數據)
    Storage: 本地文件系統 (模型、訓練數據)
    API: REST

  Discord Bot:
    Language: Node.js (Discord.js)
    Port: 無 (Discord WebSocket)
    Database: 無 (通過 Backend API)
    Cache: 本地內存緩存
    API: REST Client (調用 Backend)

  Frontend:
    Language: React + Vite
    Port: 5173
    API: REST + WebSocket Client
```

---

## 3. 目標架構圖

### 3.1 整體服務架構

```
┌─────────────────────────────────────────────────────────────────┐
│                      AIFX v2 微服務架構                           │
└─────────────────────────────────────────────────────────────────┘

                         ┌─────────────┐
                         │  Frontend   │
                         │  React      │
                         │  Port: 5173 │
                         └──────┬──────┘
                                │
                    HTTP/REST + WebSocket
                                │
                   ┌────────────┴────────────┐
                   │                         │
              ┌────▼────┐              ┌────▼────┐
              │ Apache  │              │ Nginx   │ (未來)
              │ Proxy   │              │ Gateway │
              └────┬────┘              └─────────┘
                   │
       ┌───────────┼───────────┐
       │           │           │
  ┌────▼────┐ ┌───▼────┐ ┌────▼────┐
  │ Backend │ │ML Engine│ │Discord  │
  │ API     │ │  API    │ │  Bot    │
  │Port:3000│ │Port:8000│ │(WebSock)│
  └────┬────┘ └────┬────┘ └────┬────┘
       │           │           │
       │           │           │
       │  REST API │           │ REST API
       │    ◄──────┘           │
       │                       │
       │  REST API             │
       └──────────────────────►│
       │
       │ (唯一數據庫訪問者)
       │
  ┌────▼────────┐
  │ PostgreSQL  │
  │   Database  │
  └─────────────┘
       ▲
       │
  ┌────┴────┐
  │  Redis  │
  │  Cache  │
  └─────────┘
```

### 3.2 服務通信矩陣

| From ↓ / To → | Frontend | Backend | ML Engine | Discord Bot | PostgreSQL | Redis |
|---------------|----------|---------|-----------|-------------|------------|-------|
| **Frontend** | - | ✅ REST/WS | ❌ | ❌ | ❌ | ❌ |
| **Backend** | ✅ WS推送 | - | ✅ REST | ❌ | ✅ 直接訪問 | ✅ 直接訪問 |
| **ML Engine** | ❌ | ✅ REST回調 | - | ❌ | ❌ | ❌ |
| **Discord Bot** | ❌ | ✅ REST | ❌ | - | ❌ | ❌ |

**圖例**:
- ✅ = 允許的通信方式
- ❌ = 禁止的通信方式

---

## 4. 漸進式遷移路線圖

### 4.1 遷移階段概覽

```
┌──────────────────────────────────────────────────────┐
│         漸進式遷移 - 5 個階段                          │
├──────────────────────────────────────────────────────┤
│                                                        │
│  階段 1  │  階段 2  │  階段 3  │  階段 4  │  階段 5   │
│  定義    │  解耦    │  API化   │  測試    │  優化     │
│  1週     │  2週     │  2週     │  1週     │  持續     │
│                                                        │
└──────────────────────────────────────────────────────┘

Week 1-2   : 🔍 定義服務邊界和 API 契約
Week 3-4   : 🔨 Backend API 開發 (Discord Bot 數據訪問)
Week 5-6   : 🔨 Backend API 開發 (ML Engine 數據訪問)
Week 7-8   : 🔨 Discord Bot 重構 (移除直接數據庫訪問)
Week 9-10  : 🔨 ML Engine 重構 (使用 Backend API)
Week 11-12 : ✅ 集成測試和驗證
Week 13+   : 🚀 性能優化和監控
```

### 4.2 階段 1: 定義服務邊界 (Week 1-2)

**目標**: 明確每個服務的職責和 API 契約

**任務清單**:
- [ ] 分析現有程式碼,識別服務間的依賴關係
- [ ] 定義 Backend API 端點 (for Discord Bot)
- [ ] 定義 Backend API 端點 (for ML Engine)
- [ ] 定義 ML Engine API 端點 (for Backend)
- [ ] 創建 API 文檔 (OpenAPI/Swagger)
- [ ] 確定需要遷移的數據庫模型

**產出物**:
```
docs/api/
├── backend-api-spec.yaml       # Backend API OpenAPI 規範
├── ml-engine-api-spec.yaml     # ML Engine API OpenAPI 規範
├── service-boundaries.md       # 服務邊界定義
└── migration-checklist.md      # 遷移檢查清單
```

**驗收標準**:
- ✅ 所有服務 API 文檔完成
- ✅ 團隊 Review 並達成共識
- ✅ 識別所有需要重構的程式碼位置

---

### 4.3 階段 2: 解耦準備 (Week 3-4)

**目標**: 建立 Backend API 層,為解耦做準備

**任務清單**:

#### Backend API 開發 (Discord Bot 數據訪問)
- [ ] 創建 `/api/v1/discord/users` 端點
  - `GET /api/v1/discord/users/:discordId` - 獲取用戶資料
  - `POST /api/v1/discord/users` - 創建/更新用戶
  - `PUT /api/v1/discord/users/:discordId/settings` - 更新設置
- [ ] 創建 `/api/v1/discord/signals` 端點
  - `GET /api/v1/discord/signals` - 獲取待發送信號
  - `POST /api/v1/discord/signals/:id/delivered` - 標記已發送
- [ ] 創建 `/api/v1/discord/trades` 端點
  - `GET /api/v1/discord/trades/:userId` - 獲取用戶交易
  - `POST /api/v1/discord/trades` - 記錄交易
- [ ] 添加認證中間件 (API Key for Discord Bot)
- [ ] 添加速率限制
- [ ] 添加錯誤處理

#### 測試
- [ ] 編寫單元測試
- [ ] 編寫集成測試
- [ ] 性能測試 (確保 API 響應時間 < 100ms)

**產出物**:
```
backend/src/routes/api/v1/discord/
├── users.js
├── signals.js
└── trades.js

backend/src/middleware/
└── discordApiAuth.js

backend/src/tests/api/discord/
├── users.test.js
├── signals.test.js
└── trades.test.js
```

**驗收標準**:
- ✅ 所有 Discord Bot API 端點可用
- ✅ 單元測試覆蓋率 > 80%
- ✅ API 文檔自動生成 (Swagger UI)
- ✅ 響應時間 < 100ms (p95)

---

### 4.4 階段 3: API 化 ML Engine (Week 5-6)

**目標**: 建立 Backend API 供 ML Engine 獲取訓練數據

**任務清單**:

#### Backend API 開發 (ML Engine 數據訪問)
- [ ] 創建 `/api/v1/ml/training-data` 端點
  - `GET /api/v1/ml/training-data/market/:pair` - 獲取市場數據
  - `GET /api/v1/ml/training-data/signals` - 獲取歷史信號
  - `GET /api/v1/ml/training-data/economic-events` - 獲取經濟事件
- [ ] 創建 `/api/v1/ml/models` 端點
  - `POST /api/v1/ml/models/version` - 註冊新模型版本
  - `PUT /api/v1/ml/models/:id/status` - 更新模型狀態
- [ ] 創建 `/api/v1/ml/predictions` 端點
  - `POST /api/v1/ml/predictions` - 記錄預測結果
  - `GET /api/v1/ml/predictions/accuracy` - 獲取準確度統計
- [ ] 添加 ML Engine API Key 認證
- [ ] 數據分頁和壓縮 (大量訓練數據)

#### ML Engine 更新
- [ ] 創建 Backend API Client
- [ ] 更新數據收集邏輯 (從 Backend API 獲取)
- [ ] 保留本地緩存機制
- [ ] 添加 API 錯誤處理和重試邏輯

**產出物**:
```
backend/src/routes/api/v1/ml/
├── training-data.js
├── models.js
└── predictions.js

ml_engine/api/clients/
├── backend_client.py
└── data_fetcher.py

ml_engine/tests/
└── test_backend_client.py
```

**驗收標準**:
- ✅ ML Engine 可通過 API 獲取所有訓練數據
- ✅ API 支持批量查詢 (減少請求次數)
- ✅ 數據傳輸壓縮 (gzip)
- ✅ 本地緩存有效 (減少重複請求)

---

### 4.5 階段 4: Discord Bot 重構 (Week 7-8)

**目標**: 移除 Discord Bot 的直接數據庫訪問,改用 Backend API

**任務清單**:

#### 重構步驟
- [ ] 創建 Backend API Client
  ```javascript
  // discord_bot/services/backendApiClient.js
  class BackendApiClient {
    async getUser(discordId) { ... }
    async updateSettings(discordId, settings) { ... }
    async getSignals() { ... }
  }
  ```
- [ ] 重構 `/subscribe` 命令
  - 移除: `require('../models/UserDiscordSettings')`
  - 改用: `backendApiClient.updateSettings()`
- [ ] 重構 `/preferences` 命令
  - 移除: 直接查詢數據庫
  - 改用: `backendApiClient.getUser()`
- [ ] 重構信號監聽邏輯
  - 移除: 直接訪問 `TradingSignal` 模型
  - 改用: `backendApiClient.getSignals()`
- [ ] 刪除 `discord_bot/models/` 目錄
- [ ] 刪除數據庫配置 (`config/database.js`)
- [ ] 更新環境變數 (移除 `DATABASE_URL`,添加 `BACKEND_API_URL`)

#### 測試
- [ ] 端到端測試 (使用 Backend API)
- [ ] 確保所有 Discord 命令正常工作
- [ ] 性能測試 (API 調用延遲)

**產出物**:
```
discord_bot/services/
└── backendApiClient.js

discord_bot/.env (更新)
- DATABASE_URL                (刪除)
+ BACKEND_API_URL=http://localhost:3000/api/v1
+ BACKEND_API_KEY=secret_key_here
```

**驗收標準**:
- ✅ Discord Bot 不再有任何數據庫依賴
- ✅ 所有命令功能正常
- ✅ 信號推送延遲 < 2 秒
- ✅ 可獨立啟動 Discord Bot (不需要數據庫連接)

---

### 4.6 階段 5: 測試與驗證 (Week 9-10)

**目標**: 全面測試和驗證微服務架構

**測試矩陣**:

| 測試類型 | 範圍 | 工具 | 目標 |
|---------|------|------|------|
| **單元測試** | 每個服務 | Jest, Pytest | 覆蓋率 > 80% |
| **集成測試** | API 端點 | Supertest, Postman | 所有端點正常 |
| **端到端測試** | 完整流程 | Playwright | 關鍵流程通過 |
| **性能測試** | API 響應 | Artillery, k6 | p95 < 200ms |
| **負載測試** | 並發處理 | Apache Bench | 100 req/s |
| **故障測試** | 服務隔離 | 手動 | 服務掛掉不影響其他 |

**任務清單**:
- [ ] 編寫端到端測試腳本
- [ ] 性能基準測試
- [ ] 故障注入測試 (kill 一個服務,驗證其他服務正常)
- [ ] API 契約測試 (Pact or similar)
- [ ] 文檔更新

**驗收標準**:
- ✅ 所有測試通過
- ✅ 性能指標達標
- ✅ 故障隔離有效
- ✅ 文檔完整更新

---

## 5. 服務邊界定義

### 5.1 Backend API Service

**職責**:
- 用戶認證和授權
- 數據庫訪問層 (唯一可以直接訪問 PostgreSQL 的服務)
- 市場數據收集和緩存
- 交易信號生成邏輯
- WebSocket 推送 (to Frontend)
- 為其他服務提供數據訪問 API

**不負責**:
- Discord 消息發送 (由 Discord Bot 負責)
- ML 模型訓練 (由 ML Engine 負責)

**依賴**:
- PostgreSQL (直接訪問)
- Redis (直接訪問)
- ML Engine API (HTTP REST)

**被依賴**:
- Frontend (HTTP REST + WebSocket)
- Discord Bot (HTTP REST)
- ML Engine (HTTP REST)

---

### 5.2 ML Engine Service

**職責**:
- ML 模型訓練
- 價格反轉預測
- 模型版本管理
- 訓練日誌記錄
- 提供預測 API

**不負責**:
- 數據收集 (通過 Backend API 獲取)
- 交易信號生成 (提供預測,由 Backend 整合)
- 用戶管理

**依賴**:
- Backend API (獲取訓練數據)
- 本地文件系統 (模型存儲)

**被依賴**:
- Backend (調用預測 API)

---

### 5.3 Discord Bot Service

**職責**:
- Discord 命令處理
- Discord 消息發送
- 交易信號推送 (to Discord)
- Discord 用戶互動

**不負責**:
- 數據存儲 (通過 Backend API)
- 交易邏輯 (通過 Backend API)
- 市場數據收集

**依賴**:
- Backend API (所有數據訪問)
- Discord API (WebSocket)

**被依賴**:
- 無 (純通知服務)

---

### 5.4 Frontend Service

**職責**:
- 用戶界面
- WebSocket 連接 (接收實時信號)
- 圖表展示
- 用戶設置管理

**依賴**:
- Backend API (HTTP REST + WebSocket)

**被依賴**:
- 無

---

## 6. API 契約規範

### 6.1 統一 API 響應格式

所有服務必須使用統一的響應格式:

```json
{
  "success": true,
  "data": {
    "...": "實際數據"
  },
  "error": null,
  "metadata": {
    "timestamp": "2025-11-20T10:30:00Z",
    "version": "v1",
    "requestId": "uuid-here"
  }
}
```

**錯誤響應**:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_PAIR",
    "message": "Invalid currency pair format",
    "details": {}
  },
  "metadata": {
    "timestamp": "2025-11-20T10:30:00Z",
    "version": "v1",
    "requestId": "uuid-here"
  }
}
```

### 6.2 API 版本管理

- 所有 API 路徑包含版本號: `/api/v1/...`
- 向後兼容變更: 小版本號 (v1.1, v1.2)
- 破壞性變更: 大版本號 (v2)
- 同時維護 2 個版本 (current + previous)

### 6.3 認證機制

**API Key 認證**:
```http
GET /api/v1/discord/users/123456
Authorization: Bearer <API_KEY>
X-Service-Name: discord-bot
```

**JWT 認證** (Frontend):
```http
GET /api/v1/trading/signals
Authorization: Bearer <JWT_TOKEN>
```

### 6.4 速率限制

| 服務 | 速率限制 | 說明 |
|------|---------|------|
| Frontend | 100 req/min/user | 用戶級別限制 |
| Discord Bot | 500 req/min | 服務級別限制 |
| ML Engine | 1000 req/min | 訓練數據批量查詢 |

---

## 7. 數據庫策略

### 7.1 架構決策

**選擇**: 共享數據庫 + API 層

**實施細節**:

```
┌─────────────────────────────────────────────┐
│           數據訪問架構                        │
├─────────────────────────────────────────────┤
│                                               │
│   Discord Bot  ──┐                           │
│                  │  REST API                 │
│   ML Engine   ──┼─────────►  Backend API    │
│                  │                           │
│   Frontend    ──┘                 │          │
│                                   │          │
│                              (ORM/Sequelize) │
│                                   │          │
│                                   ▼          │
│                            ┌─────────────┐  │
│                            │ PostgreSQL  │  │
│                            │  Database   │  │
│                            └─────────────┘  │
│                                               │
└─────────────────────────────────────────────┘
```

### 7.2 數據訪問規則

**允許**:
- ✅ Backend 直接訪問 PostgreSQL (使用 Sequelize ORM)
- ✅ Backend 提供 REST API 供其他服務訪問數據

**禁止**:
- ❌ Discord Bot 直接訪問 PostgreSQL
- ❌ ML Engine 直接訪問 PostgreSQL
- ❌ Frontend 直接訪問 PostgreSQL
- ❌ 服務之間共享 ORM 模型

### 7.3 數據模型遷移

**移除重複模型**:
```bash
# 刪除 Discord Bot 的數據庫模型
rm -rf discord_bot/models/
rm -rf discord_bot/config/database.js

# 所有模型集中在 Backend
backend/src/models/
├── User.js
├── UserDiscordSettings.js
├── TradingSignal.js
├── MarketData.js
└── ...
```

---

## 8. 實施步驟

### 8.1 第一步: 環境準備 (Day 1-2)

```bash
# 1. 創建分支
git checkout -b refactor/microservices-architecture

# 2. 創建目錄結構
mkdir -p docs/api
mkdir -p backend/src/routes/api/v1/{discord,ml}
mkdir -p backend/src/middleware
mkdir -p backend/src/tests/api/{discord,ml}

# 3. 安裝依賴
cd backend && npm install swagger-jsdoc swagger-ui-express
cd ml_engine && pip install httpx tenacity
```

### 8.2 第二步: API 規範文檔 (Day 3-7)

```bash
# 使用 OpenAPI 3.0 規範
# 參考: docs/api/backend-api-spec.yaml

# 生成 Swagger UI
# 訪問: http://localhost:3000/api-docs
```

### 8.3 第三步: Backend API 開發 (Day 8-28)

詳見階段 2 和階段 3 的任務清單。

### 8.4 第四步: Discord Bot 重構 (Day 29-42)

詳見階段 4 的任務清單。

### 8.5 第五步: 測試和部署 (Day 43-56)

詳見階段 5 的任務清單。

---

## 9. 測試策略

### 9.1 測試金字塔

```
        ┌───────┐
        │  E2E  │  10%  (端到端測試)
        ├───────┤
        │  整合  │  30%  (API 集成測試)
        ├───────┤
        │  單元  │  60%  (服務/函數測試)
        └───────┘
```

### 9.2 測試清單

#### Backend API 測試
```javascript
// backend/src/tests/api/discord/users.test.js
describe('Discord Users API', () => {
  test('GET /api/v1/discord/users/:discordId', async () => {
    const response = await request(app)
      .get('/api/v1/discord/users/123456')
      .set('Authorization', 'Bearer test_api_key');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

#### Discord Bot 測試
```javascript
// discord_bot/tests/backendApiClient.test.js
describe('Backend API Client', () => {
  test('getUser() returns user data', async () => {
    const client = new BackendApiClient();
    const user = await client.getUser('123456');
    expect(user).toHaveProperty('discordId');
  });
});
```

#### ML Engine 測試
```python
# ml_engine/tests/test_backend_client.py
def test_fetch_training_data():
    client = BackendClient()
    data = client.get_training_data('EURUSD')
    assert len(data) > 0
```

### 9.3 故障測試場景

| 場景 | 操作 | 預期結果 |
|------|------|---------|
| Backend 掛掉 | kill Backend | Discord Bot 返回友好錯誤,不崩潰 |
| ML Engine 掛掉 | kill ML Engine | Backend 使用技術指標,繼續服務 |
| Discord Bot 掛掉 | kill Discord Bot | Backend/ML 正常運行 |
| Database 掛掉 | stop PostgreSQL | Backend 返回 503,其他服務優雅降級 |

---

## 10. 風險管理

### 10.1 風險識別

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|-------|------|---------|
| API 性能下降 | 中 | 高 | 添加緩存,數據庫查詢優化 |
| 網絡延遲增加 | 中 | 中 | 本地緩存,批量 API 調用 |
| 服務依賴循環 | 低 | 高 | 嚴格 Review,架構圖驗證 |
| 數據不一致 | 低 | 高 | 事務處理,API 冪等性 |
| 遷移失敗 | 低 | 高 | 保留舊代碼,可快速回滾 |

### 10.2 回滾計劃

```bash
# 如果遷移失敗,可快速回滾
git checkout main
./scripts/deployment/deploy.sh

# 保留舊版本 Docker 鏡像
docker images | grep aifx_v2 | grep before-refactor
```

### 10.3 監控指標

部署後需監控的關鍵指標:

| 指標 | 閾值 | 告警 |
|------|------|------|
| API 響應時間 (p95) | < 200ms | > 500ms 告警 |
| API 錯誤率 | < 1% | > 5% 告警 |
| 服務可用性 | > 99.5% | < 99% 告警 |
| Discord 推送延遲 | < 2s | > 5s 告警 |
| ML 預測時間 | < 1s | > 3s 告警 |

---

## 11. 成功指標

### 11.1 技術指標

- ✅ 所有服務可獨立啟動和測試
- ✅ 無直接數據庫訪問 (除 Backend)
- ✅ API 文檔完整且自動生成
- ✅ 測試覆蓋率 > 80%
- ✅ 性能無明顯下降 (< 10% 延遲增加)

### 11.2 架構指標

- ✅ 服務耦合度降低 (可測量: 服務間依賴數量)
- ✅ 程式碼重複減少 (刪除重複的數據庫模型)
- ✅ 錯誤隔離有效 (一個服務掛掉不影響其他)
- ✅ 部署獨立性 (可單獨部署任一服務)

### 11.3 維護性指標

- ✅ 新開發者理解架構時間 < 1 天
- ✅ 添加新 API 端點時間 < 2 小時
- ✅ 故障排查時間減少 50%
- ✅ 代碼審查時間減少 30%

---

## 12. 下一步行動

基於本計劃,下一步行動:

1. **Review 本計劃** (1 天)
   - 團隊討論和確認
   - 調整時間估算

2. **更新 CLAUDE.md** (立即)
   - 添加微服務架構原則
   - 添加服務通信規則
   - 添加 API 設計規範

3. **創建 API 規範文檔** (Week 1)
   - 使用 OpenAPI 3.0
   - Swagger UI 自動生成

4. **開始階段 2 實施** (Week 3)
   - Backend API 開發
   - 單元測試編寫

---

**文檔維護**:
- 本計劃應隨著實施進度更新
- 每個階段完成後記錄實際進度和問題
- 重大決策變更需更新本文檔

**最後更新**: 2025-11-20
**下次 Review**: 2025-11-27 (1 週後)
