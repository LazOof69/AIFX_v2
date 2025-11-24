# 信号变化通知功能 - 完整实现计划

**创建日期**: 2025-11-25
**状态**: 开发中 (MVP Phase)
**负责人**: Claude Code + User

---

## 📋 功能概述

用户可以订阅货币对，当信号变化时（buy/hold/sell），自动在 Discord 频道 @ 通知所有订阅用户。

---

## 🎯 完整功能规划（最终目标）

### **核心功能**

#### 1️⃣ 用户订阅管理
- ✅ 订阅货币对：`/subscribe pair:EUR/USD [timeframe:1h]`
- ✅ 取消订阅：`/unsubscribe pair:EUR/USD [timeframe:1h]`
- ✅ 查看订阅：`/subscriptions`
- ⏳ 订阅限制：每人最多 5 个货币对
- ⏳ 重复订阅检测：防止同一货币对+时间框架重复订阅

#### 2️⃣ 信号监控
- ✅ 检查频率：每 15 分钟
- ✅ 监控范围：所有被订阅的货币对
- ✅ 触发条件：信号变化（buy → hold, hold → sell, etc.）
- ⏳ 冷却时间：30 分钟内同一货币对不重复通知
- ⏳ 反向信号：BUY → SELL 或 SELL → BUY 立即通知（无冷却）

#### 3️⃣ 通知发送
- ✅ 通知位置：专门的 Discord 频道（`DISCORD_SIGNAL_CHANNEL_ID`）
- ✅ @ 提及所有订阅用户
- ✅ 显示信号详情（旧信号 → 新信号）
- ⏳ 通知格式优化（Embed 美化）
- ⏳ 错误重试机制

#### 4️⃣ 数据持久化
- ✅ `user_subscriptions` 表 - 存储订阅关系
- ✅ `signal_change_history` 表 - 记录信号变化历史
- ⏳ 订阅数据清理（超过 90 天无活动自动清理）

---

## 🚀 MVP 实现范围（第一阶段）

### **包含功能** ✅

1. **订阅命令**：`/subscribe pair:EUR/USD`
   - 订阅货币对（默认 1h 时间框架）
   - 保存到数据库
   - 返回确认消息

2. **取消订阅命令**：`/unsubscribe pair:EUR/USD`
   - 取消订阅
   - 从数据库删除
   - 返回确认消息

3. **查看订阅命令**：`/subscriptions`
   - 显示用户所有订阅
   - 显示货币对和时间框架

4. **信号监控服务**：
   - 每 15 分钟检查一次
   - 为所有被订阅的货币对生成信号
   - 与上次信号对比
   - 如果变化 → 发送通知

5. **Discord 通知**：
   - 在 `DISCORD_SIGNAL_CHANNEL_ID` 发送消息
   - @ 所有订阅该货币对的用户
   - 显示信号变化信息

### **暂不包含** ⏳

- 订阅数量限制（第一版不限制）
- 冷却时间（第一版每次变化都通知）
- 高级时间框架选择（第一版固定 1h）
- Embed 美化（第一版使用简单文本）
- 错误重试机制

---

## 📊 数据库设计（已完成）

### **user_subscriptions 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| discord_user_id | VARCHAR(255) | Discord 用户 ID |
| discord_username | VARCHAR(255) | Discord 用户名 |
| pair | VARCHAR(20) | 货币对（EUR/USD） |
| timeframe | VARCHAR(10) | 时间框架（1h/4h/1d），默认 1h |
| channel_id | VARCHAR(255) | 订阅时的频道 ID（可选） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

**索引**：
- UNIQUE (discord_user_id, pair, timeframe)
- INDEX (discord_user_id)
- INDEX (pair, timeframe)

### **signal_change_history 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| pair | VARCHAR(20) | 货币对 |
| timeframe | VARCHAR(10) | 时间框架 |
| old_signal | VARCHAR(10) | 旧信号（buy/hold/sell） |
| new_signal | VARCHAR(10) | 新信号（buy/hold/sell） |
| old_confidence | DECIMAL(5,2) | 旧置信度 |
| new_confidence | DECIMAL(5,2) | 新置信度 |
| signal_strength | VARCHAR(20) | 信号强度 |
| market_condition | VARCHAR(20) | 市场状况 |
| notified_users | VARCHAR[] | 已通知的用户 ID 数组 |
| notification_sent | BOOLEAN | 是否已发送通知 |
| created_at | TIMESTAMP | 检测时间 |
| last_notified_at | TIMESTAMP | 最后通知时间 |

**索引**：
- INDEX (pair, timeframe)
- INDEX (created_at)
- INDEX (pair, timeframe, created_at)

---

## 🔧 技术架构

### **Backend API 端点**

```
POST   /api/v1/subscriptions              # 创建订阅
DELETE /api/v1/subscriptions/:id          # 删除订阅
GET    /api/v1/subscriptions/user/:discordUserId  # 获取用户订阅列表
GET    /api/v1/subscriptions/pair/:pair   # 获取订阅某货币对的所有用户
```

### **Discord Bot 命令**

```
/subscribe pair:EUR/USD [timeframe:1h]    # 订阅货币对
/unsubscribe pair:EUR/USD [timeframe:1h]  # 取消订阅
/subscriptions                             # 查看我的订阅
```

### **后台服务**

```javascript
// signalMonitoringService.js 扩展
- 每 15 分钟执行 checkSignalChanges()
- 查询所有被订阅的货币对
- 为每个货币对生成信号
- 与 signal_change_history 中的上次信号对比
- 如果变化 → 保存历史 + 发布 Redis 事件
```

### **Redis Pub/Sub 通信**

```javascript
// Backend 发布事件
redis.publish('signal-change', {
  pair: 'EUR/USD',
  timeframe: '1h',
  oldSignal: 'hold',
  newSignal: 'buy',
  confidence: 0.91,
  signalStrength: 'very_strong',
  subscribedUsers: ['user1', 'user2']
});

// Discord Bot 订阅事件
redis.subscribe('signal-change', (event) => {
  sendDiscordNotification(event);
});
```

---

## 📁 需要创建/修改的文件

### **Backend 文件**

#### 新增文件：
1. ✅ `/backend/database/migrations/20251125000001-create-user-subscriptions.js`
2. ✅ `/backend/database/migrations/20251125000002-create-signal-change-history.js`
3. ✅ `/backend/src/models/UserSubscription.js`
4. ✅ `/backend/src/models/SignalChangeHistory.js`
5. ⏳ `/backend/src/controllers/subscriptionsController.js`
6. ⏳ `/backend/src/routes/api/v1/subscriptions.js`
7. ⏳ `/backend/src/services/signalChangeNotificationService.js`

#### 修改文件：
8. ✅ `/backend/src/models/index.js` - 注册新模型
9. ⏳ `/backend/src/services/signalMonitoringService.js` - 添加信号对比逻辑
10. ⏳ `/backend/src/app.js` - 注册订阅路由

### **Discord Bot 文件**

#### 新增文件：
11. ⏳ `/discord_bot/commands/subscribe.js`
12. ⏳ `/discord_bot/commands/unsubscribe.js`
13. ⏳ `/discord_bot/commands/subscriptions.js`

#### 修改文件：
14. ⏳ `/discord_bot/utils/backendApiClient.js` - 添加订阅 API 方法
15. ⏳ `/discord_bot/bot.js` - 添加 signal-change 事件监听

---

## 🎨 通知消息格式

### **MVP 版本（简单文本）**

```
🚨 信号变化提醒

EUR/USD (1h)
HOLD → BUY

置信度: 91%
信号强度: VERY STRONG
市场状况: TRENDING

@User1 @User2 @User3

⏰ 2025-11-25 10:30:00
```

### **完整版（Embed 格式）** ⏳

```discord
[Embed]
Title: 🚨 EUR/USD 信号变化
Color: Green (for BUY)

Fields:
- 旧信号: HOLD (85%)
- 新信号: BUY (91%) ⭐⭐⭐⭐
- 信号强度: VERY STRONG
- 市场状况: TRENDING
- Entry Price: 1.15260
- 技术指标: SMA(20): 1.15882 (bullish) | RSI(14): 68.45

Footer: 订阅用户: @User1 @User2 @User3
Timestamp: 2025-11-25 10:30:00
```

---

## 📝 实现步骤（MVP）

### **Phase 1: Backend API** ✅ In Progress

1. ✅ 创建数据库表
2. ✅ 创建 Sequelize 模型
3. ⏳ 创建订阅管理 API（Controller + Routes）
4. ⏳ 创建信号变化检测服务
5. ⏳ 扩展 signalMonitoringService

### **Phase 2: Discord Bot Commands** ⏳

6. ⏳ 实现 `/subscribe` 命令
7. ⏳ 实现 `/unsubscribe` 命令
8. ⏳ 实现 `/subscriptions` 命令
9. ⏳ 扩展 backendApiClient

### **Phase 3: Notification System** ⏳

10. ⏳ 实现 Redis 事件监听
11. ⏳ 实现 Discord 消息发送
12. ⏳ 测试完整流程

### **Phase 4: Testing** ⏳

13. ⏳ 测试订阅/取消订阅
14. ⏳ 测试信号变化检测
15. ⏳ 测试 Discord 通知
16. ⏳ 端到端测试

---

## 🚧 后续优化计划（Phase 2+）

### **功能增强**

#### 1. 订阅限制系统
```javascript
// 检查用户订阅数量
const subscriptionCount = await UserSubscription.count({
  where: { discordUserId: userId }
});

if (subscriptionCount >= 5) {
  return { error: '已达到订阅上限（5个货币对）' };
}
```

#### 2. 冷却时间机制
```javascript
// 检查上次通知时间
const lastNotification = await SignalChangeHistory.findOne({
  where: {
    pair: 'EUR/USD',
    timeframe: '1h'
  },
  order: [['last_notified_at', 'DESC']]
});

const cooldownMs = 30 * 60 * 1000; // 30 minutes
const timeSinceLastNotification = Date.now() - lastNotification.lastNotifiedAt;

// 检查是否为反向信号（BUY → SELL 或 SELL → BUY）
const isReversal = (oldSignal === 'buy' && newSignal === 'sell') ||
                   (oldSignal === 'sell' && newSignal === 'buy');

if (timeSinceLastNotification < cooldownMs && !isReversal) {
  // 跳过通知（在冷却期内）
  return;
}
```

#### 3. 高级时间框架支持
```javascript
// 支持多时间框架订阅
/subscribe pair:EUR/USD timeframe:1h
/subscribe pair:EUR/USD timeframe:4h
/subscribe pair:EUR/USD timeframe:1d

// 用户可以订阅同一货币对的不同时间框架
```

#### 4. 通知偏好设置
```javascript
// 用户可以设置通知偏好
/notify-settings
  - 只通知 BUY/SELL（不通知 HOLD）
  - 只通知高置信度（>80%）
  - 只通知特定信号强度（STRONG 及以上）
```

#### 5. Embed 美化
```javascript
// 使用 Discord Embed 格式
const embed = new EmbedBuilder()
  .setColor(color) // Green for BUY, Red for SELL, Gray for HOLD
  .setTitle(`🚨 ${pair} 信号变化`)
  .addFields(
    { name: '旧信号', value: `${oldSignal.toUpperCase()} (${oldConfidence}%)`, inline: true },
    { name: '新信号', value: `${newSignal.toUpperCase()} (${newConfidence}%)`, inline: true }
  )
  .setFooter({ text: `订阅用户: ${users.length} 人` })
  .setTimestamp();
```

#### 6. 统计分析
```javascript
// 添加订阅统计
GET /api/v1/subscriptions/stats

Response:
{
  totalSubscriptions: 127,
  totalUsers: 45,
  popularPairs: [
    { pair: 'EUR/USD', subscribers: 23 },
    { pair: 'GBP/USD', subscribers: 18 }
  ],
  signalChangesToday: 12,
  notificationsSent: 156
}
```

### **性能优化**

#### 1. 批量信号生成
```javascript
// 并行生成信号（而不是串行）
const pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY'];
const signals = await Promise.all(
  pairs.map(pair => tradingSignalService.generateSignal(pair, '1h'))
);
```

#### 2. Redis 缓存
```javascript
// 缓存最近的信号，避免重复查询数据库
const cacheKey = `signal:${pair}:${timeframe}`;
const cachedSignal = await redis.get(cacheKey);
if (cachedSignal) {
  return JSON.parse(cachedSignal);
}
```

#### 3. 数据库查询优化
```javascript
// 使用 JOIN 减少查询次数
const subscriptionsWithUsers = await UserSubscription.findAll({
  where: { pair: 'EUR/USD', timeframe: '1h' },
  attributes: ['discordUserId', 'discordUsername'],
  raw: true
});
```

### **监控和日志**

#### 1. 添加详细日志
```javascript
logger.info('Signal change detected', {
  pair: 'EUR/USD',
  timeframe: '1h',
  oldSignal: 'hold',
  newSignal: 'buy',
  subscribersNotified: 5,
  duration: '234ms'
});
```

#### 2. 错误追踪
```javascript
try {
  await sendDiscordNotification(event);
} catch (error) {
  logger.error('Failed to send notification', {
    pair: event.pair,
    error: error.message,
    stack: error.stack
  });

  // 保存失败记录到数据库
  await NotificationError.create({
    pair: event.pair,
    errorMessage: error.message,
    retryCount: 0
  });
}
```

#### 3. 性能指标
```javascript
// 记录信号生成和通知发送的性能
const startTime = Date.now();
await checkSignalChanges();
const duration = Date.now() - startTime;

logger.info('Signal monitoring cycle completed', {
  duration: `${duration}ms`,
  pairsChecked: pairsChecked,
  changesDetected: changesDetected,
  notificationsSent: notificationsSent
});
```

---

## ⚠️ 注意事项

### **安全性**

1. **API 认证**：所有订阅 API 必须使用 API Key 认证
2. **输入验证**：验证货币对格式（EUR/USD 格式）
3. **防止注入**：使用 Sequelize 参数化查询
4. **速率限制**：防止滥用订阅功能

### **稳定性**

1. **错误处理**：所有 API 和服务都要有 try-catch
2. **优雅降级**：如果 Discord API 失败，不应影响信号监控
3. **数据一致性**：使用数据库事务保证一致性

### **可扩展性**

1. **水平扩展**：考虑多个 Backend 实例的协调
2. **消息队列**：可以引入 Bull Queue 处理通知
3. **数据清理**：定期清理历史数据

---

## 📈 成功指标

### **MVP 阶段**

- ✅ 用户可以成功订阅/取消订阅
- ✅ 信号变化能被正确检测
- ✅ Discord 通知能正确发送并 @ 用户
- ✅ 系统稳定运行 24 小时无崩溃

### **完整版阶段**

- ⏳ 支持 50+ 用户同时订阅
- ⏳ 订阅限制正确执行
- ⏳ 冷却时间机制正确工作
- ⏳ 通知 95% 在 1 分钟内送达
- ⏳ 系统稳定运行 7 天无崩溃

---

## 🐛 已知问题和 TODO

### **当前问题**

- 无

### **待办事项（按优先级）**

#### P0 - MVP 必须
1. ⏳ 创建订阅管理 API
2. ⏳ 实现 Discord 订阅命令
3. ⏳ 实现信号变化检测逻辑
4. ⏳ 实现 Discord 通知发送

#### P1 - 第一次迭代
5. ⏳ 添加订阅数量限制（5个）
6. ⏳ 添加冷却时间机制（30分钟）
7. ⏳ 支持自定义时间框架
8. ⏳ 美化通知消息（Embed）

#### P2 - 功能增强
9. ⏳ 添加通知偏好设置
10. ⏳ 添加订阅统计功能
11. ⏳ 添加错误重试机制
12. ⏳ 添加数据清理任务

#### P3 - 性能优化
13. ⏳ 并行信号生成
14. ⏳ Redis 缓存优化
15. ⏳ 数据库查询优化
16. ⏳ 引入消息队列

---

## 📚 参考资料

### **Discord.js 文档**
- Slash Commands: https://discord.js.org/#/docs/discord.js/main/class/SlashCommandBuilder
- Embeds: https://discord.js.org/#/docs/discord.js/main/class/EmbedBuilder
- Mentions: https://discord.com/developers/docs/reference#message-formatting

### **Sequelize 文档**
- Migrations: https://sequelize.org/docs/v6/other-topics/migrations/
- Models: https://sequelize.org/docs/v6/core-concepts/model-basics/
- Queries: https://sequelize.org/docs/v6/core-concepts/model-querying-basics/

### **Redis Pub/Sub**
- Node Redis: https://github.com/redis/node-redis
- Pub/Sub Pattern: https://redis.io/docs/manual/pubsub/

---

## 📞 联系和支持

- **开发者**: Claude Code + User
- **项目仓库**: /root/AIFX_v2
- **文档位置**: /root/AIFX_v2/SIGNAL_CHANGE_NOTIFICATION_PLAN.md

---

**最后更新**: 2025-11-25
**版本**: 1.0.0
**状态**: 📍 MVP 开发中
