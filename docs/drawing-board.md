# 画板组件（js/drawing-board.js）

导出 `window.DrawingBoard = { create(host, options), WIDTH: 1024, HEIGHT: 576 }`。
无状态全局，每次 `create()` 返回一个独立的画板实例，所有状态在该实例闭包内。

## API

```js
var board = window.DrawingBoard.create(hostElement, {
  colors: ['#000000', '#ffffff'],          // 调色盘；空/缺失 → ['#000000']
  brush: { min: 1, max: 48, defaultSize: 6 } // 每项缺失时用各自兜底
});
```

`create(host, options)` 会**重写 `host.innerHTML`**，并返回：

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `el` | `HTMLElement` | 根节点 `.board` |
| `canvas` | `HTMLCanvasElement` | 固定内部分辨率 `1024 × 576` |
| `wrapper` | `HTMLElement` | `.board-canvas-wrap`（承载锁定 / 暂停遮罩） |
| `toDataURL()` | `() => string` | 导出 PNG dataURL |
| `hasInk()` | `() => boolean` | 是否画过东西（**见陷阱**） |
| `clear()` | `() => void` | 清空（先压入历史，可撤销） |
| `undo()` | `() => void` | 回退一步 |
| `setEnabled(bool)` | | 外部强制禁用（优先于下面两个） |
| `setPaused(bool)` | | 暂停：禁用绘制 + 显示「已暂停」遮罩 |
| `setLocked(bool)` | | 锁定（时间到）：禁用绘制 + 显示「时间到」遮罩 |
| `setColor(css)` | | 选颜色，同时把工具切回画笔 |
| `setSize(n)` | | 设置粗细，clamp 到 `[min, max]` |
| `setTool('brush'\|'eraser')` | | 切换工具 |
| `pushHistory()` | | 手动压入快照（一般不用） |
| `destroy()` | | `host.innerHTML = ''`（不解除任何全局监听——组件没注册全局监听） |

`options` 兜底：`colors` 空或缺失 → `['#000000']`；`brush.min` → `1`、`brush.max` → `48`、`brush.defaultSize` → `6`（`defaultSize` 会被 clamp 到 `[min, max]`）。

## DOM 结构（选择器稳定，测试与样式依赖）

```html
<div class="board">                              <!-- 锁定时加 .is-locked -->
  <div class="board-toolbar">
    <button class="swatch[ is-active]" data-color="#000000">
    <input type="range" min max value step="1">
    <span class="size-preview"><i></i></span>     <!-- 橡皮模式加 .is-eraser -->
    <button class="tool-btn[ is-active]" data-tool="brush|eraser">
    <button class="tool-btn" data-action="undo">
    <button class="tool-btn danger" data-action="clear">
  </div>
  <div class="board-canvas-wrap">
    <canvas width="1024" height="576"></canvas>
    <div class="board-paused" hidden>已暂停<span>点击「继续」恢复计时</span></div>
    <div class="board-lock" hidden>时间到</div>
  </div>
</div>
```

事件采用**委托**：工具栏的点击统一挂在 `host` 上，按 `.swatch` / `[data-tool]` / `[data-action]` 分派；滑杆用 `input` 事件。

## 内部实现要点

| 主题 | 实现 |
| --- | --- |
| 坐标系 | canvas 内部固定 `1024 × 576`；`pointerPos(e)` 用 `getBoundingClientRect()` 把 client 坐标线性映射回内部坐标，因此 CSS 任意缩放都不影响笔迹位置 |
| 背景 | `paintBackground()` 填充白色（`setTransform(1,0,0,1,0,0)` 后 `fillRect`），所以「擦除 = 画白色」 |
| 笔迹平滑 | 起点画圆点，移动时用 `quadraticCurveTo` 以「上一点到中点的曲线」连接；抬笔时补一段直线到最后的点 |
| 高频采样 | `pointermove` 里优先使用 `e.getCoalescedEvents()`，逐点绘制，避免快速划动断线 |
| 手写笔压力 | `widthFor(e)`：`pen` 且 `pressure > 0` 时 `base * (0.45 + pressure * 0.9)`；其它指针类型用固定粗细 |
| 橡皮擦 | 不是 `destination-out`，而是把颜色换成 `#ffffff` 且粗细 `× 2.2`；`lineCap` / `lineJoin` 均为 `round` |
| 撤销 | 历史是 dataURL 快照数组（`canvas.toDataURL('image/png')`），上限 `HISTORY_LIMIT = 12`，超出 `shift()` 丢最旧；`undo()` 弹出后用 `Image.onload` 重绘（先 `paintBackground()`） |
| 指针捕获 | `pointerdown` 时 `setPointerCapture`，`pointerup` / `pointercancel` 释放；鼠标只响应左键（`button !== 0` 忽略） |
| 禁用合成 | `syncEnabled()`：`enabled = !disabled && !locked && !paused`；禁用时中断当前笔画、给 `.board` 加 `.is-locked`、按需显示两个遮罩 |

固定常量（模块内，未导出）：`WIDTH = 1024`、`HEIGHT = 576`、`HISTORY_LIMIT = 12`。

## 陷阱与已知行为

- **`hasInk()` 与撤销不一致**：`clear()` 会把 `inked` 置 `false`，但 `undo()` 只重绘、不修改 `inked`。因此「清空 → 撤销」后画面有内容而 `hasInk()` 仍返回 `false`。你画我猜用它判断「是否空白」，会在此场景下误判为空白（弹一次确认框），不影响功能。
- `undo()` 的重绘是异步的（`Image.onload`）；紧接 `undo()` 调用 `toDataURL()` 可能拿到旧画面。
- 历史快照是整张 PNG dataURL，**不是**矢量操作日志；连续大量 `pushHistory()`（每次按下都压一次）会占用内存（上限 12 张）。
- `setColor()` 会把 `tool` 强制切回 `brush`（选了颜色就不再是橡皮）。
- 橡皮用白色覆盖：如果画布背景将来改成非白色，橡皮需要同步改 `beginStroke` 里的 `strokeColor`。
- 组件不注册任何 `window` / `document` 监听，因此 `destroy()` 只清 DOM。
