import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  getUndercoverConfig,
  type UndercoverTopic,
  type UndercoverWord,
} from '@/config/normalize'
import { beep, shuffle } from '@/lib/utils'

export interface Assignment {
  name: string
  isSpy: boolean
  word: UndercoverWord
}

export function useUndercover() {
  const config = getUndercoverConfig()

  const screen = ref<'setup' | 'reveal'>('setup')
  const count = ref(config.players)
  const names = ref<string[]>([])
  const topic = ref<UndercoverTopic | null>(null)
  const topicVisible = ref(false)
  const assignments = ref<Assignment[]>([])
  const spyIndex = ref(-1)
  const seen = ref<boolean[]>([])
  const allRevealed = ref(false)
  const peekIndex = ref(-1)

  let pool: UndercoverTopic[] = []

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

  /* ================= 抽题 ================= */
  function drawTopic(): UndercoverTopic | null {
    if (!config.topics.length) {
      topic.value = null
      return null
    }
    if (!pool.length) {
      const rest = config.topics.filter((t) => t !== topic.value)
      pool = shuffle(rest.length ? rest : config.topics)
    }
    topic.value = pool.pop() ?? null
    return topic.value
  }

  function pickTopic(index: number): void {
    const t = config.topics[index]
    if (!t) return
    topic.value = t
    topicVisible.value = false
    // 从抽题池里拿掉，免得接着点「抽题」又抽到刚手动选的这一组
    pool = pool.filter((x) => x !== t)
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
    const index = Math.floor(Math.random() * n)

    spyIndex.value = index
    assignments.value = []
    seen.value = []

    for (let i = 0; i < n; i++) {
      const isSpy = i === index
      assignments.value.push({
        name: nameAt(i),
        isSpy,
        word: isSpy ? topic.value!.spy : topic.value!.normal,
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

  /* ---------- 切到后台时自动盖回 ---------- */
  function onLeave(): void {
    if (peekIndex.value >= 0) peekIndex.value = -1
  }

  onMounted(() => {
    window.addEventListener('blur', onLeave)
    document.addEventListener('visibilitychange', onLeave)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('blur', onLeave)
    document.removeEventListener('visibilitychange', onLeave)
  })

  /* ================= 派生状态 ================= */
  const spy = computed<Assignment | null>(() => (
    spyIndex.value >= 0 ? assignments.value[spyIndex.value] ?? null : null
  ))

  const pickerItems = computed(() => (
    config.topics.map((t) => ({ left: t.normal.text, right: t.spy.text }))
  ))

  const activeTopicIndex = computed(() => (
    topic.value ? config.topics.indexOf(topic.value) : -1
  ))

  syncNames()

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
