
import { Context } from 'koishi'
import { DataService } from './data.service'
import { readData, saveData, formatDuration } from '../utils'

export function registerEventListeners(ctx: Context, dataService: DataService) {

  ctx.on('friend-request', async (session) => {
    const { userId } = session
    const { _data: data } = session.event


    const blacklist = readData(dataService.blacklistPath)
    if (blacklist[userId]) {
      await session.bot.internal.setFriendAddRequest(data.flag, false, '您在黑名单中')
      return
    }


    if (!ctx.config.friendRequest.enabled) return


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

      await session.bot.internal.setFriendAddRequest(data.flag, false, ctx.config.friendRequest.rejectMessage)
    }
  })


  ctx.on('guild-request', async (session) => {
    const { userId } = session
    const { _data: data } = session.event


    const blacklist = readData(dataService.blacklistPath)
    if (blacklist[userId]) {
      await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, false, '您在黑名单中')
      return
    }


    if (ctx.config.guildRequest.enabled) {

      await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, true)
    } else {

      await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, false, ctx.config.guildRequest.rejectMessage)
    }
  })


  ctx.on('guild-member-request', async (session) => {
    const { userId, guildId } = session
    const { _data: data } = session.event


    const blacklist = readData(dataService.blacklistPath)
    if (blacklist[userId]) {
      await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, false, '您在黑名单中')
      return
    }


    const groupConfigs = readData(dataService.groupConfigPath)
    const groupConfig = groupConfigs[guildId] || { keywords: [], approvalKeywords: [] }


    const keywords = [...ctx.config.keywords, ...groupConfig.approvalKeywords]


    if (keywords.length > 0 && data.comment) {
      const comment = data.comment.toLowerCase()
      for (const keyword of keywords) {
        try {

          const regex = new RegExp(keyword, 'i')
          if (regex.test(data.comment)) {
            await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, true)
            return
          }
        } catch (e) {

          if (data.comment.toLowerCase().includes(keyword.toLowerCase())) {
            await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, true)
            return
          }
        }
      }
    }


    return
  })


  ctx.on('guild-member-added', async (session) => {
    const { guildId, userId } = session


    const mutes = readData(dataService.mutesPath)
    if (mutes[guildId]?.[userId]?.leftGroup) {
      const muteRecord = mutes[guildId][userId]


      await session.bot.muteGuildMember(guildId, userId, muteRecord.remainingTime)


      muteRecord.startTime = Date.now()
      muteRecord.duration = muteRecord.remainingTime
      delete muteRecord.remainingTime
      muteRecord.leftGroup = false
      saveData(dataService.mutesPath, mutes)


      await session.send(`检测到未完成的禁言，继续执行剩余 ${formatDuration(muteRecord.duration)} 的禁言`)
    }


    const groupConfigs = readData(dataService.groupConfigPath)
    const groupConfig = groupConfigs[guildId] || { keywords: [], approvalKeywords: [] }


    if (groupConfig.welcomeMsg) {
      const msg = groupConfig.welcomeMsg
        .replace(/{at}/g, `<at id="${userId}"/>`)
        .replace(/{user}/g, userId)
        .replace(/{group}/g, guildId)
      await session.send(msg)
    } else if (ctx.config.defaultWelcome) {

      const msg = ctx.config.defaultWelcome
        .replace(/{at}/g, `<at id="${userId}"/>`)
        .replace(/{user}/g, userId)
        .replace(/{group}/g, guildId)
      await session.send(msg)
    }


    const message = `[成员加入] 用户 ${session.userId} 加入了群 ${session.guildId}`
    await dataService.pushMessage(session.bot, message, 'memberChange')
  })


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

        delete mutes[guildId][userId]
        saveData(dataService.mutesPath, mutes)
      }
    }


    const message = `[成员退出] 用户 ${session.userId} 退出了群 ${session.guildId}`
    await dataService.pushMessage(session.bot, message, 'memberChange')
  })
}

/**
 * 设置定时任务
 */
export function setupScheduledTasks(ctx: Context, dataService: DataService) {

  setInterval(() => {
    const bot = ctx.bots.values().next().value
    if (bot) {
      dataService.checkMuteExpires(bot).catch(console.error)
    }
  }, 60000)
}
