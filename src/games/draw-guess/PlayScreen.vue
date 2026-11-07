<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import DrawingBoard from '@/components/DrawingBoard.vue'
import type { DrawGuessConfig } from '@/config/normalize'
import type { Artwork, Phase } from './useDrawGuess'
import type { DrawingBoardApi, DrawingSnapshot } from '@/lib/drawing-board'
import { formatTime } from '@/lib/utils'

const props = defineProps<{
  config: DrawGuessConfig
  round: number
  totalRounds: number
  phase: Phase
  player: string
  topic: string | null
  reference: Artwork | null
  paused: boolean
  locked: boolean
  remaining: number
  total: number
  timeUpVisible: boolean
  timeUpText: string
  autoNextOnTimeout: boolean
  nextLabel: string
  /** 静态文案（含 <b>），不是用户输入 */
  instruction: string
}>()

const emit = defineEmits<{
  pause: []
  quit: []
  next: []
  'timeup-next': []
  'open-image': [src: string]
  board: [api: DrawingBoardApi | null]
  'board-change': [snapshot: DrawingSnapshot]
}>()

const ratio = computed(() => {
  const value = props.total > 0 ? (props.remaining / props.total) * 100 : 0
  return Math.max(0, Math.min(100, value)).toFixed(1)
})

const warn = computed(() => !props.paused && props.remaining <= 10 && props.remaining > 0)

onBeforeUnmount(() => emit('board', null))
</script>

<template>
  <section class="play">
    <div class="play-top">
      <div class="play-meta">
        <span class="tag">第 {{ round }} / {{ totalRounds }} 轮</span>
        <span class="tag" :class="phase === 'A' ? 'a' : 'b'">
          {{ phase === 'A' ? 'A · 画图' : 'B · 猜词' }}
        </span>
        <span class="player-name">{{ player }}</span>
      </div>
      <div class="timer" :class="{ warn, paused }">
        <span class="timer-value">{{ formatTime(remaining) }}</span>
        <div class="timer-bar"><i :style="{ width: `${ratio}%` }" /></div>
      </div>
    </div>

    <div class="play-body">
      <aside class="play-side">
        <div class="panel">
          <template v-if="phase === 'A' && round === 1">
            <p class="eyebrow">A 的题目</p>
            <div class="topic-small">{{ topic }}</div>
            <p class="muted">把题目画出来，让 B 猜。B 看不到这个题目。</p>
          </template>
          <template v-else>
            <p class="eyebrow">{{ phase === 'A' ? '上一轮 B 写的词' : 'A 刚刚画的画' }}</p>
            <div class="muted" style="margin-top: 2px">{{ reference?.player ?? '' }}</div>
            <img
              v-if="reference?.image"
              class="ref-img"
              data-zoom="1"
              :src="reference.image"
              alt="参考作品"
              @click="emit('open-image', reference.image)"
            >
            <div v-else class="placeholder">这张参考作品是空白的 😅</div>
            <p class="muted">
              {{ phase === 'A' ? '照着这个词再画一幅，让 B 接着猜。' : '看画猜词，把答案写在右边画板上。' }}
            </p>
          </template>
        </div>
        <div class="panel">
          <p class="eyebrow">本阶段说明</p>
          <!-- 静态文案，由 useDrawGuess 生成，不含用户输入 -->
          <p class="muted" style="margin: 8px 0 12px" v-html="instruction" />
          <p class="muted">工具：调色盘选颜色、滑杆调粗细、🧽 橡皮擦、↶ 撤销、🗑 清空。鼠标 / 手指 / 手写笔都可以画。</p>
        </div>
      </aside>

      <div class="play-main">
        <div id="boardHost">
          <DrawingBoard
            :colors="config.colors"
            :brush="config.brush"
            :paused="paused"
            :locked="locked"
            @ready="emit('board', $event)"
            @change="emit('board-change', $event)"
          />
        </div>
        <div class="play-actions">
          <button class="btn ghost small" @click="emit('pause')">{{ paused ? '继续' : '暂停' }}</button>
          <button class="btn ghost small" @click="emit('quit')">结束本局</button>
          <button class="btn primary" @click="emit('next')">{{ nextLabel }}</button>
        </div>
      </div>
    </div>

    <div v-if="timeUpVisible" class="timeup">
      <div class="timeup-card">
        <div class="big">时间到</div>
        <p class="sub">
          {{ timeUpText }}<template v-if="autoNextOnTimeout"><br>约 1.6 秒后自动进入下一步…</template>
        </p>
        <button class="btn primary" @click="emit('timeup-next')">下一步</button>
      </div>
    </div>
  </section>
</template>
