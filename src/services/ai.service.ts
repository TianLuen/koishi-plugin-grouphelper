// AI 服务模块
import { Context, h } from 'koishi'
import * as path from 'path'
import * as fs from 'fs'
import { ChatMessage, ChatCompletionRequest, ChatCompletionResponse, UserContext } from '../types'

export class AIService {
  // 用户上下文缓存
  private userContexts: Map<string, UserContext> = new Map()
  private dataPath: string
  private contextsPath: string
  private contextTimeout: number = 30 * 60 * 1000 // 30分钟超时

  constructor(private ctx: Context, dataPath: string) {
    this.dataPath = dataPath
    this.contextsPath = path.join(this.dataPath, 'ai_contexts.json')

    // 初始化数据文件
    this.initDataFiles()

    // 定期清理过期上下文
    setInterval(() => this.cleanExpiredContexts(), 10 * 60 * 1000) // 每10分钟清理一次

    // 加载已有上下文
    this.loadContexts()
  }

  /**
   * 初始化数据文件
   */
  private initDataFiles() {
    if (!fs.existsSync(this.contextsPath)) {
      fs.writeFileSync(this.contextsPath, JSON.stringify({}), 'utf8')
    }
  }

  /**
   * 加载保存的上下文数据
   */
  private loadContexts() {
    try {
      const data = JSON.parse(fs.readFileSync(this.contextsPath, 'utf8'))
      for (const [userId, context] of Object.entries(data)) {
        this.userContexts.set(userId, context as UserContext)
      }
      console.log(`已加载 ${this.userContexts.size} 个AI对话上下文`)
    } catch (error) {
      console.error('加载AI上下文失败:', error)
      this.userContexts = new Map()
    }
  }

  /**
   * 保存上下文数据
   */
  private saveContexts() {
    try {
      const data = {}
      for (const [userId, context] of this.userContexts.entries()) {
        data[userId] = context
      }
      fs.writeFileSync(this.contextsPath, JSON.stringify(data, null, 2), 'utf8')
    } catch (error) {
      console.error('保存AI上下文失败:', error)
    }
  }

  /**
   * 清理过期的用户上下文
   */
  private cleanExpiredContexts() {
    const now = Date.now()
    let cleanCount = 0

    for (const [userId, context] of this.userContexts.entries()) {
      if (now - context.lastTimestamp > this.contextTimeout) {
        this.userContexts.delete(userId)
        cleanCount++
      }
    }

    if (cleanCount > 0) {
      console.log(`已清理 ${cleanCount} 个过期AI对话上下文`)
      this.saveContexts()
    }
  }

  /**
   * 获取用户上下文
   */
  private getUserContext(userId: string, systemPrompt: string): UserContext {
    if (!this.userContexts.has(userId)) {
      const newContext: UserContext = {
        userId,
        messages: [{
          role: 'system',
          content: systemPrompt
        }],
        lastTimestamp: Date.now()
      }
      this.userContexts.set(userId, newContext)
    }

    const context = this.userContexts.get(userId)

    // 检查system prompt是否需要更新
    if (context.messages[0].role === 'system' &&
        context.messages[0].content !== systemPrompt) {
      context.messages[0].content = systemPrompt
    }

    return context
  }

  /**
   * 向用户上下文添加消息
   */
  private addMessageToContext(
    userId: string,
    message: ChatMessage,
    systemPrompt: string,
    contextLimit: number
  ) {
    const context = this.getUserContext(userId, systemPrompt)
    context.messages.push(message)
    context.lastTimestamp = Date.now()

    // 裁剪超出上下文限制的消息
    if (context.messages.length > contextLimit + 1) { // +1 是因为要保留 system 消息
      // 保留 system 消息和最新的 contextLimit 条消息
      const systemMessage = context.messages[0]
      const recentMessages = context.messages.slice(-contextLimit)
      context.messages = [systemMessage, ...recentMessages]
    }

    this.saveContexts()
  }

  /**
   * 调用 OpenAI API 发送聊天完成请求
   */
  private async callOpenAI(
    messages: ChatMessage[],
    model: string,
    temperature: number,
    maxTokens: number,
    apiKey: string,
    apiUrl: string
  ): Promise<ChatCompletionResponse> {
    const endpoint = `${apiUrl.endsWith('/') ? apiUrl : apiUrl + '/'}chat/completions`

    const requestBody: ChatCompletionRequest = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    }

    try {
      const response = await this.ctx.http.post(endpoint, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      })

      return response as ChatCompletionResponse
    } catch (error) {
      console.error('OpenAI API 调用出错:', error)
      throw error
    }
  }

  /**
   * 重置用户的对话上下文
   */
  public resetUserContext(userId: string): boolean {
    const deleted = this.userContexts.delete(userId)
    if (deleted) {
      this.saveContexts()
    }
    return deleted
  }

  /**
   * 处理消息并获取 AI 回复
   */
  public async processMessage(
    userId: string,
    content: string,
    guildId?: string
  ): Promise<string> {
    // 获取配置
    const config = this.ctx.config.openai

    // 检查AI总开关和翻译功能开关
    if (!config.enabled) {
      return '抱歉，AI功能当前已禁用。'
    }

    if (!config.translateEnabled) {
      return '抱歉，翻译功能当前已禁用。'
    }

    try {
      // 准备系统提示词
      let systemPrompt = config.systemPrompt

      // 如果是群聊，检查群特定配置
      if (guildId) {
        const groupConfigs = JSON.parse(fs.readFileSync(
          path.join(this.dataPath, 'group_config.json'),
          'utf8'
        ))

        const groupConfig = groupConfigs[guildId]

        // 检查群级别AI总开关
        if (groupConfig?.openai?.enabled === false) {
          return '抱歉，当前群聊已禁用AI功能。'
        }

        // 检查群级别对话功能开关
        if (groupConfig?.openai?.chatEnabled === false) {
          return '抱歉，当前群聊已禁用AI对话功能。'
        }

        // 使用群特定的系统提示词（如果有）
        if (groupConfig?.openai?.systemPrompt) {
          systemPrompt = groupConfig.openai.systemPrompt
        }
      }

      // 添加用户消息到上下文
      this.addMessageToContext(
        userId,
        { role: 'user', content },
        systemPrompt,
        config.contextLimit || 10
      )

      // 获取用户上下文
      const context = this.getUserContext(userId, systemPrompt)

      // 调用 API
      const response = await this.callOpenAI(
        context.messages,
        config.model || 'gpt-3.5-turbo',
        config.temperature || 0.7,
        config.maxTokens || 2048,
        config.apiKey,
        config.apiUrl || 'https://api.openai.com/v1'
      )

      // 处理响应
      const assistantMessage = response.choices[0].message

      // 将回复添加到上下文
      this.addMessageToContext(
        userId,
        assistantMessage,
        systemPrompt,
        config.contextLimit || 10
      )

      return assistantMessage.content
    } catch (error) {
      console.error('AI处理消息失败:', error)
      return `处理消息时出错: ${error.message}`
    }
  }

  /**
   * 翻译文本
   * @param userId 用户ID
   * @param text 要翻译的文本
   * @param guildId 群组ID（可选）
   * @param customPrompt 自定义提示词（可选）
   * @returns 翻译结果
   */
  public async translateText(
    userId: string,
    text: string,
    guildId?: string,
    customPrompt?: string
  ): Promise<string> {
    // 获取配置
    const config = this.ctx.config.openai

    // 检查功能是否启用
    if (!config.enabled) {
      return '抱歉，AI翻译功能当前已禁用。'
    }

    try {
      // 准备翻译提示词
      let translatePrompt = config.translatePrompt || '你是一个翻译助手。请将用户的文本准确翻译，保持原文的风格和语气。如果是中文则翻译为英文，如果是其他语言则翻译为中文。不要添加任何解释或额外内容。'

      // 使用自定义提示词（如果提供了）
      if (customPrompt) {
        translatePrompt = customPrompt
      }
      // 如果是群聊，检查群特定配置
      else if (guildId) {
        const groupConfigs = JSON.parse(fs.readFileSync(
          path.join(this.dataPath, 'group_config.json'),
          'utf8'
        ))

        const groupConfig = groupConfigs[guildId]

        // 检查群级别AI总开关
        if (groupConfig?.openai?.enabled === false) {
          return '抱歉，当前群聊已禁用AI功能。'
        }

        // 检查群级别翻译功能开关
        if (groupConfig?.openai?.translateEnabled === false) {
          return '抱歉，当前群聊已禁用翻译功能。'
        }

        // 使用群特定的翻译提示词（如果有）
        if (groupConfig?.openai?.translatePrompt) {
          translatePrompt = groupConfig.openai.translatePrompt
        }
      }

      // 构建消息数组 - 翻译不保存上下文，每次都是独立的
      const messages: ChatMessage[] = [
        { role: 'system', content: translatePrompt },
        { role: 'user', content: text }
      ]

      // 调用 API
      const response = await this.callOpenAI(
        messages,
        config.model || 'gpt-3.5-turbo',
        config.temperature || 0.3, // 翻译使用较低的温度以保持准确性
        config.maxTokens || 2048,
        config.apiKey,
        config.apiUrl || 'https://api.openai.com/v1'
      )

      // 处理响应
      const assistantMessage = response.choices[0].message
      return assistantMessage.content

    } catch (error) {
      console.error('AI翻译失败:', error)
      return `翻译出错: ${error.message}`
    }
  }

  /**
   * 内容审核
   * @param prompt 完整的审核提示词
   * @returns AI审核结果
   */
  public async callModeration(prompt: string): Promise<string> {
    // 获取配置
    const config = this.ctx.config.openai

    // 检查功能是否启用
    if (!config.enabled) {
      throw new Error('AI功能当前已禁用')
    }

    try {
      // 构建消息数组 - 审核不保存上下文，每次都是独立的
      const messages: ChatMessage[] = [
        { role: 'user', content: prompt }
      ]

      // 调用 API
      const response = await this.callOpenAI(
        messages,
        config.model || 'gpt-3.5-turbo',
        0.3, // 审核使用较低的温度以提高确定性
        2048, // 足够的长度以返回完整的JSON
        config.apiKey,
        config.apiUrl || 'https://api.openai.com/v1'
      )

      // 处理响应
      const assistantMessage = response.choices[0].message
      return assistantMessage.content

    } catch (error) {
      console.error('AI内容审核失败:', error)
      throw new Error(`内容审核失败: ${error.message}`)
    }
  }

  /**
   * 释放资源
   */
  public dispose() {
    this.saveContexts()
  }
}
