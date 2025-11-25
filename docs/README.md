# AIFX v2 Documentation

项目文档索引和说明

## 📁 目录结构

### `/docs/archive/` - 归档文档
旧的项目状态、会话记录、测试报告等历史文档

- `fixes/` - 历史 bug 修复记录
- `phase3/` - Phase 3 开发记录
- `sessions/` - 开发会话记录
- `status/` - 旧的系统状态报告
- `DISCORD_BOT_TESTING_GUIDE.md` - Discord Bot 测试指南（归档）
- `FRONTEND_*.md` - 前端相关文档（已移除前端）
- `SYSTEM_OVERVIEW.md` - 系统概览（归档）

### `/docs/ultrathink/` - 调试分析文档
ULTRATHINK 深度分析和问题诊断文档

- `*_ULTRATHINK.md` - 各种问题的深度分析
- `STAGE_*_VERIFICATION_ULTRATHINK.md` - 3 阶段验证分析
- `MASTER_3_STAGE_VERIFICATION_ULTRATHINK.md` - 主验证文档

### `/docs/verification/` - 验证报告
系统测试和验证报告

- `FINAL_3_STAGE_VERIFICATION_REPORT.md` - 最终 3 阶段验证报告
- `PHASE6_INTEGRATION_TESTS_COMPLETE.md` - Phase 6 集成测试报告

### `/docs/planning/` - 规划文档
系统架构和功能规划

- `MICROSERVICES_REFACTOR_PLAN.md` - 微服务重构计划
- `PHASE7C_STAGE1_DAY1_PROGRESS.md` - Phase 7C 进度

### `/docs/api/` - API 文档
API 规范和服务边界定义

- `service-boundaries.md` - 服务边界说明

### `/docs/architecture/` - 架构文档
系统架构设计和分析

- 项目架构分析
- 系统架构报告
- 项目结构快速参考

### `/docs/discord/` - Discord 集成文档
Discord Bot 设置和故障排除

- Discord Bot 配置
- 超时问题分析
- 服务状态

### `/docs/ml_engine/` - ML Engine 文档
机器学习引擎部署和开发

- ML Engine 部署指南
- 模型版本对比
- 数据准备完成报告

### `/docs/setup/` - 设置指南
系统安装和配置指南

- 完整设置指南
- 数据库架构
- 快速启动指南
- 登录凭证

### `/docs/testing/` - 测试文档
端到端测试指南和报告

- E2E 测试指南
- 最终测试报告

---

## 📄 根目录重要文档

### `CLAUDE.md`
**Claude Code 项目指令** - 最重要的文件，包含所有开发规则和指导方针

### `README.md`
项目说明和快速开始指南

### `SIGNAL_CHANGE_NOTIFICATION_PLAN.md`
Signal Change Notification 功能完整规划（MVP + Phase 2）

### `PHASE_2_COMPLETION_REPORT.md`
Phase 2 功能完成报告（Redis 缓存、Embed 通知、冷却机制、订阅限制）

### `SIGNAL_NOTIFICATION_TEST_REPORT.md`
Signal Change Notification MVP 测试报告

---

## 📊 文档更新时间

最后整理: 2025-11-25

---

## 🔍 快速查找

**需要了解项目架构？**
→ `/docs/architecture/`

**遇到 Discord Bot 问题？**
→ `/docs/discord/`

**设置新环境？**
→ `/docs/setup/COMPLETE_SETUP_GUIDE.md`

**查看测试结果？**
→ `/docs/verification/` 和 `/docs/testing/`

**调试问题？**
→ `/docs/ultrathink/` 查看深度分析

**了解历史开发过程？**
→ `/docs/archive/sessions/`

---

**Note**: 所有 ULTRATHINK 文档包含深度技术分析，适合调试复杂问题时参考。
