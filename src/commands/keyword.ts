// 关键词过滤模块
import { Context } from 'koishi'
import { DataService } from '../services'
import { readData, parseTimeString } from '../utils'

export function registerKeywordMiddleware(ctx: Context, dataService: DataService) {
  // 关键词监听中间件
  ctx.middleware(async (session, next) => {
    if (!ctx.config.keywordBan.enabled || !session.content || !session.guildId) return next()

    const content = session.content
    const groupConfigs = readData(dataService.groupConfigPath)
    const groupConfig = groupConfigs[session.guildId] || { keywords: [] }
    const keywords = [...ctx.config.keywordBan.keywords, ...groupConfig.keywords]

    for (const keyword of keywords) {
      try {
        const regex = new RegExp(keyword)
        if (regex.test(content)) {
          const duration = ctx.config.keywordBan.duration
          try {
            const milliseconds = parseTimeString(duration)
            await session.bot.muteGuildMember(session.guildId, session.userId, milliseconds)
            // 添加禁言记录
            dataService.recordMute(session.guildId, session.userId, milliseconds)
            await session.send(`喵呜！发现了关键词"${keyword}"，要被禁言 ${duration} 啦...`)
          } catch (e) {
            await session.send('自动禁言失败了...可能是权限不够喵')
          }
          break
        }
      } catch (e) {
        if (content.includes(keyword)) {
          const duration = ctx.config.keywordBan.duration
          try {
            const milliseconds = parseTimeString(duration)
            await session.bot.muteGuildMember(session.guildId, session.userId, milliseconds)
            // 添加禁言记录
            dataService.recordMute(session.guildId, session.userId, milliseconds)
            await session.send(`喵呜！发现了关键词"${keyword}"，要被禁言 ${duration} 啦...`)
          } catch (e) {
            await session.send('自动禁言失败了...可能是权限不够喵')
          }
          break
        }
      }
    }

    return next()
  })
}
