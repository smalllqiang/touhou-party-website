import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COLORS,
  normalizeDrawGuessConfig,
  normalizeTopics,
  normalizeUndercoverConfig,
  normalizeWord,
} from '@/config/normalize'

describe('normalizeDrawGuessConfig', () => {
  it('空配置给出安全默认值', () => {
    const c = normalizeDrawGuessConfig({})
    expect(c.rounds).toBe(3)
    expect(c.timer).toEqual({ a: 60, b: 30 })
    expect(c.autoNextOnTimeout).toBe(true)
    expect(c.players).toEqual({ a: '选手A', b: '选手B' })
    expect(c.colors).toEqual(DEFAULT_COLORS)
    expect(c.topics).toEqual(['猫'])
    expect(c.brush).toEqual({ min: 1, max: 48, defaultSize: 6 })
  })

  it('非法倒计时 / 轮数会回退', () => {
    const c = normalizeDrawGuessConfig({
      rounds: -2,
      timer: { a: 0, b: Number.NaN },
    })
    expect(c.rounds).toBe(1)
    expect(c.timer).toEqual({ a: 60, b: 30 })
  })

  it('画笔粗细会被夹在 min / max 之间', () => {
    const c = normalizeDrawGuessConfig({
      brush: { min: 2, max: 10, defaultSize: 99 },
    })
    expect(c.brush).toEqual({ min: 2, max: 10, defaultSize: 10 })
  })

  it('自定义题目 / 颜色会复制一份，不共享原数组', () => {
    const topics = ['甲', '乙']
    const colors = ['#000']
    const c = normalizeDrawGuessConfig({ topics, colors })
    expect(c.topics).toEqual(topics)
    expect(c.topics).not.toBe(topics)
    expect(c.colors).toEqual(colors)
  })
})

describe('normalizeUndercoverConfig', () => {
  it('人数会被夹在 min / max 之间', () => {
    expect(normalizeUndercoverConfig({ players: 99 }).players).toBe(12)
    expect(normalizeUndercoverConfig({ players: 1 }).players).toBe(3)
    expect(normalizeUndercoverConfig({ minPlayers: 5, maxPlayers: 2 }).maxPlayers).toBe(5)
  })

  it('图片目录 / 后缀有默认值', () => {
    const c = normalizeUndercoverConfig({})
    expect(c.imageDir).toBe('images/undercover/')
    expect(c.imageExt).toBe('.png')
    expect(c.topics).toEqual([])
  })
})

describe('normalizeTopics / normalizeWord', () => {
  const dir = 'images/undercover/'
  const ext = '.png'

  it('没写图片时按「词 + 后缀」自动找图', () => {
    const topics = normalizeTopics([{ normal: '可乐', spy: '雪碧' }], dir, ext)
    expect(topics).toHaveLength(1)
    expect(topics[0].normal).toEqual({ text: '可乐', image: 'images/undercover/可乐.png' })
    expect(topics[0].spy).toEqual({ text: '雪碧', image: 'images/undercover/雪碧.png' })
  })

  it('支持 [普通词, 卧底词, 图, 图] 紧凑写法', () => {
    const topics = normalizeTopics([['猫', '老虎', 'cat.jpg', 'tiger.jpg']], dir, ext)
    expect(topics[0].normal.image).toBe('images/undercover/cat.jpg')
    expect(topics[0].spy.image).toBe('images/undercover/tiger.jpg')
  })

  it('支持 { text, image } 与别名', () => {
    const topics = normalizeTopics([
      {
        normal: '甲',
        spy: { text: '乙', image: 'b.png' },
        normalImg: 'a.png',
      },
    ], dir, ext)
    expect(topics[0].normal.text).toBe('甲')
    expect(topics[0].normal.image).toBe('images/undercover/a.png')
    expect(topics[0].spy.text).toBe('乙')
    expect(topics[0].spy.image).toBe('images/undercover/b.png')
  })

  it('完整 URL / dataURL / 绝对路径原样保留', () => {
    expect(normalizeWord('词', 'https://example.com/a.png', dir, ext).image)
      .toBe('https://example.com/a.png')
    expect(normalizeWord('词', '/abs/a.png', dir, ext).image).toBe('/abs/a.png')
    expect(normalizeWord('词', 'data:image/png;base64,AAA', dir, ext).image)
      .toBe('data:image/png;base64,AAA')
  })

  it('自带目录的相对路径不重复拼 imageDir', () => {
    expect(normalizeWord('词', 'sub/a.png', dir, ext).image).toBe('sub/a.png')
  })

  it('缺一边词的题目会被丢弃', () => {
    const topics = normalizeTopics([
      { normal: '只有普通词' },
      { spy: '只有卧底词' },
      { normal: '正常', spy: '也正常' },
    ], dir, ext)
    expect(topics).toHaveLength(1)
    expect(topics[0].normal.text).toBe('正常')
  })
})
