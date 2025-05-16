// 工具函数模块
import * as fs from 'fs'
import * as path from 'path'

// 定义时间限制常量（毫秒）
export const MIN_DURATION = 1000 // 1秒
export const MAX_DURATION = 29 * 24 * 3600 * 1000 + 23 * 3600 * 1000 + 59 * 60 * 1000 + 59 * 1000 // 29天23小时59分59秒

/**
 * 读取数据文件
 * @param filePath 文件路径
 * @returns 解析后的JSON数据
 */
export function readData(filePath: string): any {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * 保存数据到文件
 * @param filePath 文件路径
 * @param data 要保存的数据
 */
export function saveData(filePath: string, data: any): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

/**
 * 解析用户ID
 * @param user 用户ID或用户对象
 * @returns 解析后的用户ID
 */
export function parseUserId(user: string | any): string {
  if (!user) return null

  // 如果是字符串（QQ号）
  if (typeof user === 'string') {
    // 移除可能存在的@符号和空格
    return user.replace(/^@/, '').trim()
  }

  // 如果是 user 对象（@用户）
  return String(user).split(':')[1]
}

/**
 * 解析表达式
 * @param expr 表达式字符串
 * @returns 计算结果
 */
export function evaluateExpression(expr: string): number {
  // 移除所有空格
  expr = expr.replace(/\s/g, '')

  // 安全检查：只允许数字、基本运算符、括号、sqrt和x
  if (!/^[\d+\-*/()^.esqrtx]+$/.test(expr)) {
    throw new Error(`表达式包含非法字符: ${expr}`)
  }

  // 替换 x 为 *
  expr = expr.replace(/x/g, '*')

  // 替换科学计数法
  expr = expr.replace(/(\d+)e(\d+)/g, (_, base, exp) =>
    String(Number(base) * Math.pow(10, Number(exp))))

  // 替换 sqrt
  while (expr.includes('sqrt')) {
    expr = expr.replace(/sqrt\(([^()]+)\)/g, (_, num) =>
      String(Math.sqrt(calculateBasic(num))))
  }

  return calculateBasic(expr)
}

/**
 * 基础计算函数
 * @param expr 表达式字符串
 * @returns 计算结果
 */
export function calculateBasic(expr: string): number {
  // 处理括号
  while (expr.includes('(')) {
    expr = expr.replace(/\(([^()]+)\)/g, (_, subExpr) =>
      String(calculateBasic(subExpr)))
  }

  // 处理乘方
  while (expr.includes('^')) {
    expr = expr.replace(/(-?\d+\.?\d*)\^(-?\d+\.?\d*)/, (_, base, exp) =>
      String(Math.pow(Number(base), Number(exp))))
  }

  // 处理乘除
  while (/[*/]/.test(expr)) {
    expr = expr.replace(/(-?\d+\.?\d*)[*/](-?\d+\.?\d*)/, (match, a, b) => {
      if (match.includes('*')) return String(Number(a) * Number(b))
      return String(Number(a) / Number(b))
    })
  }

  // 处理加减
  while (/[+\-]/.test(expr) && !/^-\d/.test(expr)) {
    expr = expr.replace(/(-?\d+\.?\d*)[+\-](-?\d+\.?\d*)/, (match, a, b) => {
      if (match.includes('+')) return String(Number(a) + Number(b))
      return String(Number(a) - Number(b))
    })
  }

  const result = Number(expr)
  if (isNaN(result)) {
    throw new Error(`计算结果无效: ${expr}`)
  }
  return result
}

/**
 * 解析时间字符串
 * @param timeStr 时间字符串，如 "10min", "1h30m", "2days6hours"
 * @returns 毫秒数
 */
export function parseTimeString(timeStr: string): number {
  try {
    if (!timeStr) {
      throw new Error('未提供时间')
    }

    // 检查是否是组合格式 (1h30m, 2d6h15m, etc.)
    // 匹配所有的 数字+单位 组合
    const combinedPattern = /(\d+\.?\d*)(d(?:ays?)?|h(?:ours?)?|m(?:ins?)?|s(?:econds?)?)/gi
    let combinedMatches = [...timeStr.matchAll(combinedPattern)]

    // 如果找到多个匹配，则按组合时间处理
    if (combinedMatches.length > 1) {
      let totalMilliseconds = 0

      for (const match of combinedMatches) {
        const value = parseFloat(match[1])
        const unitStr = match[2].toLowerCase()
        const unit = unitStr.charAt(0)

        // 累加各部分的时间
        switch (unit) {
          case 'd': // 天
            totalMilliseconds += value * 24 * 3600 * 1000
            break
          case 'h': // 小时
            totalMilliseconds += value * 3600 * 1000
            break
          case 'm': // 分钟
            totalMilliseconds += value * 60 * 1000
            break
          case 's': // 秒
            totalMilliseconds += value * 1000
            break
        }
      }

      // 限制时间范围
      if (totalMilliseconds < MIN_DURATION) {
        return MIN_DURATION
      }
      if (totalMilliseconds > MAX_DURATION) {
        return MAX_DURATION
      }

      return totalMilliseconds
    }

    // 如果不是组合格式，则按单一时间处理
    // 匹配数值表达式和单位
    // 支持更多格式: days/day/d, hours/hour/h, mins/min/m, seconds/second/s
    const match = timeStr.match(/^(.+?)(d(?:ays?)?|h(?:ours?)?|m(?:ins?)?|s(?:econds?)?)$/i)
    if (!match) {
      throw new Error(`时间格式错误：${timeStr}`)
    }

    const [, expr, unitStr] = match
    let value: number

    // 尝试直接解析数字（支持简单格式）
    const simpleNumber = parseFloat(expr)
    if (!isNaN(simpleNumber) && expr === simpleNumber.toString()) {
      value = simpleNumber
    } else {
      // 如果不是简单数字，则尝试解析表达式
      value = evaluateExpression(expr)
    }

    // 标准化单位
    const unit = unitStr.toLowerCase().charAt(0)

    // 转换为毫秒
    let milliseconds: number
    switch (unit) {
      case 'd': // 天
        milliseconds = value * 24 * 3600 * 1000
        break
      case 'h': // 小时
        milliseconds = value * 3600 * 1000
        break
      case 'm': // 分钟
        milliseconds = value * 60 * 1000
        break
      case 's': // 秒
        milliseconds = value * 1000
        break
      default:
        throw new Error('未知时间单位')
    }

    // 限制时间范围
    if (milliseconds < MIN_DURATION) {
      return MIN_DURATION
    }
    if (milliseconds > MAX_DURATION) {
      return MAX_DURATION
    }

    return milliseconds
  } catch (e) {
    throw new Error(`时间解析错误: ${e.message}`)
  }
}

/**
 * 格式化持续时间
 * @param milliseconds 毫秒数
 * @returns 格式化的时间字符串
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  const parts = []
  if (days > 0) parts.push(`${days}天`)
  if (hours % 24 > 0) parts.push(`${hours % 24}小时`)
  if (minutes % 60 > 0) parts.push(`${minutes % 60}分钟`)
  if (seconds % 60 > 0) parts.push(`${seconds % 60}秒`)

  return parts.join('')
}

/**
 * 睡眠函数
 * @param ms 毫秒数
 * @returns Promise
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
