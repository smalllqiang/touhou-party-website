# 画板组件

- 组件：[`src/components/DrawingBoard.vue`](../src/components/DrawingBoard.vue)
- 常量与 API 类型：[`src/lib/drawing-board.ts`](../src/lib/drawing-board.ts)
- 样式：`.board*`（见 [styles.md](styles.md)）

画布保持**命令式**：canvas 的笔画状态（路径、历史、`hasInk`）不放进 Vue 响应式；Vue 只负责工具栏、暂停 / 锁定遮罩这些低频 UI。

## Props

| prop | 类型 | 说明 |
| --- | --- | --- |
| `colors` | `string[]` | 调色盘；空数组时组件内回退 `#000000` 作为当前色（配置层已兜底） |
| `brush` | `{ min, max, defaultSize }` | 粗细滑杆范围与默认值（配置层已归一化） |
| `paused` | `boolean` | 暂停：禁止绘制 + 显示「已暂停」遮罩 |
| `locked` | `boolean` | 时间到：禁止绘制 + 显示「时间到」遮罩 |
| `disabled` | `boolean` | 外部强制禁用（优先于上面两个） |

`enabled = !disabled && !locked && !paused`；禁用时中断当前笔画、给根节点加 `.is-locked`。

## Emits

| 事件 | 载荷 | 时机 |
| --- | --- | --- |
| `ready` | `DrawingBoardApi` | 组件挂载且拿到 2D context 后；父级用它保存命令式 API |
| `change` | `DrawingSnapshot`（`{ image, inked }`） | 抬笔 / 撤销完成 / 清空之后；父级用来持久化本阶段快照 |

## Expose

```ts
interface DrawingBoardApi {
  toDataURL(): string          // 导出 PNG dataURL
  hasInk(): boolean            // 当前是否算「有笔迹」
  restoreImage(image: string, inked?: boolean): void  // 用快照恢复画布，清空撤销栈
  clear(): void                // 清空（先压历史，可撤销）
  undo(): void                 // 回退一步
  setColor(css: string): void  // 选颜色，同时切回画笔
  setSize(n: number): void     // 设置粗细，clamp 到 [min, max]
  setTool(tool: 'brush' | 'eraser'): void
}
```

父级用法（`PlayScreen.vue`）：

```vue
<DrawingBoard
  :colors="config.colors"
  :brush="config.brush"
  :paused="paused"
  :locked="locked"
  @ready="emit('board', $event)"
  @change="emit('board-change', $event)"
/>
```

`useDrawGuess` 在 `setBoard(api)` 后，用 `api.toDataURL()` / `api.hasInk()` 捕获作品；如果 localStorage 里有当前 `round + phase` 的快照，会调 `api.restoreImage()` 画回去。切阶段时 `PlayScreen` 卸载并 emit `board: null`。

## DOM 结构（样式与测试依赖）

```html
<div class="board" :class="{ 'is-locked': !enabled }">
  <div class="board-toolbar">
    <button class="swatch[ is-active]" data-color="#000000">
    <input type="range" min max value step="1">
    <span class="size-preview[ is-eraser]"><i></i></span>
    <button class="tool-btn[ is-active]" data-tool="brush|eraser">
    <button class="tool-btn" data-action="undo">
    <button class="tool-btn danger" data-action="clear">
  </div>
  <div class="board-canvas-wrap">
    <canvas width="1024" height="576"></canvas>
    <div class="board-paused" :hidden="!paused">已暂停<span>点击「继续」恢复计时</span></div>
    <div class="board-lock" :hidden="!locked">时间到</div>
  </div>
</div>
```

在 play 界面里，`.play .board*` 会把组件铺满整个内容区：`.board` / `.board-canvas-wrap` 都是 `position: absolute; inset: 0`，canvas 拉伸到 100% 宽高；`.board-toolbar` 则绝对定位悬浮在画板底部。组件结构不变，DOM 选择器仍然适用。

## 内部实现要点

| 主题 | 实现 |
| --- | --- |
| 坐标系 | canvas 内部固定 `1024 × 576`；`getBoundingClientRect()` 把 client 坐标线性映射回内部坐标，CSS 任意缩放不影响笔迹位置 |
| 背景 | 填充白色（`setTransform(1,0,0,1,0,0)` 后 `fillRect`），所以「擦除 = 画白色」 |
| 笔迹平滑 | 起点画圆点；移动时用 `quadraticCurveTo` 连接「上一点到中点」；抬笔补直线 |
| 高频采样 | `pointermove` 优先用 `getCoalescedEvents()` 逐点绘制 |
| 手写笔压力 | `pen` 且 `pressure > 0` 时 `base * (0.45 + pressure * 0.9)` |
| 橡皮擦 | 颜色换成 `#ffffff` 且粗细 `× 2.2`；`lineCap` / `lineJoin` 为 `round` |
| 撤销 | `{ image, inked }` 快照数组，上限 `HISTORY_LIMIT = 12`；`undo()` 弹出后 `Image.onload` 重绘（先填白）并恢复 `inked` |
| 指针捕获 | `pointerdown` 时 `setPointerCapture`；`pointerup` / `pointercancel` 释放；鼠标只响应左键 |
| 事件绑定 | canvas 事件在 `onMounted` 里 `addEventListener`；工具栏仍用模板 `@click` / `@input` |

## 陷阱与已知行为

- `restoreImage()` 会**同步**把 `inked` 设回快照值，但像素是等 `Image.onload` 后异步画上去的；解码完成前的 `hasInk()` 已经可信。
- 恢复后撤销栈被清空：刷新前按下的每一步都没有保存，「撤销」只能撤销刷新后的笔画。
- `undo()` 的重绘是异步的；紧接 `undo()` 调 `toDataURL()` 可能拿到旧画面。`change` 事件在重绘完成后才发。
- 历史是整张 PNG 快照，不是矢量操作日志；每次按下都压一张，上限 12 张。
- 橡皮用白色覆盖：如果将来把画布背景改成非白色，`beginStroke` 里的 `strokeColor` 要同步改。
- 组件不注册任何 `window` / `document` 监听，所以不需要在卸载时移除全局事件；Vue 卸载会带走 canvas 和模板监听。
- 不要给 canvas 加 `v-bind` 的绘制数据；所有笔画状态留在组件闭包内，避免每次 `pointermove` 触发 Vue 更新。
