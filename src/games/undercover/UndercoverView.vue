<script setup lang="ts">
import RevealScreen from './RevealScreen.vue'
import SetupScreen from './SetupScreen.vue'
import { useUndercover } from './useUndercover'

const {
  config,
  screen,
  count,
  names,
  topic,
  topicVisible,
  assignments,
  seen,
  allRevealed,
  peekIndex,
  spy,
  pickerItems,
  activeTopicIndex,
  setName,
  setCount,
  roll,
  pickTopic,
  toggleTopicVisible,
  startReveal,
  redeal,
  backToSetup,
  openPeek,
  closePeek,
  flipAll,
} = useUndercover()
</script>

<template>
  <SetupScreen
    v-if="screen === 'setup'"
    :config="config"
    :count="count"
    :names="names"
    :topic="topic"
    :topic-visible="topicVisible"
    :picker-items="pickerItems"
    :active-topic-index="activeTopicIndex"
    @draw="roll"
    @pick="pickTopic"
    @start="startReveal"
    @toggle-visible="toggleTopicVisible"
    @count="setCount"
    @name="setName"
  />
  <RevealScreen
    v-else
    :assignments="assignments"
    :seen="seen"
    :all-revealed="allRevealed"
    :peek-index="peekIndex"
    :spy="spy"
    :topic="topic"
    @flip="flipAll"
    @redeal="redeal"
    @setup="backToSetup"
    @peek="openPeek"
    @close="closePeek"
  />
</template>
