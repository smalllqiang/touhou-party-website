export const BOARD_WIDTH = 1024
export const BOARD_HEIGHT = 576

export type BoardTool = 'brush' | 'eraser'

/** 画板对外暴露的命令式 API（画布本身不用 Vue 重绘）。 */
export interface DrawingBoardApi {
  toDataURL(): string
  hasInk(): boolean
  clear(): void
  undo(): void
  setColor(color: string): void
  setSize(size: number): void
  setTool(tool: BoardTool): void
}
