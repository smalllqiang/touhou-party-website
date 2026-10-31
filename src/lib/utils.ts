/* ============================================================
 *  通用小工具（无状态纯函数 / 浏览器能力封装）
 * ============================================================ */

/** 秒 -> "01:30" */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m < 10 ? '0' : ''}${m}:${r < 10 ? '0' : ''}${r}`
}

/** 洗牌（不修改原数组） */
export function shuffle<T>(list: readonly T[]): T[] {
  const arr = list.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = arr[i]
    arr[i] = arr[j]
    arr[j] = t
  }
  return arr
}

/** 把文件名里不能用的字符替换掉 */
export function safeFileName(name: string | null | undefined): string {
  return String(name ?? '')
    .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'artwork'
}

/** 触发浏览器下载 */
export function download(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/* ---------- 提示音（WebAudio，无需音频文件） ---------- */
let audioCtx: AudioContext | null = null

export function beep(freq = 880, durationMs = 100, volume = 0.14): void {
  try {
    const AC = window.AudioContext
    if (!AC) return
    if (!audioCtx) audioCtx = new AC()
    if (audioCtx.state === 'suspended') void audioCtx.resume()

    const start = audioCtx.currentTime
    const dur = durationMs / 1000

    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start(start)
    osc.stop(start + dur + 0.03)
  } catch {
    /* 静音环境忽略 */
  }
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* ignore */
  }
}

/** 页面内计时统一用 performance.now()，避免系统时间被调整时倒计时跳变。 */
export function now(): number {
  return window.performance?.now?.() ?? Date.now()
}
