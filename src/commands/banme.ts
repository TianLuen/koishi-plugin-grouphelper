import { Context } from 'koishi'
import { DataService } from '../services'
import { parseTimeString, formatDuration, readData, saveData } from '../utils'

// 添加字符标准化函数
function normalizeCommand(command: string): string {
  // 移除所有类型的空白字符
  command = command.replace(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, '')

  // 移除所有标点符号
  command = command.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')

  // 移除所有数学符号
  command = command.replace(/[\u2200-\u22FF\u2100-\u214F]/g, '')

  // 移除所有装饰符号
  command = command.replace(/[\u2600-\u26FF\u2700-\u27BF]/g, '')

  // 移除所有零宽字符
  command = command.replace(/[\u200B-\u200D\uFEFF]/g, '')

  // 移除所有组合字符
  command = command.replace(/[\u0300-\u036F\u1AB0-\u1AFF\u20D0-\u20FF]/g, '')

  // 替换相似字符
  const similarChars: { [key: string]: string } = {
    // 拉丁字母变体
    'α': 'a', 'а': 'a', 'Α': 'A', 'А': 'A', 'ɒ': 'a', 'ɐ': 'a', '𝐚': 'a', '𝐀': 'A', '₳': 'a','ₐ': 'a', 'ₔ': 'a', 'ₕ': 'a',
    'е': 'e', 'Е': 'E', 'ε': 'e', 'Ε': 'E', 'ë': 'e', 'Ë': 'E', '𝐞': 'e', '𝐄': 'E',
    'о': 'o', 'О': 'O', 'ο': 'o', 'Ο': 'O', '𝐨': 'o', '𝐎': 'O',
    'с': 'c', 'С': 'C', '𝐜': 'c', '𝐂': 'C',
    'р': 'p', 'Р': 'P', '𝐩': 'p', '𝐏': 'P',
    'м': 'm', 'М': 'M', '𝐦': 'm', '𝐌': 'M',
    'н': 'n', 'Н': 'N', 'η': 'n', 'Ν': 'N', '𝐧': 'n', '𝐍': 'N', 'И': 'N',
    'т': 't', 'Т': 'T', '𝐭': 't', '𝐓': 'T',
    'у': 'y', 'У': 'Y', '𝐲': 'y', '𝐘': 'Y',
    'х': 'x', 'Х': 'X', '𝐱': 'x', '𝐗': 'X',
    'к': 'k', 'К': 'K', '𝐤': 'k', '𝐊': 'K',
    'в': 'v', 'В': 'V', '𝐯': 'v', '𝐕': 'V',
    'Ь': 'b', 'ь': 'b', 'β': 'b', 'Β': 'B', '𝐛': 'b', '𝐁': 'B',
    '∩': 'n',
    '♭': 'b',
    'ん': 'n',
    'ə': 'e',
    '我': 'me',
    '禁言': 'ban',
    '禁': 'ban',
    'mute': 'ban',
    'myself': 'me',
    'rn': 'm',
     'ₖ': 'k', 'ₗ': 'l', 'ₘ': 'm', 'ₙ': 'n',
    'ₚ': 'p', 'ₛ': 's', 'ₜ': 't', '₝': 'p', '₞': 'm', '₟': 'p', '₠': 'a', '₡': 'c',
    '₢': 'c', '₣': 'f', '₤': 'l', '₥': 'm', '₦': 'n', '₧': 'p', '₨': 'r', '₩': 'w',
    '₪': 's', '₫': 'd', '₭': 'k', '₮': 't', '₯': 'd', '₰': 'a', '₱': 'p', '₲': 'g',
    '₴': 'h', '₵': 'c', '₶': 'l', '₷': 's', '₸': 't', '₺': 'l', '₻': 'p',
    '₼': 'm', '₽': 'r', '₾': 'p', '₿': 'b',
    'Й': 'i', 'й': 'i', 'Л': 'l', 'л': 'l',
    'П': 'p', 'п': 'p',
    'Ф': 'f', 'ф': 'f',
    'Ц': 'c', 'ц': 'c', 'Ч': 'ch', 'ч': 'ch', 'Ш': 'sh', 'ш': 'sh',
    'Щ': 'sch', 'щ': 'sch', 'Ъ': '', 'ъ': '', 'Ы': 'y', 'ы': 'y',
    'Э': 'e', 'э': 'e', 'Ю': 'yu', 'ю': 'yu', 'Я': 'ya', 'я': 'ya'
  }

  // 替换所有相似字符
  for (const [similar, normal] of Object.entries(similarChars)) {
    command = command.replace(new RegExp(similar, 'g'), normal)
  }

  // 移除重复字符
  command = command.replace(/(.)\1+/g, '$1')

  // 移除所有非字母字符
  command = command.replace(/[^a-zA-Z]/g, '')

  return command.toLowerCase()
}

export function registerBanmeCommands(ctx: Context, dataService: DataService) {
  // 添加消息中间件来处理命令变体
  ctx.middleware(async (session, next) => {
    if (!session.content || !session.guildId) return next()

    const normalizedContent = normalizeCommand(session.content)
    if (normalizedContent === 'banme') {
      // 如果是变体命令
      if (session.content !== 'banme') {
        dataService.logCommand(session, 'banme', session.userId, `Suspicious: ${session.content}`)

        // 读取群配置
        const groupConfigs = readData(dataService.groupConfigPath)
        const groupConfig = groupConfigs[session.guildId] = groupConfigs[session.guildId] || {}
        const banmeConfig = groupConfig.banme || ctx.config.banme

        // 如果启用了自动禁言
        if (banmeConfig.autoBan) {
          try {
            // 读取并更新调用记录
            const records = readData(dataService.banMeRecordsPath)
            const now = Date.now()

            // 初始化群记录
            if (!records[session.guildId]) {
              records[session.guildId] = {
                count: 0,
                lastResetTime: now,
                pity: 0,
                guaranteed: false
              }
            }

            // 检查是否需要重置计数（1小时）
            if (now - records[session.guildId].lastResetTime > 3600000) {
              records[session.guildId].count = 0
              records[session.guildId].lastResetTime = now
            }

            records[session.guildId].count++
            records[session.guildId].pity++

            // 使用群配置的概率和保底机制
            let isJackpot = false
            let isGuaranteed = false

            let currentProb = banmeConfig.jackpot.baseProb
            if (records[session.guildId].pity >= banmeConfig.jackpot.softPity) {
              currentProb = banmeConfig.jackpot.baseProb +
                (records[session.guildId].pity - banmeConfig.jackpot.softPity + 1) * 0.06
            }

            if (records[session.guildId].pity >= banmeConfig.jackpot.hardPity || Math.random() < currentProb) {
              isJackpot = true
              isGuaranteed = records[session.guildId].pity >= banmeConfig.jackpot.hardPity

              records[session.guildId].pity = 0

              if (records[session.guildId].guaranteed) {
                records[session.guildId].guaranteed = false
              } else {
                if (Math.random() < 0.5) {
                  records[session.guildId].guaranteed = true
                }
              }
            }

            saveData(dataService.banMeRecordsPath, records)

            // 计算禁言时长
            let milliseconds
            if (isJackpot && banmeConfig.jackpot.enabled) {
              if (records[session.guildId].guaranteed) {
                milliseconds = parseTimeString(banmeConfig.jackpot.loseDuration)
              } else {
                milliseconds = parseTimeString(banmeConfig.jackpot.upDuration)
              }
            } else {
              const baseMaxMillis = banmeConfig.baseMax * 60 * 1000
              const baseMinMillis = banmeConfig.baseMin * 1000
              const additionalMinutes = Math.floor(Math.pow(records[session.guildId].count - 1, 1/3) * banmeConfig.growthRate)
              const maxMilliseconds = baseMaxMillis + (additionalMinutes * 60 * 1000)
              milliseconds = Math.floor(Math.random() * (maxMilliseconds - baseMinMillis + 1)) + baseMinMillis
            }

            await session.bot.muteGuildMember(session.guildId, session.userId, milliseconds)
            dataService.recordMute(session.guildId, session.userId, milliseconds)

            const timeStr = formatDuration(milliseconds)
            let message = `🎲 检测到使用特殊字符逃避禁言，抽到了 ${timeStr} 的禁言喵！\n`

            if (isJackpot) {
              if (records[session.guildId].guaranteed) {
                message += '【金】呜呜呜歪掉了！但是下次一定会中的喵！\n'
              } else {
                message += '【金】喵喵喵！恭喜主人中了UP！\n'
              }
              if (isGuaranteed) {
                message += '触发保底啦喵~\n'
              }
            }

            dataService.logCommand(session, 'banme', session.userId,
              `Success: ${timeStr} (Jackpot: ${isJackpot}, Pity: ${records[session.guildId].pity}, Count: ${records[session.guildId].count})`)
            await session.send(message)
            return
          } catch (e) {
            await session.send('自动禁言失败了...可能是权限不够喵')
          }
        }
      }
      // 修改消息内容为标准命令
      session.content = 'banme'
    }
    return next()
  })

  // banme 命令
  ctx.command('banme', '随机禁言自己', { authority: 1 })
    .action(async ({ session }) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'
      if (session.quote) return '喵喵？回复消息时不能使用这个命令哦~'

      // 读取群配置
      const groupConfigs = readData(dataService.groupConfigPath)
      const groupConfig = groupConfigs[session.guildId] = groupConfigs[session.guildId] || {}

      // 使用群配置，如果没有则使用全局配置
      const banmeConfig = groupConfig.banme || ctx.config.banme

      if (!banmeConfig.enabled) {
        dataService.logCommand(session, 'banme', session.userId, 'Failed: Feature disabled')
        return '喵呜...banme功能现在被禁用了呢...'
      }

      try {
        // 读取并更新调用记录
        const records = readData(dataService.banMeRecordsPath)
        const now = Date.now()

        // 初始化群记录
        if (!records[session.guildId]) {
          records[session.guildId] = {
            count: 0,
            lastResetTime: now,
            pity: 0,
            guaranteed: false
          }
        }

        // 检查是否需要重置计数（1小时）
        if (now - records[session.guildId].lastResetTime > 3600000) {
          records[session.guildId].count = 0
          records[session.guildId].lastResetTime = now
        }

        records[session.guildId].count++
        records[session.guildId].pity++

        // 使用群配置的概率和保底机制
        let isJackpot = false
        let isGuaranteed = false

        let currentProb = banmeConfig.jackpot.baseProb
        if (records[session.guildId].pity >= banmeConfig.jackpot.softPity) {
          currentProb = banmeConfig.jackpot.baseProb +
            (records[session.guildId].pity - banmeConfig.jackpot.softPity + 1) * 0.06
        }

        if (records[session.guildId].pity >= banmeConfig.jackpot.hardPity || Math.random() < currentProb) {
          isJackpot = true
          isGuaranteed = records[session.guildId].pity >= banmeConfig.jackpot.hardPity

          records[session.guildId].pity = 0

          if (records[session.guildId].guaranteed) {
            records[session.guildId].guaranteed = false
          } else {
            if (Math.random() < 0.5) {
              records[session.guildId].guaranteed = true
            }
          }
        }

        saveData(dataService.banMeRecordsPath, records)

        // 计算禁言时长，使用群配置
        let milliseconds
        if (isJackpot && banmeConfig.jackpot.enabled) {
          if (records[session.guildId].guaranteed) {
            milliseconds = parseTimeString(banmeConfig.jackpot.loseDuration)
          } else {
            milliseconds = parseTimeString(banmeConfig.jackpot.upDuration)
          }
        } else {
          const baseMaxMillis = banmeConfig.baseMax * 60 * 1000
          const baseMinMillis = banmeConfig.baseMin * 1000
          const additionalMinutes = Math.floor(Math.pow(records[session.guildId].count - 1, 1/3) * banmeConfig.growthRate)
          const maxMilliseconds = baseMaxMillis + (additionalMinutes * 60 * 1000)
          milliseconds = Math.floor(Math.random() * (maxMilliseconds - baseMinMillis + 1)) + baseMinMillis
        }

        await session.bot.muteGuildMember(session.guildId, session.userId, milliseconds)
        dataService.recordMute(session.guildId, session.userId, milliseconds)

        const timeStr = formatDuration(milliseconds)
        let message = `🎲 ${session.username} 抽到了 ${timeStr} 的禁言喵！\n`

        if (isJackpot) {
          if (records[session.guildId].guaranteed) {
            message += '【金】呜呜呜歪掉了！但是下次一定会中的喵！\n'
          } else {
            message += '【金】喵喵喵！恭喜主人中了UP！\n'
          }
          if (isGuaranteed) {
            message += '触发保底啦喵~\n'
          }
        }

        dataService.logCommand(session, 'banme', session.userId,
          `Success: ${timeStr} (Jackpot: ${isJackpot}, Pity: ${records[session.guildId].pity}, Count: ${records[session.guildId].count})`)
        return message

      } catch (e) {
        dataService.logCommand(session, 'banme', session.userId, `Failed: ${e.message}`)
        return `喵呜...禁言失败了：${e.message}`
      }
    })

  // 添加设置群 banme 配置的命令
  ctx.command('banme-config', '设置banme配置', { authority: 3 })
    .option('enabled', '-e <enabled:boolean> 是否启用')
    .option('baseMin', '-min <seconds:number> 最小禁言时间(秒)')
    .option('baseMax', '-max <minutes:number> 最大禁言时间(分)')
    .option('rate', '-r <rate:number> 增长率')
    .option('prob', '-p <probability:number> 金卡基础概率')
    .option('spity', '-sp <count:number> 软保底抽数')
    .option('hpity', '-hp <count:number> 硬保底抽数')
    .option('uptime', '-ut <duration:string> UP奖励时长')
    .option('losetime', '-lt <duration:string> 歪奖励时长')
    .option('autoBan', '-ab <enabled:boolean> 是否自动禁言使用特殊字符的用户')
    .option('reset', '-reset 重置为全局配置')
    .action(async ({ session, options }) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

      const groupConfigs = readData(dataService.groupConfigPath)
      groupConfigs[session.guildId] = groupConfigs[session.guildId] || {}

      if (options.reset) {
        delete groupConfigs[session.guildId].banme
        saveData(dataService.groupConfigPath, groupConfigs)
        return '已重置为全局配置喵~'
      }

      // 初始化或获取现有配置
      let banmeConfig = groupConfigs[session.guildId].banme || { ...ctx.config.banme }
      banmeConfig.jackpot = banmeConfig.jackpot || { ...ctx.config.banme.jackpot }

      // 更新配置
      if (options.enabled !== undefined) banmeConfig.enabled = options.enabled
      if (options.baseMin) banmeConfig.baseMin = options.baseMin
      if (options.baseMax) banmeConfig.baseMax = options.baseMax
      if (options.rate) banmeConfig.growthRate = options.rate
      if (options.prob) banmeConfig.jackpot.baseProb = options.prob
      if (options.spity) banmeConfig.jackpot.softPity = options.spity
      if (options.hpity) banmeConfig.jackpot.hardPity = options.hpity
      if (options.uptime) banmeConfig.jackpot.upDuration = options.uptime
      if (options.losetime) banmeConfig.jackpot.loseDuration = options.losetime
      if (options.autoBan !== undefined) banmeConfig.autoBan = options.autoBan

      groupConfigs[session.guildId].banme = banmeConfig
      saveData(dataService.groupConfigPath, groupConfigs)

      return '配置已更新喵~'
    })
}