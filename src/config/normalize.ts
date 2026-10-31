import {
  GAME_CONFIG,
  type DrawGuessConfigInput,
  type RawUndercoverTopic,
  type UndercoverConfigInput,
} from './index'

/* ============================================================
 *  配置兜底：把「用户手改过的配置」归一化成组件能直接用的形状。
 *  非法值一律回退，不抛错 —— 配置写错不应该让整个页面白屏。
 * ============================================================ */

export const DEFAULT_COLORS = [
  '#000000',
  '#7a7a7a',
  '#ffffff',
  '#e02020',
  '#ff8c1a',
  '#ffd400',
  '#37a745',
  '#1e88e5',
  '#8e44ad',
  '#8b5a2b',
]

export interface DrawGuessConfig {
  rounds: number
  timer: { a: number; b: number }
  autoNextOnTimeout: boolean
  players: { a: string; b: string }
  colors: string[]
  brush: { min: number; max: number; defaultSize: number }
  topics: string[]
}

function toSeconds(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function toInt(value: unknown, fallback: number): number {
  const n = Number.parseInt(String(value), 10)
  return Number.isFinite(n) ? n : fallback
}

export function normalizeDrawGuessConfig(input: DrawGuessConfigInput = {}): DrawGuessConfig {
  const timer = input.timer ?? {}
  const brush = input.brush ?? {}
  const min = Math.max(1, toInt(brush.min, 1))
  const max = Math.max(min, toInt(brush.max, 48))
  const defaultSize = Math.min(
    Math.max(toInt(brush.defaultSize, 6), min),
    max,
  )

  return {
    rounds: Math.max(1, toInt(input.rounds, 3)),
    timer: {
      a: toSeconds(timer.a, 60),
      b: toSeconds(timer.b, 30),
    },
    autoNextOnTimeout: input.autoNextOnTimeout !== false,
    players: {
      a: String(input.players?.a || '选手A'),
      b: String(input.players?.b || '选手B'),
    },
    colors: input.colors && input.colors.length ? input.colors.slice() : DEFAULT_COLORS,
    brush: { min, max, defaultSize },
    topics: input.topics && input.topics.length ? input.topics.slice() : ['猫'],
  }
}

export function getDrawGuessConfig(): DrawGuessConfig {
  return normalizeDrawGuessConfig(GAME_CONFIG.drawGuess)
}

/* ============================================================
 *  谁是卧底：把三种写法统一成 { text, image }
 * ============================================================ */

export interface UndercoverWord {
  text: string
  image: string
}

export interface UndercoverTopic {
  normal: UndercoverWord
  spy: UndercoverWord
}

function joinPath(dir: string, file: string): string {
  if (!file) return ''
  // 完整路径 / 外链 / dataURL 原样使用
  if (/^(https?:|data:|blob:|\/)/i.test(file)) return file
  // 自带目录的相对路径原样使用
  if (file.includes('/')) return file
  return String(dir || '').replace(/\/+$/, '/') + file
}

/** 一个「词」支持：'可乐' / ['可乐','cola.png'] / { text, image, ... }。没写图片时用「词 + 后缀」。 */
export function normalizeWord(
  value: unknown,
  explicitImage: unknown,
  dir: string,
  ext: string,
): UndercoverWord {
  let text = ''
  let image = typeof explicitImage === 'string' ? explicitImage : ''

  if (value == null) {
    return { text: '', image: '' }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    text = String(value)
  } else if (Array.isArray(value)) {
    text = value[0] == null ? '' : String(value[0])
    if (!image && value[1]) image = String(value[1])
  } else if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    text = String(v.text || v.word || v.name || v.label || '')
    if (!image) {
      const candidate = v.image || v.img || v.src || v.picture || ''
      image = typeof candidate === 'string' ? candidate : ''
    }
  }

  if (!image && text) image = text + ext
  return { text, image: joinPath(dir, image) }
}

/** 一组题支持 { normal, spy } / 自定义图片 / ['普通词','卧底词',图,图]。 */
export function normalizeTopics(
  list: RawUndercoverTopic[] | undefined,
  dir: string,
  ext: string,
): UndercoverTopic[] {
  if (!Array.isArray(list)) return []

  const out: UndercoverTopic[] = []
  for (const item of list) {
    if (!item) continue

    let normalValue: unknown
    let spyValue: unknown
    let normalImage: unknown = ''
    let spyImage: unknown = ''

    if (Array.isArray(item)) {
      normalValue = item[0]
      spyValue = item[1]
      normalImage = item[2] || ''
      spyImage = item[3] || ''
    } else if (typeof item === 'object') {
      const t = item as Record<string, unknown>
      normalValue = t.normal !== undefined
        ? t.normal
        : (t.civilian !== undefined ? t.civilian : t.normalWord)
      spyValue = t.spy !== undefined
        ? t.spy
        : (t.undercover !== undefined
          ? t.undercover
          : (t.different !== undefined ? t.different : t.spyWord))
      normalImage = t.normalImage || t.normalImg || t.civilianImage || ''
      spyImage = t.spyImage || t.spyImg || t.undercoverImage || ''
    } else {
      continue
    }

    const normal = normalizeWord(normalValue, normalImage, dir, ext)
    const spy = normalizeWord(spyValue, spyImage, dir, ext)
    if (normal.text && spy.text) out.push({ normal, spy })
  }
  return out
}

export interface UndercoverConfig {
  minPlayers: number
  maxPlayers: number
  players: number
  names: string[]
  imageDir: string
  imageExt: string
  topics: UndercoverTopic[]
}

export function normalizeUndercoverConfig(input: UndercoverConfigInput = {}): UndercoverConfig {
  const minPlayers = Math.max(3, toInt(input.minPlayers, 3))
  const maxPlayers = Math.max(minPlayers, toInt(input.maxPlayers, 12))
  const players = Math.max(minPlayers, Math.min(maxPlayers, toInt(input.players, 4)))

  const imageDir = typeof input.imageDir === 'string' && input.imageDir
    ? input.imageDir
    : 'images/undercover/'
  const imageExt = typeof input.imageExt === 'string' && input.imageExt
    ? input.imageExt
    : '.png'

  return {
    minPlayers,
    maxPlayers,
    players,
    names: Array.isArray(input.names) ? input.names.slice() : [],
    imageDir,
    imageExt,
    topics: normalizeTopics(input.topics, imageDir, imageExt),
  }
}

export function getUndercoverConfig(): UndercoverConfig {
  return normalizeUndercoverConfig(GAME_CONFIG.undercover)
}
