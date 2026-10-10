# 架构

改动架构（新增全局、改加载顺序、改 DOM 契约、改路由）后必须同步本文件。

## 技术栈与硬约束

| 项 | 事实 |
| --- | --- |
| 语言 | 原生 HTML / CSS / JavaScript，**ES5 语法**（`var` + `function`） |
| 构建 | 无。没有 `package.json`、打包器、转译器 |
| 依赖 | 无。不引入第三方库 / CDN |
| 模块系统 | 无。IIFE + `window` 全局对象通信 |
| 网络请求 | 无（未使用 `fetch` / `XMLHttpRequest`）；只加载本地静态资源，主要是图片 |
| 持久化 | 无（未使用 `localStorage` / `sessionStorage` / cookie）。刷新 = 状态全部重置 |
| 后端 | 无。`file://` 直开或任意静态服务器均可运行 |
| 测试 | 浏览器内自跑，见 [testing.md](testing.md) |

## 文件与职责

| 路径 | 职责 |
| --- | --- |
| [`index.html`](../index.html) | 页面骨架：左侧导航 + 右侧内容区 + lightbox + 脚本加载 |
| [`css/style.css`](../css/style.css) | 全部样式（单文件，见 [styles.md](styles.md)） |
| [`js/config.js`](../js/config.js) | 唯一配置源，赋值 `window.GAME_CONFIG`（见 [config.md](config.md)） |
| [`js/utils.js`](../js/utils.js) | `window.Utils` 通用工具 |
| [`js/drawing-board.js`](../js/drawing-board.js) | `window.DrawingBoard` 画板组件（见 [drawing-board.md](drawing-board.md)） |
| [`js/games/draw-guess.js`](../js/games/draw-guess.js) | `window.DrawGuessGame`（见 [games/draw-guess.md](games/draw-guess.md)） |
| [`js/games/undercover.js`](../js/games/undercover.js) | `window.UndercoverGame`（见 [games/undercover.md](games/undercover.md)） |
| [`js/app.js`](../js/app.js) | 游戏注册表、导航渲染、游戏切换、hash 路由 |
| [`tests/smoke.html`](../tests/smoke.html) | 冒烟测试页 |
| [`images/`](../images/) | 静态图片（见 [assets.md](assets.md)） |

## 脚本加载顺序（index.html 末尾）

```
js/config.js
→ js/utils.js
→ js/drawing-board.js
→ js/games/draw-guess.js
→ js/games/undercover.js
→ js/app.js
```

- 顺序即依赖顺序：后加载的脚本在**顶层**就读取前面的全局对象。
- `js/app.js` 加载时会立即 `open()` 首个游戏，**必须最后加载**。
- 新游戏脚本必须插在 `js/app.js` 之前；它依赖的组件（如画板）必须排在它之前。

## 全局对象契约

| 全局 | 形状 / API | 说明 |
| --- | --- | --- |
| `window.GAME_CONFIG` | `{ drawGuess: {...}, undercover: {...} }` | 整体直接赋值（非合并）；缺失 / 非法的段由各游戏 `getConfig()` 兜底 |
| `window.Utils` | 见下 | 无状态纯函数集合（内部缓存 AudioContext 与 lightbox 事件绑定） |
| `window.DrawingBoard` | `{ create(host, options), WIDTH, HEIGHT }` | 画板工厂 |
| `window.DrawGuessGame` | `{ mount(root) → { destroy } }` | 你画我猜 |
| `window.UndercoverGame` | `{ mount(root) → { destroy } }` | 谁是卧底 |

`window.Utils` 导出：`qs`、`qsa`、`formatTime`、`shuffle`、`escapeHtml`、`safeFileName`、`download`、`beep`、`vibrate`、`openLightbox`、`closeLightbox`。

其中 `beep(freq, durationMs, volume)` 用 WebAudio 现场合成（无音频文件），`vibrate(pattern)` 依赖 `navigator.vibrate`，两者在不可用环境下静默失败（不抛错）。

## DOM 契约（由 index.html 提供，js/app.js 依赖）

| 选择器 | 用途 | 缺失时的行为 |
| --- | --- | --- |
| `#nav` | 左侧游戏列表容器，`renderNav()` 重写其 `innerHTML` | `app.js` 抛错 |
| `#view` | 右侧游戏挂载点（`mount(root)` 收到它） | `app.js` 抛错 |
| `#pageTitle` / `#pageSubtitle` | 内容区标题 / 副标题 | 抛错 |
| `#menuBtn` / `#backdrop` | 窄屏抽屉开关 / 遮罩 | 有 null 判断，安全跳过 |
| `#lightbox` / `#lightboxImg` | 图片放大层（`Utils.openLightbox` 使用） | 安全返回，不放大 |
| `body.nav-open` | 窄屏抽屉打开状态（纯 CSS 控制） | — |

`tests/smoke.html` 复刻了同一套骨架选择器（`#nav`、`#view`、`#pageTitle`、`#pageSubtitle`、`#menuBtn`、`#backdrop`、`#lightbox`、`#lightboxImg`）。改 `index.html` 骨架时必须同步改测试页，否则冒烟测试失败。

## 游戏注册表（js/app.js 的 `GAMES`）

数组，每项字段：

| 字段 | 类型 | 用途 |
| --- | --- | --- |
| `id` | string | 唯一 id，同时是 URL hash 值（`#/<id>`） |
| `name` | string | 导航项名称、`document.title` 前缀 |
| `icon` | string | 导航图标（emoji） |
| `desc` | string | 导航项副标题 |
| `title` | string | 内容区 `<h1>` 文本 |
| `subtitle` | string | 内容区副标题文本 |
| `mount` | `(host) => ({ destroy })` | 挂载函数，通常转发到 `window.XxxGame.mount` |

## 启动与切换流程

1. **启动**：`js/app.js` 执行 → 从 `location.hash` 去掉 `#/` 得到初始 id，空则用 `GAMES[0].id` → `open(id)`。
2. **`open(id)` 的执行顺序**（有依赖，勿调整）：
   1. 上一个实例 `current.destroy()`，然后 `current = null`
   2. `#view.innerHTML = ''`
   3. 写 `#pageTitle`、`#pageSubtitle`、`document.title`
   4. `current = game.mount(#view) || {}`
   5. `renderNav(game.id)`：重建导航并给当前项加 `.is-active`
   6. 同步 hash：`history.replaceState(null, '', '#/' + id)`，失败则退化为写 `location.hash`
   - `id` 未知时回退到 `GAMES[0]`。
3. **hashchange**：`location.hash` 去掉 `#/` 后非空则 `open(id)`。
4. **窄屏抽屉**：`#menuBtn` 切换 `body.nav-open`；`#backdrop` 点击、按 `Esc`、点击任一导航项都会移除该类。

## 生命周期与状态归属

- 每个游戏的**全部状态都在 `mount()` 闭包内**；游戏之间不共享状态，也不挂到全局。
- 组件实例挂在游戏状态里（你画我猜用 `state.board`）。
- **配置读取时机**：`getConfig()` 只在每次 `mount()` 时执行一次。运行时改 `window.GAME_CONFIG` 后必须重新 mount（刷新，或切走再切回该游戏）才生效——冒烟测试正是用「改配置 + 重新点击导航项」验证这一点。
- `destroy()` 的约定职责：清掉本实例注册的全部定时器、移除注册在 `window` / `document` 上的监听、清空自己写进 `host` 的 DOM。两个现有游戏都实现了。
- 「再玩一局」（你画我猜）与「返回设置 / 换一题重发」（谁是卧底）只在同一实例内换屏，**不重新读取配置**。

## 已知取舍

- hash 只标记当前游戏，用 `replaceState` 而非 push：浏览器后退不会在游戏之间切换。
- 没有错误边界：任一脚本抛错（例如 `js/config.js` 语法错误）会导致 `js/app.js` 不执行，页面停在没有游戏的空壳状态。
