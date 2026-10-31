import { onScopeDispose } from 'vue'

/**
 * 组件内的定时器登记处：组件卸载时自动清空，避免「切走游戏后计时器还在跑」。
 * 原来每个游戏都要手写 pending 数组 + destroy()，现在收口到这里。
 */
export function useTimers() {
  const timeouts = new Set<number>()
  const intervals = new Set<number>()

  function later(fn: () => void, ms: number): number {
    const id = window.setTimeout(() => {
      timeouts.delete(id)
      fn()
    }, ms)
    timeouts.add(id)
    return id
  }

  function every(fn: () => void, ms: number): number {
    const id = window.setInterval(fn, ms)
    intervals.add(id)
    return id
  }

  function cancel(id: number): void {
    if (timeouts.delete(id)) window.clearTimeout(id)
    if (intervals.delete(id)) window.clearInterval(id)
  }

  function clearAll(): void {
    timeouts.forEach((id) => window.clearTimeout(id))
    intervals.forEach((id) => window.clearInterval(id))
    timeouts.clear()
    intervals.clear()
  }

  onScopeDispose(clearAll)

  return { later, every, cancel, clearAll }
}
