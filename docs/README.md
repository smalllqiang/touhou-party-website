# 技术文档索引

本目录是**面向 AI / 代码维护者**的文档：只写事实、约束、代码位置和陷阱，不写宣传语、不放截图。
人类用户的使用说明在仓库根目录 [`README.md`](../README.md)。

## 阅读约定

- 引用代码用**符号名**（函数名 / class 名 / dom id / 变量名）定位，不用行号——行号随改动漂移。
- 标「兜底」的默认值是各游戏 `getConfig()` 里的**实际**兜底值，可能与 [`js/config.js`](../js/config.js) 里当前写的值不同（例如你画我猜倒计时）。两者不一致时以代码为准。
- 标「约束」的条目是有意为之的设计决定，改动前先看 [`testing.md`](testing.md) 里对应的回归断言。
- 文档只描述**当前代码状态**；改动代码后必须同步更新本目录。

## 文档清单

| 文档 | 内容 | 什么时候读 |
| --- | --- | --- |
| [`architecture.md`](architecture.md) | 技术栈硬约束、脚本加载顺序、全局对象、DOM 契约、游戏生命周期与切换、hash 路由 | 想弄清「页面怎么跑起来的」、要接入新游戏时 |
| [`config.md`](config.md) | `js/config.js` 全部配置项：类型 / 语义 / 兜底 / 生效时机 / 陷阱 | 改题目、倒计时、人数、配图路径时 |
| [`games/draw-guess.md`](games/draw-guess.md) | 你画我猜：状态机、计时模型、阶段推进、作品保存 | 改你画我猜流程或修它的 bug |
| [`games/undercover.md`](games/undercover.md) | 谁是卧底：配置归一化、发牌、按住查看、一键翻开 | 改谁是卧底流程 |
| [`drawing-board.md`](drawing-board.md) | 画板组件 API、坐标系、笔刷/橡皮/撤销实现、DOM 选择器 | 用画板组件、改画笔行为 |
| [`styles.md`](styles.md) | `css/style.css` 章节结构、主题变量、背景图、响应式断点 | 改样式、配色、背景 |
| [`assets.md`](assets.md) | `images/` 图片资源规则（背景图、卧底配图、缺失兜底） | 加 / 换图片资源 |
| [`testing.md`](testing.md) | 冒烟测试覆盖范围、运行命令、输出格式、手工回归清单 | 改完代码要验证、要加断言 |
| [`development.md`](development.md) | 新增小游戏步骤、代码规范、必须遵守的约束 | 动手写代码前 |

## 代码地图

| 路径 | 职责 |
| --- | --- |
| [`index.html`](../index.html) | 页面骨架、lightbox、脚本加载顺序 |
| [`css/style.css`](../css/style.css) | 全部样式（单文件） |
| [`js/config.js`](../js/config.js) | 唯一配置源 → `window.GAME_CONFIG` |
| [`js/utils.js`](../js/utils.js) | `window.Utils`：DOM 选择、格式化、洗牌、转义、下载、提示音、震动、lightbox |
| [`js/drawing-board.js`](../js/drawing-board.js) | `window.DrawingBoard`：画板组件 |
| [`js/games/draw-guess.js`](../js/games/draw-guess.js) | `window.DrawGuessGame`：你画我猜 |
| [`js/games/undercover.js`](../js/games/undercover.js) | `window.UndercoverGame`：谁是卧底 |
| [`js/app.js`](../js/app.js) | 游戏注册表、导航渲染、切换、hash 路由 |
| [`tests/smoke.html`](../tests/smoke.html) | 浏览器冒烟测试 |
| [`images/`](../images/) | 背景图 + 卧底配图 |

## 关键不变量（改代码不得破坏）

1. **无构建、无依赖、无网络请求**：纯静态；`<script>` 顺序加载，靠全局对象通信。
2. **ES5 语法**：只用 `var` + `function`；不用 `let` / `const` / 箭头函数 / 模板字符串 / 模块语法（代码库现状，无转译器）。
3. 游戏模块导出 `window.XxxGame.mount(root)`，返回 `{ destroy }`；`destroy()` 必须清掉自己注册的定时器和 `window` / `document` 监听。
4. 脚本加载顺序 = 依赖顺序；新游戏脚本必须插在 [`js/app.js`](../js/app.js) 之前。
5. 配置在 **mount 时读取一次**；运行时改 `window.GAME_CONFIG` 后必须重新 mount（刷新或切走再切回）才生效。
6. 谁是卧底的**抽题不能有滚动动画**：滚动会掠过题目池里其它词 = 泄题。
7. 谁是卧底的「按住查看」按钮**不能监听 `pointerleave` / `pointerout`**：卡片翻转动画会触发假 leave，导致刚翻开就合上。
8. 谁是卧底**恰好 1 名卧底**；卡片序号 = 玩家顺序。
9. 状态只存在于 `mount()` 闭包内，不做持久化；刷新即全部重置。
10. [`README.md`](../README.md) 顶部的「开发中」提示行及其后的 `<!--AI不要改上面这句话-->` 注释不得修改或删除。

## 常见任务 → 改哪里

| 任务 | 动的地方 |
| --- | --- |
| 加 / 改题目 | `js/config.js` 的 `drawGuess.topics` / `undercover.topics`（写法见 [config.md](config.md)） |
| 改倒计时 / 轮数 / 人数 | `js/config.js`，刷新页面生效 |
| 换背景图 | `images/bg/` + `css/style.css` 的 `.content-bg`（见 [styles.md](styles.md)） |
| 给卧底词配图 | 图片放进 `images/undercover/`，文件名 = 词 + `imageExt`（见 [assets.md](assets.md)） |
| 新增小游戏 | [development.md](development.md) 的 4 步 |
| 验证改动 | 跑 `tests/smoke.html`（见 [testing.md](testing.md)） |
