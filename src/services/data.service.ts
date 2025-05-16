// 数据服务模块
import * as fs from 'fs'
import * as path from 'path'
import { Context } from 'koishi'
import { createWriteStream } from 'fs'
import { readData, saveData } from '../utils'
import {
  MuteRecord,
  GroupConfig,
  AntiRepeatConfig,
  Subscription
} from '../types'

export class DataService {
  // 数据存储路径
  dataPath: string
  warnsPath: string
  blacklistPath: string
  groupConfigPath: string
  mutesPath: string
  banMeRecordsPath: string
  lockedNamesPath: string
  logPath: string
  antiRepeatConfigPath: string
  subscriptionsPath: string

  // 日志流
  logStream: fs.WriteStream

  // 数据缓存
  antiRepeatConfigs: Record<string, AntiRepeatConfig>
  subscriptions: Subscription[]

  constructor(ctx: Context) {
    // 初始化路径
    this.dataPath = path.resolve(ctx.baseDir, 'data/grouphelper')
    this.warnsPath = path.resolve(this.dataPath, 'warns.json')
    this.blacklistPath = path.resolve(this.dataPath, 'blacklist.json')
    this.groupConfigPath = path.resolve(this.dataPath, 'group_config.json')
    this.mutesPath = path.resolve(this.dataPath, 'mutes.json')
    this.banMeRecordsPath = path.resolve(this.dataPath, 'banme_records.json')
    this.lockedNamesPath = path.resolve(this.dataPath, 'locked_names.json')
    this.logPath = path.resolve(this.dataPath, 'grouphelper.log')
    this.antiRepeatConfigPath = path.join(this.dataPath, 'antirepeat.json')
    this.subscriptionsPath = path.join(this.dataPath, 'subscriptions.json')

    // 初始化
    this.init()
  }

  /**
   * 初始化数据服务
   */
  private init() {
    // 确保数据目录存在
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true })
    }

    // 初始化数据文件
    if (!fs.existsSync(this.warnsPath)) {
      fs.writeFileSync(this.warnsPath, '{}')
    }
    if (!fs.existsSync(this.blacklistPath)) {
      fs.writeFileSync(this.blacklistPath, '{}')
    }
    if (!fs.existsSync(this.groupConfigPath)) {
      fs.writeFileSync(this.groupConfigPath, '{}')
    }
    if (!fs.existsSync(this.mutesPath)) {
      fs.writeFileSync(this.mutesPath, '{}')
    }
    if (!fs.existsSync(this.banMeRecordsPath)) {
      fs.writeFileSync(this.banMeRecordsPath, '{}')
    }
    if (!fs.existsSync(this.lockedNamesPath)) {
      fs.writeFileSync(this.lockedNamesPath, '{}')
    }

    // 创建日志流
    this.logStream = createWriteStream(this.logPath, { flags: 'a' })

    // 加载复读配置
    this.antiRepeatConfigs = readData(this.antiRepeatConfigPath) as Record<string, AntiRepeatConfig>

    // 加载订阅配置
    try {
      const data = readData(this.subscriptionsPath)
      this.subscriptions = Array.isArray(data) ? data : []
    } catch {
      this.subscriptions = []
    }
  }

  /**
   * 记录禁言
   * @param guildId 群ID
   * @param userId 用户ID
   * @param duration 持续时间
   */
  recordMute(guildId: string, userId: string, duration: number) {
    const mutes = readData(this.mutesPath)
    if (!mutes[guildId]) mutes[guildId] = {}

    mutes[guildId][userId] = {
      startTime: Date.now(),
      duration: duration,
      leftGroup: false
    }

    saveData(this.mutesPath, mutes)
  }

  /**
   * 记录日志
   * @param session 会话
   * @param command 命令
   * @param target 目标
   * @param result 结果
   */
  async logCommand(session: any, command: string, target: string, result: string) {
    const date = new Date()
    date.setHours(date.getHours() + 8)
    const time = date.toISOString()
      .replace('T', ' ')
      .replace('Z', '')
      .slice(0, 16)

    const user = session.username || session.userId
    const group = session.guildId || 'private'
    const logLine = `[${time}] [${command}] 用户(${user}) 群(${group}) 目标(${target}): ${result}\n`

    // 写入日志文件
    this.logStream.write(logLine)
    console.log(logLine.trim())

    // 推送日志消息
    await this.pushMessage(session.bot, logLine.trim(), 'log')
  }

  /**
   * 保存复读配置
   * @param guildId 群ID
   * @param config 配置
   */
  saveAntiRepeatConfig(guildId: string, config: AntiRepeatConfig) {
    this.antiRepeatConfigs[guildId] = config
    saveData(this.antiRepeatConfigPath, this.antiRepeatConfigs)
  }

  /**
   * 获取复读配置
   * @param guildId 群ID
   * @returns 复读配置
   */
  getAntiRepeatConfig(guildId: string): AntiRepeatConfig {
    return this.antiRepeatConfigs[guildId]
  }

  /**
   * 关闭资源
   */
  dispose() {
    if (this.logStream) {
      this.logStream.end()
    }
  }

  /**
   * 向订阅用户推送消息
   * @param bot 机器人实例
   * @param message 消息内容
   * @param feature 功能类型
   */
  async pushMessage(bot: any, message: string, feature: keyof Subscription['features']) {
    for (const sub of this.subscriptions) {
      try {
        // 确保 features 对象存在
        if (!sub.features) {
          sub.features = {};
          continue; // 跳过这次迭代，因为新初始化的 features 肯定没有启用任何功能
        }

        // 检查是否启用了特定功能
        if (sub.features[feature]) {
          if (sub.type === 'group') {
            await bot.sendMessage(sub.id, message)
          } else {
            await bot.sendPrivateMessage(sub.id, message)
          }
        }
      } catch (e) {
        console.error(`推送消息失败: ${e.message}`)
      }
    }
  }

  /**
   * 保存订阅配置
   */
  saveSubscriptions() {
    saveData(this.subscriptionsPath, this.subscriptions)
  }

  /**
   * 获取功能名称
   * @param feature 功能键名
   * @returns 功能名称
   */
  getFeatureName(feature: keyof Subscription['features']): string {
    const names = {
      log: '操作日志',
      memberChange: '成员变动通知',
      muteExpire: '禁言到期通知',
      blacklist: '黑名单变更通知',
      warning: '警告通知'
    }
    return names[feature] || '未知功能'
  }

  /**
   * 定时检查禁言到期
   * @param bot 机器人实例
   */
  async checkMuteExpires(bot: any) {
    if (!bot) return;

    try {
      const mutes = readData(this.mutesPath) as Record<string, Record<string, MuteRecord>>
      const now = Date.now()
      let hasChanges = false

      for (const groupId in mutes) {
        for (const userId in mutes[groupId]) {
          const muteRecord = mutes[groupId][userId]
          if (!muteRecord) continue;

          const expireTime = muteRecord.startTime + muteRecord.duration

          if (now >= expireTime && !muteRecord.notified) {
            mutes[groupId][userId].notified = true
            hasChanges = true

            // 确保消息正确发送
            const message = `[禁言到期] 用户 ${userId} 在群 ${groupId} 的禁言已到期`
            try {
              await this.pushMessage(bot, message, 'muteExpire')
              console.log('已发送禁言到期通知:', message)
            } catch (e) {
              console.error('发送禁言到期通知失败:', e)
            }
          }
        }
      }

      if (hasChanges) {
        saveData(this.mutesPath, mutes)
      }
    } catch (e) {
      console.error('检查禁言到期失败:', e)
    }
  }
}