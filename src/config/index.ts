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
    autoBan: Schema.boolean().default(false)
      .description('是否自动禁言模糊匹配'),
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
  }).description('反复读设置'),
  openai: Schema.object({
    enabled: Schema.boolean().default(false)
      .description('是否启用AI功能（总开关）'),
    chatEnabled: Schema.boolean().default(true)
      .description('是否启用AI对话功能'),
    translateEnabled: Schema.boolean().default(true)
      .description('是否启用翻译功能'),
    apiKey: Schema.string().description('OpenAI API密钥'),
    apiUrl: Schema.string().default('https://api.openai.com/v1')
      .description('API接口地址，可使用第三方接口'),
    model: Schema.string().default('gpt-3.5-turbo')
      .description('使用的模型名称'),
    systemPrompt: Schema.string()
      .role('textarea')
      .default('你是一个有帮助的AI助手，请简短、准确地回答问题。')
      .description('系统提示词'),
    translatePrompt: Schema.string()
      .role('textarea')
      .default(`你是一名多语翻译专家，擅长将内容地道自然地翻译成流畅。译文应忠实原意，语言表达符合习惯，不带翻译腔的母语级别，风格口吻贴合上下文场景。

翻译原则：

- 按文本类型调整语气风格：技术/文档用语严谨，论坛/评论风格口语
- 按需调整语序，使语言更符合表达逻辑
- 用词流畅，本地化表达，恰当使用成语、流行语等特色词语和句式

要求：
- 保持对话连贯和角色一致
- 准确传递语气和文化内涵

⚠️ 输出规范（绝对遵守）：仅输出译文，不添加任何说明、注释、标记或原文。

如果是中文则翻译为英文，如果是其他语言则翻译为中文。不要添加任何解释或额外内容。

待翻译的文本内容:`)
      .description('翻译提示词'),
    maxTokens: Schema.number().default(2048)
      .description('最大生成长度'),
    temperature: Schema.number().default(0.7)
      .description('温度参数（越高越随机）'),
    contextLimit: Schema.number().default(10)
      .description('上下文消息数量限制')
  }).description('AI功能设置'),
  report: Schema.object({
    enabled: Schema.boolean().default(true)
      .description('是否启用举报功能'),
    authority: Schema.number().default(1)
      .description('使用举报功能所需的权限等级'),
    autoProcess: Schema.boolean().default(true)
      .description('是否自动处理违规行为'),
    guildConfigs: Schema.dict(
      Schema.object({
        enabled: Schema.boolean().default(true)
          .description('是否在该群启用举报功能'),
        includeContext: Schema.boolean().default(false)
          .description('是否包含群聊上下文'),
        contextSize: Schema.number().min(1).max(20).default(5)
          .description('包含的上下文消息数量（最近的n条消息）'),
        autoProcess: Schema.boolean().default(true)
          .description('是否自动处理该群的违规行为')
      })
    ).description('群聊单独配置'),
    maxReportCooldown: Schema.number().default(60)
      .description('举报失败后的冷却时间（分钟）'),
    minAuthorityNoLimit: Schema.number().default(2)
      .description('不受举报冷却限制的最低权限等级')
  }).description('举报功能设置')
})
