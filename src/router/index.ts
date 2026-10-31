import { createRouter, createWebHashHistory } from 'vue-router'
import { games, defaultGameId } from '@/games/registry'

/**
 * 用 hash 路由：#/draw-guess、#/undercover。
 * 这样纯静态托管（甚至 file:// 之外任意子目录）都不需要服务器做 history fallback。
 */
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: `/${defaultGameId}` },
    ...games.map((game) => ({
      path: `/${game.id}`,
      name: game.id,
      component: game.component,
    })),
    { path: '/:pathMatch(.*)*', redirect: `/${defaultGameId}` },
  ],
})
