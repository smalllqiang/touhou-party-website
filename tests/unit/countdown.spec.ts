import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useCountdown } from '@/composables/useCountdown'

let clockNow = 0
let scope: ReturnType<typeof effectScope>

beforeEach(() => {
  clockNow = 0
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
  vi.spyOn(performance, 'now').mockImplementation(() => clockNow)
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
  vi.useRealTimers()
})

function createCountdown() {
  const onExpire = vi.fn()
  const onLastSeconds = vi.fn()
  const cd = scope.run(() => useCountdown({ onExpire, onLastSeconds }))!
  return { cd, onExpire, onLastSeconds }
}

describe('useCountdown', () => {
  it('按真实时间差递减，而不是按 tick 次数累减', () => {
    const { cd } = createCountdown()
    cd.start(10)
    expect(cd.remaining.value).toBe(10)

    clockNow = 3_000
    vi.advanceTimersByTime(100)
    expect(cd.remaining.value).toBeCloseTo(7, 1)

    // 标签页被节流：一次 tick 跨过 4 秒，剩余时间仍然正确
    clockNow = 7_000
    vi.advanceTimersByTime(2_000)
    expect(cd.remaining.value).toBeCloseTo(3, 1)
  })

  it('暂停 / 继续时保留剩余时间', () => {
    const { cd } = createCountdown()
    cd.start(10)
    clockNow = 4_000
    vi.advanceTimersByTime(100)

    cd.pause()
    expect(cd.paused.value).toBe(true)
    clockNow = 8_000
    vi.advanceTimersByTime(2_000)
    expect(cd.remaining.value).toBeCloseTo(6, 1)

    cd.resume()
    clockNow = 10_000
    vi.advanceTimersByTime(100)
    expect(cd.remaining.value).toBeCloseTo(4, 1)
  })

  it('最后 5 秒每整秒回调一次，归零时只触发一次 onExpire', () => {
    const { cd, onExpire, onLastSeconds } = createCountdown()
    cd.start(10)

    clockNow = 6_000
    vi.advanceTimersByTime(100)
    expect(onLastSeconds).toHaveBeenCalledWith(4)

    clockNow = 10_000
    vi.advanceTimersByTime(100)
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(cd.remaining.value).toBe(0)
    expect(cd.running.value).toBe(false)

    clockNow = 12_000
    vi.advanceTimersByTime(1_000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })
})
