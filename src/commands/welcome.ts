import { Context } from 'koishi'
import { DataService } from '../services'
import { readData, saveData } from '../utils'

export function registerWelcomeCommands(ctx: Context, dataService: DataService) {

  ctx.command('welcome', '入群欢迎语管理', { authority: 3 })
    .option('s', '-s <消息> 设置欢迎语')
    .option('r', '-r 移除欢迎语')
    .option('t', '-t 测试当前欢迎语')
    .option('l', '-l <等级> 设置等级限制')
    .option('j', '-j <天数> 设置退群冷却天数')
    .action(async ({ session, options }) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

      const groupConfigs = readData(dataService.groupConfigPath)
      groupConfigs[session.guildId] = groupConfigs[session.guildId] || {
        keywords: [],
        approvalKeywords: [],
        welcomeMsg: '',
        auto: 'false',
        reject: '答案错误，请重新申请',
        levelLimit: 0,  // 等级限制
        leaveCooldown: 0  // 退群冷却天数
      }

      if (options.l !== undefined) {
        const level = parseInt(options.l)
        if (isNaN(level) || level < 0) {
          return '等级限制必须是非负整数喵~'
        }
        groupConfigs[session.guildId].levelLimit = level
        saveData(dataService.groupConfigPath, groupConfigs)
        dataService.logCommand(session, 'welcome', 'set', `已设置等级限制：${level}级`)
        return `已经设置好等级限制为${level}级啦喵~`
      }

      if (options.j !== undefined) {
        const days = parseInt(options.j)
        if (isNaN(days) || days < 0) {
          return '冷却天数必须是非负整数喵~'
        }
        groupConfigs[session.guildId].leaveCooldown = days
        saveData(dataService.groupConfigPath, groupConfigs)
        dataService.logCommand(session, 'welcome', 'set', `已设置退群冷却：${days}天`)
        return `已经设置好退群冷却为${days}天啦喵~`
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
      const currentLevelLimit = groupConfigs[session.guildId].levelLimit || 0
      const currentLeaveCooldown = groupConfigs[session.guildId].leaveCooldown || 0

      return `当前欢迎语：${currentMsg || '未设置'}
当前等级限制：${currentLevelLimit}级
当前退群冷却：${currentLeaveCooldown}天

可用变量：
{at} - @新成员
{user} - 新成员QQ号
{group} - 群号

使用方法：
welcome -s <欢迎语>  设置欢迎语
welcome -r  移除欢迎语
welcome -t  测试当前欢迎语
welcome -l <等级>  设置等级限制（0表示不限制）
welcome -j <天数>  设置退群冷却天数（0表示不限制）`
    })
}
