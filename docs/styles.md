# 样式（css/style.css）

单文件样式表，约 1600 行，**无预处理器、无构建、无 CSS 框架**。所有规则按以下顺序书写，新增样式请追加到对应章节末尾，不要打乱顺序。

## 章节顺序

| 章节注释 | 内容 |
| --- | --- |
| `:root` 变量 | 颜色 / 玻璃 / 圆角 / 阴影 / 侧栏宽度 |
| 基础重置 | `*`、`body`、滚动条等 |
| 整体两栏布局 | `.app`（flex：`.sidebar` + `.content`） |
| 右侧背景图 | `.content-bg`（`position: fixed`）+ `.content-bg::after`（暗化层） |
| 左侧导航栏 | `.sidebar`、`.brand*`、`.nav`、`.nav-item`、`.sidebar-footer` |
| 右侧内容区 | `.content`、`.content-header`、`.content-body`、`.page-subtitle` |
| 通用元件 | `.btn`（`primary` / `blue` / `ghost` / `small` / `danger`）、`.card`、`.panel`、`.tag`（`.a` / `.b`）、`.topic*`、`.settings-list`、`.hint`、`.muted`、`.eyebrow` |
| 你画我猜 —— 抽题界面 | `.setup`、`.topic-stage`、`.setup-grid`、`.rolling` / `.pop` 动画 |
| 你画我猜 —— 画板 | `.board*`、`.swatch`、`.size-control`、`.size-preview`、`.tool-btn` |
| 你画我猜 —— 游戏界面 | `.play*`、`.timer*`、`.timeup*` |
| 你画我猜 —— 结果页 | `.result*`、`.artworks`、`.artwork-card` |
| 谁是卧底 | `.uc-*`（设置 / 题目列表 / 人数与名字 / 发牌 / 卡片 / 横幅） |
| 响应式 | `@media (prefers-reduced-motion)`、`(max-width: 1100px)`、`(max-width: 820px)` |

class 命名约定：谁是卧底专属一律 `uc-` 前缀；画板一律 `board` 前缀；其余为通用或你画我猜。

## 主题变量（`:root`）

改配色只改这里，不要在规则里写死颜色。

| 变量 | 用途 |
| --- | --- |
| `--bg` | 页面兜底底色 |
| `--sky-deep` | 右侧内容区兜底底色（背景图未加载时可见） |
| `--ink` / `--ink-soft` / `--muted` | 主 / 次级 / 弱化文字 |
| `--line` | 边框、分隔线 |
| `--glass` / `--glass-solid` / `--glass-soft` / `--glass-hover` | 玻璃面板背景的四档（常规 / 需要挡住背景 / 浅色块 / hover） |
| `--blur` | 面板 `backdrop-filter` 值 |
| `--accent` / `--accent-ink` / `--accent-soft` | 强调色（枫叶粉）：主色 / 深底上的亮文字 / 半透明底 |
| `--blue` / `--blue-soft` | 次强调色（月光蓝） |
| `--green` | 成功态文字色 |
| `--sidebar-bg` / `--sidebar-bg-2` / `--sidebar-ink` / `--sidebar-w` | 侧栏渐变两端、侧栏文字、侧栏宽度（`248px`，布局与背景图偏移都依赖它） |
| `--radius` / `--radius-sm` | 圆角 |
| `--shadow` / `--shadow-sm` | 阴影 |

## 背景图

```css
.content-bg {
  position: fixed;            /* 固定视口，页面滚动时背景不动 */
  left: var(--sidebar-w);     /* 只覆盖侧栏右边那一块；窄屏断点里改为 0 */
  background-image: url("../images/bg/night-sky.jpg");                       /* 兜底 */
  background-image: image-set(url("../images/bg/night-sky.webp") type("image/webp"));
  background-size: cover;
  background-position: center bottom;   /* 宽屏裁掉上下，留住画面下半部分 */
}
```

- 路径相对 `css/` 目录（`../images/bg/...`），不是相对页面。
- 源图是**竖构图**（2480 × 3508），宽屏用 `center bottom` 保留鸟居 + 晚霞；窄屏几乎不裁切。换图时保持相近宽高比，否则构图会被裁掉。
- `.content-bg::after` 是盖在背景上的暗化层（左右 / 径向 / 上下三段渐变），面板文字可读性全靠它。换更亮的背景图时，调高这几处 `rgba()` 的 alpha。
- 背景资源与替换方法见 [assets.md](assets.md)。

## 局部换肤技巧（重要约定）

需要在「浅底」容器里显示深色文字时，**不要**新增一套颜色变量，而是在该容器上重新声明同名变量，让内部规则自动跟随：

```css
.size-preview { --ink: #1c2130; }   /* 粗细预览圆点画在白色画布上 */
.uc-card-back  { --ink: #1c2130; --ink-soft: #4b5568; --muted: #78829c; --line: #e2e6f2; }
```

新增浅底容器请沿用该做法（见 `css/style.css` 中这两处的注释）。

## 响应式断点

| 断点 | 变化 |
| --- | --- |
| `max-width: 1100px` | `.play-body` 变单列；`.play-side` 改为横向换行（面板 `flex: 1 1 260px`） |
| `max-width: 820px` | 侧栏变抽屉：`.sidebar` `position: fixed` + `translateX(-100%)`，`body.nav-open .sidebar` 滑入，`body.nav-open .backdrop` 显示；`.content-bg { left: 0 }` 铺满视口；画板工具栏换行、卡片网格缩小 |
| `prefers-reduced-motion: reduce` | 关闭卡片翻转过渡与 `.uc-card-seen` / `.uc-banner` 的动画 |

抽屉开关的状态类由 [`js/app.js`](../js/app.js) 维护（`body.nav-open`），样式只负责表现。

## 动画

`@keyframes pop`（抽题落定的弹入）与 `@keyframes pulse`（计时告警等）。新增动画时同步在 `prefers-reduced-motion` 块里关闭。

## 陷阱

- 硬编码颜色会让你画我猜 / 谁是卧底的配色与侧栏脱节；一律走变量。
- `.content-bg` 的 `left: var(--sidebar-w)` 与侧栏宽度**强耦合**：改 `--sidebar-w` 时，背景图偏移自动跟随，但任何写死 `248px` 的地方需要一起改。
- 画板内部分辨率固定 `1024 × 576`（见 [drawing-board.md](drawing-board.md)）；CSS 只控制显示尺寸，改动宽高比会让笔迹变形（光标坐标按外框比例映射）。
- 弹窗 / 遮罩用 `--glass-solid` 而不是 `--glass`，否则背后内容会透出来。
