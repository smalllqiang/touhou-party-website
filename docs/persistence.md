# 本局进度持久化

目标：**刷新页面、切走游戏、误关标签页后，本局进度不重置**。这是纯前端方案，进度只存在当前浏览器的 `localStorage` 里；没有账号、没有服务器同步，换浏览器 / 清站点数据就从零开始。

存储层与键名集中在 [`src/lib/persist.ts`](../src/lib/persist.ts)，各游戏的读写与校验在对应 composable 里。

## 键与版本

所有键都带前缀 `touhou-party:v1:`，每份数据带 `v: PERSIST_VERSION`。版本不符、JSON 损坏、结构校验失败的条目会被**静默删除**并当作没有进度。

| `STORAGE_KEYS` | 实际键 | 内容 |
| --- | --- | --- |
| `drawGuess` | `touhou-party:v1:draw-guess:state` | 你画我猜的阶段、题目、选手、作品、抽题池、剩余时间 |
| `drawGuessBoard` | `touhou-party:v1:draw-guess:board` | 当前阶段的画板快照（单独一个键） |
| `undercover` | `touhou-party:v1:undercover:state` | 谁是卧底的人数、名字、题目下标、发牌、查看状态 |

## 数据形状

字段以源码里的 `SavedState` / `SavedBoard` 类型为准（`useDrawGuess.ts` / `useUndercover.ts`），这里列语义：

| 游戏 | 持久化 | 不持久化 |
| --- | --- | --- |
| 你画我猜 | `screen` / `topic` / `players` / `round` / `phase` / `artworks` / `pool` / `remaining` / `paused` / `locked` / `timeUpVisible` | 抽题滚动动画、`popKey`、锁定输入防抖、正在进行的 pointer |
| 你画我猜 · 画板 | `round` / `phase` / `image`（PNG dataURL）/ `inked` | 撤销栈、当前颜色 / 粗细 / 工具 |
| 谁是卧底 | `screen` / `count` / `names` / `topicIndex` / `topicVisible` / `spyIndex` / `seen` / `allRevealed` / `pool` | `peekIndex`（正在按住的卡片）、卡片图片加载失败标记 |

- 谁是卧底的题目存**下标**而不是词对象：配置每次挂载都会重新归一化，按下标才能稳定对上同一组词；发牌结果恢复时按 `topicIndex` + `spyIndex` 重建，不信任存储里的词。
- 抽题池：你画我猜存题目字符串；谁是卧底存题目下标。两者都过滤掉配置里已不存在的项，避免配置改动后抽题崩掉。

## 写入与恢复时机

```text
composable setup
└─ readStored(key, parse)      // 同步读取；坏数据直接丢弃
   └─ 校验 screen / round / phase / 下标 / dataURL 前缀
      └─ 写入 refs

状态变化
└─ watch(..., { deep: true })  // 低频字段
   + pagehide / visibilitychange(hidden) / 组件卸载
     └─ persistAllNow()        // 补写 remaining、paused、locked 与画板快照

画板
└─ DrawingBoard emit change（抬笔 / 撤销 / 清空）
   └─ useDrawGuess 节流 300ms 写入 drawGuessBoard
      └─ 刷新后 setBoard(api) → api.restoreImage(image, inked)
```

- 倒计时只有 `remaining` 变化，不触发 watch；靠切后台 / 卸载 / 暂停时补写。恢复时 `useCountdown.restore(remaining, total, paused)` 保留本阶段原始时长，进度条不会突然变满。
- **已经时间到**（`locked`）时刷新：恢复「时间到」遮罩，但**不会**重新排 1.6 秒自动跳转，需要主持人点「下一步」。这是有意为之，避免刷新把作品直接跳过去。
- 画板快照带 `round` + `phase`；只恢复到同一个阶段，切阶段时旧快照会被删掉。
- 正常切阶段（`captureCurrent()`）、进结果页、`again()` 都会主动删除画板键，不会把上一阶段的笔迹带进新画板。

## 配额与降级

- `localStorage` 通常只有约 5MB；作品是 1024×576 PNG dataURL，画得多时可能写不进去。
- [`writeStored`](../src/lib/persist.ts) 写失败时：先在控制台 `warn` 一次（不是 `error`），然后 `persistState` **删掉画板快照再重试**——优先保住阶段和作品，牺牲还能重画的当前画板。
- `localStorage` 被禁用 / 隐私模式抛错时，退回模块内存：当前页面还能用，刷新后丢。
- 没有「存储已满」的界面提示；出现问题时以控制台 warn 为准。

## 重置

没有专门的「清除进度」按钮。正常流程已经覆盖：

- 你画我猜：结果页「再玩一局（重新抽题）」会清空作品、回到设置页并写回新状态。
- 谁是卧底：发牌页「返回设置」后重新抽题 / 发牌。
- 开发或想彻底重来：在浏览器 DevTools → Application → Local Storage 删除 `touhou-party:v1:*`，或执行 `clearAllStored()`（[`src/lib/persist.ts`](../src/lib/persist.ts)）。

## 新增游戏时怎么接

1. 在 [`src/lib/persist.ts`](../src/lib/persist.ts) 的 `STORAGE_KEYS` 加一个键。
2. 在 composable 里定义 `SavedState` 和 `parseState(data)`（返回 `null` 表示丢弃）。
3. setup 时 `readStored(key, parseState)` 并逐个字段恢复；坏数据回退到默认设置页。
4. 用 `watch` + `pagehide` / `visibilitychange` / `onBeforeUnmount` 写入。
5. 如果游戏有画板或其它大字段，单独拆键并节流，不要把整份状态每次重写。
6. 单测里靠 [`tests/unit/setup.ts`](../tests/unit/setup.ts) 在每个用例前清空 `localStorage`；新用例至少覆盖「写入后重新挂载能恢复」和「坏数据不会崩」。

## 陷阱

- **不要持久化正在按住 / 正在输入中的临时状态**（`peekIndex`、pointer capture）。刷新后应回到安全状态。
- 恢复的数据一定要校验：`round` 不能超过配置轮数、`phase` 只能是 `A` / `B`、图片必须是 `data:image/` 开头、题目下标必须存在。
- `watch` 里不要直接改回被持久化的 ref，否则会自触发循环；写入是单向副作用。
- 服务端渲染 / `window` 不存在时，`persist.ts` 会退回内存；不要直接 `localStorage.getItem`。
- 卸载时写入依赖「父组件的 `onBeforeUnmount` 早于子组件」这一 Vue 顺序，但即使顺序变了，画板变更事件里的 `pendingBoard` 也能兜住；新增字段时保持这个兜底思路。
