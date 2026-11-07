import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useDrawGuess } from '@/games/draw-guess/useDrawGuess'
import type { DrawingBoardApi } from '@/lib/drawing-board'

let clockNow = 0

beforeEach(() => {
  clockNow = 0
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
  vi.spyOn(performance, 'now').mockImplementation(() => clockNow)
})

afterEach(() => {
  vi.useRealTimers()
})

function setupGame() {
  let game!: ReturnType<typeof useDrawGuess>
  const wrapper = mount(defineComponent({
    setup() {
      game = useDrawGuess()
      return () => h('div')
    },
  }))
  return { game, wrapper }
}

function fakeBoard(hasInk = true): DrawingBoardApi {
  return {
    toDataURL: () => `data:image/png;base64,${hasInk ? 'INK' : 'BLANK'}`,
    hasInk: () => hasInk,
    restoreImage: () => {},
    clear: () => {},
    undo: () => {},
    setColor: () => {},
    setSize: () => {},
    setTool: () => {},
  }
}

describe('useDrawGuess', () => {
  it('抽题后能开始，按 A → B → 下一轮推进并收集作品', () => {
    const { game, wrapper } = setupGame()

    game.pickTopic(0)
    expect(game.topic.value).toBe(game.config.topics[0])
    expect(game.activeTopicIndex.value).toBe(0)

    game.startGame()
    expect(game.screen.value).toBe('play')
    expect(game.phase.value).toBe('A')
    expect(game.round.value).toBe(1)

    game.setBoard(fakeBoard())
    clockNow = 1_000
    game.requestNextPhase()
    expect(game.phase.value).toBe('B')
    expect(game.artworks.value).toHaveLength(1)
    expect(game.artworks.value[0]).toMatchObject({ round: 1, phase: 'A', blank: false })

    game.setBoard(fakeBoard())
    clockNow = 2_000
    game.requestNextPhase()
    expect(game.phase.value).toBe('A')
    expect(game.round.value).toBe(2)
    expect(game.artworks.value).toHaveLength(2)

    game.setBoard(fakeBoard())
    clockNow = 3_000
    game.requestNextPhase()
    expect(game.phase.value).toBe('B')
    expect(game.artworks.value).toHaveLength(3)

    game.setBoard(fakeBoard())
    clockNow = 4_000
    game.requestNextPhase()
    expect(game.screen.value).toBe('result')
    expect(game.artworks.value).toHaveLength(4)

    wrapper.unmount()
  })

  it('空白画板需要确认，取消时留在当前阶段', () => {
    const { game, wrapper } = setupGame()
    game.pickTopic(1)
    game.startGame()
    game.setBoard(fakeBoard(false))

    clockNow = 1_000
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    game.requestNextPhase()
    expect(game.phase.value).toBe('A')
    expect(confirm).toHaveBeenCalled()

    confirm.mockReturnValue(true)
    game.requestNextPhase()
    expect(game.phase.value).toBe('B')
    expect(game.artworks.value[0].blank).toBe(true)

    wrapper.unmount()
  })

  it('时间到自动进入下一阶段，并锁住画板', () => {
    const { game, wrapper } = setupGame()
    game.pickTopic(0)
    game.startGame()

    clockNow = game.config.timer.a * 1000
    vi.advanceTimersByTime(100)
    expect(game.timeUpVisible.value).toBe(true)
    expect(game.locked.value).toBe(true)

    vi.advanceTimersByTime(1_600)
    expect(game.phase.value).toBe('B')
    expect(game.timeUpVisible.value).toBe(false)
    expect(game.locked.value).toBe(false)

    wrapper.unmount()
  })

  it('结束本局：有笔迹才捕获，空白不记录', () => {
    const { game, wrapper } = setupGame()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    game.pickTopic(0)
    game.startGame()
    game.setBoard(fakeBoard(true))
    clockNow = 1_000
    game.quitGame()
    expect(game.screen.value).toBe('result')
    expect(game.artworks.value).toHaveLength(1)
    expect(confirm).toHaveBeenCalled()

    game.again()
    game.pickTopic(0)
    game.startGame()
    game.setBoard(fakeBoard(false))
    clockNow = 2_000
    game.quitGame()
    expect(game.screen.value).toBe('result')
    expect(game.artworks.value).toHaveLength(0)

    wrapper.unmount()
  })

  it('「再玩一局」清空作品和题目，但保留选手名', () => {
    const { game, wrapper } = setupGame()
    game.players.value.A = '小明'
    game.players.value.B = '小红'
    game.pickTopic(0)
    game.startGame()
    game.setBoard(fakeBoard())
    clockNow = 1_000
    game.requestNextPhase()
    game.setBoard(fakeBoard())
    clockNow = 2_000
    game.requestNextPhase()
    game.setBoard(fakeBoard())
    clockNow = 3_000
    game.requestNextPhase()
    game.setBoard(fakeBoard())
    clockNow = 4_000
    game.requestNextPhase()
    expect(game.screen.value).toBe('result')

    game.again()
    expect(game.screen.value).toBe('setup')
    expect(game.topic.value).toBeNull()
    expect(game.artworks.value).toEqual([])
    expect(game.players.value).toEqual({ A: '小明', B: '小红' })

    wrapper.unmount()
  })

  it('刷新恢复：进行中的阶段、选手名与画板快照都能接上', () => {
    const first = setupGame()
    first.game.pickTopic(1)
    first.game.players.value.A = '小明'
    first.game.startGame()
    expect(first.game.screen.value).toBe('play')

    first.game.setBoard(fakeBoard(true))
    first.game.onBoardChange({ image: 'data:image/png;base64,INK', inked: true })
    first.wrapper.unmount()

    const second = setupGame()
    expect(second.game.screen.value).toBe('play')
    expect(second.game.phase.value).toBe('A')
    expect(second.game.topic.value).toBe(first.game.topic.value)
    expect(second.game.players.value.A).toBe('小明')

    const restore = vi.fn()
    second.game.setBoard({ ...fakeBoard(true), restoreImage: restore })
    expect(restore).toHaveBeenCalledWith('data:image/png;base64,INK', true)
    expect(second.game.artworks.value).toEqual([])

    second.wrapper.unmount()
  })

  it('刷新恢复：已推进的阶段和作品还在', () => {
    const first = setupGame()
    first.game.pickTopic(0)
    first.game.startGame()
    first.game.setBoard(fakeBoard())
    clockNow = 1_000
    first.game.requestNextPhase()
    expect(first.game.phase.value).toBe('B')
    expect(first.game.artworks.value).toHaveLength(1)
    first.wrapper.unmount()

    const second = setupGame()
    expect(second.game.screen.value).toBe('play')
    expect(second.game.phase.value).toBe('B')
    expect(second.game.round.value).toBe(1)
    expect(second.game.artworks.value).toHaveLength(1)
    expect(second.game.artworks.value[0].image).toContain('data:image/png')

    second.wrapper.unmount()
  })

  it('刷新恢复：暂停中的倒计时保持暂停与剩余时间', () => {
    const first = setupGame()
    first.game.pickTopic(0)
    first.game.startGame()

    clockNow = 10_000
    vi.advanceTimersByTime(100)
    first.game.togglePause()
    const frozen = first.game.remaining.value
    expect(first.game.paused.value).toBe(true)
    first.wrapper.unmount()

    const second = setupGame()
    expect(second.game.paused.value).toBe(true)
    expect(second.game.remaining.value).toBeCloseTo(frozen, 1)

    second.wrapper.unmount()
  })
})
