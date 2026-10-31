<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Lightbox from '@/components/Lightbox.vue'
import { games } from '@/games/registry'

const route = useRoute()
const router = useRouter()

const navOpen = ref(false)

const currentGame = computed(() => (
  games.find((g) => g.id === route.name) ?? games[0]
))

function select(id: string): void {
  navOpen.value = false
  if (id !== currentGame.value.id) void router.replace({ name: id })
}

watch(
  () => currentGame.value,
  (game) => {
    document.title = `${game.name} · 小游戏工具箱`
    navOpen.value = false
  },
  { immediate: true },
)

watch(navOpen, (open) => {
  document.body.classList.toggle('nav-open', open)
})

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') navOpen.value = false
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('nav-open')
})
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-logo">🎮</span>
        <div class="brand-text">
          <div class="brand-title">小游戏工具箱</div>
          <div class="brand-sub">PARTY GAME TOOLS</div>
        </div>
      </div>

      <div class="nav-label">小游戏</div>
      <nav class="nav">
        <button
          v-for="game in games"
          :key="game.id"
          type="button"
          class="nav-item"
          :class="{ 'is-active': game.id === currentGame.id }"
          @click="select(game.id)"
        >
          <span class="nav-icon">{{ game.icon }}</span>
          <span class="nav-text">
            <span class="nav-name">{{ game.name }}</span>
            <span class="nav-desc">{{ game.desc }}</span>
          </span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <span class="dot" /> 更多小游戏陆续加入
      </div>
    </aside>
    <div class="backdrop" @click="navOpen = false" />

    <main class="content">
      <div class="content-bg" aria-hidden="true" />
      <header class="content-header">
        <button class="icon-btn menu-btn" aria-label="打开菜单" @click="navOpen = !navOpen">☰</button>
        <div class="content-title">
          <h1>{{ currentGame.title }}</h1>
          <p class="page-subtitle">{{ currentGame.subtitle }}</p>
        </div>
      </header>
      <div class="content-body">
        <RouterView />
      </div>
    </main>
  </div>

  <Lightbox />
</template>
