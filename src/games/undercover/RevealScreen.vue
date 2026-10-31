<script setup lang="ts">
import UcCard from './UcCard.vue'
import type { Assignment } from './useUndercover'
import type { UndercoverTopic } from '@/config/normalize'

const props = defineProps<{
  assignments: Assignment[]
  seen: boolean[]
  allRevealed: boolean
  peekIndex: number
  spy: Assignment | null
  topic: UndercoverTopic | null
}>()

const emit = defineEmits<{
  flip: []
  redeal: []
  setup: []
  peek: [index: number]
  close: [index: number]
}>()

const flipLabel = (): string => (
  props.allRevealed ? '🙈 一键扣上全部卡片' : '👀 一键翻开全部卡片'
)
</script>

<template>
  <section class="uc-reveal">
    <div class="uc-reveal-top">
      <div class="uc-reveal-meta">
        <span class="tag">共 {{ assignments.length }} 张卡片</span>
        <span class="tag b">1 名卧底 · {{ assignments.length - 1 }} 名普通玩家</span>
        <span class="muted">依次传阅：按住按钮看词，松手自动盖回</span>
      </div>
      <div class="uc-reveal-actions">
        <button class="btn blue" @click="emit('flip')">{{ flipLabel() }}</button>
        <button class="btn ghost small" @click="emit('redeal')">换一题重发</button>
        <button class="btn ghost small" @click="emit('setup')">返回设置</button>
      </div>
    </div>

    <div v-if="allRevealed && spy" class="uc-banner">
      🕵️ 本局卧底是 <b>{{ spy.name }}</b>
      <span class="uc-banner-words">
        卧底词「{{ spy.word.text }}」 · 普通词「{{ topic?.normal.text }}」
      </span>
    </div>

    <div class="uc-cards">
      <UcCard
        v-for="(a, i) in assignments"
        :key="i"
        :assignment="a"
        :index="i"
        :open="allRevealed || peekIndex === i"
        :show-role="allRevealed"
        :spy-revealed="allRevealed && a.isSpy"
        :seen="seen[i] ?? false"
        :all-revealed="allRevealed"
        @peek="emit('peek', $event)"
        @close="emit('close', $event)"
      />
    </div>

    <p class="uc-foot muted">
      卡片序号和玩家顺序一致。谁拿到的词不一样，翻开才知道；
      玩完点「一键翻开全部卡片」公布答案，再点一次可以全部扣上。
    </p>
  </section>
</template>
