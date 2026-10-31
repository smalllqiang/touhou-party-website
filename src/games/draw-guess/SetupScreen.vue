<script setup lang="ts">
import { computed, ref } from 'vue'
import TopicPicker from '@/components/TopicPicker.vue'
import type { DrawGuessConfig } from '@/config/normalize'

const props = defineProps<{
  config: DrawGuessConfig
  topic: string | null
  players: { A: string; B: string }
  slotText: string
  slotClass: Record<string, boolean>
  popKey: number
  activeTopicIndex: number
}>()

const emit = defineEmits<{
  draw: []
  pick: [index: number]
  confirm: []
  'update:players': [players: { A: string; B: string }]
}>()

const picker = ref<InstanceType<typeof TopicPicker> | null>(null)

const pickerItems = computed(() => props.config.topics.map((t) => ({ left: t })))

function onPick(index: number): void {
  emit('pick', index)
  picker.value?.close()
}

function onName(who: 'A' | 'B', e: Event): void {
  const value = (e.target as HTMLInputElement).value
  emit('update:players', { ...props.players, [who]: value })
}
</script>

<template>
  <section class="setup">
    <div class="topic-stage">
      <p class="eyebrow">本轮题目</p>
      <div :key="popKey" class="topic" :class="slotClass">{{ slotText }}</div>
      <div class="topic-actions">
        <button class="btn primary" :disabled="!config.topics.length" @click="emit('draw')">抽</button>
        <button class="btn" :disabled="!topic" @click="emit('draw')">重来</button>
        <button class="btn blue" :disabled="!topic" @click="emit('confirm')">确定</button>
      </div>
    </div>

    <TopicPicker
      ref="picker"
      :items="pickerItems"
      :active-index="activeTopicIndex"
      title="📋 题目列表"
      :sub="`${config.topics.length} 个 · 展开可以直接指定某一题`"
      @pick="onPick"
    >
      点一条就直接把它当本题，不用先「抽」。列表里有全部题目，猜的人在场时小心别被看到。
    </TopicPicker>

    <div class="setup-grid">
      <div class="card">
        <h3>选手</h3>
        <div class="field">
          <label for="playerA">A —— 负责画图</label>
          <input id="playerA" :value="players.A" maxlength="12" placeholder="选手A" @input="onName('A', $event)">
        </div>
        <div class="field">
          <label for="playerB">B —— 负责看画猜词</label>
          <input id="playerB" :value="players.B" maxlength="12" placeholder="选手B" @input="onName('B', $event)">
        </div>
      </div>
      <div class="card">
        <h3>本局设置</h3>
        <ul class="settings-list">
          <li><span>游戏轮数</span><b>{{ config.rounds }} 轮</b></li>
          <li><span>A 阶段倒计时</span><b>{{ config.timer.a }} 秒</b></li>
          <li><span>B 阶段倒计时</span><b>{{ config.timer.b }} 秒</b></li>
          <li><span>时间到</span><b>{{ config.autoNextOnTimeout ? '自动进入下一阶段' : '手动进入下一阶段' }}</b></li>
          <li><span>题目数量</span><b>{{ config.topics.length }} 个</b></li>
        </ul>
        <p class="hint">这些数字和题目列表都在 <code>src/config/index.ts</code> 里改，保存后刷新页面即可。</p>
      </div>
      <div class="card rules">
        <h3>玩法</h3>
        <ol>
          <li>抽到题目后交给 A：第 1 轮 A 按题目画，第 2 轮起 A 按上一轮 B 写的词画。</li>
          <li>B 看画猜词，但答案必须<b>写在画板上</b>，不能打字说出来。</li>
          <li>一个 A + 一个 B 算一轮，共 {{ config.rounds }} 轮。</li>
          <li>结束后展示起始题目与全部作品，可以逐张保存。</li>
        </ol>
      </div>
    </div>
  </section>
</template>
