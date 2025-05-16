// 事件监听服务模块
import { Context } from 'koishi'
import { DataService } from './data.service'
import { readData, saveData, formatDuration } from '../utils'

export function registerEventListeners(ctx: Context, dataService: DataService) {
  // 处理好友申请
  ctx.on('friend-request', async (session) => {
    const { userId } = session
    const { _data: data } = session.event

    // 检查黑名单
    const blacklist = readData(dataService.blacklistPath)
    if (blacklist[userId]) {
      await session.bot.internal.setFriendAddRequest(data.flag, false, '您在黑名单中')
      return
    }

    // 如果未启用关键词验证，不处理请求
    if (!ctx.config.friendRequest.enabled) return

    // 检查关键词（忽略大小写）
    if (ctx.config.friendRequest.keywords.length > 0 && data.comment) {
      const comment = data.comment.toLowerCase()
      for (const keyword of ctx.config.friendRequest.keywords) {
        try {
          const regex = new RegExp(keyword, 'i')
          if (regex.test(data.comment)) {
            await session.bot.internal.setFriendAddRequest(data.flag, true)
            return
          }
        } catch (e) {
          if (data.comment.toLowerCase().includes(keyword.toLowerCase())) {
            await session.bot.internal.setFriendAddRequest(data.flag, true)
            return
          }
        }
      }
      // 如果没有匹配到关键词，拒绝请求
      await session.bot.internal.setFriendAddRequest(data.flag, false, ctx.config.friendRequest.rejectMessage)
    }
  })

  // 处理入群邀请
  ctx.on('guild-request', async (session) => {
    const { userId } = session
    const { _data: data } = session.event

    // 检查黑名单
    const blacklist = readData(dataService.blacklistPath)
    if (blacklist[userId]) {
      await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, false, '您在黑名单中')
      return
    }

    // 根据配置决定是同意还是拒绝
    if (ctx.config.guildRequest.enabled) {
      // 启用时同意所有邀请
      await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, true)
    } else {
      // 禁用时拒绝所有邀请
      await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, false, ctx.config.guildRequest.rejectMessage)
    }
  })

  // 处理入群请求
  ctx.on('guild-member-request', async (session) => {
    const { userId, guildId } = session
    const { _data: data } = session.event

    // 检查黑名单
    const blacklist = readData(dataService.blacklistPath)
    if (blacklist[userId]) {
      await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, false, '您在黑名单中')
      return
    }

    // 获取群配置
    const groupConfigs = readData(dataService.groupConfigPath)
    const groupConfig = groupConfigs[guildId] || { keywords: [], approvalKeywords: [] }

    // 合并全局和群专属关键词
    const keywords = [...ctx.config.keywords, ...groupConfig.approvalKeywords]

    // 检查关键词（忽略大小写）
    if (keywords.length > 0 && data.comment) {
      const comment = data.comment.toLowerCase() // 转换为小写
      for (const keyword of keywords) {
        try {
          // 尝试作为正则表达式处理，添加 i 标志以忽略大小写
          const regex = new RegExp(keyword, 'i')
          if (regex.test(data.comment)) {
            await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, true)
            return
          }
        } catch (e) {
          // 如果不是有效的正则表达式，则使用普通字符串匹配（忽略大小写）
          if (data.comment.toLowerCase().includes(keyword.toLowerCase())) {
            await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, true)
            return
          }
        }
      }
    }

    // 如果没有关键词或没有匹配到，不处理请求
    return
  })

  // 在群成员加入时处理欢迎语
  ctx.on('guild-member-added', async (session) => {
    const { guildId, userId } = session

    // 检查是否有未完成的禁言
    const mutes = readData(dataService.mutesPath)
    if (mutes[guildId]?.[userId]?.leftGroup) {
      const muteRecord = mutes[guildId][userId]

      // 恢复禁言
      await session.bot.muteGuildMember(guildId, userId, muteRecord.remainingTime)

      // 更新记录
      muteRecord.startTime = Date.now()
      muteRecord.duration = muteRecord.remainingTime
      delete muteRecord.remainingTime
      muteRecord.leftGroup = false
      saveData(dataService.mutesPath, mutes)

      // 发送提示
      await session.send(`检测到未完成的禁言，继续执行剩余 ${formatDuration(muteRecord.duration)} 的禁言`)
    }

    // 获取群配置
    const groupConfigs = readData(dataService.groupConfigPath)
    const groupConfig = groupConfigs[guildId] || { keywords: [], approvalKeywords: [] }

    // 如果有设置欢迎语，发送欢迎消息
    if (groupConfig.welcomeMsg) {
      const msg = groupConfig.welcomeMsg
        .replace(/{at}/g, `<at id="${userId}"/>`)
        .replace(/{user}/g, userId)
        .replace(/{group}/g, guildId)
      await session.send(msg)
    } else if (ctx.config.defaultWelcome) {
      // 如果没有群特定欢迎语但有默认欢迎语，使用默认欢迎语
      const msg = ctx.config.defaultWelcome
        .replace(/{at}/g, `<at id="${userId}"/>`)
        .replace(/{user}/g, userId)
        .replace(/{group}/g, guildId)
      await session.send(msg)
    }

    // 推送成员加入通知
    const message = `[成员加入] 用户 ${session.userId} 加入了群 ${session.guildId}`
    await dataService.pushMessage(session.bot, message, 'memberChange')
  })

  // 添加退群监控
  ctx.on('guild-member-removed', async (session) => {
    const { guildId, userId } = session

    const mutes = readData(dataService.mutesPath)
    if (mutes[guildId]?.[userId]) {
      const muteRecord = mutes[guildId][userId]
      const elapsedTime = Date.now() - muteRecord.startTime

      if (elapsedTime < muteRecord.duration) {
        muteRecord.remainingTime = muteRecord.duration - elapsedTime
        muteRecord.leftGroup = true
        saveData(dataService.mutesPath, mutes)
      } else {
        // 如果禁言已经结束，删除记录
        delete mutes[guildId][userId]
        saveData(dataService.mutesPath, mutes)
      }
    }

    // 推送成员退出通知
    const message = `[成员退出] 用户 ${session.userId} 退出了群 ${session.guildId}`
    await dataService.pushMessage(session.bot, message, 'memberChange')
  })
}

/**
 * 设置定时任务
 */
export function setupScheduledTasks(ctx: Context, dataService: DataService) {
  // 每分钟检查一次禁言到期
  setInterval(() => {
    const bot = ctx.bots.values().next().value
    if (bot) {
      dataService.checkMuteExpires(bot).catch(console.error)
    }
  }, 60000)
}
