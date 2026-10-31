/** 题目列表共用元件的数据形状：left 是普通词 / 题目，right 是卧底词（可选）。 */
export interface PickerItem {
  left: string
  right?: string
}
