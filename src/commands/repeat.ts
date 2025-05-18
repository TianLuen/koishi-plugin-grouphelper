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

const repeatMap = new Map<string, RepeatRecord>()

export function registerRepeatMiddleware(ctx: Context, dataService: DataService) {
  ctx.middleware(async (session, next) => {
    if (!session.content || !session.guildId) return next()

    const groupConfig = dataService.getAntiRepeatConfig(session.guildId)
    if (!groupConfig?.enabled) return next()

    const currentContent = session.content
    const currentMessageId = session.messageId
    const currentGuildId = session.guildId
    const currentUserId = session.userId

    const record = repeatMap.get(currentGuildId)

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

    record.count++
    record.messages.push({
      id: currentMessageId,
      userId: currentUserId,
      timestamp: Date.now()
    })

    if (record.count > groupConfig.threshold) {
      try {
        dataService.logCommand(session, 'antirepeat', 'messages',
          `已删除 ${record.count - 1} 条复读消息`)

        for (let i = 1; i < record.messages.length; i++) {
          const msg = record.messages[i]
          try {
            await session.bot.deleteMessage(session.channelId, msg.id)
          } catch (e) {
            console.error(`撤回消息 ${msg.id} 失败:`, e)
          }
          await sleep(300)
        }

        repeatMap.delete(currentGuildId)
      } catch (e) {
        console.error('处理复读消息时出错:', e)
      }
    }

    return next()
  })
}

export function setupRepeatCleanupTask() {
  setInterval(() => {
    const now = Date.now()
    for (const [guildId, record] of repeatMap.entries()) {
      if (now - record.messages[record.messages.length - 1].timestamp > 3600000) {
        repeatMap.delete(guildId)
      }
    }
  }, 3600000)
}

export function getRepeatMap() {
  return repeatMap
}
