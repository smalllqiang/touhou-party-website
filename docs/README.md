# 技术文档索引

本目录是**面向 AI / 代码维护者**的文档：只写结构、约束、代码位置和陷阱，不复述实现细节。函数怎么算、字段有哪些，以源码与类型为准（见各文档里的入口链接）。
人类用户的使用说明在仓库根目录 [`README.md`](../README.md)。

## 阅读约定

- 引用代码用**路径 + 符号名**定位，不用行号——行号随改动漂移。
- 标「约束」的条目是有意为之的设计决定，改动前先看对应回归断言（见 [testing.md](testing.md)）。
- 文档只描述**当前代码状态**；改动后必须同步本目录，过期内容直接替换或删除。

## 文档清单

| 文档 | 内容 | 什么时候读 |
| --- | --- | --- |
| [`architecture.md`](architecture.md) | 技术栈、启动流程、路由、组件树、状态归属、构建与部署、已知取舍 | 想弄清「页面怎么跑起来的」、要接入新游戏时 |
| [`config.md`](config.md) | `src/config/index.ts`、配置类型与兜底、题目写法、配图路径、生效时机 | 改题目、倒计时、人数、配图路径时 |
| [`games/draw-guess.md`](games/draw-guess.md) | 你画我猜：组件拆分、状态机、计时模型、作品保存 | 改你画我猜流程或修它的 bug |
| [`games/undercover.md`](games/undercover.md) | 谁是卧底：配置归一化、发牌、按住查看、一键翻开 | 改谁是卧底流程 |
| [`drawing-board.md`](drawing-board.md) | 画板组件 props / expose、坐标系、撤销、锁定与暂停 | 用画板组件、改画笔行为 |
| [`styles.md`](styles.md) | `src/styles/main.css` 章节结构、主题变量、背景图、响应式断点 | 改样式、配色、背景 |
| [`assets.md`](assets.md) | 背景图与卧底配图的位置、命名、缺图降级 | 加 / 换图片资源 |
| [`testing.md`](testing.md) | 单测与端到端测试的覆盖范围、运行命令、手工回归清单 | 改完代码要验证、要加断言 |
| [`development.md`](development.md) | 新增小游戏步骤、代码规范、必须遵守的约束、自检流程 | 动手写代码前 |

## 代码地图

| 路径 | 职责 |
| --- | --- |
| [`src/main.ts`](../src/main.ts) | 创建 Vue 应用、挂路由、引入全局样式 |
| [`src/App.vue`](../src/App.vue) | 应用外壳：侧栏、导航、标题、窄屏抽屉、lightbox |
| [`src/router/index.ts`](../src/router/index.ts) | hash 路由：`#/draw-guess`、`#/undercover`，未知路径回退到首个游戏 |
| [`src/games/registry.ts`](../src/games/registry.ts) | 游戏注册表：路由名、导航文案、标题、组件；新增游戏只改这里 |
| [`src/games/draw-guess/`](../src/games/draw-guess/) | 你画我猜：`DrawGuessView.vue` + `useDrawGuess.ts` + 三个屏幕组件 |
| [`src/games/undercover/`](../src/games/undercover/) | 谁是卧底：`UndercoverView.vue` + `useUndercover.ts` + 设置 / 发牌屏幕 |
| [`src/components/DrawingBoard.vue`](../src/components/DrawingBoard.vue) | 画板：canvas 命令式绘制 + Vue 工具栏 |
| [`src/components/TopicPicker.vue`](../src/components/TopicPicker.vue) | 两个游戏共用的折叠题目列表 |
| [`src/components/Lightbox.vue`](../src/components/Lightbox.vue) | 全局图片放大层 |
| [`src/composables/`](../src/composables/) | `useCountdown` / `useTimers` / `useLightbox` |
| [`src/config/index.ts`](../src/config/index.ts) | 唯一配置源 |
| [`src/config/normalize.ts`](../src/config/normalize.ts) | 配置归一化与兜底（类型也在这里） |
| [`src/lib/`](../src/lib/) | 通用工具、资源 URL、画板 API 类型 |
| [`src/styles/main.css`](../src/styles/main.css) | 全部样式（单文件全局样式） |
| [`public/images/undercover/`](../public/images/undercover/) | 卧底配图（不参与打包，按 URL 运行期加载） |
| [`src/assets/bg/`](../src/assets/bg/) | 内容区背景图（随构建打包、带哈希） |
| [`tests/unit/`](../tests/unit/) | Vitest 单元测试 |
| [`tests/e2e/`](../tests/e2e/) | Playwright 端到端测试 |

## 关键不变量（改代码不得破坏）

1. **纯静态、无网络请求、无持久化**：构建产物放到静态服务器即可运行；不引入后端、API、`localStorage`。
2. **配置是构建期模块**：`src/config/index.ts` 被静态 import；改配置靠 dev server 的 HMR 或重新 `npm run build` 生效，运行期没有全局配置对象可改。
3. **状态不持久化**：刷新页面 = 全部重置；游戏状态只存在于组件 / composable 中。
4. 谁是卧底的**抽题不能有滚动动画**：滚动会掠过题目池里其它词 = 泄题。
5. 谁是卧底的「按住查看」按钮**不能监听 `pointerleave` / `pointerout`**：卡片翻转动画会触发假 leave，导致刚翻开就合上。
6. 谁是卧底**恰好 1 名卧底**；卡片序号 = 玩家顺序。
7. 画板 canvas 内部分辨率固定 `1024 × 576`，由命令式代码绘制；**不要**把笔迹状态塞进 Vue 响应式，否则每帧都会触发重渲染。
8. 路由用 `router.replace` 切换游戏：浏览器后退不会在游戏之间来回跳。
9. [`README.md`](../README.md) 顶部的「开发中」提示行及其后的 `<!--AI不要改上面这句话-->` 注释不得修改或删除。
10. 不保留界面截图 / 示例图片；图片资源只放功能性素材（见 [assets.md](assets.md)）。

## 常见任务 → 改哪里

| 任务 | 动的地方 |
| --- | --- |
| 加 / 改题目 | `src/config/index.ts` 的 `drawGuess.topics` / `undercover.topics`（写法见 [config.md](config.md)） |
| 改倒计时 / 轮数 / 人数 | 同上；dev 模式保存即生效，构建产物需重新 build |
| 改题目列表 / 手动指定题目 | 共用 [`TopicPicker.vue`](../src/components/TopicPicker.vue)；样式在 `src/styles/main.css` 的「通用元件」 |
| 换背景图 | `src/assets/bg/` + `.content-bg`（见 [styles.md](styles.md)） |
| 给卧底词配图 | 图片放进 `public/images/undercover/`，文件名 = 词 + `imageExt`（见 [assets.md](assets.md)） |
| 新增小游戏 | [development.md](development.md) 的步骤 |
| 验证改动 | `npm run build` + `npm test` + `npm run test:e2e`（见 [testing.md](testing.md)） |
