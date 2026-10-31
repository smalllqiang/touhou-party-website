<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useLightbox } from '@/composables/useLightbox'

const { src, isOpen, close } = useLightbox()

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && isOpen.value) close()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="lightbox" @click="close">
      <img :src="src" alt="作品预览">
      <span class="lightbox-hint">点击任意处关闭 · Esc</span>
    </div>
  </Teleport>
</template>
