import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { getDrawGuessConfig } from '@/config/normalize'
import { useCountdown } from '@/composables/useCountdown'
import { useTimers } from '@/composables/useTimers'
import { useLightbox } from '@/composables/useLightbox'
import type { DrawingBoardApi, DrawingSnapshot } from '@/lib/drawing-board'
import {
  STORAGE_KEYS,
  asInt,
  asString,
  isRecord,
  readStored,
  removeStored,
  writeStored,
} from '@/lib/persist'
import {
  beep,
  download,
  now,
  safeFileName,
  shuffle,
  vibrate,
} from '@/lib/utils'

export type DrawGuessScreen = 'setup' | 'play' | 'result'
export type Phase = 'A' | 'B'

export interface Artwork {
  round: number
  phase: Phase
  player: string
  image: string
  blank: boolean
}

/** localStorage 里的本局状态；字段与内存状态同名，恢复时逐个校验。 */
interface SavedState {
  screen: DrawGuessScreen
  topic: string | null
  players: { A: string; B: string }
  round: number
  phase: Phase
  artworks: Artwork[]
  pool: string[]
  remaining: number | null
  paused: boolean
  locked: boolean
  timeUpVisible: boolean
}

/** 当前阶段的画板快照。单独一个键：每画一笔都会更新，避免反复重写作品列表。 */
interface SavedBoard extends DrawingSnapshot {
  round: number
  phase: Phase
}

const BOARD_SAVE_DELAY = 300

function isPhase(value: unknown): value is Phase {
  return value === 'A' || value === 'B'
}

export function useDrawGuess() {
  const config = getDrawGuessConfig()
  const timers = useTimers()
  const lightbox = useLightbox()
  const totalRounds = config.rounds

  /* ---------- 状态 ---------- */
  const screen = ref<DrawGuessScreen>('setup')
  const topic = ref<string | null>(null)
  const players = ref({ A: config.players.a, B: config.players.b })
  const round = ref(1)
  const phase = ref<Phase>('A')
  const artworks = ref<Artwork[]>([])
  const pool = ref<string[]>([])

  const board = shallowRef<DrawingBoardApi | null>(null)
  const transitioning = ref(false)
  const locked = ref(false)
  const timeUpVisible = ref(false)
  const inputBlockedUntil = ref(0)
  const savingAll = ref(false)

  /* ---------- 抽题动画 ---------- */
  const spinning = ref(false)
  const spinText = ref('')
  const popKey = ref(0)
  let spinId: number | null = null

  /* ---------- 持久化（刷新恢复） ---------- */
  let boardSnapshot: SavedBoard | null = null
  let pendingBoard: SavedBoard | null = null
  let boardSaveId: number | null = null

  function parseArtworks(value: unknown): Artwork[] {
    if (!Array.isArray(value)) return []
    const out: Artwork[] = []
    for (const item of value.slice(0, totalRounds * 2)) {
      if (!isRecord(item) || !isPhase(item.phase)) continue
      const roundNo = asInt(item.round, 0)
      if (roundNo < 1 || roundNo > totalRounds) continue
      const image = asString(item.image)
      // 只接受画板导出的 dataURL；损坏 / 被截断的条目直接丢掉，不能让结果页渲染坏图。
      if (image && !image.startsWith('data:image/')) continue
      out.push({
        round: roundNo,
        phase: item.phase,
        player: asString(item.player),
        image,
        blank: item.blank === true,
      })
    }
    return out
  }

  function parseState(data: Record<string, unknown>): SavedState | null {
    const savedScreen = data.screen
    if (savedScreen !== 'setup' && savedScreen !== 'play' && savedScreen !== 'result') return null
    if (!isPhase(data.phase)) return null

    const savedRound = asInt(data.round, 0)
    if (savedRound < 1 || savedRound > totalRounds) return null

    const savedTopic = typeof data.topic === 'string' && data.topic ? data.topic : null
    // 开局后（play / result）必须有题目；否则数据不完整，当作没有进度。
    if (savedScreen !== 'setup' && !savedTopic) return null

    const savedPlayers = isRecord(data.players) ? data.players : {}
    const savedRemaining = typeof data.remaining === 'number' && Number.isFinite(data.remaining)
      ? Math.max(0, data.remaining)
      : null
    const savedLocked = data.locked === true

    return {
      screen: savedScreen,
      topic: savedTopic,
      phase: data.phase,
      round: savedRound,
      players: {
        A: asString(savedPlayers.A, config.players.a),
        B: asString(savedPlayers.B, config.players.b),
      },
      artworks: parseArtworks(data.artworks),
      pool: Array.isArray(data.pool)
        ? data.pool.filter((t): t is string => typeof t === 'string' && config.topics.includes(t))
        : [],
      remaining: savedRemaining,
      paused: data.paused === true,
      locked: savedLocked,
      // 时间到遮罩和 locked 保持一致；旧数据只有 locked 时也能 восстановить遮罩。
      timeUpVisible: savedLocked || data.timeUpVisible === true,
    }
  }

  function parseBoard(data: Record<string, unknown>): SavedBoard | null {
    if (!isPhase(data.phase)) return null
    const roundNo = asInt(data.round, 0)
    if (roundNo < 1 || roundNo > totalRounds) return null
    const image = asString(data.image)
    if (!image.startsWith('data:image/')) return null
    return { round: roundNo, phase: data.phase, image, inked: data.inked === true }
  }

  const savedState = readStored<SavedState>(STORAGE_KEYS.drawGuess, parseState)
  if (savedState) {
    screen.value = savedState.screen
    topic.value = savedState.topic
    players.value = { ...savedState.players }
    round.value = savedState.round
    phase.value = savedState.phase
    artworks.value = savedState.artworks
    pool.value = savedState.pool
    locked.value = savedState.locked
    timeUpVisible.value = savedState.timeUpVisible
  }

  boardSnapshot = readStored<SavedBoard>(STORAGE_KEYS.drawGuessBoard, parseBoard)
  // 快照只对「正在进行的这个阶段」有效；切阶段时残留的旧快照一律丢掉。
  if (
    !boardSnapshot
    || screen.value !== 'play'
    || boardSnapshot.round !== round.value
    || boardSnapshot.phase !== phase.value
  ) {
    if (boardSnapshot) removeStored(STORAGE_KEYS.drawGuessBoard)
    boardSnapshot = null
  }

  const countdown = useCountdown({
    onExpire: onTimeUp,
    onLastSeconds: () => beep(880, 70, 0.1),
  })

  const paused = countdown.paused
  const remaining = countdown.remaining
  const total = countdown.total

  // 刷新时恢复本阶段的剩余时间与暂停状态；已经时间到的，恢复成遮罩而不是再自动跳一次。
  if (savedState?.screen === 'play') {
    if (savedState.locked || (savedState.remaining ?? 0) <= 0.05) {
      countdown.restore(0, phaseSeconds())
      locked.value = true
      timeUpVisible.value = true
    } else {
      timeUpVisible.value = false
      countdown.restore(
        savedState.remaining ?? phaseSeconds(),
        phaseSeconds(),
        savedState.paused,
      )
    }
  }

  /* ================= 持久化写入 ================= */
  function stateSnapshot(): Record<string, unknown> {
    return {
      screen: screen.value,
      topic: topic.value,
      players: { ...players.value },
      round: round.value,
      phase: phase.value,
      artworks: artworks.value,
      pool: pool.value,
      remaining: remaining.value,
      paused: paused.value,
      locked: locked.value,
      timeUpVisible: timeUpVisible.value,
    }
  }

  function persistState(): void {
    const data = stateSnapshot()
    if (writeStored(STORAGE_KEYS.drawGuess, data)) return

    // 配额写满时优先保住「阶段 + 作品」，牺牲可重画的画板快照。
    removeStored(STORAGE_KEYS.drawGuessBoard)
    if (boardSaveId !== null) {
      timers.cancel(boardSaveId)
      boardSaveId = null
    }
    pendingBoard = null
    boardSnapshot = null
    writeStored(STORAGE_KEYS.drawGuess, data)
  }

  function flushBoard(): void {
    if (!pendingBoard) return
    writeStored(STORAGE_KEYS.drawGuessBoard, pendingBoard)
    pendingBoard = null
  }

  function clearBoardPersistence(): void {
    if (boardSaveId !== null) {
      timers.cancel(boardSaveId)
      boardSaveId = null
    }
    pendingBoard = null
    boardSnapshot = null
    removeStored(STORAGE_KEYS.drawGuessBoard)
  }

  function onBoardChange(snapshot: DrawingSnapshot): void {
    if (screen.value !== 'play') return
    if (!snapshot.image.startsWith('data:image/')) return

    const next: SavedBoard = {
      round: round.value,
      phase: phase.value,
      image: snapshot.image,
      inked: snapshot.inked,
    }
    boardSnapshot = next
    pendingBoard = next
    if (boardSaveId !== null) timers.cancel(boardSaveId)
    boardSaveId = timers.later(() => {
      boardSaveId = null
      flushBoard()
    }, BOARD_SAVE_DELAY)
  }

  function persistBoardNow(): void {
    if (screen.value !== 'play') return

    const api = board.value
    if (api) {
      const image = api.toDataURL()
      if (image.startsWith('data:image/')) {
        const snapshot: SavedBoard = {
          round: round.value,
          phase: phase.value,
          image,
          inked: api.hasInk(),
        }
        boardSnapshot = snapshot
        pendingBoard = null
        if (boardSaveId !== null) {
          timers.cancel(boardSaveId)
          boardSaveId = null
        }
        writeStored(STORAGE_KEYS.drawGuessBoard, snapshot)
        return
      }
    }
    flushBoard()
  }

  function persistAllNow(): void {
    persistState()
    persistBoardNow()
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'hidden') persistAllNow()
  }

  watch(
    [screen, topic, players, round, phase, artworks, pool, locked, timeUpVisible, paused],
    () => persistState(),
    { deep: true },
  )

  onMounted(() => {
    window.addEventListener('pagehide', persistAllNow)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('pagehide', persistAllNow)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    persistAllNow()
  })

  /* ================= 计算属性 ================= */
  const slotText = computed(() => {
    if (spinning.value) return spinText.value
    return topic.value ?? '点击「抽」按钮抽取一个题目'
  })

  const slotClass = computed(() => ({
    'is-empty': !topic.value && !spinning.value,
    rolling: spinning.value,
    pop: !!topic.value && !spinning.value && popKey.value > 0,
  }))

  const activeTopicIndex = computed(() => (
    topic.value ? config.topics.indexOf(topic.value) : -1
  ))

  const currentPlayer = computed(() => players.value[phase.value])

  const reference = computed<Artwork | null>(() => (
    artworks.value.length ? artworks.value[artworks.value.length - 1] : null
  ))

  const isLastPhase = computed(() => (
    phase.value === 'B' && round.value >= totalRounds
  ))

  const nextLabel = computed(() => {
    if (phase.value === 'A') return '完成画图，交给 B'
    return isLastPhase.value ? '完成猜词，查看作品' : '完成猜词，进入下一轮'
  })

  const phaseInstruction = computed(() => {
    if (phase.value === 'A') {
      return round.value === 1
        ? 'A 照着右侧面板里的题目作画，画完点「完成画图，交给 B」。'
        : 'A 照着右侧面板里上一轮 B 写的词作画，画完点「完成画图，交给 B」。'
    }
    return 'B 看右侧面板里的画，猜出词以后<b>写在左侧画板上</b>（不能打字），写完点完成。'
  })

  const timeUpText = computed(() => (
    `「${players.value[phase.value]}」的${phase.value === 'A' ? '画图' : '猜词'}时间结束了。`
  ))

  /* ================= 题目 ================= */
  function drawTopic(): string {
    if (!pool.value.length) {
      const rest = config.topics.filter((t) => t !== topic.value)
      pool.value = shuffle(rest.length ? rest : config.topics)
    }
    const next = pool.value.pop() ?? config.topics[0]
    topic.value = next
    return next
  }

  function stopSpin(): void {
    if (spinId !== null) {
      timers.cancel(spinId)
      spinId = null
    }
    spinning.value = false
  }

  function roll(): void {
    if (!config.topics.length) return
    stopSpin()

    drawTopic()
    spinning.value = true
    spinText.value = config.topics[Math.floor(Math.random() * config.topics.length)] ?? ''
    let ticks = 0
    spinId = timers.every(() => {
      ticks += 1
      if (ticks >= 14) {
        stopSpin()
        popKey.value += 1
        beep(1046, 90, 0.12)
        return
      }
      spinText.value = config.topics[Math.floor(Math.random() * config.topics.length)] ?? ''
    }, 55)
  }

  function pickTopic(index: number): void {
    const t = config.topics[index]
    if (t === undefined) return
    stopSpin()
    topic.value = t
    pool.value = pool.value.filter((x) => x !== t)
    popKey.value += 1
    beep(988, 90, 0.12)
  }

  /* ================= 开局 ================= */
  function setBoard(api: DrawingBoardApi | null): void {
    board.value = api
    if (!api) return

    const snapshot = boardSnapshot
    if (snapshot && snapshot.round === round.value && snapshot.phase === phase.value) {
      api.restoreImage(snapshot.image, snapshot.inked)
    }
  }

  function phaseSeconds(): number {
    return phase.value === 'A' ? config.timer.a : config.timer.b
  }

  function enterPhase(): void {
    screen.value = 'play'
    transitioning.value = false
    locked.value = false
    timeUpVisible.value = false
    countdown.start(phaseSeconds())
    // 防止「双击」误触下一个阶段
    inputBlockedUntil.value = now() + 450
    persistState()
  }

  function startGame(): void {
    timers.clearAll()
    stopSpin()
    clearBoardPersistence()
    players.value = {
      A: players.value.A.trim() || '选手A',
      B: players.value.B.trim() || '选手B',
    }
    artworks.value = []
    round.value = 1
    phase.value = 'A'
    beep(784, 90, 0.12)
    enterPhase()
  }

  /* ================= 计时 ================= */
  function onTimeUp(): void {
    locked.value = true
    timeUpVisible.value = true
    beep(659, 200, 0.18)
    timers.later(() => beep(523, 320, 0.18), 210)
    vibrate([120, 60, 120])
    persistState()

    if (config.autoNextOnTimeout) {
      timers.later(() => nextPhase(), 1600)
    }
  }

  function togglePause(): void {
    if (locked.value) return
    if (paused.value) countdown.resume()
    else countdown.pause()
    persistState()
  }

  /* ================= 阶段推进 ================= */
  function captureCurrent(): void {
    if (!board.value) return
    artworks.value.push({
      round: round.value,
      phase: phase.value,
      player: players.value[phase.value],
      image: board.value.toDataURL(),
      blank: !board.value.hasInk(),
    })
    board.value = null
    clearBoardPersistence()
  }

  function requestNextPhase(): void {
    if (now() < inputBlockedUntil.value) return
    if (locked.value) {
      nextPhase()
      return
    }
    if (board.value && !board.value.hasInk()) {
      if (!window.confirm('画板还是空白的，确定要进入下一阶段吗？')) return
    }
    nextPhase()
  }

  function nextPhase(): void {
    if (transitioning.value || screen.value !== 'play') return
    transitioning.value = true
    timers.clearAll()
    countdown.stop()
    captureCurrent()

    if (phase.value === 'A') {
      phase.value = 'B'
      enterPhase()
      return
    }
    if (round.value >= totalRounds) {
      openResult()
      return
    }
    round.value += 1
    phase.value = 'A'
    enterPhase()
  }

  function openResult(): void {
    timers.clearAll()
    countdown.stop()
    screen.value = 'result'
    transitioning.value = false
    timeUpVisible.value = false
    locked.value = false
    board.value = null
    clearBoardPersistence()
    persistState()
    beep(880, 120, 0.12)
    timers.later(() => beep(1174, 200, 0.12), 130)
  }

  function quitGame(): void {
    if (!window.confirm('结束本局并查看已有作品？')) return
    timers.clearAll()
    countdown.stop()
    if (board.value?.hasInk()) captureCurrent()
    transitioning.value = true
    openResult()
  }

  function again(): void {
    timers.clearAll()
    countdown.stop()
    stopSpin()
    clearBoardPersistence()
    artworks.value = []
    round.value = 1
    phase.value = 'A'
    topic.value = null
    pool.value = []
    popKey.value = 0
    locked.value = false
    timeUpVisible.value = false
    savingAll.value = false
    screen.value = 'setup'
    persistState()
  }

  /* ================= 作品保存 ================= */
  function fileNameFor(a: Artwork): string {
    const phaseText = a.phase === 'A' ? '画图' : '猜词'
    return `${safeFileName(`第${a.round}轮-${a.phase}${phaseText}-${a.player}`)}.png`
  }

  function saveOne(index: number): void {
    const a = artworks.value[index]
    if (a) download(a.image, fileNameFor(a))
  }

  function saveAll(): void {
    const list = artworks.value.slice()
    if (!list.length || savingAll.value) return
    savingAll.value = true
    list.forEach((a, i) => {
      timers.later(() => {
        download(a.image, fileNameFor(a))
        if (i === list.length - 1) {
          savingAll.value = false
          beep(988, 90, 0.1)
        }
      }, i * 350)
    })
  }

  function openImage(src: string): void {
    lightbox.open(src)
  }

  return {
    config,
    screen,
    topic,
    players,
    round,
    phase,
    artworks,
    totalRounds,
    paused,
    remaining,
    total,
    locked,
    timeUpVisible,
    savingAll,
    slotText,
    slotClass,
    popKey,
    activeTopicIndex,
    currentPlayer,
    reference,
    isLastPhase,
    nextLabel,
    phaseInstruction,
    timeUpText,
    drawTopic,
    roll,
    pickTopic,
    setBoard,
    onBoardChange,
    startGame,
    requestNextPhase,
    togglePause,
    quitGame,
    again,
    saveOne,
    saveAll,
    openImage,
  }
}
