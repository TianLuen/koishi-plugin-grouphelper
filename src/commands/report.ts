// 举报命令模块
import { Context } from 'koishi'
import { DataService } from '../services/data.service'
import { AIService } from '../services/ai.service'
import { executeCommand } from '../utils'

// 违规级别和处理方式
export enum ViolationLevel {
  NONE = 0,       // 未违规
  LOW = 1,        // 轻微违规 - 警告
  MEDIUM = 2,     // 中度违规 - 禁言
  HIGH = 3,       // 严重违规 - 踢出
  CRITICAL = 4,   // 极其严重违规 - 踢出并加入黑名单
}

// 违规信息
interface ViolationInfo {
  level: ViolationLevel;
  reason: string;
  action: string;
  duration?: string; // 禁言时间（如果适用）
}

// 举报限制记录
interface ReportBanRecord {
  userId: string;      // 用户ID
  guildId: string;     // 群组ID
  timestamp: number;   // 添加时间戳
  expireTime: number;  // 过期时间戳
}

// 群聊消息记录，用于上下文
interface MessageRecord {
  userId: string;      // 发送者ID
  content: string;     // 消息内容
  timestamp: number;   // 时间戳
}

export function registerReportCommands(ctx: Context, dataService: DataService, aiService: AIService) {
  // 存储举报限制记录
  const reportBans: Record<string, ReportBanRecord> = {};

  // 存储各群聊近期消息记录（用于上下文）
  const guildMessages: Record<string, MessageRecord[]> = {};

  // 获取举报冷却时间（配置中的分钟换算为毫秒）
  const getReportCooldownDuration = () => {
    return (ctx.config.report.maxReportCooldown || 60) * 60 * 1000;
  };

  // 获取最低不受限制的权限等级
  const getMinUnlimitedAuthority = () => {
    return ctx.config.report.minAuthorityNoLimit || 2;
  };

  // 配置默认的违规判断提示词
  const defaultReportPrompt = `你是一个群组内容安全审查助手。你的任务是判断用户发送的消息是否违规，并根据违规程度进行分类。请分析以下消息内容：

{content}

根据内容，请严格按照以下JSON格式返回你的判断结果：
{
  "level": 数字（0: 未违规，1: 轻微违规，2: 中度违规，3: 严重违规，4: 极其严重违规）,
  "reason": "判断理由，说明为什么内容违规或不违规",
  "action": "建议采取的措施，如警告、禁言（请附上建议的时长，如10m、1h）、踢出群聊、踢出并加入黑名单等"
}

注意：
- 轻微违规(1)：侮辱、引战行为、刷屏等，建议简单禁言处理
- 中度违规(2)：辱骂、歧视言论，低俗内容，广告内容等，建议叠加警告处分处理
- 严重违规(3)：严重人身攻击、政治敏感内容、挑拨群内矛盾等，建议踢出处理
- 极其严重违规(4)：违法内容、散布恶意软件链接、极端言论等，建议踢出并拉黑处理

请客观公正地评估内容，不要过度解读，尽量宽松。要分清调侃，开玩笑和人身攻击的区别。只返回JSON格式的结果，不要有任何其他文字。
尽可能宽松处理，不要过于严格！最终将你思考的level降一级！`

  // 带上下文的评审提示词
  const contextReportPrompt = `你是一个群组内容安全审查助手。你的任务是判断用户发送的消息是否违规，并根据违规程度进行分类。

请先查看以下群聊的上下文消息：
{context}

现在，请分析以下被举报的消息内容：
{content}

根据内容及其上下文，请严格按照以下JSON格式返回你的判断结果：
{
  "level": 数字（0: 未违规，1: 轻微违规，2: 中度违规，3: 严重违规，4: 极其严重违规）,
  "reason": "判断理由，说明为什么内容违规或不违规，可参考上下文",
  "action": "建议采取的措施，如警告、禁言（请附上建议的时长，如10m、1h）、踢出群聊、踢出并加入黑名单等"
}

注意：
- 轻微违规(1)：侮辱、引战行为、刷屏等，建议简单禁言处理
- 中度违规(2)：辱骂、歧视言论，低俗内容，广告内容等，建议叠加警告处分处理
- 严重违规(3)：严重人身攻击、政治敏感内容、挑拨群内矛盾等，建议踢出处理
- 极其严重违规(4)：违法内容、散布恶意软件链接、极端言论等，建议踢出并拉黑处理

请客观公正地评估内容，不要过度解读，尽量宽松。要分清调侃，开玩笑和人身攻击的区别。只返回JSON格式的结果，不要有任何其他文字。
上下文可能会影响您的判断，比如玩笑话、游戏互动或反讽。请充分考虑上下文后做出判断。
尽可能宽松处理，不要过于严格！最终将你思考的level降一级！`

  // 监听并记录群消息
  ctx.on('message', (session) => {
    if (!session.guildId || !session.content) return;

    // 获取群配置
    const guildConfig = getGuildConfig(session.guildId);

    // 如果该群启用了上下文，记录消息
    if (guildConfig?.includeContext) {
      const guildId = session.guildId;

      // 初始化群消息数组
      if (!guildMessages[guildId]) {
        guildMessages[guildId] = [];
      }

      // 添加新消息
      guildMessages[guildId].push({
        userId: session.userId,
        content: session.content,
        timestamp: Date.now()
      });

      // 限制记录数量，只保留最近的n条
      const contextSize = guildConfig.contextSize || 5;
      if (guildMessages[guildId].length > contextSize * 2) { // 保留两倍容量，避免频繁裁剪
        guildMessages[guildId] = guildMessages[guildId].slice(-contextSize * 2);
      }
    }
  });

  // 获取指定群的配置
  function getGuildConfig(guildId: string) {
    const globalConfig = ctx.config.report;
    if (!globalConfig.guildConfigs || !globalConfig.guildConfigs[guildId]) {
      return null;
    }
    return globalConfig.guildConfigs[guildId];
  }

  // 添加举报命令
  ctx.command('report', '举报违规消息', { authority: ctx.config.report.authority || 1 })
    .option('verbose', '-v 显示详细判断结果')
    .action(async ({ session, options }) => {
      // 检查全局举报功能是否启用
      if (!ctx.config.report?.enabled) {
        return '举报功能已被禁用'
      }

      if (!session.guildId) {
        return '此命令只能在群聊中使用。'
      }

      // 获取群配置
      const guildConfig = getGuildConfig(session.guildId);

      // 检查群举报功能是否启用
      if (guildConfig && !guildConfig.enabled) {
        return '本群的举报功能已被禁用'
      }

      // 获取用户权限等级
      let userAuthority = 1;
      try {
        const user = await ctx.database.getUser(session.platform, session.userId);
        userAuthority = user?.authority || 1;
      } catch (e) {
        console.error('获取用户权限失败:', e);
      }

      // 最低不受限制的权限等级
      const minUnlimitedAuthority = getMinUnlimitedAuthority();

      // 检查用户是否被举报禁用（仅针对低权限用户）
      if (userAuthority < minUnlimitedAuthority) {
        const banKey = `${session.userId}:${session.guildId}`;
        const banRecord = reportBans[banKey];

        if (banRecord && Date.now() < banRecord.expireTime) {
          // 计算剩余时间（分钟）
          const remainingMinutes = Math.ceil((banRecord.expireTime - Date.now()) / (60 * 1000));
          return `您由于举报不当已被暂时限制使用举报功能，请在${remainingMinutes}分钟后再试。`;
        }
      }

      // 检查是否回复了消息
      if (!session.quote) {
        return '请回复需要举报的消息。例如：回复某消息 > /report'
      }

      try {
        // 获取被举报消息ID
        const quoteId = typeof session.quote === 'string' ? session.quote : session.quote.id

        // 获取被举报消息
        const reportedMessage = await session.bot.getMessage(session.guildId, quoteId)

        if (!reportedMessage || !reportedMessage.content) {
          return '无法获取被举报的消息内容。'
        }

        // 获取要被举报的用户ID
        // 适配不同的消息格式
        let reportedUserId: string
        if (reportedMessage.user && typeof reportedMessage.user === 'object') {
          reportedUserId = reportedMessage.user.id
        } else if (typeof reportedMessage['userId'] === 'string') {
          // 尝试访问可能存在的 userId 属性
          reportedUserId = reportedMessage['userId']
        } else {
          // 尝试其他可能的方式获取用户ID
          const sender = reportedMessage['sender'] || reportedMessage['from']
          if (sender && typeof sender === 'object' && sender.id) {
            reportedUserId = sender.id
          } else {
            return '无法确定被举报消息的发送者。'
          }
        }

        if (!reportedUserId) {
          return '无法确定被举报消息的发送者。'
        }

        // 不能举报自己
        if (reportedUserId === session.userId) {
          return '不能举报自己的消息喵~'
        }

        // 不能举报机器人
        if (reportedUserId === session.selfId) {
          return '喵？不能举报本喵的消息啦~'
        }

        // 记录举报日志
        await dataService.logCommand(
          session,
          'report',
          reportedUserId,
          `举报内容: ${reportedMessage.content}`
        )

        // 准备审核提示词和内容
        let promptWithContent = '';

        // 判断是否需要包含上下文
        if (guildConfig?.includeContext) {
          // 获取该群最近的消息记录作为上下文
          const contextMessages = guildMessages[session.guildId] || [];
          const contextSize = guildConfig.contextSize || 5;

          // 按时间从早到晚排序并取最近的n条
          const sortedMessages = [...contextMessages]
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-contextSize);

          // 格式化上下文信息
          const formattedContext = sortedMessages
            .map((msg, index) => `消息${index + 1} [用户${msg.userId}]: ${msg.content}`)
            .join('\n');

          // 使用带上下文的提示词
          promptWithContent = contextReportPrompt
            .replace('{context}', formattedContext)
            .replace('{content}', reportedMessage.content);
        } else {
          // 使用标准提示词
          promptWithContent = defaultReportPrompt.replace('{content}', reportedMessage.content);
        }

        // 获取AI判断
        const response = await aiService.callModeration(promptWithContent)

        // 解析响应
        let violationInfo: ViolationInfo
        try {
          // 尝试直接解析JSON
          if (response.startsWith('{') && response.endsWith('}')) {
            violationInfo = JSON.parse(response)
          } else {
            // 尝试从文本中提取JSON
            const jsonMatch = response.match(/\{[\s\S]*\}/g)
            if (jsonMatch && jsonMatch.length > 0) {
              violationInfo = JSON.parse(jsonMatch[0])
            } else {
              throw new Error('无法解析AI响应中的JSON')
            }
          }

          // 验证响应格式
          if (violationInfo.level === undefined ||
              violationInfo.reason === undefined ||
              violationInfo.action === undefined) {
            throw new Error('AI响应格式不正确')
          }
        } catch (e) {
          console.error('解析AI响应失败:', e, response)

          // 添加举报失败限制（低权限用户）
          if (userAuthority < minUnlimitedAuthority) {
            const banKey = `${session.userId}:${session.guildId}`;
            reportBans[banKey] = {
              userId: session.userId,
              guildId: session.guildId,
              timestamp: Date.now(),
              expireTime: Date.now() + getReportCooldownDuration()
            };

            // 记录举报失败和限制
            await dataService.logCommand(
              session,
              'report-banned',
              session.userId,
              '举报处理失败，已限制使用'
            );
          }

          return '举报处理失败：AI判断结果格式有误，请重试或联系管理员手动处理。'
        }

        // 根据判断结果处理
        const result = await handleViolation(
          ctx,
          session,
          reportedUserId,
          violationInfo,
          reportedMessage.content,
          options.verbose,
          guildConfig
        )

        // 如果未判定为违规，对低权限用户添加举报限制
        if (violationInfo.level === ViolationLevel.NONE && userAuthority < minUnlimitedAuthority) {
          const banKey = `${session.userId}:${session.guildId}`;
          reportBans[banKey] = {
            userId: session.userId,
            guildId: session.guildId,
            timestamp: Date.now(),
            expireTime: Date.now() + getReportCooldownDuration()
          };

          // 记录举报失败和限制
          await dataService.logCommand(
            session,
            'report-banned',
            session.userId,
            '举报内容未违规，已限制使用'
          );

          // 添加警告信息到结果
          const cooldownMinutes = ctx.config.report.maxReportCooldown || 60;
          return result + `\n您因举报内容未被判定为违规，已被暂时限制举报功能${cooldownMinutes}分钟。`;
        }

        return result
      } catch (e) {
        console.error('举报处理失败:', e)

        // 添加举报失败限制（低权限用户）
        if (userAuthority < minUnlimitedAuthority) {
          const banKey = `${session.userId}:${session.guildId}`;
          reportBans[banKey] = {
            userId: session.userId,
            guildId: session.guildId,
            timestamp: Date.now(),
            expireTime: Date.now() + getReportCooldownDuration()
          };

          // 记录举报失败和限制
          await dataService.logCommand(
            session,
            'report-banned',
            session.userId,
            `举报处理失败(${e.message})，已限制使用`
          );
        }

        return `举报处理失败：${e.message}`
      }
    })

  // 添加举报功能设置命令
  ctx.command('report-config', '配置举报功能', { authority: 3 })
    .option('enabled', '-e <enabled:boolean> 是否启用举报功能')
    .option('auto', '-a <auto:boolean> 是否自动处理违规')
    .option('authority', '-auth <auth:number> 设置举报功能权限等级')
    .option('context', '-c <context:boolean> 是否包含群聊上下文')
    .option('context-size', '-cs <size:number> 上下文消息数量')
    .option('guild', '-g <guildId:string> 配置指定群聊')
    .action(async ({ session, options }) => {
      const guildId = options.guild || session.guildId;

      if (!guildId) {
        return '请在群聊中使用此命令或使用 -g 参数指定群号';
      }

      const isGuildSpecific = !!options.guild || !!session.guildId;

      // 修改配置
      let hasChanges = false;
      let configMsg = [];

      if (isGuildSpecific) {
        // 修改群特定配置
        configMsg.push(`群 ${guildId} 的举报功能配置：`);

        // 初始化群配置
        if (!ctx.config.report.guildConfigs) {
          ctx.config.report.guildConfigs = {};
        }

        if (!ctx.config.report.guildConfigs[guildId]) {
          ctx.config.report.guildConfigs[guildId] = {
            enabled: true,
            includeContext: false,
            contextSize: 5,
            autoProcess: true
          };
        }

        const guildConfig = ctx.config.report.guildConfigs[guildId];

        if (options.enabled !== undefined) {
          guildConfig.enabled = options.enabled;
          hasChanges = true;
        }

        if (options.auto !== undefined) {
          guildConfig.autoProcess = options.auto;
          hasChanges = true;
        }

        if (options.context !== undefined) {
          guildConfig.includeContext = options.context;
          hasChanges = true;
        }

        if (options['context-size'] !== undefined) {
          const size = options['context-size'];
          if (size < 1 || size > 20) {
            return '上下文消息数量必须在1-20之间';
          }
          guildConfig.contextSize = size;
          hasChanges = true;
        }

        configMsg.push(`状态: ${guildConfig.enabled ? '已启用' : '已禁用'}`);
        configMsg.push(`自动处理: ${guildConfig.autoProcess ? '已启用' : '已禁用'}`);
        configMsg.push(`包含上下文: ${guildConfig.includeContext ? '已启用' : '已禁用'}`);
        configMsg.push(`上下文消息数量: ${guildConfig.contextSize || 5}`);
      } else {
        // 修改全局配置
        configMsg.push('全局举报功能配置：');

        if (options.enabled !== undefined) {
          ctx.config.report.enabled = options.enabled;
          hasChanges = true;
        }

        if (options.auto !== undefined) {
          ctx.config.report.autoProcess = options.auto;
          hasChanges = true;
        }

        if (options.authority !== undefined && !isNaN(options.authority)) {
          ctx.config.report.authority = options.authority;
          hasChanges = true;
        }

        configMsg.push(`全局状态: ${ctx.config.report.enabled ? '已启用' : '已禁用'}`);
        configMsg.push(`全局自动处理: ${ctx.config.report.autoProcess ? '已启用' : '已禁用'}`);
        configMsg.push(`权限等级: ${ctx.config.report.authority}`);
      }

      if (hasChanges) {
        await dataService.logCommand(
          session,
          'report-config',
          isGuildSpecific ? guildId : 'global',
          '已更新举报功能配置'
        );
        return `举报功能配置已更新\n${configMsg.join('\n')}`;
      }

      return configMsg.join('\n');
    })

  /**
   * 处理违规内容
   */
  async function handleViolation(
    ctx: Context,
    session: any,
    userId: string,
    violation: ViolationInfo,
    content: string,
    verbose = false,
    guildConfig = null
  ): Promise<string> {
    // 未违规
    if (violation.level === ViolationLevel.NONE) {
      return verbose
        ? `AI判断结果：该消息未违规\n理由：${violation.reason}`
        : '该消息未被判定为违规内容。'
    }

    let result = ''
    const bot = session.bot
    const guildId = session.guildId

    try {
      // 检查是否启用自动处理功能
      const shouldAutoProcess = guildConfig
        ? guildConfig.autoProcess
        : ctx.config.report?.autoProcess;

      if (!shouldAutoProcess) {
        result = verbose
          ? `AI判断结果：${getViolationLevelText(violation.level)}违规\n理由：${violation.reason}\n操作：自动处理功能已禁用，请管理员手动处理`
          : `该消息被判定为${getViolationLevelText(violation.level)}违规，请管理员手动处理。`

        // 记录违规但不执行操作
        await dataService.logCommand(
          session,
          'report-no-action',
          userId,
          `${getViolationLevelText(violation.level)}违规，管理员待处理`
        )
        return result;
      }

      // 根据违规等级处理
      switch(violation.level) {
        case ViolationLevel.LOW: // 轻微违规 - 禁言
          // 解析时长
          let duration = '10m' // 默认10分钟
          const durationMatch = violation.action.match(/(\d+[smhd])/i)
          if (durationMatch) {
            duration = durationMatch[1]
          }

          // 执行禁言
          await banUser(ctx, session, userId, duration)
          result = verbose
            ? `AI判断结果：轻微违规\n理由：${violation.reason}\n操作：已禁言该用户 ${duration}`
            : `已禁言用户 ${userId} ${duration}，轻微违规。`
          break

        case ViolationLevel.MEDIUM: // 警告和禁言
          // 获取可能的时长
          let mediumDuration = '30m'  // 默认中度违规禁言时长
          const mediumDurationMatch = violation.action.match(/(\d+[smhd])/i)
          if (mediumDurationMatch) {
            mediumDuration = mediumDurationMatch[1]
          }

          // 执行警告
          await warnUser(ctx, session, userId)
          result = verbose
            ? `AI判断结果：中度违规\n理由：${violation.reason}\n操作：已警告该用户`
            : `已警告用户 ${userId}，中度违规。`
          break

        case ViolationLevel.HIGH: // 踢出
          // 执行踢出
          await kickUser(ctx, session, userId, false)
          result = verbose
            ? `AI判断结果：严重违规\n理由：${violation.reason}\n操作：已将该用户踢出群聊`
            : `已将用户 ${userId} 踢出群聊，严重违规。`
          break

        case ViolationLevel.CRITICAL: // 踢出并拉黑
          // 执行踢出并拉黑
          await kickUser(ctx, session, userId, true)
          result = verbose
            ? `AI判断结果：极其严重违规\n理由：${violation.reason}\n操作：已将该用户踢出群聊并加入黑名单`
            : `已将用户 ${userId} 踢出群聊并加入黑名单，极其严重违规。`
          break

        default:
          result = '判断结果无法处理，请联系管理员手动处理。'
      }

      // 记录举报处理日志
      try {
        // 截断内容，防止消息过长
        const shortContent = content.length > 30 ? content.substring(0, 30) + '...' : content

        // 使用正确的logCommand参数格式：session, command, target, result
        const result = `${getViolationLevelText(violation.level)}违规，处理: ${violation.action}`
        await dataService.logCommand(session, 'report-handle', userId, result)

        // 同时推送消息通知
        const message = `[举报] 用户 ${userId} - ${getViolationLevelText(violation.level)}违规\n处理: ${violation.action}`
        await dataService.pushMessage(bot, message, 'warning')
      } catch (e) {
        console.error('记录举报处理日志失败:', e)
        // 通知失败不影响主流程
      }

      return result
    } catch (e) {
      console.error('执行违规处理失败:', e)

      // 记录举报处理错误日志
      try {
        // 使用正确的logCommand参数格式
        const errorResult = `${getViolationLevelText(violation.level)}违规处理失败: ${e.message.substring(0, 50)}`
        await dataService.logCommand(session, 'report-error', userId, errorResult)

        // 同时推送错误通知
        const errorMessage = `[举报失败] 用户 ${userId} - ${getViolationLevelText(violation.level)}违规\n错误: ${e.message.substring(0, 50)}`
        await dataService.pushMessage(bot, errorMessage, 'warning')
      } catch (err) {
        console.error('记录举报错误日志失败:', err)
        // 通知失败不影响主流程
      }

      return `AI已判定该消息${getViolationLevelText(violation.level)}违规，但自动处理失败：${e.message}\n请联系管理员手动处理。`
    }
  }

  /**
   * 获取违规等级文本描述
   */
  function getViolationLevelText(level: ViolationLevel): string {
    switch(level) {
      case ViolationLevel.NONE: return '未'
      case ViolationLevel.LOW: return '轻微'
      case ViolationLevel.MEDIUM: return '中度'
      case ViolationLevel.HIGH: return '严重'
      case ViolationLevel.CRITICAL: return '极其严重'
      default: return '未知'
    }
  }

  /**
   * 警告用户
   */
  async function warnUser(ctx: Context, session: any, userId: string): Promise<void> {
    try {
      // 创建一个user类型的参数，格式为 "platform:id"
      const user = `${session.platform}:${userId}`
      // 使用commander直接执行warn命令
      await executeCommand(ctx, session, 'warn', [user, '1'], {})
    } catch (e) {
      console.error(`警告用户失败: ${e.message}`)
      throw e
    }
  }

  /**
   * 禁言用户
   */
  async function banUser(ctx: Context, session: any, userId: string, duration: string): Promise<void> {
    // 直接使用纯数字用户ID，不添加平台前缀
    // 构造ban命令输入字符串
    const banInput = `${userId} ${duration}`
    // 使用commander直接执行ban命令
    await executeCommand(ctx, session, 'ban', [banInput], {})
  }

  /**
   * 踢出用户
   */
  async function kickUser(ctx: Context, session: any, userId: string, addToBlacklist: boolean): Promise<void> {
    // 直接使用纯数字用户ID，不添加平台前缀
    // 构造kick命令输入字符串 - 如果需要加入黑名单，添加-b选项
    const kickInput = addToBlacklist ? `${userId} -b` : userId
    // 使用commander直接执行kick命令
    await executeCommand(ctx, session, 'kick', [kickInput], {})
  }

  // 清除过期的举报限制的定时任务
  ctx.setInterval(() => {
    const now = Date.now();
    for (const key in reportBans) {
      if (reportBans[key].expireTime <= now) {
        delete reportBans[key];
      }
    }
  }, 10 * 60 * 1000); // 每10分钟执行一次清理
}
