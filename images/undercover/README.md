# 谁是卧底的配图

把每个词的图片放进这个文件夹，文件名和词一样就行，默认后缀是 `.png`：

```
images/undercover/可乐.png
images/undercover/雪碧.png
images/undercover/猫.png
images/undercover/老虎.png
```

游戏里没写 `normalImage` / `spyImage` 时，就按「`imageDir` + 词 + `imageExt`」去找图
（见 `js/config.js` 的 `undercover` 段）。

## 换成别的格式 / 别的文件名

- **统一换成 jpg**：把 `js/config.js` 里的 `imageExt: '.png'` 改成 `'.jpg'` 即可。
- **只有个别词的文件名不一样**：在题目里单独指定，例如

  ```js
  { normal: '猫', spy: '老虎', normalImage: 'cat.png', spyImage: 'tiger.jpg' },
  ```

- **想放到别的文件夹**：改 `imageDir`，或者在 `normalImage` / `spyImage` 里写完整路径。

## 没有图片也没关系

图片缺失时卡片上会显示一个虚线占位框，**词本身照常显示**，游戏可以正常玩。
占位框里会写出它期望的图片路径，照着放进去刷新页面即可。

图片建议用正方形或 4:3，主体居中，卡片里会自动等比缩放（`object-fit: contain`）。
