<script setup lang="ts">
import { ref } from 'vue'
import type { PickerItem } from './topic-picker'

defineProps<{
  items: PickerItem[]
  activeIndex: number
  title: string
  sub: string
}>()

const emit = defineEmits<{
  pick: [index: number]
}>()

const detailsEl = ref<HTMLDetailsElement | null>(null)

function pick(index: number): void {
  emit('pick', index)
  // 选完自动收起，免得被围观的人看光
  if (detailsEl.value) detailsEl.value.open = false
}

function close(): void {
  if (detailsEl.value) detailsEl.value.open = false
}

defineExpose({ close })
</script>

<template>
  <details v-if="items.length" ref="detailsEl" class="topic-picker">
    <summary>
      <span class="topic-picker-title">{{ title }}</span>
      <span class="topic-picker-sub">{{ sub }}</span>
      <span class="topic-picker-caret">▾</span>
    </summary>
    <div class="topic-picker-body">
      <p class="topic-picker-tip">
        <slot />
      </p>
      <div class="topic-pick-list">
        <button
          v-for="(item, i) in items"
          :key="i"
          type="button"
          class="topic-pick-item"
          :class="{ 'is-active': i === activeIndex }"
          :data-pick="i"
          @click="pick(i)"
        >
          <span class="topic-pick-no">{{ i + 1 }}</span>
          <span class="topic-pick-word">{{ item.left }}</span>
          <template v-if="item.right !== undefined">
            <span class="topic-pick-sep">/</span>
            <span class="topic-pick-word spy">{{ item.right }}</span>
          </template>
        </button>
      </div>
    </div>
  </details>
</template>
