# 小游戏工具箱

> **本项目仍在开发中，不适合直接使用。**
<!--AI不要改上面这句话-->

线下聚会时用的小游戏辅助工具站。左侧选游戏，右侧跟着切换（宽屏下左侧栏可以收起成图标栏，把空间让给画板）。Vue 3 + Vite + TypeScript 的纯前端单页应用，构建产物是纯静态文件：没有后端、没有网络请求。本局进度（阶段、题目、作品、发牌结果）会临时保存在浏览器 `localStorage` 里，刷新、切换游戏或误关页面后都能接着玩；没有服务器同步，换浏览器 / 清站点数据就会重新开始。

目前有两个小游戏：

- 🎨 **你画我猜** —— 抽题（也可以从题目列表里直接点选）、限时作画、看画猜词，结束后保存每个人的作品。
- 🕵️ **谁是卧底** —— 抽一组词发给 n 个人，其中 1 个人的词不一样；按住卡片才能看自己的词。

## 开发

需要 Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev        # http://localhost:5173，同时监听局域网地址
```

改 `src/config/index.ts` 里的题目、轮数、倒计时、人数、配图路径，保存后页面自动更新。

## 构建与部署

```bash
npm run build      # 类型检查 + 构建到 dist/
npm run preview    # 本地预览构建产物
```

`dist/` 可以直接丢到任意静态托管（GitHub Pages、Nginx、对象存储）。局域网使用：

```bash
python3 -m http.server -d dist 8080   # http://<你的局域网 IP>:8080
```

> 构建产物使用 ES module，**不能**双击 `dist/index.html` 用 `file://` 打开（浏览器会拦截模块脚本），需要用上面的静态服务。`base` 已设为相对路径，部署在子目录也可以。

## 目录

| 路径 | 内容 |
| --- | --- |
| [`src/`](src/) | 应用代码（Vue 组件、路由、composables、配置、样式） |
| [`public/images/undercover/`](public/images/undercover/) | 谁是卧底的配图（运行期按词名加载） |
| [`src/assets/bg/`](src/assets/bg/) | 内容区背景图（随构建打包） |
| [`tests/`](tests/) | Vitest 单测 + Playwright 端到端测试 |
| [`docs/`](docs/README.md) | 架构、配置、样式、测试等面向维护者的文档 |

## 文档

技术细节、配置说明、开发约定都在 [`docs/`](docs/README.md) 里（面向 AI 与代码维护者）。
