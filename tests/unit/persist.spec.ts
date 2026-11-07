import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS, clearAllStored, readStored, writeStored } from '@/lib/persist'

const KEY = 'touhou-party:v1:' + STORAGE_KEYS.undercover

describe('persist', () => {
  it('写入后能读回，并自动带版本号', () => {
    expect(writeStored(STORAGE_KEYS.undercover, { count: 5 })).toBe(true)

    const raw = localStorage.getItem(KEY)
    expect(raw).toContain('"v":1')

    const value = readStored<number>(STORAGE_KEYS.undercover, (data) => (
      typeof data.count === 'number' ? data.count : null
    ))
    expect(value).toBe(5)
  })

  it('JSON 损坏或版本不符时丢弃并删除键', () => {
    localStorage.setItem(KEY, '{ not json')
    expect(readStored(STORAGE_KEYS.undercover, () => 1)).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()

    localStorage.setItem(KEY, JSON.stringify({ v: 999, count: 5 }))
    expect(readStored(STORAGE_KEYS.undercover, () => 1)).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('parse 返回 null 时按坏数据处理', () => {
    expect(writeStored(STORAGE_KEYS.undercover, { count: 'nope' })).toBe(true)
    expect(readStored(STORAGE_KEYS.undercover, () => null)).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('clearAllStored 只清本应用的键', () => {
    const other = 'someone-else'
    localStorage.setItem(other, 'keep-me')
    writeStored(STORAGE_KEYS.drawGuess, { screen: 'setup' })
    writeStored(STORAGE_KEYS.undercover, { count: 4 })

    clearAllStored()

    expect(localStorage.getItem(KEY)).toBeNull()
    expect(localStorage.getItem(other)).toBe('keep-me')
  })
})
