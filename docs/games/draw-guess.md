# 你画我猜（js/games/draw-guess.js）

导出 `window.DrawGuessGame = { mount(root) }`；`mount()` 返回 `{ destroy }`。
依赖：`window.Utils`、`window.DrawingBoard`、`window.GAME_CONFIG.drawGuess`。
配置项见 [../config.md](../config.md)。

## 流程与状态机

```
setup ──[确认抽题]──> play(phase=A, round=1)
                        │
                  [完成画图] → play(phase=B, round=n)
                        │
                  [完成猜词] ── round < totalRounds ──> play(phase=A, round=n+1)
                        │
                  round == totalRounds ──> result ──[再玩一局]──> setup
```

- 1 轮 = A 阶段（画图）+ B 阶段（猜词），共 `2 × rounds` 个阶段。
- 任意 play 阶段可被「结束本局」中断直接进 result。
- 状态机由 `state.screen`（`setup` / `play` / `result`）与 `state.phase`（`A` / `B`）共同表达。

## 状态字段（`mount()` 闭包内）

| 字段 | 含义 |
| --- | --- |
| `screen` | `setup` / `play` / `result` |
| `pool` | 未抽的题目（洗牌后的副本）；空了才重新洗牌 |
| `topic` | 本局起始题目（字符串） |
| `round` / `phase` | 当前轮次（1 基）与阶段 |
| `artworks` | 已捕获作品数组，见下 |
| `players` | `{ A, B }` 当前选手名 |
| `totalRounds` | 来自配置 |
| `board` | 当前画板实例；离开 play 阶段后置 `null` |
| `intervalId` | 计时器（`setInterval`） |
| `pending` | `later()` / `every()` 注册的定时器句柄数组，统一清理 |
| `paused` / `locked` / `transitioning` | 见下文语义 |
| `inputBlockedUntil` | 「下一阶段」按钮的防抖截止时间（`performance.now()` 基） |
| `deadline` / `remaining` / `total` | 计时模型，单位分别为 `performance.now()` 时刻与秒 |
| `lastTickSecond` | 最后 5 秒提示音的去重标记 |
| `destroyed` | `destroy()` 置位；所有定时回调先检查它 |

作品对象形状：`{ round, phase, player, image, blank }`，其中 `image` 是 PNG dataURL（`board.toDataURL()`），`blank = !board.hasInk()`。

## 关键函数

| 函数 | 职责 |
| --- | --- |
| `getConfig()` | 读取并兜底 `GAME_CONFIG.drawGuess`（每次 `mount()` 一次） |
| `drawTopic()` | 从 `pool` 取题；池空则用「排除当前题后的全集」重新洗牌 |
| `renderSetup()` | 抽题界面（抽 / 重来 / 确定、选手名输入、设置与玩法卡片） |
| `roll()` | 抽题动画：`every(55ms)` 共 14 tick 随机显示题目池文本，落定后 `pop` 动画 + 提示音 |
| `startGame()` | 清定时器、清空作品、`round=1`、`phase=A`，进入 `renderPlay()` |
| `renderPlay()` | 构建游戏界面、创建画板、绑定按钮、`startTimer()` |
| `startTimer()` / `tick()` / `paintTimer()` | 计时模型（见下） |
| `togglePause()` | 暂停 / 继续 |
| `onTimeUp()` | 时间到：锁定、提示音、震动、显示遮罩、按配置自动推进 |
| `requestNextPhase()` | 「下一阶段」入口：防抖 + 空白确认 + 推进 |
| `captureCurrent()` | 把当前画板存成作品对象并 `state.board = null` |
| `nextPhase()` | 真正的阶段推进（A→B / 换轮 / 进结果） |
| `quitGame()` | 「结束本局」：确认后直接进结果 |
| `renderResult()` | 结果页：起始题目 + 全部作品 + 保存 / 再玩一局 |
| `fileNameFor(a)` | 保存文件名：`第{round}轮-{A\|B}{画图\|猜词}-{player}.png`，经 `Utils.safeFileName` 清洗 |
| `destroy()` | 置 `destroyed`、清定时器、`board = null`、清空 `root` |

## 计时模型

- 基准是 `performance.now()`（降级 `Date.now()`），不用累加计数：`deadline = now() + total*1000`，`remaining = max(0, (deadline - now())/1000)`。
- `setInterval(tick, 100)` 单独由 `state.intervalId` 管理（不进 `pending`）；其余延时 / 周期任务一律走 `later()` / `every()` 进 `pending`。
- 最后 5 个整秒（`whole ∈ (0,5]` 且与 `lastTickSecond` 不同）各响一声 880Hz。
- `remaining ≤ 10` 且未暂停时给 `#timer` 加 `warn` 类；暂停时加 `paused` 类。
- 暂停：停止消耗（`tick()` 在 `paused` 时直接 return），继续时用 `state.remaining` 重算 `deadline`，并同步 `board.setPaused()`。
- 时间到：`stopTimer()`、`locked = true`、`board.setLocked(true)`（画板锁定并显示「时间到」遮罩）、两声提示音 + 震动、显示 `#timeup` 遮罩，遮罩里写明该阶段是谁的时间结束。
- `autoNextOnTimeout !== false` 时，遮罩里追加「约 1.6 秒后自动进入下一步…」并 `later(nextPhase, 1600)`；此时点遮罩上的「下一步」也能立刻推进（它会先 `clearPending()`）。
- `autoNextOnTimeout === false` 时停在遮罩上，等主持人点「下一步」。

## 阶段推进语义

- `requestNextPhase()`：
  - `now() < inputBlockedUntil` 直接返回（`renderPlay()` 结束时设置 `now() + 450`，防双击误触）。
  - `locked`（时间已到）时不做空白检查，直接 `nextPhase()`。
  - 否则画板 `hasInk()` 为 false 时弹 `confirm('画板还是空白的，确定要进入下一阶段吗？')`，取消则不推进。
- `nextPhase()`：`transitioning` 标志防重入；先 `clearPending()` + `stopTimer()` + `captureCurrent()`，然后：
  - `phase === 'A'` → 切 `B`，重新 `renderPlay()`；
  - `phase === 'B'` 且 `round >= totalRounds` → `renderResult()`；
  - 否则 `round += 1`、`phase = 'A'`、重新 `renderPlay()`。
- `quitGame()`：`confirm('结束本局并查看已有作品？')`；**只有画板有笔迹时才 `captureCurrent()`**（与正常推进不同：正常推进会记录空白作品并打上「空白」标签）；然后置 `transitioning = true` 并 `renderResult()`。

## 界面元素与选择器（供改动 / 测试定位）

| 阶段 | 选择器 | 说明 |
| --- | --- | --- |
| setup | `#topicSlot` `#drawBtn` `#redrawBtn` `#confirmBtn` | 抽题区；`is-empty` / `rolling` / `pop` 是状态类 |
| setup | `#playerA` `#playerB` | 选手名输入（`maxlength=12`） |
| play | `#timer` `.timer-value` `.timer-bar i` | 倒计时数字与进度条（`i` 的 `width` 是比例） |
| play | `#boardHost` | 画板挂载点（`DrawingBoard.create` 的 host） |
| play | `#pauseBtn` `#quitBtn` `#nextBtn` | 按钮文案由 `nextButtonLabel()` 决定 |
| play | `#timeup` `#timeupSub` `#timeupBtn` | 时间到遮罩（`hidden` 切换） |
| play | `[data-zoom]` | 参考图 `<img>`，点击 → `Utils.openLightbox(src)` |
| play | `.ref-img` / `.placeholder` | 参考作品有图 / 空白的两种渲染 |
| result | `#saveAllBtn` `#againBtn` | 无作品时 `#saveAllBtn` 为 `disabled` |
| result | `[data-save="<i>"]` | 单张保存按钮，`i` 是 `artworks` 下标 |
| result | `.artwork-card` / `.blank-hint` | 作品卡；无图时渲染「没有留下作品」 |

## 保存作品

- 逐张：`Utils.download(a.image, fileNameFor(a))`。
- 「保存全部作品」：按 `i * 350ms` 依次触发下载，同时把按钮文案改成「保存中…（若浏览器拦截，请允许多文件下载）」，最后一张完成后恢复原文案并响一声。按钮在过程中 `disabled = true`，防重复点击。
- 浏览器可能拦截连续多文件下载，这是已知行为，不做规避。

## 结果页与「再玩一局」

- 结果页展示：本局起始题目 `state.topic`、轮数 / 选手 / 作品数摘要、作品列表（按 `artworks` 顺序，带轮次、`A|B` 标签、选手名、序号、空白标记）。
- 「再玩一局（重新抽题）」清空 `artworks`、`round`、`phase`、`topic`、`pool` 后回到 `renderSetup()`；**不重新读取配置、不改选手名**。

## 陷阱与已知行为

- `renderSetup()` 会把 `state.board` 置 `null`；`state.board` 只在 play 阶段有效。
- `roll()` 会先消耗题目（`drawTopic()`）再滚动；滚动过程中可能一闪而过地显示最终题目，这是动画的副作用，不影响正确性（题目对 A 不是秘密）。
- `inputBlockedUntil` 只在 `renderPlay()` 里设置，`renderResult()` 里没有；在结果页连点不会误触。
- `board.hasInk()` 在「清空后撤销」时会返回 `false` 但画面有内容，这是画板组件的已知行为，见 [../drawing-board.md](../drawing-board.md)。
- `destroy()` 后再触发的定时回调都会因 `destroyed` 检查而失效。
