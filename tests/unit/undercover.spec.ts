import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useUndercover } from '@/games/undercover/useUndercover'

let wrappers: ReturnType<typeof mount>[] = []

function setupGame() {
  let game!: ReturnType<typeof useUndercover>
  const wrapper = mount(defineComponent({
    setup() {
      game = useUndercover()
      return () => h('div')
    },
  }))
  wrappers.push(wrapper)
  return game
}

afterEach(() => {
  wrappers.forEach((w) => w.unmount())
  wrappers = []
})

describe('useUndercover', () => {
  it('默认名字与人数增减', () => {
    const game = setupGame()
    expect(game.count.value).toBe(4)
    expect(game.names.value.slice(0, 4)).toEqual(['玩家1', '玩家2', '玩家3', '玩家4'])

    game.setCount(6)
    expect(game.count.value).toBe(6)
    expect(game.names.value[5]).toBe('玩家6')

    game.setCount(99)
    expect(game.count.value).toBe(12)
    game.setCount(1)
    expect(game.count.value).toBe(3)
  })

  it('抽题后发牌：恰好 1 名卧底，卡片序号 = 玩家顺序', () => {
    const game = setupGame()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    game.pickTopic(0)
    game.startReveal()

    expect(game.screen.value).toBe('reveal')
    expect(game.assignments.value).toHaveLength(4)
    expect(game.assignments.value.filter((a) => a.isSpy)).toHaveLength(1)

    const spy = game.assignments.value.find((a) => a.isSpy)!
    expect(spy.name).toBe('玩家3')
    expect(spy.word).toEqual(game.topic.value!.spy)
    expect(game.seen.value).toEqual([false, false, false, false])
  })

  it('按住查看会标记已查看，松开只清当前卡片', () => {
    const game = setupGame()
    game.pickTopic(0)
    game.startReveal()

    game.openPeek(1)
    expect(game.peekIndex.value).toBe(1)
    expect(game.seen.value[1]).toBe(true)

    game.closePeek(0)
    expect(game.peekIndex.value).toBe(1)

    game.closePeek(1)
    expect(game.peekIndex.value).toBe(-1)
  })

  it('一键翻开 / 扣上，并在返回设置时复位', () => {
    const game = setupGame()
    game.pickTopic(0)
    game.startReveal()

    game.flipAll()
    expect(game.allRevealed.value).toBe(true)
    expect(game.spy.value).not.toBeNull()

    game.flipAll()
    expect(game.allRevealed.value).toBe(false)

    game.flipAll()
    game.backToSetup()
    expect(game.screen.value).toBe('setup')
    expect(game.allRevealed.value).toBe(false)
    expect(game.peekIndex.value).toBe(-1)
  })

  it('改名字后重新发牌会使用新名字', () => {
    const game = setupGame()
    game.setName(0, '小明')
    vi.spyOn(Math, 'random').mockReturnValue(0)
    game.pickTopic(2)
    game.startReveal()
    expect(game.assignments.value[0].name).toBe('小明')

    game.redeal()
    expect(game.assignments.value[0].name).toBe('小明')
  })

  it('没有题目时抽题不会崩溃', () => {
    const game = setupGame()
    // 配置里题目固定存在，这里验证接口的防御性：未知下标不改变状态
    game.pickTopic(9999)
    expect(game.topic.value).toBeNull()
    expect(game.screen.value).toBe('setup')
  })
})
