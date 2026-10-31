# 谁是卧底

| 文件 | 职责 |
| --- | --- |
| [`UndercoverView.vue`](../../src/games/undercover/UndercoverView.vue) | 根组件：按 `screen` 切设置 / 发牌 |
| [`useUndercover.ts`](../../src/games/undercover/useUndercover.ts) | 人数、名字、抽题、发牌、查看状态 |
| [`SetupScreen.vue`](../../src/games/undercover/SetupScreen.vue) | 抽题 / 人数 / 名字 / 题目列表 |
| [`RevealScreen.vue`](../../src/games/undercover/RevealScreen.vue) | 发牌结果、一键翻开、公布横幅 |
| [`UcCard.vue`](../../src/games/undercover/UcCard.vue) | 单张卡片 + 按住查看 |
| [`TopicPicker.vue`](../../src/components/TopicPicker.vue) | 共用的折叠题目列表 |

配置与题目写法见 [../config.md](../config.md)；配图规则见 [../assets.md](../assets.md)。

游戏只负责**抽词组 + 发牌 + 展示**，不判断输赢、不记录投票。n 人里**恰好 1 人**（卧底）拿到的词与其他人不同。

## 流程与状态机

```text
setup ──[开始发牌]──> reveal ──[换一题重发]──> reveal（重新抽题 + 重新发牌）
  ↑                     │
  └──[返回设置]─────────┘   （人数 / 名字 / 已抽到的题目保留）
```

- `screen`：`setup` | `reveal`。
- `setup` 内可反复抽题，不会自动发牌；必须点「开始发牌」。

## 状态（`useUndercover`）

| 字段 | 含义 |
| --- | --- |
| `count` | 玩家人数，始终在 `[minPlayers, maxPlayers]` |
| `names` | 玩家名数组；长度**不一定**等于 `count`（缩容保留多余项，再扩容不丢） |
| `topic` | 当前题目（归一化后的 `{ normal, spy }`），跨屏幕保留 |
| `topicVisible` | 主持人是否点开「查看本题」；跨屏幕保留 |
| `assignments` | `{ name, isSpy, word }[]`，长度 = `count` |
| `spyIndex` | 卧底下标（`-1` 表示未发牌）；对外暴露为 `spy` computed |
| `seen` | `boolean[]`，每张卡是否被按住看过 |
| `allRevealed` | 「一键翻开」的永久翻开状态 |
| `peekIndex` | 当前被按住查看的卡片下标，`-1` 表示没有 |
| `pool` | 抽题池（洗牌副本），避免连续抽到同一组 |

## 题目归一化

`getUndercoverConfig()` 在 setup 时执行一次，`normalizeTopics()` 把三种写法统一成 `{ normal: {text,image}, spy: {text,image} }`。规则与别名见 [../config.md](../config.md)。

- `normal.text` / `spy.text` 为空的条目被静默丢弃。
- 图片路径拼接只做一次；渲染时 `assetUrl()` 再加部署 base。

## 人数与名字

- `setCount(value)`：`parseInt` 后 clamp 到 `[minPlayers, maxPlayers]`，非法值保持原值；值未变时不触发额外更新（避免输入框失焦）。
- `syncNames()`：只补齐**空白**位置（`null` / 空串 / 纯空白），已有名字不动，多余的名字保留。
- `nameAt(i)`：优先 `names[i]`（trim 后非空），否则配置 `names[i]`，再否则 `玩家{i+1}`。
- 名字输入框 `maxlength=12`，`input` 事件实时写回 `names[i]`（不 trim，trim 发生在 `nameAt`）。
- 人数输入框在 `change` / `blur` 时提交，越界值会被拉回 `count`。

## 抽题

- `drawTopic()`：池空时用「排除当前题后的全集」重新洗牌；从池尾 `pop()`。
- `roll()`（「抽题」/「换一题」）：**只做抽取，没有滚动动画**。
  - 约束：不要恢复滚动动画。滚动会掠过题目池里的其它词，等于泄题。抽到的题默认 `topicVisible = false`。
- 手动指定：共用 [`TopicPicker.vue`](../../src/components/TopicPicker.vue)。`pickTopic(i)` 会写 `topic`、`topicVisible = false`、把该组从池里移除，并收起列表。
- 「查看本题」：切换 `topicVisible`。false 时显示「✅ 已抽到题目」；true 时显示普通词（× 普通玩家人数）与卧底词（×1）。

## 发牌（`deal()`）

- `spyIndex = Math.floor(Math.random() * count)` → 恰好 1 名卧底。
- 逐人写入 `{ name, isSpy, word }`：卧底用 `topic.spy`，其余用 `topic.normal`。
- 重置 `seen`、`allRevealed = false`、`peekIndex = -1`。
- 卡片序号（`.uc-card-no`）= `i + 1` = 玩家顺序；同一个 `i` 同时是名字、`assignments`、`seen` 的下标。

## 按住查看（核心交互，约束最多）

[`UcCard.vue`](../../src/games/undercover/UcCard.vue) 在 `.uc-hold-btn` 上处理：

| 事件 | 行为 |
| --- | --- |
| `pointerdown`（鼠标仅左键） | `preventDefault()` → emit `peek(i)` → `setPointerCapture(pointerId)` → 在 `window` 捕获阶段注册 `pointerup` / `pointercancel` |
| `window` 的 `pointerup` / `pointercancel` | 校验 `pointerId` 一致后 emit `close(i)`，并移除监听 |
| `lostpointercapture` / `blur` / `contextmenu` | 兜底关卡片 / 阻止长按菜单 |
| `keydown` / `keyup`（空格、Enter） | 按住效果（键盘可达性） |

- `openPeek(i)`：`allRevealed` 或 `peekIndex === i` 时直接返回；否则置 `peekIndex = i`、`seen[i] = true`。
- `closePeek(i)`：仅当 `peekIndex === i` 时复位（避免误关别的卡片）。
- **约束**：故意**不**监听 `pointerleave` / `pointerout`。卡片一翻转，按钮就被转到指针命中范围之外，浏览器会补发一次假 leave；一旦监听，卡片会刚翻开就立刻合上（历史 bug：「要按好几下才翻得开」）。
- `window` 的 `blur` 与 `document` 的 `visibilitychange` → 关掉当前 peek（防止别人看到屏幕）；这两个监听由 composable 统一挂载 / 移除。
- 卡片翻开判据：`open = allRevealed || peekIndex === i` → `.uc-card.is-open`；`.is-spy` 只在 `allRevealed` 时加。

## 一键翻开 / 扣上（`flipAll()`）

- 翻转 `allRevealed`，清空 `peekIndex`，提示音（翻开 988Hz / 扣上 523Hz）。
- 永久状态，按钮文案在「👀 一键翻开全部卡片」与「🙈 一键扣上全部卡片」间切换。
- 翻开时每张卡显示身份文本（`.uc-card-role`），`.uc-banner` 显示「本局卧底是 <名字>」+ 卧底词与普通词；扣上时隐藏。
- `allRevealed = true` 时按住查看失效。

## 缺图行为

| 情况 | 表现 |
| --- | --- |
| 配置里没给 `image` | 卡片背面显示占位「没有配图 / 在 src/config/index.ts 里给这个词写 image」 |
| 给了 `image` 但加载失败 | `<img>` 隐藏，显示占位「图片待补充」+ 期望路径 |
| 两种情况 | **词本身照常显示，游戏可正常玩** |

实现：`@error` + `onMounted` 的 `complete && naturalWidth === 0` 检查；另外监听 `imgSrc` 变化并在 `nextTick` 后重查，避免「换一题重发」复用卡片时残留上一轮的缺图占位。

## 界面选择器

| 屏幕 | 选择器 | 说明 |
| --- | --- | --- |
| setup | `.uc-setup`、`.uc-topic` | 题目槽；类：`is-empty` / `is-hidden` / `is-shown` |
| setup | `.topic-actions .btn` | 抽题 / 换一题 / 查看本题 / 开始发牌 |
| setup | `.uc-stepper`、`#ucCount`、`.uc-step-btn` | 人数输入与加减 |
| setup | `.uc-name-field input` | 名字输入（`data-name="<i>"`） |
| setup | `.topic-picker`、`.topic-pick-item` | 共用题目列表 |
| reveal | `.uc-reveal`、`.uc-cards`、`.uc-card` | 发牌页与卡片 |
| reveal | `.uc-hold-btn`、`.uc-card-seen` | 按住查看 / 已查看标记 |
| reveal | `.uc-card-role`、`.uc-card-word`、`.uc-card-media` | 背面身份 / 词 / 图 |
| reveal | `.uc-reveal-actions .btn` | 一键翻开 / 换一题重发 / 返回设置 |
| reveal | `.uc-banner` | 公布答案横幅 |

## 陷阱与已知行为

- `topicVisible` 与 `topic` 跨屏幕保留：从 reveal 点「返回设置」后，若之前点开过「查看本题」，题目仍以明文显示。
- 「换一题重发」会重新抽题 + 发牌，但**不会**重置 `names`。
- 卡片组件按 `i` 复用；`seen`、`failed` 等状态要么放在 composable（`seen`），要么监听输入变化重置（`failed`）。
- 题目列表只切 `.is-active` 高亮，不重建 DOM；重建会把列表滚动位置顶回去。
- 不要在 `input` 事件里重建名字输入框，否则会打断输入。
- `window` / `document` 上的监听必须由 `useUndercover` 清理；新增全局监听不要散落在组件里。
