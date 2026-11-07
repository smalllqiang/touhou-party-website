import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  getUndercoverConfig,
  type UndercoverTopic,
  type UndercoverWord,
} from '@/config/normalize'
import {
  STORAGE_KEYS,
  asInt,
  readStored,
  writeStored,
} from '@/lib/persist'
import { beep, shuffle } from '@/lib/utils'

export interface Assignment {
  name: string
  isSpy: boolean
  word: UndercoverWord
}

type UndercoverScreen = 'setup' | 'reveal'

/** localStorage 里的本局状态。题目只存下标，配置重新归一化后才能对上同一组词。 */
interface SavedState {
  screen: UndercoverScreen
  count: number
  names: string[]
  topicIndex: number
  topicVisible: boolean
  spyIndex: number
  seen: boolean[]
  allRevealed: boolean
  pool: number[]
}

function isScreen(value: unknown): value is UndercoverScreen {
  return value === 'setup' || value === 'reveal'
}

export function useUndercover() {
  const config = getUndercoverConfig()

  const screen = ref<UndercoverScreen>('setup')
  const count = ref(config.players)
  const names = ref<string[]>([])
  const topicIndex = ref(-1)
  const topicVisible = ref(false)
  const assignments = ref<Assignment[]>([])
  const spyIndex = ref(-1)
  const seen = ref<boolean[]>([])
  const allRevealed = ref(false)
  const peekIndex = ref(-1)

  /** 抽题池只存下标：配置对象每次挂载都会重新归一化，按下标才能稳定恢复。 */
  const pool = ref<number[]>([])

  const topic = computed<UndercoverTopic | null>(() => (
    topicIndex.value >= 0 ? config.topics[topicIndex.value] ?? null : null
  ))

  /* ================= 玩家名字 ================= */
  function defaultName(i: number): string {
    const custom = config.names[i]
    if (custom != null && String(custom).trim()) return String(custom).trim()
    return `玩家${i + 1}`
  }

  /** 补齐前 count 个名字，多余的位置保留（改小再改大不会丢）。 */
  function syncNames(): void {
    for (let i = 0; i < count.value; i++) {
      if (names.value[i] == null || !String(names.value[i]).trim()) {
        names.value[i] = defaultName(i)
      }
    }
  }

  function nameAt(i: number): string {
    const n = names.value[i]
    return n != null && String(n).trim() ? String(n).trim() : defaultName(i)
  }

  function setName(i: number, value: string): void {
    names.value[i] = value
  }

  function setCount(value: number | string): void {
    const parsed = Number.parseInt(String(value), 10)
    const n = Math.max(
      config.minPlayers,
      Math.min(config.maxPlayers, Number.isFinite(parsed) ? parsed : count.value),
    )
    if (n === count.value) return
    count.value = n
    syncNames()
  }

  /* ================= 持久化（刷新恢复） ================= */
  function parseState(data: Record<string, unknown>): SavedState | null {
    if (!isScreen(data.screen)) return null

    const savedCount = Math.max(
      config.minPlayers,
      Math.min(config.maxPlayers, asInt(data.count, config.players)),
    )
    const savedTopicIndex = asInt(data.topicIndex, -1)
    const nextTopicIndex = savedTopicIndex >= 0 && savedTopicIndex < config.topics.length
      ? savedTopicIndex
      : -1

    const savedNames = Array.isArray(data.names)
      ? data.names.filter((n): n is string => typeof n === 'string').slice(0, config.maxPlayers)
      : []

    const savedSpyIndex = asInt(data.spyIndex, -1)
    const nextSpyIndex = savedSpyIndex >= 0 && savedSpyIndex < savedCount ? savedSpyIndex : -1

    const savedSeenRaw: unknown = data.seen
    const savedSeen = Array.isArray(savedSeenRaw)
      ? Array.from({ length: savedCount }, (_, i) => savedSeenRaw[i] === true)
      : []
    let savedScreen = data.screen
    // 发牌页缺少题目 / 卧底下标时视为坏数据，回到设置页重新抽题。
    if (savedScreen === 'reveal' && (nextTopicIndex < 0 || nextSpyIndex < 0)) {
      savedScreen = 'setup'
    }

    return {
      screen: savedScreen,
      count: savedCount,
      names: savedNames,
      topicIndex: nextTopicIndex,
      topicVisible: data.topicVisible === true,
      spyIndex: savedScreen === 'reveal' ? nextSpyIndex : -1,
      seen: savedScreen === 'reveal' ? savedSeen : [],
      allRevealed: savedScreen === 'reveal' && data.allRevealed === true,
      pool: Array.isArray(data.pool)
        ? data.pool
          .map((i) => asInt(i, -1))
          .filter((i) => i >= 0 && i < config.topics.length && i !== nextTopicIndex)
        : [],
    }
  }

  function persistState(): void {
    writeStored(STORAGE_KEYS.undercover, {
      screen: screen.value,
      count: count.value,
      names: names.value,
      topicIndex: topicIndex.value,
      topicVisible: topicVisible.value,
      spyIndex: spyIndex.value,
      seen: seen.value,
      allRevealed: allRevealed.value,
      pool: pool.value,
    })
  }

  const savedState = readStored<SavedState>(STORAGE_KEYS.undercover, parseState)
  if (savedState) {
    screen.value = savedState.screen
    count.value = savedState.count
    names.value = savedState.names
    topicIndex.value = savedState.topicIndex
    topicVisible.value = savedState.topicVisible
    spyIndex.value = savedState.spyIndex
    seen.value = savedState.seen
    allRevealed.value = savedState.allRevealed
    pool.value = savedState.pool
  }

  syncNames()

  /** 发牌页恢复：只信 count / spyIndex / 题目，词从配置重建，避免存下一份可能过期的词。 */
  function rebuildAssignments(): void {
    const current = topic.value
    if (!current || spyIndex.value < 0 || spyIndex.value >= count.value) {
      assignments.value = []
      seen.value = []
      spyIndex.value = -1
      allRevealed.value = false
      return
    }

    const list: Assignment[] = []
    for (let i = 0; i < count.value; i++) {
      const isSpy = i === spyIndex.value
      list.push({
        name: nameAt(i),
        isSpy,
        word: isSpy ? current.spy : current.normal,
      })
    }
    assignments.value = list
    seen.value = Array.from({ length: count.value }, (_, i) => seen.value[i] === true)
  }

  rebuildAssignments()

  /* ================= 抽题 ================= */
  function drawTopic(): UndercoverTopic | null {
    if (!config.topics.length) {
      topicIndex.value = -1
      return null
    }
    if (!pool.value.length) {
      const all = config.topics.map((_, i) => i)
      const rest = all.filter((i) => i !== topicIndex.value)
      pool.value = shuffle(rest.length ? rest : all)
    }
    const next = pool.value.pop()
    topicIndex.value = next ?? -1
    return topic.value
  }

  function pickTopic(index: number): void {
    const t = config.topics[index]
    if (!t) return
    topicIndex.value = index
    topicVisible.value = false
    // 从抽题池里拿掉，免得接着点「抽题」又抽到刚手动选的这一组
    pool.value = pool.value.filter((x) => x !== index)
    beep(988, 90, 0.12)
  }

  /** 抽题：点一下直接出结果。不做滚动动画，否则会掠过题目池里的其他词，等于泄题。 */
  function roll(): void {
    if (!config.topics.length) return
    drawTopic()
    topicVisible.value = false
    beep(1046, 90, 0.12)
  }

  function toggleTopicVisible(): void {
    topicVisible.value = !topicVisible.value
  }

  /* ================= 发牌 ================= */
  function deal(): void {
    const n = count.value
    const current = topic.value
    if (!current) return
    const index = Math.floor(Math.random() * n)

    spyIndex.value = index
    assignments.value = []
    seen.value = []

    for (let i = 0; i < n; i++) {
      const isSpy = i === index
      assignments.value.push({
        name: nameAt(i),
        isSpy,
        word: isSpy ? current.spy : current.normal,
      })
      seen.value.push(false)
    }

    allRevealed.value = false
    peekIndex.value = -1
  }

  function startReveal(): void {
    if (!topic.value) return
    deal()
    screen.value = 'reveal'
    peekIndex.value = -1
    beep(784, 90, 0.12)
  }

  function redeal(): void {
    if (!config.topics.length) return
    drawTopic()
    deal()
    screen.value = 'reveal'
    peekIndex.value = -1
    beep(784, 90, 0.12)
  }

  function backToSetup(): void {
    allRevealed.value = false
    peekIndex.value = -1
    screen.value = 'setup'
  }

  /* ================= 卡片 ================= */
  function openPeek(i: number): void {
    if (allRevealed.value || peekIndex.value === i) return
    peekIndex.value = i
    seen.value[i] = true
  }

  function closePeek(i: number): void {
    if (peekIndex.value !== i) return
    peekIndex.value = -1
  }

  function flipAll(): void {
    allRevealed.value = !allRevealed.value
    peekIndex.value = -1
    beep(allRevealed.value ? 988 : 523, 110, 0.12)
  }

  /* ---------- 切到后台时自动盖回 + 落盘 ---------- */
  function onLeave(): void {
    if (peekIndex.value >= 0) peekIndex.value = -1
  }

  function onVisibilityChange(): void {
    if (document.visibilityState !== 'hidden') return
    onLeave()
    persistState()
  }

  function onPageHide(): void {
    onLeave()
    persistState()
  }

  watch(
    [screen, count, names, topicIndex, topicVisible, spyIndex, seen, allRevealed, pool],
    () => persistState(),
    { deep: true },
  )

  onMounted(() => {
    window.addEventListener('blur', onLeave)
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('blur', onLeave)
    window.removeEventListener('pagehide', onPageHide)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    persistState()
  })

  /* ================= 派生状态 ================= */
  const spy = computed<Assignment | null>(() => (
    spyIndex.value >= 0 ? assignments.value[spyIndex.value] ?? null : null
  ))

  const pickerItems = computed(() => (
    config.topics.map((t) => ({ left: t.normal.text, right: t.spy.text }))
  ))

  const activeTopicIndex = computed(() => topicIndex.value)

  return {
    config,
    screen,
    count,
    names,
    topic,
    topicVisible,
    assignments,
    seen,
    allRevealed,
    peekIndex,
    spy,
    pickerItems,
    activeTopicIndex,
    nameAt,
    setName,
    setCount,
    roll,
    pickTopic,
    toggleTopicVisible,
    startReveal,
    redeal,
    backToSetup,
    openPeek,
    closePeek,
    flipAll,
  }
}
