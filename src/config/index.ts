// 配置模块
import { Schema } from 'koishi'
import { Config } from '../types'

export const name = 'grouphelper'

export const usage = `
# 使用说明请查看github readme。
https://github.com/camvanaa/koishi-plugin-grouphelper#readme

本配置页面默认为全局配置，群配置请到群内使用指令配置
`

// 配置模式
export const ConfigSchema: Schema<Config> = Schema.object({
  keywords: Schema.array(Schema.string()).default([])
    .description('入群审核关键词列表'),
  warnLimit: Schema.number().default(3)
    .description('警告达到多少次触发自动禁言'),
  banTimes: Schema.object({
    expression: Schema.string().default('{t}^2h')
      .description('警告禁言时长表达式，{t}代表警告次数。例：{t}^2h 表示警告次数的平方小时')
  }).description('自动禁言时长设置'),
  keywordBan: Schema.object({
    enabled: Schema.boolean().default(false)
      .description('是否启用关键词自动禁言'),
    keywords: Schema.array(Schema.string()).default([])
      .description('触发禁言的关键词列表'),
    duration: Schema.string().default('10min')
      .description('关键词触发的禁言时长(格式：数字+单位[s/min/h])')
  }).description('关键词禁言设置'),
  defaultWelcome: Schema.string().description('默认欢迎语'),
  banme: Schema.object({
    enabled: Schema.boolean().default(true)
      .description('是否启用banme指令'),
    baseMin: Schema.number().default(1)
      .description('基础最小禁言时长（秒）'),
    baseMax: Schema.number().default(30)
      .description('基础最大禁言时长（分钟）'),
    growthRate: Schema.number().default(30)
      .description('递增系数（越大增长越快）'),
    jackpot: Schema.object({
      enabled: Schema.boolean().default(true)
        .description('是否启用金卡系统'),
      baseProb: Schema.number().default(0.006)
        .description('金卡基础概率'),
      softPity: Schema.number().default(73)
        .description('软保底抽数'),
      hardPity: Schema.number().default(89)
        .description('硬保底抽数'),
      upDuration: Schema.string().default('24h')
        .description('UP奖励时长'),
      loseDuration: Schema.string().default('12h')
        .description('歪奖励时长')
    }).description('金卡系统设置')
  }).description('banme指令设置'),
  friendRequest: Schema.object({
    enabled: Schema.boolean().default(false)
      .description('是否启用好友申请关键词验证'),
    keywords: Schema.array(Schema.string()).default([])
      .description('好友申请通过关键词列表'),
    rejectMessage: Schema.string().default('请输入正确的验证信息')
      .description('好友申请拒绝时的提示消息')
  }).description('好友申请设置'),
  guildRequest: Schema.object({
    enabled: Schema.boolean().default(false)
      .description('是否自动同意入群邀请（启用时同意所有，禁用时拒绝所有）'),
    rejectMessage: Schema.string().default('暂不接受入群邀请')
      .description('拒绝入群邀请时的提示消息')
  }).description('入群邀请设置'),
  setEssenceMsg: Schema.object({
    enabled: Schema.boolean().default(true)
      .description('是否启用精华消息功能'),
    authority: Schema.number().default(3)
      .description('设置精华消息所需权限等级')
  }).description('精华消息设置'),
  setTitle: Schema.object({
    enabled: Schema.boolean().default(true)
      .description('是否启用头衔功能'),
    authority: Schema.number().default(3)
      .description('设置头衔所需权限等级'),
    maxLength: Schema.number().default(18)
      .description('头衔最大长度')
  }).description('头衔设置'),
  antiRepeat: Schema.object({
    enabled: Schema.boolean().default(false)
      .description('是否启用反复读功能'),
    threshold: Schema.number().default(3)
      .description('触发反复读处理的次数阈值（超过该次数将撤回除第一条外的所有复读消息）')
  }).description('反复读设置')
})