export const BOARD_WIDTH = 1024
export const BOARD_HEIGHT = 576

export type BoardTool = 'brush' | 'eraser'

/** 画板快照：刷新恢复 / 作品捕获共用。`inked` 不能用像素颜色判断（白底画白色仍是「有笔迹」）。 */
export interface DrawingSnapshot {
  image: string
  inked: boolean
}

/** 画板对外暴露的命令式 API（画布本身不用 Vue 重绘）。 */
export interface DrawingBoardApi {
  toDataURL(): string
  hasInk(): boolean
  /** 用 dataURL 恢复画布（刷新后继续作画）；`inked` 与快照一起恢复。 */
  restoreImage(image: string, inked?: boolean): void
  clear(): void
  undo(): void
  setColor(color: string): void
  setSize(size: number): void
  setTool(tool: BoardTool): void
}
