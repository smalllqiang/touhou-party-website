<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  type BoardTool,
  type DrawingBoardApi,
  type DrawingSnapshot,
} from '@/lib/drawing-board'

const props = withDefaults(
  defineProps<{
    colors: string[]
    brush: { min: number; max: number; defaultSize: number }
    paused?: boolean
    locked?: boolean
    disabled?: boolean
  }>(),
  { paused: false, locked: false, disabled: false },
)

const emit = defineEmits<{
  ready: [api: DrawingBoardApi]
  /** 一笔画完 / 撤销 / 清空之后上报整张快照，父级用来持久化本阶段进度。 */
  change: [snapshot: DrawingSnapshot]
}>()

const HISTORY_LIMIT = 12

const canvasEl = ref<HTMLCanvasElement | null>(null)
const tool = ref<BoardTool>('brush')
const color = ref(props.colors[0] ?? '#000000')
const size = ref(
  Math.min(Math.max(props.brush.defaultSize, props.brush.min), props.brush.max),
)

let ctx: CanvasRenderingContext2D | null = null
let drawing = false
let inked = false
let strokeColor = '#000000'
let lineWidth = size.value
let lastPoint: { x: number; y: number } | null = null
let lastMid: { x: number; y: number } | null = null
/** 撤销栈保存「整张图 + 当时是否算有笔迹」，否则「清空后撤销」会让 hasInk 永远为 false。 */
const undoStack: DrawingSnapshot[] = []

const enabled = computed(() => !props.disabled && !props.locked && !props.paused)

const previewStyle = computed(() => {
  const visual = Math.max(2, Math.min(26, size.value))
  return { width: `${visual}px`, height: `${visual}px` }
})

/* ---------- 画布初始化 ---------- */
function paintBackground(): void {
  if (!ctx) return
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT)
  ctx.restore()
}

function resetContext(): void {
  if (!ctx) return
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

onMounted(() => {
  const canvas = canvasEl.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  if (!ctx) return
  paintBackground()
  resetContext()

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('contextmenu', preventDefault)

  emit('ready', api)
})

watch(enabled, (value) => {
  if (!value) drawing = false
})

/* ---------- 历史（撤销） ---------- */
function pushHistory(): void {
  try {
    const data = canvasEl.value?.toDataURL('image/png')
    if (!data) return
    undoStack.push({ image: data, inked })
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift()
  } catch {
    /* ignore */
  }
}

/* ---------- 快照上报 ---------- */
function emitChange(): void {
  const data = toDataURL()
  if (!data) return
  emit('change', { image: data, inked })
}

/* ---------- 指针绘制 ---------- */
function pointerPos(e: PointerEvent): { x: number; y: number } {
  const canvas = canvasEl.value!
  const rect = canvas.getBoundingClientRect()
  const sx = BOARD_WIDTH / (rect.width || 1)
  const sy = BOARD_HEIGHT / (rect.height || 1)
  return {
    x: (e.clientX - rect.left) * sx,
    y: (e.clientY - rect.top) * sy,
  }
}

/** 手写笔按压力度微调粗细 */
function widthFor(e: PointerEvent | undefined): number {
  let base = tool.value === 'eraser' ? size.value * 2.2 : size.value
  if (e?.pointerType === 'pen' && e.pressure > 0) {
    base *= 0.45 + e.pressure * 0.9
  }
  return Math.max(0.6, base)
}

function beginStroke(p: { x: number; y: number }, e: PointerEvent): void {
  if (!ctx) return
  strokeColor = tool.value === 'eraser' ? '#ffffff' : color.value
  lineWidth = widthFor(e)
  lastPoint = p
  lastMid = p
  ctx.fillStyle = strokeColor
  ctx.beginPath()
  ctx.arc(p.x, p.y, Math.max(lineWidth / 2, 0.4), 0, Math.PI * 2)
  ctx.fill()
  inked = true
}

function extendStroke(p: { x: number; y: number }, e: PointerEvent): void {
  if (!ctx || !lastPoint || !lastMid) return
  const w = widthFor(e) || lineWidth
  const mid = { x: (lastPoint.x + p.x) / 2, y: (lastPoint.y + p.y) / 2 }
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = w
  ctx.beginPath()
  ctx.moveTo(lastMid.x, lastMid.y)
  ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, mid.x, mid.y)
  ctx.stroke()
  lastPoint = p
  lastMid = mid
  lineWidth = w
  inked = true
}

function endStroke(): void {
  if (!ctx || !lastPoint || !lastMid) return
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(lastMid.x, lastMid.y)
  ctx.lineTo(lastPoint.x, lastPoint.y)
  ctx.stroke()
}

function onPointerDown(e: PointerEvent): void {
  if (!enabled.value) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  e.preventDefault()
  pushHistory()
  drawing = true
  try {
    canvasEl.value?.setPointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
  resetContext()
  beginStroke(pointerPos(e), e)
}

function onPointerMove(e: PointerEvent): void {
  if (!drawing || !enabled.value) return
  e.preventDefault()
  const coalesced = e.getCoalescedEvents?.() ?? []
  const events = coalesced.length ? coalesced : [e]
  for (const ev of events) extendStroke(pointerPos(ev), ev)
}

function onPointerUp(e: PointerEvent): void {
  if (!drawing) return
  drawing = false
  endStroke()
  try {
    canvasEl.value?.releasePointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
  emitChange()
}

function preventDefault(e: Event): void {
  e.preventDefault()
}

/* ---------- 工具栏 ---------- */
function setColor(c: string): void {
  color.value = c
  tool.value = 'brush'
}

function setSize(v: number | string): void {
  const n = Number(v)
  size.value = Math.min(Math.max(Number.isFinite(n) ? n : props.brush.min, props.brush.min), props.brush.max)
}

function setTool(t: BoardTool): void {
  tool.value = t === 'eraser' ? 'eraser' : 'brush'
}

function onRangeInput(e: Event): void {
  setSize((e.target as HTMLInputElement).value)
}

/* ---------- 对外 API ---------- */
function clear(): void {
  pushHistory()
  paintBackground()
  resetContext()
  inked = false
  emitChange()
}

function undo(): void {
  const entry = undoStack.pop()
  if (!entry) return
  const img = new Image()
  img.onload = () => {
    paintBackground()
    ctx?.drawImage(img, 0, 0)
    inked = entry.inked
    emitChange()
  }
  img.src = entry.image
}

/**
 * 用快照恢复画布（刷新后继续作画）。
 * 先同步写回 inked：dataURL 解码是异步的，如果玩家在解码完成前点「下一阶段」，
 * hasInk() 不能误报空白。恢复后清空撤销栈（刷新前的历史没有保存）。
 */
function restoreImage(image: string, restoredInked = true): void {
  if (!image.startsWith('data:image/')) return
  inked = restoredInked
  undoStack.length = 0
  const img = new Image()
  img.onload = () => {
    paintBackground()
    resetContext()
    ctx?.drawImage(img, 0, 0)
  }
  img.onerror = () => {
    /* 损坏的快照当作空白画布，不影响继续玩 */
    inked = false
    paintBackground()
  }
  img.src = image
}

function toDataURL(): string {
  return canvasEl.value?.toDataURL('image/png') ?? ''
}

function hasInk(): boolean {
  return inked
}

const api: DrawingBoardApi = {
  toDataURL,
  hasInk,
  restoreImage,
  clear,
  undo,
  setColor,
  setSize,
  setTool,
}

defineExpose(api)
</script>

<template>
  <div class="board" :class="{ 'is-locked': !enabled }">
    <div class="board-toolbar">
      <div class="tool-group">
        <button
          v-for="c in colors"
          :key="c"
          type="button"
          class="swatch"
          :class="{ 'is-active': c === color }"
          :data-color="c"
          :style="{ background: c }"
          :title="c"
          @click="setColor(c)"
        />
      </div>
      <div class="tool-group">
        <label class="size-control">
          <span>粗细</span>
          <input
            type="range"
            :min="brush.min"
            :max="brush.max"
            :value="size"
            step="1"
            @input="onRangeInput"
          >
          <span class="size-preview" :class="{ 'is-eraser': tool === 'eraser' }">
            <i :style="previewStyle" />
          </span>
        </label>
      </div>
      <div class="tool-group">
        <button
          type="button"
          class="tool-btn"
          :class="{ 'is-active': tool === 'brush' }"
          data-tool="brush"
          @click="setTool('brush')"
        >
          🖌 画笔
        </button>
        <button
          type="button"
          class="tool-btn"
          :class="{ 'is-active': tool === 'eraser' }"
          data-tool="eraser"
          @click="setTool('eraser')"
        >
          🧽 橡皮擦
        </button>
      </div>
      <div class="tool-group right">
        <button type="button" class="tool-btn" data-action="undo" @click="undo">↶ 撤销</button>
        <button type="button" class="tool-btn danger" data-action="clear" @click="clear">🗑 清空</button>
      </div>
    </div>
    <div class="board-canvas-wrap">
      <canvas
        ref="canvasEl"
        :width="BOARD_WIDTH"
        :height="BOARD_HEIGHT"
        :style="{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }"
      />
      <div class="board-paused" :hidden="!paused">
        已暂停<span>点击「继续」恢复计时</span>
      </div>
      <div class="board-lock" :hidden="!locked">时间到</div>
    </div>
  </div>
</template>
