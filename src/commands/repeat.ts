// 反复读功能模块
import { Context } from 'koishi'
import { DataService } from '../services'
import { sleep } from '../utils'

export interface RepeatRecord {
  content: string
  count: number
  firstMessageId: string
  messages: Array<{
    id: string
    userId: string
    timestamp: number
  }>
}

// 复读记录存储
const repeatMap = new Map<string, RepeatRecord>()

export function registerRepeatMiddleware(ctx: Context, dataService: DataService) {
  // 复读监听中间件
  ctx.middleware(async (session, next) => {
    if (!session.content || !session.guildId) return next()

    // 检查群配置
    const groupConfig = dataService.getAntiRepeatConfig(session.guildId)
    if (!groupConfig?.enabled) return next()

    const currentContent = session.content
    const currentMessageId = session.messageId
    const currentGuildId = session.guildId
    const currentUserId = session.userId

    const record = repeatMap.get(currentGuildId)

    // 如果是新内容或没有记录
    if (!record || record.content !== currentContent) {
      repeatMap.set(currentGuildId, {
        content: currentContent,
        count: 1,
        firstMessageId: currentMessageId,
        messages: [{
          id: currentMessageId,
          userId: currentUserId,
          timestamp: Date.now()
        }]
      })
      return next()
    }

    // 更新复读记录
    record.count++
    record.messages.push({
      id: currentMessageId,
      userId: currentUserId,
      timestamp: Date.now()
    })

    // 使用群配置的阈值
    if (record.count > groupConfig.threshold) {
      try {
        // 记录操作到日志
        dataService.logCommand(session, 'antirepeat', 'messages',
          `已删除 ${record.count - 1} 条复读消息`)

        // 撤回除第一条外的所有消息
        for (let i = 1; i < record.messages.length; i++) {
          const msg = record.messages[i]
          try {
            await session.bot.deleteMessage(session.channelId, msg.id)
          } catch (e) {
            console.error(`撤回消息 ${msg.id} 失败:`, e)
          }
          await sleep(300)
        }

        // 重置记录
        repeatMap.delete(currentGuildId)
      } catch (e) {
        console.error('处理复读消息时出错:', e)
      }
    }

    return next()
  })
}

export function setupRepeatCleanupTask() {
  // 定期清理复读记录（1小时未更新的记录）
  setInterval(() => {
    const now = Date.now()
    for (const [guildId, record] of repeatMap.entries()) {
      if (now - record.messages[record.messages.length - 1].timestamp > 3600000) {
        repeatMap.delete(guildId)
      }
    }
  }, 3600000) // 每小时检查一次
}

// 导出复读记录Map以供外部访问
export function getRepeatMap() {
  return repeatMap
}
