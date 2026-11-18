# 样式（src/styles/main.css）

单文件全局样式表，约 1600 行，**无预处理器、无 CSS 框架、无 scoped**。规则按下面的章节顺序书写，新增样式请追加到对应章节末尾，不要打乱顺序。

## 章节顺序

| 章节注释 | 内容 |
| --- | --- |
| `:root` 变量 | 颜色 / 玻璃 / 圆角 / 阴影 / 侧栏宽度 |
| 基础重置 | `*`、`body`、滚动条等 |
| 整体两栏布局 | `.app`（flex：`.sidebar` + `.content`） |
| 右侧背景图 | `.content-bg`（`position: fixed`）+ `.content-bg::after`（暗化层） |
| 左侧导航栏 | `.sidebar`、`.brand*`、`.nav`、`.nav-item`、`.sidebar-footer` |
| 右侧内容区 | `.content`、`.content-header`、`.content-body`、`.page-subtitle` |
| 通用元件 | `.btn`（`primary` / `blue` / `ghost` / `small` / `danger`）、`.card`、`.panel`、`.tag`（`.a` / `.b`）、`.topic*`、`.topic-picker*`、`.settings-list`、`.hint`、`.muted`、`.eyebrow` |
| 你画我猜 —— 抽题界面 | `.setup`、`.topic-stage`、`.setup-grid`、`.rolling` / `.pop` 动画 |
| 你画我猜 —— 画板 | `.board*`、`.swatch`、`.size-control`、`.size-preview`、`.tool-btn` |
| 你画我猜 —— 游戏界面 | `.play*`、`.timer*`、`.timeup*` |
| 你画我猜 —— 结果页 | `.result*`、`.artworks`、`.artwork-card` |
| 谁是卧底 | `.uc-*`（设置 / 人数与名字 / 发牌 / 卡片 / 横幅） |
| 响应式 | `@media (prefers-reduced-motion)`、`(max-width: 1100px)`、`(max-width: 820px)` |

class 命名约定：谁是卧底专属一律 `uc-` 前缀；画板一律 `board` 前缀；其余为通用或你画我猜。跨游戏复用的元件用通用名（如 `.topic-picker*`、`.topic-pick-*`），**不**带 `dg-` / `uc-` 前缀。

## 主题变量（`:root`）

改配色只改这里，不要在规则里写死颜色。

| 变量 | 用途 |
| --- | --- |
| `--bg` | 页面兜底底色 |
| `--sky-deep` | 右侧内容区兜底底色（背景图未加载时可见） |
| `--ink` / `--ink-soft` / `--muted` | 主 / 次级 / 弱化文字 |
| `--line` | 边框、分隔线 |
| `--glass` / `--glass-solid` / `--glass-soft` / `--glass-hover` | 玻璃面板背景的四档 |
| `--blur` | 面板 `backdrop-filter` 值 |
| `--accent` / `--accent-ink` / `--accent-soft` | 强调色（枫叶粉） |
| `--blue` / `--blue-soft` | 次强调色（月光蓝） |
| `--green` | 成功态文字色 |
| `--sidebar-bg` / `--sidebar-bg-2` / `--sidebar-ink` / `--sidebar-w` | 侧栏渐变两端、文字、宽度（`248px`） |
| `--radius` / `--radius-sm` | 圆角 |
| `--shadow` / `--shadow-sm` | 阴影 |

## 背景图

```css
.content-bg {
  position: fixed;            /* 固定视口，页面滚动时背景不动 */
  left: var(--sidebar-w);     /* 只覆盖侧栏右边那一块；窄屏断点里改为 0 */
  background-image: url("../assets/bg/night-sky.jpg");                       /* 兜底 */
  background-image: image-set(url("../assets/bg/night-sky.webp") type("image/webp"));
  background-size: cover;
  background-position: center bottom;
}
```

- 背景图放在 `src/assets/bg/`，由 Vite 打包并加哈希；路径相对 `src/styles/`（`../assets/bg/...`）。
- 源图是**竖构图**（2480 × 3508），宽屏用 `center bottom` 保留鸟居 + 晚霞；窄屏几乎不裁切。换图时保持相近宽高比。
- `.content-bg::after` 是盖在背景上的暗化层（左右 / 径向 / 上下三段渐变），面板文字可读性全靠它。换更亮的背景图时，调高这几处 `rgba()` 的 alpha。
- 资源规则见 [assets.md](assets.md)。

## 局部换肤技巧（重要约定）

需要在「浅底」容器里显示深色文字时，**不要**新增一套颜色变量，而是在该容器上重新声明同名变量，让内部规则自动跟随：

```css
.size-preview { --ink: #1c2130; }   /* 粗细预览圆点画在白色画布上 */
.uc-card-back  { --ink: #1c2130; --ink-soft: #4b5568; --muted: #78829c; --line: #e2e6f2; }
```

## 你画我猜 · 画图界面（全屏画板 + 悬浮 HUD）

- `.content-body:has(.play)` 去掉内边距并 `overflow: hidden`，`.play` 用 `position: absolute; inset: 0` 正好铺满内容区。
- `.play-board`、`.play .board`、`.play .board-canvas-wrap` 全部 `inset: 0`；canvas `width / height: 100%`。内部分辨率仍是 `1024 × 576`，指针坐标按外框比例映射，所以屏幕上的笔迹始终跟着光标。
- `.play-hud` 是 `pointer-events: none` 的叠层；只有 `.play-top`、`.play-side`、`.play .board-toolbar` 等具体控件恢复 `auto`，空白处仍然可以画。
- 层级：画板 canvas < 画板工具栏（`z-index: 3`）< HUD（`z-index: 5`）< 时间到弹窗 `.timeup`（`z-index: 60`）。
- 参考面板 `.play-side` 靠右悬浮，画板工具栏在底部居中；顶栏的「收起参考 / 参考 / 说明」按钮可随时显隐参考面板。

## 响应式断点

| 断点 | 变化 |
| --- | --- |
| `max-width: 1100px` | `.play-side` 收窄到 240px；HUD 底部留白加大，给换行的画板工具栏让位 |
| `max-width: 820px` | 侧栏变抽屉：`.sidebar` `position: fixed` + `translateX(-100%)`，`body.nav-open .sidebar` 滑入，`body.nav-open .backdrop` 显示；`.content-bg { left: 0 }` 铺满视口；`.play-top` 收窄、操作按钮独占一行；画板工具栏贴底换行、色块缩小 |
| `prefers-reduced-motion: reduce` | 关闭卡片翻转过渡与 `pop` 等动画 |

抽屉状态类 `body.nav-open` 由 [`App.vue`](../src/App.vue) 维护（`navOpen` ref → class），样式只负责表现。

## 动画

`@keyframes pop`（抽题落定的弹入）与 `@keyframes pulse`（计时告警等）。新增动画时同步在 `prefers-reduced-motion` 块里关闭。

## 陷阱

- 硬编码颜色会让两个游戏与侧栏脱节；一律走变量。
- `.content-bg` 的 `left: var(--sidebar-w)` 与侧栏宽度**强耦合**：改 `--sidebar-w` 时检查是否有写死 `248px` 的地方。
- 画板内部分辨率固定 `1024 × 576`（见 [drawing-board.md](drawing-board.md)）；CSS 把它拉伸到内容区的实际宽高比。指针坐标按外框比例映射，屏幕上的笔迹严格跟随光标；但导出的 PNG 仍是 `1024 × 576`，宽高比不同时作品相对手势会轻微拉伸。
- 弹窗 / 遮罩用 `--glass-solid` 而不是 `--glass`，否则背后内容会透出来。
- 组件不加 scoped style：所有类名是全局契约，改名会同时影响样式和端到端选择器。
