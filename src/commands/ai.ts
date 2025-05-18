
import { Context, h } from 'koishi'
import { DataService } from '../services/data.service'
import { AIService } from '../services/ai.service'
import { readData, saveData } from '../utils'

export function registerAICommands(ctx: Context, dataService: DataService, aiService: AIService) {

  ctx.command('ai', '与AI进行对话')
    .option('reset', '-r 重置对话上下文')
    .action(async ({ session, options }) => {

      if (!ctx.config.openai?.enabled) {
        return 'AI功能已被全局禁用'
      }

      if (!ctx.config.openai?.chatEnabled) {
        return 'AI对话功能已被禁用'
      }


      if (options.reset) {
        const reset = aiService.resetUserContext(session.userId)
        return reset ? '对话上下文已重置' : '没有找到对话上下文'
      }


      if (!session.content) {
        return '请输入您要问AI的内容，例如：ai 今天天气怎么样？'
      }

      try {

        await dataService.logCommand(session, 'ai', 'AI请求', session.content)


        const response = await aiService.processMessage(session.userId, session.content, session.guildId)
        return response
      } catch (error) {
        return `处理请求时出错: ${error.message}`
      }
    })


  ctx.command('translate <text:text>', '使用AI翻译文本')
    .alias('tsl')
    .option('prompt', '-p <prompt:text> 自定义翻译提示词')
    .action(async ({ session, options }, text) => {

      if (!ctx.config.openai?.enabled) {
        return 'AI功能已被全局禁用'
      }

      if (!ctx.config.openai?.translateEnabled) {
        return '翻译功能已被禁用'
      }


      if (!text) {

        if (session.quote && session.quote.content) {
          text = session.quote.content
        }


        if (!text) {
          return '请提供要翻译的文本，或回复需要翻译的消息。\n用法：tsl [文本] 或 回复消息后使用 tsl'
        }
      }

      try {

        await dataService.logCommand(session, 'translate', '翻译请求', text)


        const translatedText = await aiService.translateText(
          session.userId,
          text,
          session.guildId,
          options.prompt
        )


        if (session.guildId) {
          return h.quote(session.messageId) + translatedText
        }

        return translatedText
      } catch (error) {
        return `翻译时出错: ${error.message}`
      }
    })


  ctx.command('ai-config', '配置AI功能', { authority: 3 })
    .option('enabled', '-e <enabled:boolean> 是否在本群启用AI功能')
    .option('chat', '-c <enabled:boolean> 是否在本群启用AI对话功能')
    .option('translate', '-t <enabled:boolean> 是否在本群启用翻译功能')
    .option('prompt', '-p <prompt:text> 设置本群特定的系统提示词')
    .option('tprompt', '-tp <prompt:text> 设置本群特定的翻译提示词')
    .option('reset', '-r 重置为全局配置')
    .action(async ({ session, options }) => {
      if (!session.guildId) {
        return '此命令只能在群聊中使用'
      }

      const groupConfigs = readData(dataService.groupConfigPath)
      groupConfigs[session.guildId] = groupConfigs[session.guildId] || {}


      if (options.reset) {
        if (groupConfigs[session.guildId].openai) {
          delete groupConfigs[session.guildId].openai
          saveData(dataService.groupConfigPath, groupConfigs)
          return '已重置为全局AI配置'
        }
        return '本群未设置特定AI配置'
      }


      groupConfigs[session.guildId].openai = groupConfigs[session.guildId].openai || {}


      let hasChanges = false

      if (options.enabled !== undefined) {
        groupConfigs[session.guildId].openai.enabled = options.enabled
        hasChanges = true
      }

      if (options.chat !== undefined) {
        groupConfigs[session.guildId].openai.chatEnabled = options.chat
        hasChanges = true
      }

      if (options.translate !== undefined) {
        groupConfigs[session.guildId].openai.translateEnabled = options.translate
        hasChanges = true
      }

      if (options.prompt) {
        groupConfigs[session.guildId].openai.systemPrompt = options.prompt
        hasChanges = true
      }

      if (options.tprompt) {
        groupConfigs[session.guildId].openai.translatePrompt = options.tprompt
        hasChanges = true
      }

      if (hasChanges) {
        saveData(dataService.groupConfigPath, groupConfigs)
        return '群AI配置已更新'
      }


      const config = groupConfigs[session.guildId].openai || {}
      return [
        '当前群AI配置：',
        `AI总开关: ${config.enabled === undefined ? '跟随全局' : (config.enabled ? '启用' : '禁用')}`,
        `对话功能: ${config.chatEnabled === undefined ? '跟随全局' : (config.chatEnabled ? '启用' : '禁用')}`,
        `翻译功能: ${config.translateEnabled === undefined ? '跟随全局' : (config.translateEnabled ? '启用' : '禁用')}`,
        `系统提示词: ${config.systemPrompt || '跟随全局'}`,
        `翻译提示词: ${config.translatePrompt || '跟随全局'}`
      ].join('\n')
    })


  ctx.middleware(async (session, next) => {

    if (!session.elements?.some(el => el.type === 'at' && el.attrs?.id === session.selfId) ||
        session.content.startsWith('/')) {
      return next()
    }


    if (!ctx.config.openai?.enabled || !ctx.config.openai?.chatEnabled) {
      return next()
    }

    try {

      const content = session.content
        .replace(new RegExp(`<at id="${session.selfId}"/>`, 'g'), '')
        .replace(new RegExp(`@${session.selfId}`, 'g'), '')
        .trim()


      if (!content) {
        return next()
      }


      const response = await aiService.processMessage(session.userId, content, session.guildId)


      return `${h.quote(session.messageId)}${h.at(session.userId)} ${response}`
    } catch (error) {
      console.error('AI中间件处理失败:', error)
      return next()
    }
  })
}
