// 类型定义文件
import { Context } from 'koishi'

// 声明模块扩展
declare module 'koishi' {
  interface Config {
    keywords: string[]
    warnLimit: number
    banTimes: {
      expression: string  // 使用表达式替代固定的三个等级
    }
    keywordBan: {
      enabled: boolean
      keywords: string[]
      duration: string
    }
    defaultWelcome: string  // 添加默认欢迎语配置
    banme: {
      enabled: boolean  // 是否启用banme
      baseMin: number   // 基础最小值（秒）
      baseMax: number   // 基础最大值（分钟）
      growthRate: number // 递增系数
      jackpot: {
        enabled: boolean  // 是否启用金
        baseProb: number  // 基础概率
        softPity: number  // 软保底抽数
        hardPity: number  // 硬保底抽数
        upDuration: string // UP奖励时长
        loseDuration: string // 歪了奖励时长
      }
    }
    friendRequest: {
      enabled: boolean
      keywords: string[]
      rejectMessage: string
    }
    guildRequest: {
      enabled: boolean
      keywords: string[]
      rejectMessage: string
    }
    setEssenceMsg: {
      enabled: boolean
      authority: number
    }
    setTitle: {
      enabled: boolean
      authority: number
      maxLength: number
    }
    antiRepeat: {
      enabled: boolean
      threshold: number
    }
    openai: {
      enabled: boolean
      apiKey: string
      apiUrl: string
      maxTokens: number
      temperature: number
      model: string
      systemPrompt: string
      contextLimit: number
      translatePrompt: string
    }
  }
}

// 扩展配置接口
export interface Config {
  keywords: string[]  // 入群审核关键词
  warnLimit: number
  banTimes: {
    expression: string  // 使用表达式替代固定的三个等级
  }
  keywordBan: {
    enabled: boolean
    keywords: string[]  // 禁言关键词
    duration: string
  }
  defaultWelcome?: string  // 默认欢迎语
  banme: {
    enabled: boolean  // 是否启用banme
    baseMin: number   // 基础最小值（秒）
    baseMax: number   // 基础最大值（分钟）
    growthRate: number // 递增系数
    jackpot: {
      enabled: boolean  // 是否启用金
      baseProb: number  // 基础概率
      softPity: number  // 软保底抽数
      hardPity: number  // 硬保底抽数
      upDuration: string // UP奖励时长
      loseDuration: string // 歪了奖励时长
    }
  }
  friendRequest: {
    enabled: boolean
    keywords: string[]
    rejectMessage: string
  }
  guildRequest: {
    enabled: boolean
    rejectMessage: string
  }
  setEssenceMsg: {
    enabled: boolean
    authority: number
  }
  setTitle: {
    enabled: boolean
    authority: number
    maxLength: number
  }
  antiRepeat: {
    enabled: boolean
    threshold: number
  }
  openai: {
    enabled: boolean
    apiKey: string
    apiUrl: string
    maxTokens: number
    temperature: number
    model: string
    systemPrompt: string
    contextLimit: number
    translatePrompt: string
  }
}

// 群配置接口
export interface GroupConfig {
  keywords: string[]  // 群专属的禁言关键词
  approvalKeywords: string[]  // 群专属的入群审核关键词
  welcomeMsg?: string  // 入群欢迎语
  banme?: BanMeConfig  // 添加分群 banme 配置
  openai?: {
    enabled: boolean
    systemPrompt?: string
    translatePrompt?: string
  }
}

// 警告记录接口
export interface WarnRecord {
  groups: {
    [guildId: string]: {
      count: number
      timestamp: number
    }
  }
}

// 黑名单记录接口
export interface BlacklistRecord {
  userId: string
  timestamp: number
}

// 禁言记录接口
export interface MuteRecord {
  startTime: number
  duration: number
  remainingTime?: number
  leftGroup?: boolean
  notified?: boolean
}

// 抽奖记录接口
export interface BanMeRecord {
  count: number
  lastResetTime: number
  pity: number  // 保底计数
  guaranteed: boolean  // 是否大保底
}

// 锁定名称记录接口
export interface LockedName {
  userId: string
  name: string
}

// 日志记录接口
export interface LogRecord {
  time: string
  command: string
  user: string
  group: string
  target: string
  result: string
}

// 分群复读配置存储
export interface AntiRepeatConfig {
  enabled: boolean
  threshold: number
}

// 订阅配置类型和存储
export interface LogSubscription {
  type: 'group' | 'private'
  id: string
}

// 扩展订阅配置类型
export interface Subscription {
  type: 'group' | 'private'
  id: string
  features: {
    log?: boolean         // 日志订阅
    memberChange?: boolean // 进群退群通知
    muteExpire?: boolean  // 禁言到期通知
    blacklist?: boolean   // 黑名单变更通知
    warning?: boolean     // 警告通知
  }
}

// banme 配置类型
export interface BanMeConfig {
  enabled: boolean
  baseMin: number
  baseMax: number
  growthRate: number
  jackpot: {
    enabled: boolean
    baseProb: number
    softPity: number
    hardPity: number
    upDuration: string
    loseDuration: string
  }
}

// 复读记录接口
export interface RepeatRecord {
  content: string
  count: number
  firstMessageId: string
  messages: Array<{
    id: string
    userId: string
    timestamp: number
  }>
}

// OpenAI 相关接口
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function'
  content: string
  name?: string
}

export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  top_p?: number
  max_tokens?: number
  presence_penalty?: number
  frequency_penalty?: number
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: {
    index: number
    message: ChatMessage
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface UserContext {
  userId: string
  messages: ChatMessage[]
  lastTimestamp: number
}
