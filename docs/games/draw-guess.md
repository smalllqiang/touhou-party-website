# 你画我猜

| 文件 | 职责 |
| --- | --- |
| [`DrawGuessView.vue`](../../src/games/draw-guess/DrawGuessView.vue) | 根组件：按 `screen` 切三个屏幕 |
| [`useDrawGuess.ts`](../../src/games/draw-guess/useDrawGuess.ts) | 全部状态、计时、阶段推进、作品保存 |
| [`SetupScreen.vue`](../../src/games/draw-guess/SetupScreen.vue) | 抽题 / 题目列表 / 选手名 / 设置卡片 |
| [`PlayScreen.vue`](../../src/games/draw-guess/PlayScreen.vue) | 计时、侧栏参考、画板、时间到遮罩 |
| [`ResultScreen.vue`](../../src/games/draw-guess/ResultScreen.vue) | 起始题目、作品列表、保存、再玩一局 |
| [`DrawingBoard.vue`](../../src/components/DrawingBoard.vue) | 画板（见 [../drawing-board.md](../drawing-board.md)） |

配置项见 [../config.md](../config.md)。

## 流程与状态机

```text
setup ──[抽 / 从题目列表点选，再点「确定」]──> play(phase=A, round=1)
                        │
                  [完成画图] → play(phase=B, round=n)
                        │
                  [完成猜词] ── round < totalRounds ──> play(phase=A, round=n+1)
                        │
                  round == totalRounds ──> result ──[再玩一局]──> setup
```

- 1 轮 = A 阶段（画图）+ B 阶段（猜词），共 `2 × rounds` 个阶段。
- 任意 play 阶段可被「结束本局」中断直接进 result。
- `screen`（`setup` / `play` / `result`）与 `phase`（`A` / `B`）共同表达状态。

## 状态（`useDrawGuess`）

| 字段 | 含义 |
| --- | --- |
| `screen` / `phase` / `round` | 当前屏幕、阶段、轮次（1 基） |
| `topic` | 本局起始题目；`null` 表示还没抽 |
| `artworks` | 已捕获作品 `{ round, phase, player, image, blank }[]` |
| `players` | `{ A, B }` 当前选手名 |
| `board` | `shallowRef<DrawingBoardApi \| null>`；离开 play 阶段后置 `null` |
| `paused` / `remaining` / `total` | 来自 `useCountdown()` |
| `locked` / `timeUpVisible` | 时间到后锁定画板、显示遮罩 |
| `transitioning` | 阶段推进防重入 |
| `inputBlockedUntil` | 「下一阶段」按钮防抖截止时间（`performance.now()` 基） |
| `spinning` / `spinText` / `popKey` | 抽题动画与 pop 重播 |

作品对象：`image` 是 PNG dataURL（`board.toDataURL()`），`blank = !board.hasInk()`。

## 抽题与题目列表

- `roll()`：从洗牌池取题 → `spinning = true` → 每 55ms 随机换一次显示文本，14 tick 后落定 → `popKey += 1`（模板用 `:key` 重挂载题目槽，重播 `.pop` 动画）+ 提示音。
- 池空时用「排除当前题后的全集」重新洗牌；手动点选会把该题从池里移除。
- 题目列表是共用组件 [`TopicPicker.vue`](../../src/components/TopicPicker.vue)：
  - `<details>` 默认折叠，列出全部题目（只列文字编号）；
  - 点一条直接把它当本题，并自动收起（防围观）；
  - 高亮由 `activeTopicIndex` 计算，不重建列表，滚动位置不丢。
- 抽题动画进行中手动点选，`pickTopic()` 先 `stopSpin()`，避免动画落定覆盖手选题。

## 计时模型

由 [`useCountdown`](../../src/composables/useCountdown.ts) 实现：

- 基准是 `performance.now()`，`deadline = now() + 秒数 * 1000`，每 100ms 计算 `remaining`；不做「每次 tick 减 0.1 秒」的累减，标签页被节流也不会漂移。
- 最后 5 个整秒各响一声；`remaining ≤ 10 && !paused` 时计时器加 `.warn`，暂停时加 `.paused`。
- 暂停：`useCountdown.pause()` 冻结剩余时间；继续时用剩余时间重算 deadline。画板通过 `paused` prop 显示遮罩。
- 时间到：`locked = true`、`board` 的 `locked` prop 生效、两声提示音 + 震动、显示 `.timeup`；`autoNextOnTimeout !== false` 时 1.6 秒后自动 `nextPhase()`。
- 时间到后点「下一步」：`requestNextPhase()` 走 `locked` 分支，不做空白检查，直接推进。

## 阶段推进

- `requestNextPhase()`：
  - `now() < inputBlockedUntil` 直接返回（进入阶段后 450ms 防双击）；
  - `locked` 时不检查空白，直接 `nextPhase()`；
  - 否则画板 `hasInk()` 为 false 时弹 `confirm('画板还是空白的，确定要进入下一阶段吗？')`，取消则不推进。
- `nextPhase()`：`transitioning` 防重入；清定时器、停计时、`captureCurrent()`，然后 A→B / 换轮 / 进结果。
- `quitGame()`：确认后直接进结果；**只有画板有笔迹时才捕获**（正常推进会把空白作品也记下来并打「空白」标签）。
- 每个阶段 `PlayScreen` 用 `:key="phase-round"` 重新挂载，保证进入新阶段是一块干净画板。

## 结果与保存

- 展示起始题目、轮数 / 选手 / 作品数摘要、作品列表（轮次、`A|B` 标签、选手名、序号、空白标记）。
- 单张：`download(image, fileNameFor(a))`；文件名 `第{round}轮-{A|B}{画图|猜词}-{player}.png`，经 `safeFileName` 清洗。
- 「保存全部作品」：按 `i * 350ms` 依次触发下载，过程中按钮禁用并显示「保存中…（若浏览器拦截，请允许多文件下载）」；最后一张完成后恢复并响一声。
- 「再玩一局（重新抽题）」清空 `artworks` / `round` / `phase` / `topic` / 池，回到 setup；**不重新读取配置、不改选手名**。

## 界面选择器（测试与样式定位）

| 屏幕 | 选择器 | 说明 |
| --- | --- | --- |
| setup | `.setup`、`.topic` | 题目槽；`is-empty` / `rolling` / `pop` 是状态类 |
| setup | `.topic-actions .btn` | 抽 / 重来 / 确定；禁用态由 `topic` 与配置量决定 |
| setup | `.topic-picker`、`.topic-pick-item`、`.is-active` | 共用题目列表 |
| setup | `#playerA` `#playerB` | 选手名输入（`maxlength=12`） |
| play | `.play-meta`、`.tag` | 轮次 / 阶段 / 选手 |
| play | `.timer`、`.timer-value`、`.timer-bar i` | 倒计时与进度条（`i.style.width` 是比例） |
| play | `#boardHost` | 画板挂载点 |
| play | `.play-actions .btn` | 暂停 / 结束本局 / 下一阶段 |
| play | `.timeup`、`.timeup .sub` | 时间到遮罩 |
| play | `.ref-img` / `.placeholder` | 参考作品有图 / 空白 |
| result | `.result-topic`、`.artwork-card`、`.blank-hint` | 结果摘要与作品卡 |
| result | `.artwork-card .btn` | 单张保存；「保存全部」在 `.result-actions` |

## 陷阱与已知行为

- `board` 只在 play 阶段有效；`PlayScreen` 卸载会 emit `board: null`。不要在 setup / result 调画板 API。
- 抽题动画会先消耗题目再滚动；滚动中可能一闪而过地显示最终题目。对 A 不是秘密，可接受。
- `inputBlockedUntil` 只在进入阶段时设置，结果页没有。
- `board.hasInk()` 在「清空后撤销」时会返回 `false` 但画面有内容，见 [../drawing-board.md](../drawing-board.md)。
- `saveAll` 的定时器登记在 `useTimers` 里；离开结果页会自动清理，不会继续触发下载。
