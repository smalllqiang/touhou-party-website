import { computed, ref, shallowRef } from 'vue'
import { getDrawGuessConfig } from '@/config/normalize'
import { useCountdown } from '@/composables/useCountdown'
import { useTimers } from '@/composables/useTimers'
import { useLightbox } from '@/composables/useLightbox'
import type { DrawingBoardApi } from '@/lib/drawing-board'
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

export function useDrawGuess() {
  const config = getDrawGuessConfig()
  const timers = useTimers()
  const lightbox = useLightbox()

  /* ---------- 状态 ---------- */
  const screen = ref<DrawGuessScreen>('setup')
  const topic = ref<string | null>(null)
  const players = ref({ A: config.players.a, B: config.players.b })
  const round = ref(1)
  const phase = ref<Phase>('A')
  const artworks = ref<Artwork[]>([])
  const totalRounds = config.rounds

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
  let pool: string[] = []

  const countdown = useCountdown({
    onExpire: onTimeUp,
    onLastSeconds: () => beep(880, 70, 0.1),
  })

  const paused = countdown.paused
  const remaining = countdown.remaining
  const total = countdown.total

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
        ? 'A 看着左边的题目作画，画完点「完成画图，交给 B」。'
        : 'A 看着左边上一轮 B 写的词作画，画完点「完成画图，交给 B」。'
    }
    return 'B 看左边的画，猜出词以后<b>写在右边画板上</b>（不能打字），写完点完成。'
  })

  const timeUpText = computed(() => (
    `「${players.value[phase.value]}」的${phase.value === 'A' ? '画图' : '猜词'}时间结束了。`
  ))

  /* ================= 题目 ================= */
  function drawTopic(): string {
    if (!pool.length) {
      const rest = config.topics.filter((t) => t !== topic.value)
      pool = shuffle(rest.length ? rest : config.topics)
    }
    const next = pool.pop() ?? config.topics[0]
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
    pool = pool.filter((x) => x !== t)
    popKey.value += 1
    beep(988, 90, 0.12)
  }

  /* ================= 开局 ================= */
  function setBoard(api: DrawingBoardApi | null): void {
    board.value = api
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
  }

  function startGame(): void {
    timers.clearAll()
    stopSpin()
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

    if (config.autoNextOnTimeout) {
      timers.later(() => nextPhase(), 1600)
    }
  }

  function togglePause(): void {
    if (locked.value) return
    if (paused.value) countdown.resume()
    else countdown.pause()
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
    artworks.value = []
    round.value = 1
    phase.value = 'A'
    topic.value = null
    pool = []
    popKey.value = 0
    locked.value = false
    timeUpVisible.value = false
    savingAll.value = false
    screen.value = 'setup'
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
