// 欢迎语和关键词管理命令
import { Context } from 'koishi'
import { DataService } from '../services'
import { readData, saveData } from '../utils'

export function registerWelcomeCommands(ctx: Context, dataService: DataService) {
  // 添加欢迎语管理命令
  ctx.command('welcome', '入群欢迎语管理', { authority: 3 })
    .option('s', '-s <消息> 设置欢迎语')
    .option('r', '-r 移除欢迎语')
    .option('t', '-t 测试当前欢迎语')
    .action(async ({ session, options }) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

      const groupConfigs = readData(dataService.groupConfigPath)
      groupConfigs[session.guildId] = groupConfigs[session.guildId] || {
        keywords: [],
        approvalKeywords: [],
        welcomeMsg: '',
        auto: 'false',
        reject: '答案错误，请重新申请'
      }

      if (options.s) {
        groupConfigs[session.guildId].welcomeMsg = options.s
        saveData(dataService.groupConfigPath, groupConfigs)
        dataService.logCommand(session, 'welcome', 'set', `已设置欢迎语：${options.s}`)
        return `已经设置好欢迎语啦喵，要不要用 -t 试试看效果呀？`
      }

      if (options.r) {
        delete groupConfigs[session.guildId].welcomeMsg
        saveData(dataService.groupConfigPath, groupConfigs)
        dataService.logCommand(session, 'welcome', 'remove', '已移除欢迎语')
        return `欢迎语已经被我吃掉啦喵~`
      }

      if (options.t) {
        const msg = groupConfigs[session.guildId].welcomeMsg || ctx.config.defaultWelcome
        if (!msg) return '未设置欢迎语'

        const testMsg = msg
          .replace(/{at}/g, `<at id="${session.userId}"/>`)
          .replace(/{user}/g, session.userId)
          .replace(/{group}/g, session.guildId)
        return testMsg
      }

      const currentMsg = groupConfigs[session.guildId].welcomeMsg
      return `当前欢迎语：${currentMsg || '未设置'}\n\n可用变量：
{at} - @新成员
{user} - 新成员QQ号
{group} - 群号

使用方法：
welcome -s <欢迎语>  设置欢迎语
welcome -r  移除欢迎语
welcome -t  测试当前欢迎语`
    })

  // 添加群关键词管理命令
  ctx.command('groupkw', '群关键词管理', { authority: 3 })
    .option('a', '-a <关键词> 添加关键词，多个关键词用英文逗号分隔')
    .option('r', '-r <关键词> 移除关键词，多个关键词用英文逗号分隔')
    .option('l', '-l 列出关键词')
    .option('p', '-p 管理入群审核关键词')
    .option('n', '-n <自动拒绝> 设置自动拒绝，需要配合-p使用')
    .option('w', '-w <拒绝词> 设置拒绝词，需要配合-p使用')
    .action(async ({ session, options }) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

      const groupConfigs = readData(dataService.groupConfigPath)
      groupConfigs[session.guildId] = groupConfigs[session.guildId] || {
        keywords: [],
        approvalKeywords: [],
        auto: 'false',
        reject: '答案错误，请重新申请'
      }

      // 处理入群审核关键词
      if (options.p) {
        if (options.l) {
          const keywords = groupConfigs[session.guildId].approvalKeywords
          return `当前群入群审核关键词：\n${keywords.join('、') || '无'}\n自动拒绝状态：${groupConfigs[session.guildId].auto}\n拒绝词：${groupConfigs[session.guildId].reject}`
        }

        if (options.a) {
          const newKeywords = options.a.split(',').map(k => k.trim()).filter(k => k)
          groupConfigs[session.guildId].approvalKeywords.push(...newKeywords)
          saveData(dataService.groupConfigPath, groupConfigs)
          dataService.logCommand(session, 'groupkw', 'add', `已添加关键词：${newKeywords.join('、')}`)
          return `已经添加了关键词：${newKeywords.join('、')} 喵喵喵~`
        }

        if (options.r) {
          const removeKeywords = options.r.split(',').map(k => k.trim()).filter(k => k)
          const removed = []
          for (const keyword of removeKeywords) {
            const index = groupConfigs[session.guildId].approvalKeywords.indexOf(keyword)
            if (index > -1) {
              groupConfigs[session.guildId].approvalKeywords.splice(index, 1)
              removed.push(keyword)
            }
          }
          if (removed.length > 0) {
            saveData(dataService.groupConfigPath, groupConfigs)
            dataService.logCommand(session, 'groupkw', 'remove', `已移除关键词：${removed.join('、')}`)
            return `已经把关键词：${removed.join('、')} 删掉啦喵！`
          }
          return '未找到指定的关键词'
        }

        if (options.n !== undefined) {
          const value = String(options.n).toLowerCase()
          if (value === 'true' || value === '1' || value === 'yes' || value === 'y' || value === 'on') {
            groupConfigs[session.guildId].auto = 'true'
          } else if (value === 'false' || value === '0' || value === 'no' || value === 'n' || value === 'off') {
            groupConfigs[session.guildId].auto = 'false'
          } else {
            return '无效的值，请使用 true/false、1/0、yes/no、y/n 或 on/off'
          }
          saveData(dataService.groupConfigPath, groupConfigs)
          dataService.logCommand(session, 'groupkw', 'auto', `已设置自动拒绝：${groupConfigs[session.guildId].auto}`)
          return `自动拒绝状态更新为${groupConfigs[session.guildId].auto}`
        }

        if (options.w) {
          groupConfigs[session.guildId].reject = options.w
          saveData(dataService.groupConfigPath, groupConfigs)
          dataService.logCommand(session, 'groupkw', 'set', `已设置拒绝词：${options.w}`)
          return `拒绝词已更新为：${options.w} 喵喵喵~`
        }
      }

      // 原有的禁言关键词管理逻辑
      if (options.l) {
        const keywords = groupConfigs[session.guildId].keywords
        return `当前群禁言关键词：\n${keywords.join('、') || '无'}`
      }

      if (options.a) {
        const newKeywords = options.a.split(',').map(k => k.trim()).filter(k => k)
        groupConfigs[session.guildId].keywords.push(...newKeywords)
        saveData(dataService.groupConfigPath, groupConfigs)
        dataService.logCommand(session, 'groupkw', 'add', `已添加关键词：${newKeywords.join('、')}`)
        return `已经添加了关键词：${newKeywords.join('、')} 喵喵喵~`
      }

      if (options.r) {
        const removeKeywords = options.r.split(',').map(k => k.trim()).filter(k => k)
        const removed = []
        for (const keyword of removeKeywords) {
          const index = groupConfigs[session.guildId].keywords.indexOf(keyword)
          if (index > -1) {
            groupConfigs[session.guildId].keywords.splice(index, 1)
            removed.push(keyword)
          }
        }
        if (removed.length > 0) {
          saveData(dataService.groupConfigPath, groupConfigs)
          dataService.logCommand(session, 'groupkw', 'remove', `已移除关键词：${removed.join('、')}`)
          return `已经把关键词：${removed.join('、')} 删掉啦喵！`
        }
        return '未找到指定的关键词'
      }

      return '请使用：\n-a 添加关键词\n-r 移除关键词\n-l 列出关键词\n-p 管理入群审核关键词\n-n <true/false> 未匹配关键词自动拒绝\n-w <拒绝词> 设置拒绝时的回复\n多个关键词用英文逗号分隔'
    })
}