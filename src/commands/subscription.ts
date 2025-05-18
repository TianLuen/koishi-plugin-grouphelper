import { Context } from 'koishi'
import { DataService } from '../services'
import { Subscription } from '../types'

export function registerSubscriptionCommands(ctx: Context, dataService: DataService) {

  ctx.command('sub', '订阅管理')
    .action(async ({ session }) => {
      return `使用以下命令管理订阅：
sub log - 操作日志订阅
sub member - 成员变动通知
sub mute - 禁言到期通知
sub blacklist - 黑名单变更通知
sub warning - 警告通知
sub all - 订阅所有通知
sub none - 取消所有订阅
sub status - 查看订阅状态`
    })


  ctx.command('sub.log', '订阅操作日志', { authority: 3 })
    .action(async ({ session }) => {
      return handleSubscription(session, 'log')
    })

  ctx.command('sub.member', '订阅成员变动', { authority: 3 })
    .action(async ({ session }) => {
      return handleSubscription(session, 'memberChange')
    })

  ctx.command('sub.mute', '订阅禁言到期通知', { authority: 3 })
    .action(async ({ session }) => {
      return handleSubscription(session, 'muteExpire')
    })

  ctx.command('sub.blacklist', '订阅黑名单变更', { authority: 3 })
    .action(async ({ session }) => {
      return handleSubscription(session, 'blacklist')
    })

  ctx.command('sub.warning', '订阅警告通知', { authority: 3 })
    .action(async ({ session }) => {
      return handleSubscription(session, 'warning')
    })

  ctx.command('sub.all', '订阅所有通知', { authority: 3 })
    .action(async ({ session }) => {
      return handleAllSubscriptions(session, true)
    })

  ctx.command('sub.none', '取消所有订阅', { authority: 3 })
    .action(async ({ session }) => {
      return handleAllSubscriptions(session, false)
    })

  ctx.command('sub.status', '查看订阅状态', { authority: 3 })
    .action(async ({ session }) => {
      return showSubscriptionStatus(session)
    })


  function handleSubscription(session: any, feature: keyof Subscription['features']) {
    if (!session) return '无法获取会话信息'

    const id = session.guildId || session.userId
    if (!id) return '无法获取订阅ID'

    const type = session.guildId ? 'group' : 'private'


    let sub = dataService.subscriptions.find(s => s.id === id && s.type === type)


    if (!sub) {
      sub = {
        type,
        id,
        features: {}
      }
      dataService.subscriptions.push(sub)
    }


    if (!sub.features) {
      sub.features = {}
    }


    sub.features[feature] = !sub.features[feature]
    dataService.saveSubscriptions()

    return sub.features[feature]
      ? `已订阅${dataService.getFeatureName(feature)}喵~`
      : `已取消订阅${dataService.getFeatureName(feature)}喵~`
  }


  function handleAllSubscriptions(session: any, enabled: boolean) {
    if (!session) return '无法获取会话信息'

    const id = session.guildId || session.userId
    if (!id) return '无法获取订阅ID'

    const type = (session.guildId ? 'group' : 'private') as ('group' | 'private')


    const index = dataService.subscriptions.findIndex(s => s.id === id && s.type === type)

    if (!enabled && index >= 0) {

      dataService.subscriptions.splice(index, 1)
      dataService.saveSubscriptions()
      return '已取消所有订阅喵~'
    }

    if (enabled) {

      const sub: Subscription = index >= 0 ? dataService.subscriptions[index] : {
        type,
        id,
        features: {}
      }

      if (index < 0) {
        dataService.subscriptions.push(sub)
      }

      sub.features = {
        log: true,
        memberChange: true,
        muteExpire: true,
        blacklist: true,
        warning: true
      }

      dataService.saveSubscriptions()
      return '已订阅所有通知喵~'
    }

    return '无需操作喵~'
  }


  function showSubscriptionStatus(session: any) {
    if (!session) return '无法获取会话信息'

    const id = session.guildId || session.userId
    if (!id) return '无法获取订阅ID'

    const type = session.guildId ? 'group' : 'private'


    const sub = dataService.subscriptions.find(s => s.id === id && s.type === type)

    if (!sub || !sub.features) {
      return '当前没有任何订阅喵~'
    }

    const status = [
      `当前订阅状态：`,
      `- 操作日志: ${sub.features.log ? '✅' : '❌'}`,
      `- 成员变动: ${sub.features.memberChange ? '✅' : '❌'}`,
      `- 禁言到期: ${sub.features.muteExpire ? '✅' : '❌'}`,
      `- 黑名单变更: ${sub.features.blacklist ? '✅' : '❌'}`,
      `- 警告通知: ${sub.features.warning ? '✅' : '❌'}`
    ]

    return status.join('\n')
  }


  setInterval(() => {
    const bot = ctx.bots.values().next().value
    if (bot) {
      dataService.checkMuteExpires(bot).catch(console.error)
    }
  }, 60000)
}
