<script setup lang="ts">
import PlayScreen from './PlayScreen.vue'
import ResultScreen from './ResultScreen.vue'
import SetupScreen from './SetupScreen.vue'
import { useDrawGuess } from './useDrawGuess'

const {
  config,
  screen,
  topic,
  players,
  round,
  phase,
  artworks,
  totalRounds,
  paused,
  remaining,
  total,
  locked,
  timeUpVisible,
  savingAll,
  slotText,
  slotClass,
  popKey,
  activeTopicIndex,
  currentPlayer,
  reference,
  nextLabel,
  phaseInstruction,
  timeUpText,
  roll,
  pickTopic,
  setBoard,
  startGame,
  requestNextPhase,
  togglePause,
  quitGame,
  again,
  saveOne,
  saveAll,
  openImage,
} = useDrawGuess()
</script>

<template>
  <SetupScreen
    v-if="screen === 'setup'"
    :config="config"
    :topic="topic"
    :players="players"
    :slot-text="slotText"
    :slot-class="slotClass"
    :pop-key="popKey"
    :active-topic-index="activeTopicIndex"
    @draw="roll"
    @pick="pickTopic"
    @confirm="startGame"
    @update:players="Object.assign(players, $event)"
  />
  <PlayScreen
    v-else-if="screen === 'play'"
    :key="`${phase}-${round}`"
    :config="config"
    :round="round"
    :total-rounds="totalRounds"
    :phase="phase"
    :player="currentPlayer"
    :topic="topic"
    :reference="reference"
    :paused="paused"
    :locked="locked"
    :remaining="remaining"
    :total="total"
    :time-up-visible="timeUpVisible"
    :time-up-text="timeUpText"
    :auto-next-on-timeout="config.autoNextOnTimeout"
    :next-label="nextLabel"
    :instruction="phaseInstruction"
    @pause="togglePause"
    @quit="quitGame"
    @next="requestNextPhase"
    @timeup-next="requestNextPhase"
    @open-image="openImage"
    @board="setBoard"
  />
  <ResultScreen
    v-else
    :topic="topic"
    :players="players"
    :artworks="artworks"
    :total-rounds="totalRounds"
    :saving-all="savingAll"
    @save="saveOne"
    @save-all="saveAll"
    @again="again"
    @open-image="openImage"
  />
</template>
