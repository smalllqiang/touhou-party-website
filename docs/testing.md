# 测试

两层：**Vitest** 测逻辑与 composable，**Playwright** 在真实 Chromium 里跑关键流程。

## 命令

```bash
npm test            # 单测，跑一次
npm run test:watch  # 单测，监听
npm run test:e2e    # 端到端（会自动启动 / 复用 dev server）
npm run build       # vue-tsc 类型检查 + 构建，必跑
```

判定标准：三条命令全部成功。

## 单元测试（Vitest + jsdom）

配置在 [`vitest.config.ts`](../vitest.config.ts)，用例在 `tests/unit/`：

| 文件 | 覆盖点 |
| --- | --- |
| `utils.spec.ts` | `formatTime` 补零 / 取整、`shuffle` 不改原数组、`safeFileName` 清洗 |
| `config.spec.ts` | 两个游戏的配置兜底、人数 / 画笔 clamp、题目三种写法、图片路径拼接、缺词的题目被丢弃 |
| `countdown.spec.ts` | 按时间差递减（模拟标签页节流）、暂停 / 继续、最后 5 秒回调、`onExpire` 只触发一次、`restore()` 恢复剩余时间与暂停态 |
| `persist.spec.ts` | 版本号、坏 JSON / 版本不符丢弃、parse 失败删除、`clearAllStored` 不误删其它键 |
| `draw-guess.spec.ts` | 抽题 → A/B → 换轮 → 结果；空白确认；时间到自动推进；再玩一局清空但保留选手名；刷新恢复阶段 / 作品 / 画板快照 / 暂停计时 |
| `undercover.spec.ts` | 默认名字 / 人数 clamp、发牌恰好 1 名卧底、按住 / 松开、一键翻开与返回设置、改名后重发；刷新恢复设置页与发牌页 |

composable 测试的注意事项：

- `useDrawGuess` / `useUndercover` 必须在组件 `setup` 里调用（用 `@vue/test-utils` 的 `mount` 包一层），否则 `onScopeDispose` / `onMounted` 没有作用域。
- 计时相关用 `vi.useFakeTimers` + `vi.spyOn(performance, 'now')` 控制时间；`draw-guess.spec.ts` 里有现成写法。
- 画板在 jsdom 里没有真实 canvas，测试注入 `DrawingBoardApi` 假对象（见 `fakeBoard()`），不测像素；接口新增了 `restoreImage()`，假对象也要补上。
- **持久化是全局副作用**：[`tests/unit/setup.ts`](../tests/unit/setup.ts) 在每个用例前 `localStorage.clear()`。需要模拟刷新时，先 `wrapper.unmount()` 让 `onBeforeUnmount` 落盘，再新建一个 `useXxx` 实例读取。
- 撤销栈 / 画板像素不参与单测；`change` 事件的载荷用假对象断言即可。

## 端到端（Playwright）

配置在 [`playwright.config.ts`](../playwright.config.ts)，用例在 `tests/e2e/smoke.spec.ts`。

- 默认优先使用系统 Chromium：`/usr/bin/chromium`；也可用 `CHROMIUM_PATH` 指定。
- 如果机器上没有系统 Chromium，先 `npx playwright install chromium`，再让 `CHROMIUM_PATH` 留空（Playwright 回退到自带浏览器）。
- `webServer` 会复用已在 5173 端口运行的 dev server；直接 `npm run test:e2e` 即可。
- 每个用例都会收集 `pageerror` / console error，结束时断言为空——新增功能不要引入浏览器报错。
- 时间相关用例用 `page.clock.install()` + `fastForward()` 快进，不需要真的等 150 秒。

覆盖范围：

| 区块 | 覆盖点 |
| --- | --- |
| 路由 / 外壳 | 直接访问 `#/undercover`、未知 hash 回退、标题与导航高亮同步 |
| 你画我猜 | 抽题动画落定、题目列表折叠 / 点选 / 收起 / 高亮、开始游戏、每个阶段画一笔并推进、结果页作品数与题目、单张下载、lightbox 打开与 Esc、再玩一局清空 |
| 你画我猜 · 边界 | 空白画板弹确认、暂停冻住倒计时、时间到遮罩与 1.6 秒自动进入 B |
| 谁是卧底 | 人数步进与名字数量、抽题默认隐藏、查看本题、发牌 5 张、按住翻开 / 松手盖回 / 已查看标记、一键翻开（1 张卧底 + 横幅）、扣上、返回设置 |
| 刷新恢复 | 你画我猜：作画后 `reload`，阶段 / 选手名 / 画板像素都在；推进到 B 再 `reload`，参考作品仍在；谁是卧底：发牌 + 查看 + 一键翻开后 `reload`，卡片数 / 已查看 / 横幅都恢复 |
| 窄屏 | 菜单按钮、`body.nav-open`、点遮罩关闭 |
| 宽屏侧栏 | 点圆钮收起为图标栏、文字隐藏、仍可切换游戏、`reload` 后保持收起、展开恢复原宽度 |

## 手工回归清单（自动化测不到的部分）

改完代码后按需人工过一遍：

1. **真实触摸按住**：真机或浏览器触摸模拟，按住卡片按钮不松手，确认不会被翻转动画误关（对应「不能监听 pointerleave / pointerout」的约束）。
2. **多文件下载**：结果页点「保存全部作品」，确认浏览器未拦截或提示文案正确。
3. **配图缺失降级**：把一张卧底图临时改名，确认卡片显示占位而不是破图图标，且词与流程正常。
4. **局域网**：`npm run dev -- --host` 或 `npm run build` + 静态服务器，用手机访问同一局域网地址；确认背景图、卧底配图、画板触摸都正常。
5. **无网络环境**：断网后通过本地静态服务器打开构建产物，确认功能不依赖网络。
6. **背景图**：宽屏（裁上下）与窄屏（几乎不裁）下观感正常。
7. **真实刷新恢复**：手机浏览器切后台被杀后重新打开，确认回到原阶段；再试一次「暂停中刷新」与「时间到遮罩上刷新」。
8. **隐私模式**：Safari 无痕 / 禁用站点数据时，游戏仍能玩（只会在控制台 warn，不崩）。

## 陷阱

- `npm run test:e2e` 依赖 5173 端口的 dev server；端口被占用时 `reuseExistingServer` 会直接用现有服务，注意它是不是当前代码。
- Playwright 的 `clock.install()` 会接管页面里的 `setTimeout` / `performance.now`；不要在同一个用例里同时依赖真实等待和 fake clock。
- 画板笔迹用 `page.mouse` 模拟；如果改了画板 CSS 尺寸，`stroke()` 里的比例坐标仍然有效，但断言 `toDataURL` 长度时要留余量。
- 测试会断言「导航项数量」与配置题目数；新增游戏 / 改配置后同步更新 `tests/e2e/smoke.spec.ts`。
- e2e 每个用例是独立的浏览器上下文，`localStorage` 天然隔离；单测则是共享 jsdom，必须靠 `tests/unit/setup.ts` 清空。
- 断言刷新后的画板像素时，等 `restoreImage()` 的 `Image.onload` 完成：用 `expect.poll()`，不要用固定 `waitForTimeout` 猜时间。
