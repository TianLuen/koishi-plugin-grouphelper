import { Context } from 'koishi'

// 导入配置
import * as config from './config'

// 导入服务
import { DataService } from './services'
import { registerEventListeners, setupScheduledTasks } from './services/event.service'

// 导入命令
import {
  registerBasicCommands,
  registerWelcomeCommands,
  registerWarnCommands,
  registerHelpCommands,
  registerRepeatMiddleware,
  registerKeywordMiddleware,
  setupRepeatCleanupTask,
  registerConfigCommands,
  registerBanmeCommands,
  registerLogCommands,
  registerSubscriptionCommands
} from './commands'

// 导出配置
export const name = config.name
export const usage = config.usage
export const Config = config.ConfigSchema

// 导出接口类型
export { Config as ConfigInterface } from './types'

// 插件主函数
export function apply(ctx: Context) {
  // 创建数据服务
  const dataService = new DataService(ctx)

  // 注册命令和中间件
  registerBasicCommands(ctx, dataService)
  registerWelcomeCommands(ctx, dataService)
  registerWarnCommands(ctx, dataService)
  registerHelpCommands(ctx, dataService)
  registerKeywordMiddleware(ctx, dataService)
  registerRepeatMiddleware(ctx, dataService)
  registerConfigCommands(ctx, dataService)
  registerBanmeCommands(ctx, dataService)
  registerLogCommands(ctx, dataService)
  registerSubscriptionCommands(ctx, dataService)

  // 注册事件监听器和定时任务
  registerEventListeners(ctx, dataService)
  setupScheduledTasks(ctx, dataService)
  setupRepeatCleanupTask()

  // 注册资源释放钩子
  ctx.on('dispose', () => {
    dataService.dispose()
  })
}
