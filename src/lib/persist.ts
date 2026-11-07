/* ============================================================
 *  本地进度存储（localStorage）
 *  ------------------------------------------------------------
 *  只在浏览器里保存「本局」状态，用来支持刷新 / 切换游戏 / 意外关闭后
 *  继续未完成的一局。没有后端，也不保存历史战绩。
 *
 *  设计约束：
 *  - 所有读写都吞掉异常：隐私模式、存储被禁用、配额写满都不能让游戏崩。
 *  - 带版本号；版本不匹配的数据会被丢弃，避免旧结构把页面弄坏。
 *  - localStorage 不可用时退回模块内存，至少当前页面内还能用。
 * ============================================================ */

const PREFIX = 'touhou-party:v1:'

export const PERSIST_VERSION = 1

/** 各游戏使用的键（实际写入时会加 PREFIX）。 */
export const STORAGE_KEYS = {
  drawGuess: 'draw-guess:state',
  drawGuessBoard: 'draw-guess:board',
  undercover: 'undercover:state',
} as const

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function asInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

/* ---------- 底层读写 ---------- */
const memory = new Map<string, string>()
let local: Storage | null | undefined
const warned = new Set<string>()

function localStorageOrNull(): Storage | null {
  if (local !== undefined) return local
  try {
    if (typeof window === 'undefined') {
      local = null
      return null
    }
    const store = window.localStorage
    const probe = `${PREFIX}__probe__`
    store.setItem(probe, '1')
    store.removeItem(probe)
    local = store
  } catch {
    local = null
  }
  return local
}

function warnOnce(key: string, error: unknown): void {
  if (warned.has(key)) return
  warned.add(key)
  // 用 warn 而不是 error：功能降级但游戏还能玩，不应触发测试的 error 断言。
  console.warn(`[persist] 无法写入 ${PREFIX}${key}，进度只会留在当前页面。`, error)
}

function readRaw(key: string): string | null {
  const store = localStorageOrNull()
  if (store) {
    try {
      return store.getItem(PREFIX + key)
    } catch {
      return null
    }
  }
  return memory.get(PREFIX + key) ?? null
}

function writeRaw(key: string, value: string): boolean {
  const store = localStorageOrNull()
  if (store) {
    try {
      store.setItem(PREFIX + key, value)
      return true
    } catch (error) {
      warnOnce(key, error)
      return false
    }
  }
  memory.set(PREFIX + key, value)
  return true
}

/* ---------- 对外 API ---------- */
export function removeStored(key: string): void {
  const store = localStorageOrNull()
  if (store) {
    try {
      store.removeItem(PREFIX + key)
    } catch {
      /* ignore */
    }
  }
  memory.delete(PREFIX + key)
}

/**
 * 读取并校验一份进度。`parse` 返回 null 表示数据不可用（会被顺手删掉）。
 * 版本不符、JSON 损坏、浏览器不允许读，一律当作没有进度。
 */
export function readStored<T>(
  key: string,
  parse: (data: Record<string, unknown>) => T | null,
): T | null {
  const text = readRaw(key)
  if (!text) return null

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    removeStored(key)
    return null
  }

  if (!isRecord(data) || data.v !== PERSIST_VERSION) {
    removeStored(key)
    return null
  }

  const parsed = parse(data)
  if (parsed == null) removeStored(key)
  return parsed
}

/** 写入一份带版本号的进度；返回 false 表示没写进去（配额 / 被禁用）。 */
export function writeStored(key: string, data: object): boolean {
  let text: string
  try {
    text = JSON.stringify({ ...data, v: PERSIST_VERSION })
  } catch {
    return false
  }
  return writeRaw(key, text)
}

/** 清空本应用写入的所有进度（测试 / 开发调试用）。 */
export function clearAllStored(): void {
  const store = localStorageOrNull()
  if (store) {
    try {
      const keys: string[] = []
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i)
        if (key?.startsWith(PREFIX)) keys.push(key)
      }
      keys.forEach((key) => store.removeItem(key))
    } catch {
      /* ignore */
    }
  }
  memory.clear()
}
