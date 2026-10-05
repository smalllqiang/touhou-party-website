# 小游戏工具箱

线下聚会玩小游戏时的辅助工具站。界面是两栏结构：**左侧导航栏**列出各个小游戏，**右侧主内容区**随所选游戏切换。

目前实现了第一个小游戏：**你画我猜**。

![抽题界面](docs/screenshots/1-setup.png)

## 快速开始

纯静态页面，**没有任何依赖和构建步骤**，两种打开方式都行：

```bash
# 方式一：直接双击 index.html（所有功能都可用）

# 方式二：起一个本地静态服务（推荐，方便手机 / 平板连同一局域网访问）
cd touhou-party-website
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

## 你画我猜 怎么玩

1. **抽题**：点「抽」随机抽一个题目，不满意点「重来」再抽一个，确认后点「确定」。
2. **A 画图**：A 看到题目后在画板上作画，限时（默认 60 秒）。
3. **B 猜词**：B 看着 A 的画猜词，**答案要写在画板上（手写），不能打字说出来**，限时（默认 30 秒）。
4. **继续**：一个 A + 一个 B = 一轮；下一轮 A 参照「上一轮 B 写的词」重新作画，如此循环。
5. **结束**：走完全部轮数后，页面顶部给出**本局起始题目**，下面按顺序列出每个人的作品，可以逐张保存 PNG，也可以「保存全部作品」。

![游戏界面](docs/screenshots/2-draw.png)
![猜词界面](docs/screenshots/3-guess.png)
![结果界面](docs/screenshots/4-result.png)

画板工具：常用颜色一键切换、画笔粗细滑杆、橡皮擦、撤销、清空。鼠标 / 手指 / 手写笔都能画（手写笔支持按压力度改变粗细）。

游戏过程中还可以：**暂停 / 继续**、**结束本局**（提前收工直接看作品）、点击参考图放大查看。

## 修改配置

所有可调项都在 [`js/config.js`](js/config.js) 里的 `drawGuess` 段，改完保存、刷新页面即生效：

| 配置项 | 说明 |
| --- | --- |
| `rounds` | 游戏轮数（一个 A + 一个 B 算一轮） |
| `timer.a` | A 阶段（画图）倒计时，单位秒 |
| `timer.b` | B 阶段（猜词）倒计时，单位秒 |
| `autoNextOnTimeout` | 时间到后 `true` 自动进入下一阶段，`false` 等主持人手动点 |
| `players` | 默认选手名字（界面上也能改） |
| `colors` | 画板调色盘的颜色列表 |
| `brush` | 画笔粗细范围与默认值 |
| `topics` | 题目列表，一行一个，随便增删 |

示例：

```js
drawGuess: {
  rounds: 4,                        // 改成 4 轮
  timer: { a: 90, b: 45 },          // A 90 秒，B 45 秒
  autoNextOnTimeout: false,         // 时间到后手动进入下一阶段
  topics: ['猫', '西瓜', '雨伞'],    // 只留自己想要的题目
  // ...
}
```

## 新增一个（第二个）小游戏

1. 在 `js/config.js` 里加一段自己的配置（如 `werewolf: { ... }`）。
2. 新建 `js/games/xxx.js`，导出一个 `window.XxxGame = { mount: function (host) { ... return { destroy: function () {} }; } }`。
3. 在 `index.html` 里加一行 `<script src="js/games/xxx.js"></script>`。
4. 在 `js/app.js` 的 `GAMES` 数组里加一项（id / 名字 / 图标 / 副标题 / mount），左侧导航会自动出现。

## 目录结构

```
index.html                 页面骨架：左侧导航栏 + 右侧内容区
css/style.css              全部样式（含响应式：窄屏导航变抽屉）
js/config.js               ★ 配置文件：题目、倒计时、轮数、颜色、粗细
js/utils.js                通用工具：计时格式化、提示音、下载、图片放大
js/drawing-board.js        画板组件：画笔 / 颜色 / 粗细 / 橡皮擦 / 撤销 / 清空
js/games/draw-guess.js     你画我猜：抽题 → A → B → 结果 的完整流程
js/app.js                  应用入口：导航渲染与游戏切换
tests/smoke.html           浏览器冒烟测试（自动跑完整局流程并断言）
docs/screenshots/          界面截图
```

## 冒烟测试

`tests/smoke.html` 会自动把整局流程点一遍（抽题 → 6 个阶段 → 结果页 → 时间到自动切换），并把结果打印在页面上的 `<pre id="results">`，共 35 项断言。

```bash
chromium --headless=new --no-sandbox --disable-gpu --user-data-dir=/tmp/cp \
  --virtual-time-budget=60000 --dump-dom "file://$PWD/tests/smoke.html" \
  | grep -o 'PASS.*\|FAIL.*\|=== TOTAL.*'
```

窄屏（手机 / 平板）下左侧导航会自动收起为抽屉，画板与工具栏自动换行：

![手机端](docs/screenshots/6-mobile-play.png)
