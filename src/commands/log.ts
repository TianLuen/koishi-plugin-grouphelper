import { Context } from 'koishi'
import { DataService } from '../services'
import * as fs from 'fs'

export function registerLogCommands(ctx: Context, dataService: DataService) {
  ctx.command('listlog [lines:number]', '显示最近的操作记录', { authority: 3 })
  .action(async ({ session }, lines = 100) => {
    if (!fs.existsSync(dataService.logPath)) {
      return '还没有任何日志记录喵~'
    }

    try {

      const maxBuffer = 1024 * 1024
      const content = fs.readFileSync(dataService.logPath, 'utf8')
      const allLines = content.split('\n').filter(line => line.trim())
      const recentLines = allLines.slice(-lines)

      if (recentLines.length === 0) {
        return '还没有任何日志记录喵~'
      }


      return `=== 最近 ${Math.min(lines, recentLines.length)} 条操作记录 ===\n${recentLines.join('\n')}`
    } catch (e) {
      return `读取日志失败喵...${e.message}`
    }
  })

  ctx.command('clearlog', '清理日志文件', { authority: 4 })
  .option('d', '-d <days:number> 保留最近几天的日志')
  .option('a', '-a 清理所有日志')
  .action(async ({ session, options }) => {
    if (!fs.existsSync(dataService.logPath)) {
      return '还没有任何日志记录喵~'
    }

    try {
      if (options.a) {

        fs.writeFileSync(dataService.logPath, '')
        dataService.logCommand(session, 'clearlog', 'all', 'Cleared all logs')
        return '已清理所有日志记录喵~'
      }

      const days = options.d || 7
      const now = Date.now()
      const content = fs.readFileSync(dataService.logPath, 'utf8')
      const allLines = content.split('\n').filter(line => line.trim())


      const keptLogs = allLines.filter(line => {
        const match = line.match(/^\[(.*?)\]/)
        if (!match) return false

        const logTime = new Date(match[1]).getTime()
        return (now - logTime) <= days * 24 * 60 * 60 * 1000
      })


      fs.writeFileSync(dataService.logPath, keptLogs.join('\n') + '\n')

      const deletedCount = allLines.length - keptLogs.length
      dataService.logCommand(session, 'clearlog', `${days}days`, `Cleared ${deletedCount} logs`)

      return `已清理 ${deletedCount} 条日志记录，保留最近 ${days} 天的记录喵~`
    } catch (e) {
      return `清理日志失败喵...${e.message}`
    }
  })
}