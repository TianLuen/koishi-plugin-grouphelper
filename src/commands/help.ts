// 帮助命令模块
import { Context } from 'koishi'
import { DataService } from '../services'
import { parseTimeString, formatDuration } from '../utils'

export function registerHelpCommands(ctx: Context, dataService: DataService) {
  // grouphelper命令 - 帮助信息
  ctx.command('grouphelper', '群管理帮助', { authority: 3 })
    .action(async ({ session }) => {
      return `=== 基础命令 ===
kick {@用户} [-b] [群号]  踢出用户，-b 表示加入黑名单
ban {@用户} {时长} [群号]  禁言用户，支持表达式
unban {@用户} [群号]  解除用户禁言
ban-all  开启全体禁言
unban-all  解除全体禁言
unban-allppl  解除所有人禁言
delmsg (回复)  撤回指定消息

=== 管理员设置 ===
admin {@用户}  设置管理员（权限等级4）
unadmin {@用户}  取消管理员（权限等级4）

=== 娱乐功能 ===
banme [次数]  随机禁言自己（权限等级1）
  · 普通抽卡：1秒~30分钟（每次使用递增上限）
  · 金卡概率：0.6%（73抽后概率提升，89抽保底）
  · UP奖励：24小时禁言
  · 歪奖励：12小时禁言（下次必中UP）
banme-config  设置banme配置（权限等级3）：
  -e <true/false>  启用/禁用功能
  -min <秒>  最小禁言时间
  -max <分>  最大禁言时间
  -r <数值>  增长率
  -p <概率>  金卡基础概率
  -sp <次数>  软保底抽数
  -hp <次数>  硬保底抽数
  -ut <时长>  UP奖励时长
  -lt <时长>  歪奖励时长
  -reset  重置为全局配置

=== 警告系统 ===
warn {@用户} [次数]  警告用户，默认1次
check {@用户}  查询用户记录
autoban {@用户}  根据警告次数自动禁言

=== 精华消息 ===
essence  精华消息管理：
  -s  设置精华消息（需回复消息）
  -r  取消精华消息（需回复消息）

=== 头衔管理 ===
title  群头衔管理：
  -s <文本>  设置头衔
  -r  移除头衔
  -u @用户  为指定用户设置（可选）

=== 日志管理 ===
listlog [数量]  显示最近的操作记录，默认100条
clearlog  清理日志文件（权限等级4）：
  -d <天数>  保留最近几天的日志，默认7天
  -a  清理所有日志

=== 关键词管理 ===
groupkw  群关键词管理：
  -l  列出本群关键词
  -a <关键词>  添加本群关键词，多个关键词用英文逗号分隔
  -r <关键词>  移除本群关键词，多个关键词用英文逗号分隔
  -p  管理入群审核关键词（需配合上述参数使用）

=== 欢迎设置 ===
welcome  入群欢迎语管理：
  -s <消息>  设置欢迎语
  -r  移除欢迎语
  -t  测试当前欢迎语
支持变量：
  {at}  @新成员
  {user}  新成员QQ号
  {group}  群号

=== 订阅系统 ===
sub  订阅管理：
  log  订阅操作日志（踢人、禁言等操作记录）
  member  订阅成员变动通知（进群、退群）
  mute  订阅禁言到期通知
  blacklist  订阅黑名单变更通知
  warning  订阅警告通知
  all  订阅所有通知
  none  取消所有订阅
  status  查看订阅状态

=== 配置管理 ===
config  配置管理：
  -t  显示所有配置和记录
  -b  黑名单管理
    -a {QQ号}  添加黑名单
    -r {QQ号}  移除黑名单
  -w  警告管理
    -a {QQ号} [次数]  增加警告
    -r {QQ号} [次数]  减少警告

=== 时间表达式 ===
支持以下格式：
· 基本单位：s（秒）、min（分钟）、h（小时）
· 基本格式：数字+单位，如：1h、10min、30s
· 支持的运算：
  · +, -, *, /, ^, sqrt(), 1e2
· 表达式示例：
  · (sqrt(100)+1e1)^2s = 400秒 = 6分40秒
· 时间范围：1秒 ~ 29天23小时59分59秒

注：大部分命令需要权限等级 3 或以上`
    })

  // 添加时间解析测试命令
  ctx.command('parse-time <expression:text>', '测试时间解析', { authority: 1 })
    .example('parse-time 10m')
    .example('parse-time 1h30m')
    .example('parse-time 2days')
    .example('parse-time (1+2)^2hours')
    .action(async ({ session }, expression) => {
      if (!expression) {
        return '请提供时间表达式进行测试'
      }

      try {
        const milliseconds = parseTimeString(expression)
        return `表达式 "${expression}" 解析结果：${formatDuration(milliseconds)} (${milliseconds}毫秒)`
      } catch (e) {
        return `解析错误：${e.message}`
      }
    })
}
