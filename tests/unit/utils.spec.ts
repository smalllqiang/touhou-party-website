import { describe, expect, it } from 'vitest'
import { formatTime, safeFileName, shuffle } from '@/lib/utils'

describe('formatTime', () => {
  it('补零', () => {
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(9)).toBe('00:09')
    expect(formatTime(65)).toBe('01:05')
    expect(formatTime(600)).toBe('10:00')
  })

  it('向上取整，负数当 0', () => {
    expect(formatTime(1.2)).toBe('00:02')
    expect(formatTime(-3)).toBe('00:00')
  })
})

describe('shuffle', () => {
  it('不修改原数组，元素不丢不重', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffle(input)
    expect(input).toEqual([1, 2, 3, 4, 5])
    expect(out).not.toBe(input)
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5])
  })
})

describe('safeFileName', () => {
  it('替换文件系统非法字符', () => {
    expect(safeFileName('第1轮/A\\画图:选手?"<>|')).toBe('第1轮_A_画图_选手_____')
  })

  it('空值回退 artwork', () => {
    expect(safeFileName('')).toBe('artwork')
    expect(safeFileName(null)).toBe('artwork')
  })
})
