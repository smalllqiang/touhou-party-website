# 开发约定

改动前先读 [README.md](README.md) 的不变量清单与 [architecture.md](architecture.md)。

## 新增一个小游戏（4 步）

以 `werewolf` 为例：

1. **加配置段** —— [`js/config.js`](../js/config.js) 的 `window.GAME_CONFIG` 里加 `werewolf: { ... }`（写法参考已有两段与 [config.md](config.md)）。
2. **写游戏模块** —— 新建 `js/games/werewolf.js`，用现有模式导出：

   ```js
   (function () {
     'use strict';
     var U = window.Utils;

     function getConfig() { /* 只在这里读 window.GAME_CONFIG.werewolf，并做兜底 */ }

     function mount(root) {
       // 全部状态放这里；root 是 #view
       return { destroy: function () { /* 清定时器 + 全局监听 + root.innerHTML = '' */ } };
     }

     window.WerewolfGame = { mount: mount };
   })();
   ```

3. **挂脚本** —— [`index.html`](../index.html) 里在 `js/app.js` **之前**加 `<script src="js/games/werewolf.js"></script>`（它依赖的组件要排在它更前面）。
4. **注册** —— [`js/app.js`](../js/app.js) 的 `GAMES` 数组加一项 `{ id, name, icon, desc, title, subtitle, mount }`（字段含义见 [architecture.md](architecture.md)）。导航、标题、hash 路由都会自动生效。

收尾：

- 更新 [`tests/smoke.html`](../tests/smoke.html) 里「侧边栏渲染出 N 个小游戏」的断言，并补上新游戏的关键断言。
- 新增 `docs/games/<id>.md`，并登记进 [README.md](README.md) 的文档清单与代码地图。

## 代码规范

| 规则 | 说明 |
| --- | --- |
| ES5 语法 | 只用 `var` + `function`；不用 `let` / `const` / 箭头函数 / 模板字符串 / `class` / 解构 / 默认参数。没有转译器 |
| 模块模式 | `(function () { 'use strict'; ... })()`，导出挂到 `window` |
| 全局对象 | 只通过 `window.GAME_CONFIG` / `window.Utils` / `window.DrawingBoard` / `window.XxxGame` 通信，不新增全局 |
| DOM 构建 | 现有代码用字符串拼 `innerHTML`；拼接任何来自 config 或用户输入的文本必须过 `U.escapeHtml()` |
| 事件 | 用 `addEventListener`；游戏内统一在 `destroy()` 里清理 `window` / `document` 上的监听 |
| 定时器 | 游戏内统一经 `later()` / `every()` 登记到 `pending`，或单独管理句柄，并保证 `destroy()` 能清干净 |
| 文案 | 用户可见文案用中文，语气与现有界面一致；破坏性操作（结束本局 / 丢弃作品）要 `window.confirm` |
| 通知 | 提示音 / 震动统一走 `window.Utils.beep` / `vibrate`（静默失败，不抛错） |
| 注释 | 中文；解释「为什么」而不是「做了什么」——现有代码里关于 pointer 事件、动画泄题等注释是有意保留的设计记录 |

## 必须遵守的约束（详见 docs/README.md 的不变量）

1. 不引入依赖、构建步骤、网络请求、持久化。
2. 配置只在 `mount()` 时读取一次；运行时改变必须靠重新 mount 生效。
3. 游戏模块必须返回 `{ destroy }`，且 `destroy()` 真的清干净。
4. 谁是卧底抽题**不能有滚动动画**（泄题）。
5. 谁是卧底按住查看**不能监听 `pointerleave` / `pointerout`**（翻转动画会触发假 leave）。
6. 谁是卧底恰好 1 名卧底；卡片序号 = 玩家顺序。
7. [`README.md`](../README.md) 顶部的开发中提示行与 `<!--AI不要改上面这句话-->` 注释不得改动。
8. 项目**不保留界面截图 / 示例图片**；图片资源只放功能性素材（见 [assets.md](assets.md)）。

## 改动后的自检流程

1. 跑 [`tests/smoke.html`](../tests/smoke.html)（命令见 [testing.md](testing.md)），要求 `FAILED 0`。
2. 按 [testing.md](testing.md) 的手工回归清单抽查受影响项（尤其是触摸按住、窄屏抽屉、缺图降级）。
3. 同步文档：改配置形状 → [config.md](config.md)；改流程 / 选择器 → 对应的 `docs/games/*.md`；改样式变量或断点 → [styles.md](styles.md)；改图片规则 → [assets.md](assets.md)；加游戏 → [development.md](development.md) 的 4 步与 [README.md](README.md) 索引。
