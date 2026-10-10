# 谁是卧底（js/games/undercover.js）

导出 `window.UndercoverGame = { mount(root) }`；`mount()` 返回 `{ destroy }`。
依赖：`window.Utils`、`window.GAME_CONFIG.undercover`。
配置项与题目写法见 [../config.md](../config.md)；配图规则见 [../assets.md](../assets.md)。

游戏只负责**抽词组 + 发牌 + 展示**，不判断输赢、不记录投票。n 人里**恰好 1 人**（卧底）拿到的词与其他人不同。

## 流程与状态机

```
setup ──[开始发牌]──> reveal ──[换一题重发]──> reveal（重新抽题 + 重新发牌）
  ↑                     │
  └──[返回设置]─────────┘   （人数 / 名字 / 已抽到的题目保留）
```

- `state.screen`：`setup` | `reveal`。
- `setup` 内可反复抽题，不会自动发牌；必须点「开始发牌」。

## 状态字段

| 字段 | 含义 |
| --- | --- |
| `count` | 玩家人数，始终在 `[minPlayers, maxPlayers]` 内 |
| `names` | 玩家名数组；长度**不一定**等于 `count`（缩容时保留多余项，再扩容不丢） |
| `topic` | 当前题目（归一化后的 `{normal, spy}`），跨屏幕保留 |
| `pool` | 抽题池（洗牌副本），避免连续抽到同一组 |
| `topicVisible` | 主持人是否点开了「查看本题」；跨屏幕保留 |
| `assignments` | `[{ name, isSpy, word }]`，长度 = `count`，`word` 是 `{text, image}` |
| `spyIndex` | 卧底在 `assignments` 中的下标（`-1` 表示未发牌） |
| `seen` | `boolean[]`，每张卡是否被按住看过 |
| `allRevealed` | 「一键翻开」的永久翻开状态 |
| `peekIndex` | 当前被按住查看的卡片下标，`-1` 表示没有 |
| `destroyed` | `destroy()` 置位 |

模块级（闭包内）`cardEls` 缓存 `.uc-card` 元素数组，`paintReveal()` 靠它做局部更新（**不重建列表**，否则会丢失滚动位置和动画状态）。

## 题目归一化（`normalizeTopics` / `normalizeWord` / `joinPath`）

规则与可用写法见 [../config.md](../config.md)。要点：

- 归一化在 `mount()` 时执行一次，结果存进 `C.topics`；`C.topics` 一旦生成就不再变。
- `normal.text` 或 `spy.text` 为空的条目被静默丢弃。
- 图片路径拼接只做一次；`image` 已含目录时不再拼 `imageDir`。

## 人数与名字

- `applyCount(value)`：`parseInt` 后 clamp 到 `[minPlayers, maxPlayers]`，非法值保持原值；值未变时只刷新数字显示，不重建界面（避免名字输入框失焦）。
- `syncNames()`：只补齐**空白**位置（`null` / 空串 / 纯空白），已有名字不动，多余的名字保留。
- `nameAt(i)`：优先取 `state.names[i]`（trim 后非空），否则回退 `C.names[i]`，再否则 `玩家{i+1}`。
- 名字输入框 `maxlength=12`，`input` 事件实时写回 `state.names[i]`（不 trim，trim 发生在 `nameAt`）。

## 抽题

- `drawTopic()`：池空时用「排除当前题后的全集」重新洗牌；从池尾 `pop()`。
- `roll()`（「抽题」/「换一题」）：**只做抽取，没有滚动动画**。
  - 约束：不要恢复滚动动画。滚动时会一闪而过地掠过题目池里的其它词，等于泄题。`state.topicVisible` 被重置为 `false`（抽到的题默认藏着）。
- 手动指定：`<details class="uc-picker">` 里的题目列表（`buildPicker()` 只建一次，`paintPicker()` 只切 `.is-active` 高亮）。`pickTopic(i)` 会：
  1. `state.topic = C.topics[i]`，`topicVisible = false`
  2. 把该组从 `state.pool` 移除（避免接着点「抽题」又抽到它）
  3. 把 `<details>` 收起（`open = false`），避免被围观的人看到
- 「查看本题」按钮：切换 `topicVisible`。false 时显示「✅ 已抽到题目」；true 时显示普通词（× 普通玩家人数）与卧底词（×1）。

## 发牌（`deal()`）

- `spyIndex = Math.floor(Math.random() * count)` → 恰好 1 名卧底。
- 逐人写入 `{ name, isSpy, word }`：卧底用 `topic.spy`，其余用 `topic.normal`。
- 重置 `seen`、`allRevealed = false`、`peekIndex = -1`。
- 卡片序号（`.uc-card-no`）= `i + 1` = 玩家顺序；同一个 `i` 同时是名字、`assignments`、`seen`、`cardEls` 的下标。

## 按住查看（核心交互，约束最多）

`bindHold(btn, i)` 挂在卡片正面的 `.uc-hold-btn` 上：

| 事件 | 行为 |
| --- | --- |
| `pointerdown`（鼠标仅左键） | `preventDefault()` → `openPeek(i)` → `btn.setPointerCapture(pointerId)` → 在 `window` 上以**捕获阶段**注册 `pointerup` / `pointercancel` |
| `window` 的 `pointerup` / `pointercancel` | 校验 `pointerId` 一致后 `closePeek(i)`，并移除这两个监听 |
| `lostpointercapture` / `blur` / `contextmenu` | 兜底：`closePeek(i)` / 阻止长按菜单 |
| `keydown` / `keyup`（空格、Enter） | 按住效果（键盘可达性） |

- `openPeek(i)`：`state.destroyed` 或 `state.allRevealed` 时直接返回；`peekIndex === i` 时返回；否则置 `peekIndex = i`、`seen[i] = true`、`paintReveal()`。
- `closePeek(i)`：仅当 `peekIndex === i` 时复位（避免误关别的卡片）。
- **约束**：这里故意**不**监听 `pointerleave` / `pointerout`。卡片一翻转，按钮就被转到指针命中范围之外，浏览器会补发一次假的 `pointerleave` / `pointerout`；一旦监听，卡片会刚翻开就立刻合上（历史 bug：「要按好几下才翻得开」）。`tests/smoke.html` 有对应回归断言，改这里必须保留该行为。
- `window` 的 `blur` 与 `document` 的 `visibilitychange` → `onLeave()`：切后台时关掉当前 peek（防止别人看到屏幕）。
- 卡片翻开的判据（`paintReveal()`）：`open = state.allRevealed || state.peekIndex === i`，对应 `.uc-card.is-open`；`is-spy` 只在 `allRevealed` 时加。

## 一键翻开 / 扣上（`flipAll()`）

- 翻转 `state.allRevealed`，清空 `peekIndex`，提示音（翻开 988Hz / 扣上 523Hz），`paintReveal()`。
- 永久状态，不是「按住才有效」：按钮文案在「👀 一键翻开全部卡片」与「🙈 一键扣上全部卡片」间切换。
- 翻开时：
  - 每张卡写入身份文本（`.uc-card-role` → `卧底` / `普通玩家`）；
  - `#ucBanner` 显示「本局卧底是 <名字>」+ 卧底词与普通词；
  - 扣上时清空并 `hidden`。
- `allRevealed` 为 true 时，按住查看失效（`openPeek` 直接返回）。

## 缺图行为

| 情况 | 表现 |
| --- | --- |
| 配置里没给 `image`（归一化后 `word.image` 为空串） | 卡片背面渲染静态占位 `.uc-img-missing`：「没有配图 / 在 config.js 里给这个词写 image」 |
| 给了 `image` 但加载失败（`error` 事件，或 `complete && naturalWidth === 0`） | `<img>` 置 `hidden`，显示同为 `.uc-img-missing` 的占位（「图片待补充」+ 期望路径） |
| 两种情况 | **词本身照常显示，游戏可正常玩** |

## 界面元素与选择器

| 屏幕 | 选择器 | 说明 |
| --- | --- | --- |
| setup | `#ucTopicSlot` | 题目槽；类：`is-empty` / `is-hidden`（已抽到但藏着）/ `is-shown`（主持人查看中） |
| setup | `#ucDrawBtn` `#ucRedrawBtn` `#ucPeekBtn` `#ucStartBtn` | 抽题 / 换一题 / 查看本题 / 开始发牌；`paintSetup()` 统一刷新禁用态与文案 |
| setup | `#ucPicker` `#ucPickList` `[data-pick="<i>"]` | 折叠的题目列表；`hidden` 且无选项时不渲染（`topics` 为空时） |
| setup | `#ucCount` `#ucMinus` `#ucPlus` `#ucCountTip` | 人数步进器与提示 |
| setup | `#ucNames` `[data-name="<i>"]` | 名字输入列表；`paintNames()` 会整体重建（只在人数 / 屏幕变化时调用） |
| setup | `#ucStats` | 本局设置摘要（人数 / 卧底 / 普通玩家 / 题目数量） |
| reveal | `#ucCards` `.uc-card[data-index]` | 卡片容器与卡片 |
| reveal | `.uc-hold-btn[data-hold="<i>"]` | 按住查看按钮 |
| reveal | `.uc-card-cover` / `.uc-card-back` / `.uc-card-role` / `.uc-card-word` / `.uc-card-media` / `.uc-card-seen` | 正面 / 背面 / 身份 / 词 / 图 / 「✓ 已查看」 |
| reveal | `#ucFlipBtn` `#ucRedealBtn` `#ucSetupBtn` | 一键翻开 / 换一题重发 / 返回设置 |
| reveal | `#ucBanner` | 公布答案横幅（`hidden` 切换） |

## 陷阱与已知行为

- `paintReveal()` 依赖 `cardEls` 缓存；新增 / 删除卡片后必须重新查询 DOM（现有代码只在 `renderReveal()` 里查询一次，卡片集合在 reveal 屏幕内固定）。
- `paintPicker()` 只切高亮，不重建列表——重建会把列表滚动位置顶回去。
- `paintNames()` 会整体重建输入框，只在人数变化或切回设置时调用；不要在 `input` 事件里调用它，否则会打断输入。
- `state.topicVisible` 与 `state.topic` 跨屏幕保留：从 reveal 点「返回设置」后，若之前点开过「查看本题」，题目仍以明文显示。
- 「换一题重发」会 `drawTopic()` + `deal()` + `renderReveal()`，但**不会**重置 `state.names`。
- `destroy()` 会移除 `window` 的 `blur` 与 `document` 的 `visibilitychange` 监听；新增全局监听必须在这里一并移除（见 [../architecture.md](../architecture.md) 的生命周期约定）。
