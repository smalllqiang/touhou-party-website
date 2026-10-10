# 图片资源（images/）

项目**没有多余的界面截图**：`docs/screenshots/` 已删除，图片资源只剩下面两类功能性素材。不要再往仓库里添加示例截图。

## images/bg/ —— 内容区背景

| 文件 | 作用 |
| --- | --- |
| `night-sky.webp` | 现代浏览器实际加载的版本（`image-set` 优先） |
| `night-sky.jpg` | `image-set` 不支持时的兜底版本 |
| 仓库根 `背景.png` | 源图（裁切前的原图），未纳入版本管理，仅作为工作区素材 |

- 引用位置：`css/style.css` 的 `.content-bg`（见 [styles.md](styles.md)）。
- 原图竖构图约 2480 × 3508；用 `background-size: cover` + `background-position: center bottom` 定位，宽屏裁掉上下、保留画面下半部分（鸟居 + 晚霞），窄屏几乎不裁切。
- 换图流程：把压缩后的图放进 `images/bg/`，**同时提供 `.webp` 与 `.jpg` 两个同名版本**（或改 `.content-bg` 的 `background-image`）。

## images/undercover/ —— 谁是卧底的配图

### 命名规则

图片文件名默认 = 题目的词 + `imageExt`，放在 `imageDir` 下：

```
images/undercover/可乐.png       ← 题目 { normal: '可乐', spy: '雪碧' }
images/undercover/雪碧.png
```

- `imageDir` 默认 `images/undercover/`，`imageExt` 默认 `.png`；两者都在 `js/config.js` 的 `undercover` 段里改（见 [config.md](config.md)）。
- 单独指定文件名：`{ normal: '猫', spy: '老虎', normalImage: 'cat.png', spyImage: 'tiger.jpg' }`；也可以在词对象里写 `{ text: '猫', image: 'cat.png' }`。
- 路径拼接规则（含 `/` 的相对路径会被原样使用，不再拼 `imageDir`）见 [config.md](config.md) 的 `joinPath` 一节。
- 建议尺寸：正方形或 4:3，主体居中；卡片内用 `object-fit: contain` 等比缩放。

### 版本管理策略（`.gitignore`）

```
/images/undercover/*
!/images/undercover/README.md
```

- **题目配图不入库**：除 `README.md` 外，`images/undercover/` 下的文件全部被忽略。克隆仓库后需要自行提供图片。
- 因此缺图是常态，代码必须始终能优雅降级（见下）。

### 缺图兜底（不可回退为报错）

| 情况 | 表现 |
| --- | --- |
| 该词没配图（`image` 为空） | 卡片背面显示静态占位「没有配图 / 在 config.js 里给这个词写 image」 |
| 配了图但文件不存在 / 加载失败 | `<img>` 隐藏，显示占位「图片待补充」+ 期望路径 |
| 两种情况 | **词照常显示**，抽题、发牌、按住查看、一键翻开全部可用 |

实现位置：`js/games/undercover.js` 的 `mediaHtml()` 与 `bindReveal()`（`error` 事件 + `complete && naturalWidth === 0` 检查）。

## 新增图片资源时的检查清单

1. 是否真的必要？本项目的原则是**不放示例 / 装饰性图片**。
2. 功能性图片（背景、配图）是否只有 `.webp` / `.jpg` 这类可直接被浏览器加载的格式？
3. 是否需要写进 `.gitignore`（大体积 / 有版权的题目配图一律不入库）？
4. 缺失时的降级表现是否可接受（不能出现破图图标或报错）？
5. 相关文档（本文件、[styles.md](styles.md)、[config.md](config.md)）是否已同步？
