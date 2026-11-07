# 开发约定

改动前先读 [README.md](README.md) 的不变量清单与 [architecture.md](architecture.md)。

## 新增一个小游戏（4 步）

以 `werewolf` 为例：

1. **加配置段** —— 在 [`src/config/index.ts`](../src/config/index.ts) 的 `GAME_CONFIG` 里加 `werewolf`，类型定义在同一个文件；如果需要兜底，在 [`src/config/normalize.ts`](../src/config/normalize.ts) 加 `getWerewolfConfig()`。配置语义写进 [config.md](config.md)。
2. **写游戏** —— 新建 `src/games/werewolf/`：
   - `WerewolfView.vue`：根组件，`setup` 里调用 `useWerewolf()`，用 `v-if` 在设置 / 进行中 / 结果等屏幕间切换；
   - `useWerewolf.ts`：该游戏的全部状态与状态机（`ref` / `computed` / 方法），不挂全局；
   - 屏幕组件按需拆到同目录，比如 `SetupScreen.vue` / `PlayScreen.vue`。
3. **接持久化** —— 在 [`src/lib/persist.ts`](../src/lib/persist.ts) 加键；composable 里 `readStored` 恢复、`watch` / `pagehide` 写入。至少保证刷新后能回到原屏幕，详见 [persistence.md](persistence.md)。
4. **注册** —— 在 [`src/games/registry.ts`](../src/games/registry.ts) 的 `games` 数组加一项 `{ id, name, icon, desc, title, subtitle, component }`。`id` 同时是路由名和 hash；导航、标题、路由会自动生效，不需要改 `router/index.ts`。
5. **补测试与文档** —— 新增 `docs/games/<id>.md`，登记进 [README.md](README.md) 文档清单与代码地图；加单测（状态机、配置归一化、刷新恢复）和端到端用例；更新端到端测试里「导航项数量」相关断言。

## 代码规范

| 规则 | 说明 |
| --- | --- |
| TypeScript strict | 不用 `any` 绕过类型；配置与状态形状写进类型定义 |
| SFC | `<script setup lang="ts">` + `<template>`；组件名用 PascalCase，文件名一致 |
| 状态归属 | 游戏状态放 composable（`useXxx`）或组件内；**不引入 Pinia**，不挂 `window` |
| 定时器 | 用 `useTimers().later/every` 或 `useCountdown`；不要裸 `setInterval`，否则切走游戏后仍会跑 |
| 生命周期 | 组件卸载由 Vue 负责；`onScopeDispose` / `onBeforeUnmount` 里清理自己注册的 `window` / `document` 监听 |
| 持久化 | 只通过 [`src/lib/persist.ts`](../src/lib/persist.ts) 读写 `localStorage`；不要直接 `localStorage.setItem`，也不要持久化正在按住 / 输入中的临时状态 |
| 恢复校验 | 从存储读出的数据一律校验（屏幕枚举、轮次范围、题目下标、`data:image/` 前缀），坏数据回退默认页，不能抛错白屏 |
| DOM 访问 | 优先 `ref` + 模板；只有 canvas 等命令式 API 允许直接操作 DOM |
| 用户内容 | 用 `{{ }}` 插值，Vue 会转义；**不要**对来自配置 / 用户输入的文本用 `v-html`（当前唯一的 `v-html` 是静态说明文案） |
| 文案 | 用户可见文案用中文，语气与现有界面一致；破坏性操作（结束本局 / 丢弃作品）要 `window.confirm` |
| 通知 | 提示音 / 震动统一走 `@/lib/utils` 的 `beep` / `vibrate`（静默失败，不抛错） |
| 样式 | 全局 CSS；新游戏用独立前缀（如 `ww-`），跨游戏复用元件用通用类名（如 `.topic-picker*`） |
| 注释 | 中文；解释「为什么」而不是「做了什么」——pointer 捕获、翻转动画假 leave、抽题不滚动这类注释是有意保留的设计记录 |

## 必须遵守的约束（详见 [README.md](README.md) 的不变量）

1. 纯静态：不引入后端、网络请求；本局进度只用 `localStorage` 保存，不接数据库 / 云同步。
2. 配置是构建期模块；不要在运行时改配置对象。
3. 刷新不能重置本局进度：新增游戏 / 新状态时同步接 [`src/lib/persist.ts`](../src/lib/persist.ts)，见 [persistence.md](persistence.md)。
4. 谁是卧底抽题**不能有滚动动画**（泄题）。
5. 谁是卧底按住查看**不能监听 `pointerleave` / `pointerout`**（翻转动画会触发假 leave）。
6. 谁是卧底恰好 1 名卧底；卡片序号 = 玩家顺序。
7. 画板 canvas 内部固定 `1024 × 576`，绘制保持命令式；不要用响应式状态驱动每一笔。
8. 切游戏用 `router.replace`，不要改成 `push`。
9. [`README.md`](../README.md) 顶部的开发中提示行与 `<!--AI不要改上面这句话-->` 注释不得改动。
10. 项目**不保留界面截图 / 示例图片**；图片资源只放功能性素材（见 [assets.md](assets.md)）。

## 改动后的自检流程

1. `npm run build`：`vue-tsc --noEmit` + Vite 构建必须通过。
2. `npm test`：Vitest 单测全绿。
3. `npm run test:e2e`：Playwright 端到端全绿（默认复用已在跑的 dev server；需要系统 Chromium，见 [testing.md](testing.md)）。
4. 按 [testing.md](testing.md) 的手工回归清单抽查受影响项（尤其是真实触摸按住、窄屏抽屉、缺图降级、多文件下载）。
5. 同步文档：改配置形状 → [config.md](config.md)；改流程 / 类名 → 对应 `docs/games/*.md`；改样式变量或断点 → [styles.md](styles.md)；改图片规则 → [assets.md](assets.md)；改持久化 / 刷新恢复 → [persistence.md](persistence.md)；改架构 → [architecture.md](architecture.md)。
