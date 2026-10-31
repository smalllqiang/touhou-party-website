import { ref } from 'vue'

/* 全局唯一的图片放大层：游戏组件只要调 open(src) 就行，不用再找 #lightbox。 */
const src = ref('')
const isOpen = ref(false)

export function useLightbox() {
  function open(url: string): void {
    if (!url) return
    src.value = url
    isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
  }

  return { src, isOpen, open, close }
}
