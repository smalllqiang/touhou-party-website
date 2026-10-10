# 配置参考（js/config.js）

[`js/config.js`](../js/config.js) 是唯一配置入口，**整体直接赋值** `window.GAME_CONFIG = { drawGuess: {...}, undercover: {...} }`（不是 `Object.assign` 合并）。改完保存、刷新页面即生效，无需构建。

所有键都有兜底，兜底逻辑分散在两个游戏的 `getConfig()` 里。

> 下表的「兜底」是代码里的**实际**兜底值，可能与本仓库 `js/config.js` 当前写的数值不同（例如你画我猜的倒计时）。两者不一致时以代码为准。

## drawGuess（你画我猜）

消费方：[`js/games/draw-guess.js`](../js/games/draw-guess.js) 的 `getConfig()`；`colors` / `brush` 原样传给 `DrawingBoard.create`。

| 键 | 类型 | 语义 | 兜底 |
| --- | --- | --- | --- |
| `rounds` | int | 轮数。1 轮 = A 画图 + B 猜词两个阶段 | `max(1, parseInt(rounds) \|\| 3)` |
| `timer.a` | number（秒） | A 阶段（画图）倒计时 | 非有限数或 ≤ 0 → `60` |
| `timer.b` | number（秒） | B 阶段（猜词）倒计时 | 非有限数或 ≤ 0 → `30` |
| `autoNextOnTimeout` | bool | 时间到后是否约 1.6 秒自动进入下一阶段 | 仅当值**严格等于** `false` 时为手动；缺省 / 其它值为自动 |
| `players.a` / `players.b` | string | 默认选手名 | `'选手A'` / `'选手B'`（界面输入框留空也回退到这两个值） |
| `colors` | string[] | 画板调色盘颜色（CSS 颜色串） | 空数组 / 缺失 → 代码内置 `DEFAULT_COLORS`（10 色；`js/config.js` 里当前多一个粉色 `#f48fb1`） |
| `brush.min` | number | 画笔粗细滑杆下限（画板内部像素） | `1` |
| `brush.max` | number | 画笔粗细滑杆上限 | `48` |
| `brush.defaultSize` | number | 默认粗细，会被 clamp 到 `[min, max]` | `6` |
| `topics` | string[] | 题目列表，每项一个字符串 | 空 / 缺失 → `['猫']` |

行为细节：

- `topics` 的元素只被当字符串使用（拼进 `textContent` / `innerHTML`），不做类型校验。不要放对象。
- 选手名在**点击「确定」抽题结束之后**从输入框读回 `state.players`；输入框 `maxlength=12`，前后空白会被 trim。
- 游戏内部维护 `pool`（`topics` 的洗牌副本），抽空一轮才重新洗牌，并避免与「当前题目」重复；`topics` 只有 1 项时永远抽到它。

## undercover（谁是卧底）

消费方：[`js/games/undercover.js`](../js/games/undercover.js) 的 `getConfig()` + `normalizeTopics()`。

| 键 | 类型 | 语义 | 兜底 / 约束 |
| --- | --- | --- | --- |
| `players` | int | 默认玩家人数 | 缺省 `4`，再 clamp 到 `[minPlayers, maxPlayers]` |
| `minPlayers` | int | 界面可调人数下限 | 缺省 `3`，再取 `max(3, 值)` → **硬下限 3** |
| `maxPlayers` | int | 界面可调人数上限 | 缺省 `12`，再取 `max(minPlayers, 值)` |
| `names` | string[] | 默认玩家名，可留空 `[]` | 非数组 → `[]`；不足的位置自动补 `玩家N`（N 从 1 开始计数） |
| `imageDir` | string | 配图目录前缀 | 非字符串 / 空 → `'images/undercover/'` |
| `imageExt` | string | 未单独指定图片时的默认后缀 | 非字符串 / 空 → `'.png'` |
| `topics` | array | 题目列表（写法见下） | 非数组 → `[]`（界面显示「题目列表是空的」，抽题按钮禁用） |

### topics 支持的写法

一组题 = 普通玩家的词 + 卧底的词。三种等价写法：

```js
{ normal: '可乐', spy: '雪碧' },                                   // 图片按词自动找
{ normal: '猫', spy: '老虎', normalImage: 'cat.png', spyImage: 'tiger.jpg' },
['可乐', '雪碧', 'cola.png', 'sprite.png'],                         // [普通词, 卧底词, 普通图, 卧底图]
```

字段别名（按顺序取第一个存在的）：

| 位置 | 可用字段 |
| --- | --- |
| 普通玩家的词 | `normal` → `civilian` → `normalWord` |
| 卧底的词 | `spy` → `undercover` → `different` → `spyWord` |
| 普通玩家的图 | `normalImage` → `normalImg` → `civilianImage` |
| 卧底的图 | `spyImage` → `spyImg` → `undercoverImage` |

单个「词」也支持多种写法（`normalizeWord`）：

```js
'可乐'                                 // 图片 = imageDir + '可乐' + imageExt
['可乐', 'cola.png']                   // [词, 图]
{ text: '可乐', image: 'cola.png' }    // 文本别名 text → word → name → label
                                       // 图片别名 image → img → src → picture
```

归一化后，游戏内部只认这一种形状：

```js
topic = {
  normal: { text: string, image: string },   // image 已是可用 URL，可能为空串
  spy:    { text: string, image: string }
}
```

### 图片路径拼接规则（`joinPath(dir, file)`）

| 写入的值 | 结果 |
| --- | --- |
| 以 `http:` / `https:` / `data:` / `blob:` / `/` 开头 | 原样使用 |
| 含 `/` 的相对路径 | 原样使用（**不会**再拼 `imageDir`） |
| 其它（纯文件名） | `imageDir`（去掉尾部 `/` 后补一个 `/`）+ 值 |
| 空，但词非空 | 先用 `词 + imageExt`，再按上面规则拼接 |

### 会被静默丢弃的题目

`normal.text` 或 `spy.text` 为空（空串 / `null` / 非字符串、非数组、非对象类型）的条目会被跳过，界面上的「题目数量」也不计它。

## 生效时机

| 操作 | 是否重新读取 config |
| --- | --- |
| 刷新页面 | 是 |
| 切到另一个游戏再切回 | 是（重新 `mount`） |
| 你画我猜「再玩一局」 | 否 |
| 谁是卧底「返回设置」「换一题重发」 | 否 |
| 运行时改 `window.GAME_CONFIG` 后继续操作 | 否，必须重新 mount |

## 陷阱清单

- **末尾英文逗号**：`js/config.js` 里属性结尾的逗号不能删；语法错误会导致整站 JS 停摆、页面空白。
- `players` 在两个游戏里含义不同：你画我猜是对象 `{ a, b }`，谁是卧底是数字。
- `drawGuess.topics` 是字符串数组，`undercover.topics` 是「词组」数组。写错形状不报错，只会静默回退（题目变成 `['猫']`，或题目列表为空）。
- `imageDir` 相对**页面 URL**（`index.html` 所在目录），不是相对 `js/` 或 `css/`。
- `undercover.topics` 里同一个词在两个位置出现（如 `{normal:'A', spy:'B'}` 与 `{normal:'B', spy:'A'}`）是合法且当前实际使用的写法（双向成对）。
