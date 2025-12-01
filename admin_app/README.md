# AIFX Admin Desktop App

Python 桌面管理應用程式，用於管理 AIFX 交易系統。

## 兩個版本

| 檔案 | 連接方式 | 說明 |
|------|----------|------|
| `aifx_admin.py` | HTTP REST API | 簡單版，需要 API URL |
| `aifx_admin_ws.py` | **WebSocket** | 推薦，即時連接，更穩定 |

## 安裝

### Windows
```bash
pip install requests python-socketio[client]
```

### macOS / Linux
```bash
pip3 install requests python-socketio[client]
```

## 執行

### WebSocket 版本 (推薦)
```bash
python aifx_admin_ws.py
```

### REST API 版本
```bash
python aifx_admin.py
```

## 使用方式

1. 輸入伺服器地址 (Cloudflare Tunnel URL)
2. 輸入帳號: `admin`
3. 輸入密碼: `00000000`
4. 點擊「連接並登入」

## 功能

- 📊 **總覽**: 查看系統狀態、統計數據
- 👥 **用戶管理**: 查看用戶列表、啟用/停用用戶
- 📈 **訊號管理**: 查看交易訊號記錄
- 🤖 **ML 模型**: 查看模型狀態

## WebSocket 版本優點

- 即時連接，不需要每次請求都建立新連接
- 更低延遲
- 自動處理連線狀態
- 更好的錯誤處理

## 注意事項

- 需要有網路連線
- Cloudflare Quick Tunnel 的網址會變動，請確認使用最新網址
- Tkinter 是 Python 內建的，不需額外安裝
