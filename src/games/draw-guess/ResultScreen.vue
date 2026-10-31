<script setup lang="ts">
import type { Artwork } from './useDrawGuess'

defineProps<{
  topic: string | null
  players: { A: string; B: string }
  artworks: Artwork[]
  totalRounds: number
  savingAll: boolean
}>()

const emit = defineEmits<{
  save: [index: number]
  'save-all': []
  again: []
  'open-image': [src: string]
}>()
</script>

<template>
  <section class="result">
    <div class="result-head">
      <p class="eyebrow">本局起始题目</p>
      <h2 class="result-topic">{{ topic || '—' }}</h2>
      <p class="muted">
        共 {{ totalRounds }} 轮 · {{ players.A }} 画图 / {{ players.B }} 猜词 ·
        共 {{ artworks.length }} 张作品
      </p>
      <div class="result-actions">
        <button class="btn" :disabled="!artworks.length || savingAll" @click="emit('save-all')">
          {{ savingAll ? '保存中…（若浏览器拦截，请允许多文件下载）' : '保存全部作品' }}
        </button>
        <button class="btn primary" @click="emit('again')">再玩一局（重新抽题）</button>
      </div>
    </div>

    <ol v-if="artworks.length" class="artworks">
      <li v-for="(a, i) in artworks" :key="i" class="artwork-card">
        <div class="artwork-meta">
          <span class="tag">第 {{ a.round }} 轮</span>
          <span class="tag" :class="a.phase === 'A' ? 'a' : 'b'">
            {{ a.phase }} · {{ a.phase === 'A' ? '画图' : '猜词（手写）' }}
          </span>
          <span class="player-name">{{ a.player }}</span>
          <span v-if="a.blank" class="tag">空白</span>
        </div>
        <img
          v-if="a.image"
          data-zoom="1"
          :src="a.image"
          alt="作品"
          @click="emit('open-image', a.image)"
        >
        <div v-else class="blank-hint">没有留下作品</div>
        <div class="artwork-foot">
          <span class="order">第 {{ i + 1 }} 张 / 共 {{ artworks.length }} 张</span>
          <button class="btn small" @click="emit('save', i)">保存这张</button>
        </div>
      </li>
    </ol>
    <div v-else class="card">
      <p class="muted">本局没有留下任何作品。</p>
    </div>
  </section>
</template>
