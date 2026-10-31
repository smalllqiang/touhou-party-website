<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import TopicPicker from '@/components/TopicPicker.vue'
import type { UndercoverConfig, UndercoverTopic } from '@/config/normalize'
import type { PickerItem } from '@/components/topic-picker'

const props = defineProps<{
  config: UndercoverConfig
  count: number
  names: string[]
  topic: UndercoverTopic | null
  topicVisible: boolean
  pickerItems: PickerItem[]
  activeTopicIndex: number
}>()

const emit = defineEmits<{
  draw: []
  pick: [index: number]
  start: []
  'toggle-visible': []
  count: [value: number | string]
  name: [index: number, value: string]
}>()

const picker = ref<InstanceType<typeof TopicPicker> | null>(null)

const hasTopics = computed(() => props.config.topics.length > 0)

const topicClass = computed(() => {
  if (!hasTopics.value || !props.topic) return 'uc-topic is-empty'
  return props.topicVisible ? 'uc-topic is-shown' : 'uc-topic is-hidden'
})

function onCount(value: number | string): void {
  emit('count', value)
  nextTick(() => {
    // 输入越界时把输入框拉回实际人数（原版 paintCount 的等价行为）
    const input = document.getElementById('ucCount') as HTMLInputElement | null
    if (input) input.value = String(props.count)
  })
}

function onCountEvent(e: Event): void {
  onCount((e.target as HTMLInputElement).value)
}

function onName(i: number, e: Event): void {
  emit('name', i, (e.target as HTMLInputElement).value)
}

function onPick(index: number): void {
  emit('pick', index)
  picker.value?.close()
}
</script>

<template>
  <section class="uc-setup">
    <div class="topic-stage">
      <p class="eyebrow">第一步 · 抽题</p>
      <div class="uc-topic" :class="topicClass">
        <template v-if="!hasTopics">
          <span>题目列表是空的 😢</span>
          <span class="muted">请在 src/config/index.ts 的 undercover.topics 里添加题目</span>
        </template>
        <template v-else-if="!topic">
          <span>点击「抽题」随机抽一组词</span>
        </template>
        <template v-else-if="topicVisible">
          <div class="uc-topic-row">
            <span class="tag">普通玩家 ×{{ count - 1 }}</span>
            <b>{{ topic.normal.text }}</b>
          </div>
          <div class="uc-topic-row spy">
            <span class="tag a">卧底 ×1</span>
            <b>{{ topic.spy.text }}</b>
          </div>
        </template>
        <template v-else>
          <span class="uc-topic-ok">✅ 已抽到题目</span>
          <span class="muted">先藏着不剧透 · 点「查看本题」主持人可以确认</span>
        </template>
      </div>
      <div class="topic-actions">
        <button class="btn primary" :disabled="!hasTopics" @click="emit('draw')">抽题</button>
        <button class="btn" :disabled="!topic" @click="emit('draw')">换一题</button>
        <button class="btn ghost" :disabled="!topic" @click="emit('toggle-visible')">
          {{ topicVisible ? '🙈 隐藏本题' : '👀 查看本题' }}
        </button>
        <button class="btn blue" :disabled="!topic" @click="emit('start')">
          开始发牌（{{ count }} 张卡片）
        </button>
      </div>
    </div>

    <TopicPicker
      ref="picker"
      :items="pickerItems"
      :active-index="activeTopicIndex"
      title="📋 题目列表"
      :sub="`${config.topics.length} 组 · 展开可以直接指定某一组`"
      @pick="onPick"
    >
      左边是<b>普通玩家</b>看到的词，右边是<b>卧底</b>看到的词。点一组就直接用它出题。
    </TopicPicker>

    <div class="setup-grid">
      <div class="card">
        <h3>玩家人数</h3>
        <div class="uc-stepper">
          <button
            type="button"
            class="uc-step-btn"
            aria-label="减少一人"
            :disabled="count <= config.minPlayers"
            @click="onCount(count - 1)"
          >
            −
          </button>
          <input
            id="ucCount"
            type="number"
            inputmode="numeric"
            :min="config.minPlayers"
            :max="config.maxPlayers"
            :value="count"
            @change="onCountEvent"
            @blur="onCountEvent"
          >
          <button
            type="button"
            class="uc-step-btn"
            aria-label="增加一人"
            :disabled="count >= config.maxPlayers"
            @click="onCount(count + 1)"
          >
            +
          </button>
          <span class="muted">人</span>
        </div>
        <p class="muted uc-count-tip">{{ count }} 人：1 名卧底 + {{ count - 1 }} 名普通玩家</p>
        <div class="uc-names">
          <label v-for="i in count" :key="i" class="uc-name-field">
            <span>{{ i }}</span>
            <input
              type="text"
              maxlength="12"
              :data-name="i - 1"
              :value="names[i - 1] ?? ''"
              :placeholder="`玩家${i}`"
              @input="onName(i - 1, $event)"
            >
          </label>
        </div>
      </div>

      <div class="card">
        <h3>本局设置</h3>
        <ul class="settings-list">
          <li><span>玩家人数</span><b>{{ count }} 人</b></li>
          <li><span>卧底</span><b>1 人</b></li>
          <li><span>普通玩家</span><b>{{ count - 1 }} 人</b></li>
          <li><span>题目数量</span><b>{{ config.topics.length }} 组</b></li>
          <li><span>卡片翻开</span><b>按住查看 / 一键全开</b></li>
        </ul>
        <p class="hint">
          人数、默认名字、图片文件夹和题目列表都在 <code>src/config/index.ts</code> 的
          <code>undercover</code> 段里改，保存后刷新页面即可。
        </p>
      </div>

      <div class="card rules">
        <h3>玩法</h3>
        <ol>
          <li>抽一组词再发牌：每人一张卡片，其中<b>只有 1 张</b>卡片的词和别人不一样。</li>
          <li>大家轮流拿起设备，<b>按住</b>自己卡片上的按钮看词和配图，松开就盖回去，别被别人瞄到。</li>
          <li>看完后每人用一句话描述自己的词（不能直接说出来），然后投票找出卧底。</li>
          <li>想公布答案，点卡片外的「一键翻开全部卡片」；再点一次就全部扣上。</li>
        </ol>
      </div>
    </div>
  </section>
</template>
