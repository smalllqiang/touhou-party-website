import { onScopeDispose, ref } from 'vue'
import { now } from '@/lib/utils'

interface CountdownOptions {
  /** 倒计时归零时调用（只调用一次）。 */
  onExpire: () => void
  /** 最后 5 秒内，每跨过一整秒调用一次（用来响提示音）。 */
  onLastSeconds?: (second: number) => void
}

/**
 * 基于「截止时间戳」的倒计时。
 * 不用「每 100ms 减 0.1 秒」的累减写法：标签页切到后台时浏览器会节流定时器，
 * 累减会让剩余时间和真实时间对不上。
 */
export function useCountdown(options: CountdownOptions) {
  const total = ref(0)
  const remaining = ref(0)
  const paused = ref(false)
  const running = ref(false)

  let deadline = 0
  let handle: number | null = null
  let lastTickSecond: number | null = null

  function stop(): void {
    if (handle !== null) {
      window.clearInterval(handle)
      handle = null
    }
    running.value = false
    paused.value = false
  }

  function tick(): void {
    if (!running.value || paused.value) return

    const left = Math.max(0, (deadline - now()) / 1000)
    remaining.value = left

    const whole = Math.ceil(left)
    if (whole > 0 && whole <= 5 && whole !== lastTickSecond) {
      lastTickSecond = whole
      options.onLastSeconds?.(whole)
    }

    if (left <= 0) {
      stop()
      options.onExpire()
    }
  }

  function start(seconds: number): void {
    stop()
    total.value = seconds
    remaining.value = seconds
    deadline = now() + seconds * 1000
    lastTickSecond = null
    running.value = true
    handle = window.setInterval(tick, 100)
  }

  function pause(): void {
    if (!running.value || paused.value) return
    remaining.value = Math.max(0, (deadline - now()) / 1000)
    paused.value = true
  }

  function resume(): void {
    if (!running.value || !paused.value) return
    paused.value = false
    deadline = now() + remaining.value * 1000
  }

  onScopeDispose(stop)

  return { total, remaining, paused, running, start, pause, resume, stop }
}
