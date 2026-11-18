<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Lightbox from '@/components/Lightbox.vue'
import { games } from '@/games/registry'

const route = useRoute()
const router = useRouter()

const navOpen = ref(false)

/* 宽屏侧栏是否收起。只影响布局，不参与游戏状态；
   顺手记在 localStorage 里，刷新 / 下次打开保持用户的选择。 */
const SIDEBAR_KEY = 'touhou-party:sidebar-collapsed'

function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

const sidebarCollapsed = ref(readSidebarCollapsed())

function toggleSidebar(): void {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

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

watch(sidebarCollapsed, (collapsed) => {
  try {
    window.localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
  } catch {
    /* 隐私模式 / 存储被禁用：只在当前页面生效 */
  }
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
  <div class="app" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <aside id="app-sidebar" class="sidebar">
      <div class="brand">
        <span class="brand-logo">🎮</span>
        <div class="brand-text">
          <div class="brand-title">小游戏工具箱</div>
          <div class="brand-sub">PARTY GAME TOOLS</div>
        </div>
      </div>

      <button
        type="button"
        class="sidebar-toggle"
        aria-controls="app-sidebar"
        :aria-expanded="!sidebarCollapsed"
        :aria-label="sidebarCollapsed ? '展开侧栏' : '收起侧栏'"
        :title="sidebarCollapsed ? '展开侧栏' : '收起侧栏'"
        @click="toggleSidebar"
      >
        <span aria-hidden="true">{{ sidebarCollapsed ? '»' : '«' }}</span>
      </button>

      <div class="nav-label">小游戏</div>
      <nav class="nav">
        <button
          v-for="game in games"
          :key="game.id"
          type="button"
          class="nav-item"
          :class="{ 'is-active': game.id === currentGame.id }"
          :aria-label="sidebarCollapsed ? `${game.name}，${game.desc}` : undefined"
          :title="sidebarCollapsed ? `${game.name} · ${game.desc}` : undefined"
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
        <span class="dot" /> <span class="sidebar-footer-text">更多小游戏陆续加入</span>
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
