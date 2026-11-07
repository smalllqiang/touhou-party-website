import { beforeEach } from 'vitest'

/**
 * 单一测试进程内所有用例共享同一个 jsdom 与 localStorage。
 * 进度持久化是全局副作用，必须在每个用例前清空，否则前一个用例的状态会漏进下一个。
 */
beforeEach(() => {
  localStorage.clear()
})
