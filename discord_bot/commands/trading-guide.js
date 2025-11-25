/**
 * Trading Guide Command
 * Educational guide for trading periods and how to use them
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trading-guide')
    .setDescription('交易週期使用指南 | Learn about trading periods'),

  async execute(interaction) {
    try {
      // Create main guide embed
      const guideEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('📚 交易週期使用指南 | Trading Period Guide')
        .setDescription('選擇適合您的交易週期 | Choose the right trading period for you')
        .addFields(
          {
            name: '🔥 日內交易 (Day Trading / Intraday)',
            value: '```' +
              '⏰ 持倉時長: 數分鐘到數小時（當天平倉）\n' +
              '⚠️ 風險等級: 高 (⚠️⚠️⚠️)\n' +
              '💰 最低資金: $5,000\n' +
              '👥 適合: 專職交易者\n' +
              '🎯 分析週期: 15分鐘K線\n' +
              '```' +
              '**特點**:\n' +
              '• 高頻交易，需要緊盯盤面\n' +
              '• 點差成本較高\n' +
              '• 快速進出，當天平倉\n' +
              '• 需要較多時間和經驗',
            inline: false
          },
          {
            name: '📈 周內交易 (Swing Trading) ⭐ 推薦新手',
            value: '```' +
              '⏰ 持倉時長: 2-10天\n' +
              '⚠️ 風險等級: 中等 (⚠️⚠️)\n' +
              '💰 最低資金: $2,000\n' +
              '👥 適合: 上班族、兼職交易者\n' +
              '🎯 分析週期: 1小時K線\n' +
              '```' +
              '**特點**:\n' +
              '• 波段操作，捕捉短期趨勢\n' +
              '• 隔夜持倉，需設止損\n' +
              '• 每天查看1-2次即可\n' +
              '• **最適合散戶的交易週期**',
            inline: false
          },
          {
            name: '📊 月內交易 (Position Trading)',
            value: '```' +
              '⏰ 持倉時長: 數週到2個月\n' +
              '⚠️ 風險等級: 中低 (⚠️)\n' +
              '💰 最低資金: $1,000\n' +
              '👥 適合: 耐心投資者\n' +
              '🎯 分析週期: 日K線\n' +
              '```' +
              '**特點**:\n' +
              '• 趨勢跟隨，中期持倉\n' +
              '• 基本面分析重要性增加\n' +
              '• 容忍短期回撤\n' +
              '• 每週查看1-2次',
            inline: false
          },
          {
            name: '🎯 季內交易 (Long-term Trading)',
            value: '```' +
              '⏰ 持倉時長: 數月到1年\n' +
              '⚠️ 風險等級: 低 (✅)\n' +
              '💰 最低資金: $500\n' +
              '👥 適合: 長期配置投資者\n' +
              '🎯 分析週期: 周K線\n' +
              '```' +
              '**特點**:\n' +
              '• 戰略配置，長期持有\n' +
              '• 宏觀經濟視角\n' +
              '• 經濟週期影響\n' +
              '• 每月查看1-2次',
            inline: false
          }
        )
        .addFields({
          name: '💡 使用方法 | How to Use',
          value: '使用 `/signal` 命令時選擇交易週期:\n' +
            '```\n' +
            '/signal pair:EUR/USD period:周內交易\n' +
            '/signal pair:GBP/USD period:日內交易\n' +
            '```\n' +
            '如果不選擇，系統默認使用「周內交易」（最適合新手）',
          inline: false
        })
        .addFields({
          name: '⚠️ 重要提示 | Important',
          value: '• 交易外匯有風險，請量力而為\n' +
            '• 建議從「周內交易」開始學習\n' +
            '• 永遠不要投入無法承受損失的資金\n' +
            '• 使用止損保護您的資金\n' +
            '• 這不是投資建議，僅供參考',
          inline: false
        })
        .setFooter({
          text: 'AIFX v2 Trading Advisory System | 交易輔助系統',
          iconURL: 'https://i.imgur.com/AfFp7pu.png'
        })
        .setTimestamp();

      // Create comparison table embed
      const comparisonEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('📊 交易週期對比表 | Period Comparison')
        .setDescription('快速對比不同交易週期 | Quick comparison of trading periods')
        .addFields(
          {
            name: '交易頻率 | Trading Frequency',
            value: '```\n' +
              '日內交易: ████████████ (極高)\n' +
              '周內交易: ████ (中等)\n' +
              '月內交易: ██ (低)\n' +
              '季內交易: █ (極低)\n' +
              '```',
            inline: true
          },
          {
            name: '精力投入 | Time Commitment',
            value: '```\n' +
              '日內交易: ████████████ (全職盯盤)\n' +
              '周內交易: ████ (每天1-2次)\n' +
              '月內交易: ██ (每週查看)\n' +
              '季內交易: █ (每月查看)\n' +
              '```',
            inline: true
          },
          {
            name: '技術依賴 | Technical Analysis',
            value: '```\n' +
              '日內交易: ████████████ (極強)\n' +
              '周內交易: ████████ (強)\n' +
              '月內交易: ████ (中等)\n' +
              '季內交易: ██ (弱)\n' +
              '```',
            inline: true
          }
        )
        .addFields({
          name: '📈 推薦路徑 | Learning Path',
          value: '**新手建議學習路徑**:\n' +
            '1️⃣ 從「周內交易」開始，學習基礎交易\n' +
            '2️⃣ 累積經驗後，可嘗試「日內交易」或「月內交易」\n' +
            '3️⃣ 找到最適合自己的交易週期\n' +
            '4️⃣ 持續學習，不斷改進策略',
          inline: false
        })
        .setFooter({
          text: '使用 /signal 開始交易 | Use /signal to get started',
          iconURL: 'https://i.imgur.com/AfFp7pu.png'
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [guideEmbed, comparisonEmbed],
        ephemeral: false // Show to everyone so others can learn too
      });

    } catch (error) {
      console.error('Trading guide command error:', error);

      try {
        await interaction.reply({
          content: '❌ 無法載入交易指南 | Failed to load trading guide. Please try again later.',
          ephemeral: true
        });
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  }
};
