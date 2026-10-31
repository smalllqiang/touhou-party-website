# 配置参考（src/config/index.ts）

唯一配置入口是 [`src/config/index.ts`](../src/config/index.ts)：一个带类型的 `GAME_CONFIG` 对象。
类型与兜底逻辑在 [`src/config/normalize.ts`](../src/config/normalize.ts)，**默认值以该文件的代码为准**；本文只解释语义与容易踩的坑。

改完配置后：

- dev 模式（`npm run dev`）保存即热更新；
- 生产产物需要重新 `npm run build`；
- 配置在构建期被打进 bundle，运行期没有可改的全局配置对象。

## drawGuess（你画我猜）

消费方：`getDrawGuessConfig()` → [`useDrawGuess`](../src/games/draw-guess/useDrawGuess.ts)。

| 键 | 类型 | 语义 | 兜底 |
| --- | --- | --- | --- |
| `rounds` | number | 轮数；1 轮 = A 画图 + B 猜词两个阶段 | `max(1, parseInt(...) || 3)` |
| `timer.a` | number（秒） | A 阶段（画图）倒计时 | 非有限数或 ≤ 0 → `60` |
| `timer.b` | number（秒） | B 阶段（猜词）倒计时 | 非有限数或 ≤ 0 → `30` |
| `autoNextOnTimeout` | boolean | 时间到后是否约 1.6 秒自动进入下一阶段 | 仅严格 `false` 为手动；缺省为自动 |
| `players.a` / `players.b` | string | 默认选手名 | `选手A` / `选手B`；界面留空也回退 |
| `colors` | string[] | 画板调色盘（CSS 颜色串） | 空 / 缺失 → `DEFAULT_COLORS`（10 色） |
| `brush.min` / `max` | number | 粗细滑杆范围（画板内部像素） | `1` / `48`；`max` 不得小于 `min` |
| `brush.defaultSize` | number | 默认粗细 | `6`，并 clamp 到 `[min, max]` |
| `topics` | string[] | 题目列表 | 空 / 缺失 → `['猫']` |

行为：

- 选手名在点击「确定」时 trim，空串回退默认值；输入框 `maxlength=12`。
- 抽题维护一个洗牌池，抽空一轮才重新洗牌，并避免与「当前题目」重复；只有 1 个题目时永远抽到它。
- 手动从题目列表点选会把该题从池里移除，避免接着点「重来」又抽到同一题。

## undercover（谁是卧底）

消费方：`getUndercoverConfig()` → [`useUndercover`](../src/games/undercover/useUndercover.ts)。

| 键 | 类型 | 语义 | 兜底 / 约束 |
| --- | --- | --- | --- |
| `players` | number | 默认人数 | `4`，clamp 到 `[minPlayers, maxPlayers]` |
| `minPlayers` | number | 界面可调下限 | `3`，再取 `max(3, 值)` → **硬下限 3** |
| `maxPlayers` | number | 界面可调上限 | `12`，再取 `max(minPlayers, 值)` |
| `names` | string[] | 默认玩家名，可留空 | 非数组 → `[]`；不足的位置补 `玩家N` |
| `imageDir` | string | 配图目录前缀 | 空 / 非字符串 → `'images/undercover/'` |
| `imageExt` | string | 未单独指定图片时的后缀 | 空 / 非字符串 → `'.png'` |
| `topics` | array | 题目列表（见下） | 非数组 → `[]`；为空时抽题按钮禁用、题目槽显示提示 |

### topics 支持的写法

一组题 = 普通玩家的词 + 卧底的词。`RawUndercoverTopic` 支持：

```ts
{ normal: '可乐', spy: '雪碧' }                                    // 图片按词自动找
{ normal: '猫', spy: '老虎', normalImage: 'cat.png', spyImage: 'tiger.jpg' }
['可乐', '雪碧', 'cola.png', 'sprite.png']                         // [普通词, 卧底词, 普通图, 卧底图]
```

字段别名（按顺序取第一个存在的）：

| 位置 | 可用字段 |
| --- | --- |
| 普通玩家的词 | `normal` → `civilian` → `normalWord` |
| 卧底的词 | `spy` → `undercover` → `different` → `spyWord` |
| 普通玩家的图 | `normalImage` → `normalImg` → `civilianImage` |
| 卧底的图 | `spyImage` → `spyImg` → `undercoverImage` |

单个「词」也可以写成 `'可乐'`、`['可乐', 'cola.png']`、`{ text: '可乐', image: 'cola.png' }`（文本别名 `text` → `word` → `name` → `label`；图片别名 `image` → `img` → `src` → `picture`）。

归一化后的内部形状：

```ts
{
  normal: { text: string; image: string },   // image 是已拼好、尚未加 base 的路径，可能为空串
  spy:    { text: string; image: string }
}
```

### 图片路径规则（`joinPath` + `assetUrl`）

| 写入的值 | 结果 |
| --- | --- |
| 以 `http:` / `https:` / `data:` / `blob:` / `/` 开头 | 原样使用 |
| 含 `/` 的相对路径 | 原样使用（不再拼 `imageDir`） |
| 其它（纯文件名） | `imageDir`（去尾部 `/` 后补 `/`）+ 值 |
| 空，但词非空 | 先用「词 + imageExt」，再按上面规则拼接 |

渲染时 [`assetUrl()`](../src/lib/assets.ts) 再补当前部署的 base：

- dev / 根路径部署：`/images/undercover/可乐.png`；
- 子目录部署：`./images/undercover/可乐.png`（相对当前页面）。

所以配置里的 `imageDir` 是**相对站点根 / `public/`** 的路径，不是相对 `src/`。

### 会被静默丢弃的题目

`normal.text` 或 `spy.text` 为空（空串、`null`、既不是字符串/数组/对象）的条目会被跳过，界面上的「题目数量」也不计它。

## 生效时机

| 操作 | 是否重新读取配置 |
| --- | --- |
| dev 模式保存 `src/config/index.ts` | 是（Vite HMR） |
| 刷新页面 / 重新构建 | 是 |
| 切到另一个游戏再切回 | 是（组件重新 setup，再次调用 `get*Config()`） |
| 你画我猜「再玩一局」 | 否 |
| 谁是卧底「返回设置」「换一题重发」 | 否 |

## 陷阱清单

- 配置是 TypeScript：语法 / 类型错误会让 `npm run build` 失败，这是有意设计，比静默回退更早暴露问题。
- `players` 在两个游戏里含义不同：你画我猜是 `{ a, b }` 对象，谁是卧底是数字。
- `drawGuess.topics` 是字符串数组；`undercover.topics` 是「词组」数组。写错形状会走兜底（题目变成 `['猫']`，或题目列表为空）。
- `undercover.topics` 里同一组词双向成对出现（如 `{normal:'A', spy:'B'}` 与 `{normal:'B', spy:'A'}`）是合法的，当前配置就是这么写的。
- `assetUrl` 只处理一次 base；不要把已经带 `./` 前缀的路径再塞进 `imageDir`。
