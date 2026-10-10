# 谁是卧底的配图

把每个词的图片放进这个文件夹，文件名和词一样即可（默认后缀 `.png`）：

```
images/undercover/可乐.png
images/undercover/雪碧.png
```

- 换格式 / 换文件夹 / 单独指定文件名：改 [`js/config.js`](../../js/config.js) 的 `undercover` 段。
- **没有图片也能玩**：卡片上会显示占位框，词本身照常显示。
- 本文件夹下除本文件外的图片默认不纳入版本管理（见 [`.gitignore`](../../.gitignore)）。

完整规则（命名、路径拼接、缺图降级、建议尺寸）见 [`docs/assets.md`](../../docs/assets.md)。
