# koishi-plugin-grouphelper

[![npm](https://img.shields.io/npm/v/koishi-plugin-grouphelper?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-grouphelper)

> 🤖 强大的群管理插件，提供一系列实用的群管理功能

## 📝 命令列表

> 除特殊说明外，所有命令需要权限等级 3 或以上

### 🛠️ 基础命令
- `kick <@用户> [-b] [群号]` 踢出用户，`-b` 表示加入黑名单
- `ban <@用户> {时长} [群号]` 禁言用户，支持表达式
- `unban <@用户> [群号]` 解除用户禁言
- `stop <@用户>` 短期禁言用户
- `ban-all` 开启全体禁言
- `unban-all` 解除全体禁言
- `unban-allppl` 解除所有人禁言

### 👑 管理员设置
- `admin <@用户>` 设置管理员
- `unadmin <@用户>` 取消管理员

### ⚠️ 警告系统
- `warn <@用户> [次数]` 警告用户，默认1次

### 💬 消息管理
- `essence *引用消息*` 精华消息管理：
  - `-s` 设置精华消息
  - `-r` 取消精华消息
- `delmsg *引用消息*` 撤回指定消息
- `send <群号> [-s] *引用消息*` 向指定群发送消息，`-s` 表示不显示发送者信息

### 🎖️ 头衔管理
- `title` 群头衔管理：
  - `-s <文本>` 设置头衔
  - `-r` 移除头衔
  - `-u <@用户>` 为指定用户设置（可选）

### 📝 日志管理
- `listlog [数量]` 显示最近的操作记录，默认100条
- `clearlog` 清理日志文件：
  - `-d <天数>` 保留最近几天的日志，默认7天
  - `-a` 清理所有日志

### 🔑 关键词管理
- `verify` 入群验证关键词管理：
  - `-l` 列出本群验证关键词
  - `-a <关键词>` 添加验证关键词，多个关键词用英文逗号分隔
  - `-r <关键词>` 移除验证关键词，多个关键词用英文逗号分隔
  - `--clear` 清空所有验证关键词
  - `-n {true|false}` 设置是否自动拒绝未匹配关键词的入群申请
  - `-w <拒绝词>` 设置拒绝时的提示消息
- `forbidden` 禁言关键词管理：
  - `-l` 列出本群禁言关键词
  - `-a <关键词>` 添加禁言关键词，多个关键词用英文逗号分隔
  - `-r <关键词>` 移除禁言关键词，多个关键词用英文逗号分隔
  - `--clear` 清空所有禁言关键词
  - `-d {true|false}` 设置是否自动撤回包含关键词的消息
  - `-b {true|false}` 设置是否自动禁言包含关键词的消息的发送者
  - `-t <时长>` 设置自动禁言时长

### 👋 欢迎设置
- `welcome` 入群欢迎语管理：
  - `-s <消息>` 设置欢迎语
  - `-r` 移除欢迎语
  - `-t` 测试当前欢迎语
- 支持变量：
  - `{at}` @新成员
  - `{user}` 新成员QQ号
  - `{group}` 群号

### 🔁 防复读功能
- `antirepeat <复读阈值>` 设置防复读系统，值为0则关闭

### 📢 订阅系统
- `sub` 订阅管理：
  - `log` 订阅操作日志（踢人、禁言等操作记录）
  - `member` 订阅成员变动通知（进群、退群）
  - `mute` 订阅禁言到期通知
  - `blacklist` 订阅黑名单变更通知
  - `warning` 订阅警告通知
  - `all` 订阅所有通知
  - `none` 取消所有订阅
  - `status` 查看订阅状态

### ⚙️ 配置管理
- `config` 配置管理：
  - `-t` 显示所有配置和记录
  - `-b` 黑名单管理
    - `-a <QQ号>` 添加黑名单
    - `-r <QQ号>` 移除黑名单
  - `-w` 警告管理
    - `-a <QQ号> [次数]` 增加警告
    - `-r <QQ号> [次数]` 减少警告

### 🚨 举报功能
- `report *引用消息*` 举报违规消息（权限等级1）
  - `-v` 显示详细判断结果
- `report-config` 配置举报功能（权限等级3）：
  - `-e {true|false}` 是否启用举报功能
  - `-a {true|false}` 是否自动处理违规
  - `-c {true|false}` 是否包含群聊上下文
  - `-cs {数量}` 上下文消息数量（1-20）
  - `-g {群号}` 配置指定群聊
  - `-auth {等级}` 设置权限等级

### 🤖 AI功能
- `ai <内容>` 与AI进行对话
  - `-r` 重置对话上下文
- `translate <文本>` 翻译文本（简写：tsl）
  - `-p <提示词>` 自定义翻译提示词
- `ai-config` 配置AI功能（权限等级3）：
  - `-e {true|false}` 是否在本群启用AI功能
  - `-c {true|false}` 是否在本群启用对话功能
  - `-t {true|false}` 是否在本群启用翻译功能
  - `-p [提示词]` 设置本群对话系统提示词
  - `-tp [提示词]` 设置本群翻译提示词
  - `-r` 重置为全局配置
- 同时支持直接@机器人进行对话

### 🎲 娱乐功能
- `dice <面数> [个数]` 掷骰子，生成随机数
- `dice-config` 配置掷骰子功能
  - `-e {true|false}`  是否启用掷骰子功能
  - `-l <长度>`  设置掷骰子结果最大长度，默认1000字符
- `banme` 随机禁言自己
  - 普通抽卡：1秒~30分钟（每次使用递增上限）
  - 金卡概率：0.6%（73抽后概率提升，89抽保底）
  - UP奖励：24小时禁言
  - 歪奖励：12小时禁言（下次必中UP）
- `banme-config` 设置banme配置（权限等级3）：
  - `-e {true|false}` 启用/禁用功能
  - `--min <秒>` 最小禁言时间
  - `--max <分>` 最大禁言时间
  - `-r <数值>` 增长率
  - `-p <概率>` 金卡基础概率
  - `--sp <次数>` 软保底抽数
  - `--hp <次数>` 硬保底抽数
  - `--ut <时长>` UP奖励时长
  - `--lt <时长>` 歪奖励时长
  - `--ab {true|false}` 是否自动禁言使用特殊字符的用户
  - `--reset` 重置为全局配置
- `banme-similar` 输出形似字符映射表（权限等级3）
- `banme-record-a <标准串> *引用消息*` 逐字符添加形似字符映射（权限等级3）
- `banme-record-allas <标准串> *引用消息*` 添加字符串映射（权限等级3）
- `banme-normalize *引用消息*` 输出规范化文本（权限等级3）

### 🧩 其他功能
- `quit-group <群号>` 让bot退出指定群聊

### 🤝 贡献
- 如果你发现了任何问题或有新的功能建议，欢迎在 [GitHub Issues](https://github.com/camvanaa/koishi-plugin-grouphelper/issues) 提出
- 如果你想为这个项目做出贡献，欢迎提交 Pull Request

[![Contributors](https://contrib.rocks/image?repo=camvanaa/koishi-plugin-grouphelper)](https://github.com/camvanaa/koishi-plugin-grouphelper/graphs/contributors)
