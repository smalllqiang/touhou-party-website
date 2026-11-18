# 架构

改动架构（新增全局单例、改路由、改游戏注册方式、改生命周期约定）后必须同步本文件。

## 技术栈

| 项 | 事实 |
| --- | --- |
| 框架 | Vue 3.5，`<script setup>` + TypeScript（strict） |
| 构建 | Vite 7，`@vitejs/plugin-vue` |
| 路由 | `vue-router` 4，`createWebHashHistory()`（`#/draw-guess`） |
| 样式 | 单文件全局 CSS（[`src/styles/main.css`](../src/styles/main.css)），无预处理器 / UI 框架 |
| 状态管理 | 不引入 Pinia；状态放 composable 或组件内 |
| 网络请求 | 无。只加载本地静态资源（图片、构建产物） |
| 持久化 | `localStorage`，仅保存本局进度；刷新 / 切游戏 / 误关页面后可继续，见 [persistence.md](persistence.md) |
| 后端 | 无。`npm run build` 后是纯静态 `dist/` |
| 测试 | Vitest（逻辑）+ Playwright（浏览器流程），见 [testing.md](testing.md) |

## 启动流程

```text
index.html
└─ src/main.ts
   ├─ import ./styles/main.css
   ├─ createApp(App).use(router)
   └─ mount('#app')
      └─ App.vue
         ├─ 侧栏导航（来自 games/registry.ts）
         ├─ <RouterView />（当前游戏的 View 组件）
         └─ <Lightbox />（Teleport 到 body）
```

- `src/main.ts` 是唯一入口；`index.html` 只保留 `#app` 挂载点和模块脚本。
- `App.vue` 用 `route.name` 从注册表找当前游戏，驱动 `<h1>`、副标题、`document.title` 和导航高亮。**注册表的 `id` 必须与路由名一致**。
- 首次进入 `#/` 会重定向到注册表第一项；未知 hash 走 catch-all 重定向到同一项。
- 切换游戏用 `router.replace`：浏览器后退不会在游戏之间切换。

## 游戏注册与路由

[`src/games/registry.ts`](../src/games/registry.ts) 是唯一的游戏清单，`GameDefinition` 包含：

| 字段 | 用途 |
| --- | --- |
| `id` | 路由名、hash 值、注册表主键 |
| `name` / `icon` / `desc` | 侧栏导航 |
| `title` / `subtitle` | 内容区标题与副标题 |
| `component` | 游戏根组件 |

[`src/router/index.ts`](../src/router/index.ts) 直接由注册表生成路由，所以新增游戏只需要在注册表加一项，无需改路由文件。

## 组件树与状态归属

### 你画我猜

```text
DrawGuessView.vue
├─ useDrawGuess.ts          # 全部游戏状态 + 状态机
├─ SetupScreen.vue          # 抽题 / 题目列表 / 选手名
├─ PlayScreen.vue           # 计时、侧栏、画板、时间到遮罩
│  └─ DrawingBoard.vue
└─ ResultScreen.vue         # 作品列表 / 保存 / 再玩一局
```

- `useDrawGuess` 持有 `screen`、`topic`、`round`、`phase`、`artworks`、计时与锁定状态。
- `PlayScreen` 用 `:key="phase-round"` 强制重挂载：每进入一个阶段就是一块新画板，避免跨阶段残留笔迹。
- 画板通过 `@ready` 把命令式 API 交给父级，`useDrawGuess.setBoard()` 保存；`captureCurrent()` 在切阶段前调用 `toDataURL()` / `hasInk()`。
- 画板每完成一笔 / 撤销 / 清空会 emit `change`；`useDrawGuess` 节流保存当前阶段快照，刷新后由 `setBoard()` 调 `restoreImage()` 画回去。
- 阶段推进、空白确认、时间到自动下一步等规则见 [games/draw-guess.md](games/draw-guess.md)。

### 谁是卧底

```text
UndercoverView.vue
├─ useUndercover.ts         # 全部游戏状态 + 发牌逻辑
├─ SetupScreen.vue          # 抽题 / 人数 / 名字 / 题目列表
├─ RevealScreen.vue         # 发牌结果 / 一键翻开 / 横幅
│  └─ UcCard.vue            # 单张卡片 + 按住查看
```

- `useUndercover` 持有 `count`、`names`、`topicIndex`、`assignments`、`seen`、`peekIndex`、`allRevealed`；`topic` 是由下标派生的 computed。
- 卡片按住/松手通过 `UcCard` 的 pointer 事件 + `window` 捕获阶段监听实现；`window.blur` 与 `visibilitychange` 由 composable 统一挂载 / 移除。
- 详细约束见 [games/undercover.md](games/undercover.md)。

## 生命周期与定时器约定

| 场景 | 机制 |
| --- | --- |
| 延时 / 周期任务 | `useTimers()` 的 `later()` / `every()`；`onScopeDispose` 时统一清理 |
| 倒计时 | `useCountdown()`：基于 `deadline = performance.now() + 秒数 * 1000`，每 100ms 计算剩余时间；组件卸载自动停 |
| 切走游戏 | RouterView 换组件 → 组件卸载 → `useTimers` / `useCountdown` 的 scope dispose 生效；无需手写 `destroy()` |
| 画板 | 画板只活在一个阶段内；`PlayScreen` 卸载时 emit `board: null`，父级清空引用 |
| 刷新 / 关页 | composable 在 `pagehide`、`visibilitychange(hidden)`、组件卸载时补写进度；见下节 |

**不要**在组件里裸用 `setInterval` / `setTimeout` 而不登记；否则切游戏后回调仍可能执行。

## 进度持久化（localStorage）

存储层是 [`src/lib/persist.ts`](../src/lib/persist.ts)，细节（键名、数据形状、配额策略）集中在 [persistence.md](persistence.md)。

- 每个游戏 composable 在 setup 时**同步**读回本局状态并校验；坏数据 / 版本不符直接丢弃，不阻塞渲染。
- 状态变化通过 `watch(..., { deep: true })` 写入；`pagehide` / 隐藏标签页 / 卸载时额外补写「剩余时间 + 画板快照」这类高频或易丢字段。
- 画板快照单独一个键并节流 300ms：每画一笔都重写作品列表代价太大。状态写不进去（配额满）时优先删画板快照，保住阶段和作品。
- 提示音、抽题滚动动画、`peekIndex`（正在按住的卡片）等瞬时 UI 状态不持久化。
- 没有「后端同步」：换浏览器、隐私模式或清站点数据就从头开始。

## 配置读取时机

- `src/config/index.ts` 导出 `GAME_CONFIG`，被 `normalize.ts` 静态 import。
- `getDrawGuessConfig()` / `getUndercoverConfig()` 在**每个游戏 View 的 setup 时调用一次**（也就是每次进入游戏时），归一化后再使用。
- 由于 Vite 在构建期把配置打进 bundle，配置不是运行期可改的变量；dev 模式改文件会触发 HMR，生产环境需要重新构建。
- 归一化函数的兜底与类型在 [`src/config/normalize.ts`](../src/config/normalize.ts)，文档只列语义与陷阱（见 [config.md](config.md)）。

## 样式与 DOM 契约

- 组件通过 `ref` 与模板事件定位 DOM；`main.css` 的选择器全是通用类名（`.nav-item`、`.topic`、`.uc-card`…），组件目录与类名一一对应。
- 两个游戏的屏幕组件沿用同一套类名，因此样式在游戏之间复用。
- 全局状态类有 `body.nav-open`（窄屏抽屉）与 `.app.sidebar-collapsed`（宽屏侧栏收起），均由 `App.vue` 维护，CSS 负责布局与动画；收起状态同时写入 localStorage，刷新后保持。
- 交互中的展示态类：`.is-active`（导航 / 题目列表）、`.is-open` / `.is-spy`（卧底卡片）、`.is-empty` / `.rolling` / `.pop`（抽题槽）、`.is-shown` / `.is-hidden`（卧底题目槽）、`.is-locked`（画板）。

## 构建与部署

- `vite.config.ts` 设置 `base: './'`：产物可部署在域名根路径或任意子目录。
- hash 路由不需要服务器做 history fallback；静态服务器直接返回 `index.html` 即可。
- 背景图在 `src/assets/bg/`，由 Vite 处理并带哈希；卧底配图在 `public/images/undercover/`，按 URL 运行期加载。
- **不能用 `file://` 直接打开构建产物**：模块脚本会被 CORS 拦截。用 `npm run preview` 或任意静态服务器（见 [README](../README.md)）。

## 已知取舍

- **没有 SSR**：这是线下聚会用的单页工具，SEO / 首屏内容不是目标。
- **没有 Pinia**：两个游戏的状态互不共享，composable 足够；引入全局 store 只会增加一层间接。
- **配置是构建期常量**：换来类型检查与更简单的代码；代价是改配置后生产产物要重新构建。
- **进度存在 localStorage**：受 5MB 配额限制，作品图片是 dataURL；配额写满时降级为「不保存画板快照，尽量保住阶段与作品」。换浏览器 / 清站点数据会丢进度，这是纯静态、无后端的必然取舍。
- **图片体积**：`public/images/undercover/` 目前约 24MB PNG，构建时会原样复制。手机局域网首次加载可能偏慢，转 WebP 是后续可做的优化，不影响当前架构。
- **没有错误边界**：任一模块抛错会由 Vue 冒泡；`main.ts` 没有兜底 UI。纯静态工具站可接受。
