<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Assignment } from './useUndercover'
import { assetUrl } from '@/lib/assets'

const props = defineProps<{
  assignment: Assignment
  index: number
  open: boolean
  showRole: boolean
  spyRevealed: boolean
  seen: boolean
  allRevealed: boolean
}>()

const emit = defineEmits<{
  peek: [index: number]
  close: [index: number]
}>()

const imgEl = ref<HTMLImageElement | null>(null)
const failed = ref(false)

const hasImage = computed(() => !!props.assignment.word.image)
const imgSrc = computed(() => assetUrl(props.assignment.word.image))
const showMissing = computed(() => !hasImage.value || failed.value)

let endHandler: ((e: PointerEvent) => void) | null = null

function cleanup(): void {
  if (!endHandler) return
  window.removeEventListener('pointerup', endHandler, true)
  window.removeEventListener('pointercancel', endHandler, true)
  endHandler = null
}

function onPointerDown(e: PointerEvent): void {
  if (props.allRevealed) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  e.preventDefault() // 防止长按选中文字 / 弹出菜单
  emit('peek', props.index)

  // 把这一根手指「锁」在按钮上。卡片一开始翻转，按钮就被转到指针命中范围之外，
  // 浏览器会跟着补发 pointerout / pointerleave；不锁住的话，卡片会刚翻开就被自己关掉。
  const btn = e.currentTarget as HTMLButtonElement
  try {
    btn.setPointerCapture(e.pointerId)
  } catch {
    /* 合成事件等场景忽略 */
  }

  const pointerId = e.pointerId
  cleanup()
  endHandler = (ev: PointerEvent) => {
    if (ev.pointerId != null && pointerId != null && ev.pointerId !== pointerId) return
    cleanup()
    emit('close', props.index)
  }
  window.addEventListener('pointerup', endHandler, true)
  window.addEventListener('pointercancel', endHandler, true)
}

function onLostCapture(): void {
  cleanup()
  emit('close', props.index)
}

function onBlur(): void {
  emit('close', props.index)
}

// 注意：故意「不」监听 pointerleave / pointerout —— 翻转动画会触发一次假 leave，
// 监听它会让卡片刚翻开就立刻合上。
function onKeydown(e: KeyboardEvent): void {
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') {
    e.preventDefault()
    emit('peek', props.index)
  }
}

function onKeyup(e: KeyboardEvent): void {
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') emit('close', props.index)
}

onMounted(() => {
  const img = imgEl.value
  if (img && img.complete && img.naturalWidth === 0) failed.value = true
})

// 「换一题重发」会复用同一张卡片组件（key 是下标），图片换了要把失败状态清掉，
// 否则上一轮缺图的占位会一直留着。
watch(imgSrc, async () => {
  failed.value = false
  await nextTick()
  const img = imgEl.value
  if (img && img.complete && img.naturalWidth === 0) failed.value = true
})

onBeforeUnmount(cleanup)
</script>

<template>
  <div
    class="uc-card"
    :class="{ 'is-open': open, 'is-spy': spyRevealed }"
    :data-index="index"
  >
    <div class="uc-card-inner">
      <div class="uc-card-face uc-card-cover">
        <div class="uc-card-no">{{ index + 1 }}</div>
        <div class="uc-card-name">{{ assignment.name }}</div>
        <div class="uc-card-cover-icon">🎴</div>
        <button
          type="button"
          class="uc-hold-btn"
          :data-hold="index"
          @pointerdown="onPointerDown"
          @lostpointercapture="onLostCapture"
          @contextmenu.prevent
          @blur="onBlur"
          @keydown="onKeydown"
          @keyup="onKeyup"
        >
          按住查看我的词
        </button>
        <div class="uc-card-seen" :hidden="!seen">✓ 已查看</div>
      </div>

      <div class="uc-card-face uc-card-back">
        <div class="uc-card-role">
          {{ showRole ? (assignment.isSpy ? '卧底' : '普通玩家') : '' }}
        </div>
        <div class="uc-card-word">{{ assignment.word.text }}</div>
        <div class="uc-card-media">
          <img
            v-if="hasImage"
            v-show="!failed"
            ref="imgEl"
            class="uc-img"
            :src="imgSrc"
            :alt="assignment.word.text"
            @error="failed = true"
          >
          <div v-show="showMissing" class="uc-img-missing">
            <span>🖼️</span>
            <b>{{ hasImage ? '图片待补充' : '没有配图' }}</b>
            <i>{{ hasImage ? assignment.word.image : '在 src/config/index.ts 里给这个词写 image' }}</i>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
