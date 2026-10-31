import type { Component } from 'vue'
import DrawGuessView from '@/games/draw-guess/DrawGuessView.vue'
import UndercoverView from '@/games/undercover/UndercoverView.vue'

export interface GameDefinition {
  /** 唯一 id，同时是 URL hash（#/<id>）与路由名 */
  id: string
  name: string
  icon: string
  desc: string
  title: string
  subtitle: string
  component: Component
}

export const games: GameDefinition[] = [
  {
    id: 'draw-guess',
    name: '你画我猜',
    icon: '🎨',
    desc: '抽题 · 计时 · 画板',
    title: '你画我猜',
    subtitle: '抽题目、限时作画、看画猜词，结束后可以保存每个人的作品',
    component: DrawGuessView,
  },
  {
    id: 'undercover',
    name: '谁是卧底',
    icon: '🕵️',
    desc: '抽词 · 发牌 · 按住看词',
    title: '谁是卧底',
    subtitle: '抽一组词发给 n 个人，其中 1 个人的词不一样；按住卡片才能看自己的词',
    component: UndercoverView,
  },
  // 以后新增小游戏：在数组里加一项，路由、导航、标题都会自动生效。
  // {
  //   id: 'werewolf', name: '狼人杀', icon: '🐺', desc: '身份 · 发言 · 计时',
  //   title: '狼人杀', subtitle: '……', component: WerewolfView,
  // },
]

export const defaultGameId = games[0].id
