# Discord Bot Scripts

**最後更新**: 2025-11-20
**整理行動**: ULTRATHINK 目錄清理

---

## 📁 目錄結構

```
discord_bot/scripts/
├── management/  - Bot 管理和診斷腳本
└── utils/       - 工具腳本
```

---

## 🛠️ management/ - Bot 管理腳本

### Shell 腳本

#### **start_bot.sh** (1.2K)
啟動 Discord Bot
```bash
./discord_bot/scripts/management/start_bot.sh
```

#### **stop_bot.sh** (897B)
停止 Discord Bot
```bash
./discord_bot/scripts/management/stop_bot.sh
```

#### **check_bot_instances.sh** (1.4K)
檢查運行中的 Bot 實例
```bash
./discord_bot/scripts/management/check_bot_instances.sh
```

#### **verify_fix.sh** (4.6K)
驗證 Bot 修復
```bash
./discord_bot/scripts/management/verify_fix.sh
```

---

### Node.js 腳本

#### **check_command_id.js** (899B)
檢查指令 ID
```bash
node discord_bot/scripts/management/check_command_id.js
```

#### **clear-global-commands.js** (504B)
清除全域指令
```bash
node discord_bot/scripts/management/clear-global-commands.js
```

#### **debug-interaction.js** (8.0K)
調試互動問題
```bash
node discord_bot/scripts/management/debug-interaction.js
```

#### **get-command-ids.js** (1.7K)
獲取所有指令 ID
```bash
node discord_bot/scripts/management/get-command-ids.js
```

#### **reset-commands.js** (5.0K)
重置 Discord 指令
```bash
node discord_bot/scripts/management/reset-commands.js
```

#### **verify-commands.js** (4.1K)
驗證指令註冊狀態
```bash
node discord_bot/scripts/management/verify-commands.js
```

---

## 🎯 常用命令

### 啟動/停止 Bot
```bash
# 啟動
./discord_bot/scripts/management/start_bot.sh

# 停止
./discord_bot/scripts/management/stop_bot.sh

# 檢查實例
./discord_bot/scripts/management/check_bot_instances.sh
```

### 指令管理
```bash
# 部署指令（從根目錄）
node discord_bot/deploy-commands.js

# 驗證指令
node discord_bot/scripts/management/verify-commands.js

# 重置指令
node discord_bot/scripts/management/reset-commands.js
```

### 調試
```bash
# 調試互動問題
node discord_bot/scripts/management/debug-interaction.js

# 檢查指令 ID
node discord_bot/scripts/management/check_command_id.js
```

---

**整理完成**: 2025-11-20
