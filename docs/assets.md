# 图片资源

项目**不放界面截图 / 示例图片**，只有两类功能性素材：内容区背景图、谁是卧底的题目配图。

## `src/assets/bg/` —— 内容区背景

| 文件 | 作用 |
| --- | --- |
| `night-sky.webp` | 现代浏览器实际加载的版本（`image-set` 优先） |
| `night-sky.jpg` | `image-set` 不支持时的兜底版本 |

- 引用位置：[`src/styles/main.css`](../src/styles/main.css) 的 `.content-bg`（见 [styles.md](styles.md)）。
- 由 Vite 打包并生成带哈希的文件名；不要在配置里手写 `/assets/night-sky-*.webp`，交给 CSS 引用。
- 原图竖构图约 2480 × 3508；`cover` + `center bottom`，宽屏裁上下、留住鸟居与晚霞，窄屏几乎不裁。
- 换图流程：把压缩后的图放进 `src/assets/bg/`，**同时提供 `.webp` 与 `.jpg` 两个同名版本**（或改 `.content-bg` 的 `background-image`）。

## `public/images/undercover/` —— 卧底配图

### 命名规则

图片文件名默认 = 题目的词 + `imageExt`，放在 `imageDir` 下：

```
public/images/undercover/可乐.png       ← 题目 { normal: '可乐', spy: '雪碧' }
public/images/undercover/雪碧.png
```

- `imageDir` 默认 `images/undercover/`，`imageExt` 默认 `.png`；两者都在 [`src/config/index.ts`](../src/config/index.ts) 的 `undercover` 段里改（见 [config.md](config.md)）。
- 单独指定文件名：`{ normal: '猫', spy: '老虎', normalImage: 'cat.png', spyImage: 'tiger.jpg' }`；也可以在词对象里写 `{ text: '猫', image: 'cat.png' }`。
- 路径拼接规则见 [config.md](config.md) 的「图片路径规则」。
- 建议尺寸：正方形或 4:3，主体居中；卡片内用 `object-fit: contain` 等比缩放。

### 运行期 URL

配置里保存的是相对路径（如 `images/undercover/可乐.png`）。渲染时 [`assetUrl()`](../src/lib/assets.ts) 会补上 `import.meta.env.BASE_URL`：

- 根路径 / dev：`/images/undercover/可乐.png`；
- 子目录部署（`base: './'`）：`./images/undercover/可乐.png`。

图片放在 `public/` 下，Vite 构建时**原样复制**到 `dist/images/undercover/`，不参与打包哈希。

### 版本管理策略（`.gitignore`）

```
/public/images/undercover/*
!/public/images/undercover/README.md
```

- **题目配图不入库**：除 `README.md` 外，`public/images/undercover/` 下的文件全部被忽略。克隆仓库后需要自行提供图片。
- 因此缺图是常态，代码必须始终能优雅降级（见下）。
- 注意：这些图片仍然会被复制进 `dist/`，所以构建产物约 24MB；这是当前取舍，不是 bug。

### 缺图兜底（不可回退为报错）

| 情况 | 表现 |
| --- | --- |
| 该词没配图（`image` 为空） | 卡片背面显示占位「没有配图 / 在 src/config/index.ts 里给这个词写 image」 |
| 配了图但文件不存在 / 加载失败 | `<img>` 隐藏，显示占位「图片待补充」+ 期望路径 |
| 两种情况 | **词照常显示**，抽题、发牌、按住查看、一键翻开全部可用 |

实现位置：[`UcCard.vue`](../src/games/undercover/UcCard.vue) 的 `@error` 与 `onMounted` 里对 `complete && naturalWidth === 0` 的检查。

## 新增图片资源时的检查清单

1. 是否真的必要？本项目的原则是**不放示例 / 装饰性图片**。
2. 功能性图片（背景、配图）是否只有 `.webp` / `.jpg` / `.png` 这类可直接被浏览器加载的格式？
3. 是否需要写进 `.gitignore`（大体积 / 有版权的题目配图一律不入库）？
4. 缺失时的降级表现是否可接受（不能出现破图图标或报错）？
5. 相关文档（本文件、[styles.md](styles.md)、[config.md](config.md)）是否已同步？
