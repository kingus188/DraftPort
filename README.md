<p align="center">
  <img src="apps/web/public/favicon-dark.svg" width="80" height="80" alt="DraftPort Logo" />
</p>

<h1 align="center">DraftPort</h1>

<p align="center">
  <strong>面向多平台发布的 Markdown 内容编辑器</strong>
</p>

<p align="center">
  告别重复排版。Markdown 写作，多平台内容整理与发布。<br>
  为内容创作者设计的<b>本地优先</b>编辑器。
</p>

---

## ✨ 特性

|     | 功能                 | 说明                                                     |
| --- | -------------------- | -------------------------------------------------------- |
| 📝  | **Markdown 语法**    | 支持 GFM、表格、代码高亮、数学公式                       |
| 🎨  | **主题切换**         | 内置十余款精美主题，支持可视化设计器或自定义 CSS         |
| 📋  | **多平台富文本复制** | 支持微信公众号 / 知乎 / 掘金，减少跨平台发布前的二次排版 |
| 💾  | **本地优先**         | 数据存储在本地，无需登录，隐私安全                       |
| 📱  | **跨平台**           | Web 端 + 桌面端（macOS / Windows / Linux）               |
| 🌙  | **界面风格**         | 亮色 / 深色 双模式可选                                   |
| 👁️  | **深色模式预览**     | 预览微信深色模式效果，还原度达 98%+                      |
| 🪟  | **灵活预览布局**     | 支持收起预览面板、预览优先模式和预览宽度调整             |
| 🔍  | **高级搜索**         | 支持正则匹配、全词匹配、批量替换                         |
| 🧭  | **最近打开**         | 桌面端记录最近打开的文件和文件夹，启动后可快速续写       |
| 🔄  | **文件夹刷新**       | 侧边栏支持手动刷新工作区文件树，便于同步外部文件改动     |
| 🎞️  | **滑动图组**         | 支持水平滑动的多图展示组件，丰富视觉体验                 |
| 📊  | **Mermaid 图表**     | 内置流程图、时序图、甘特图等多种图表，自动适配主题配色   |

---

## 🆕 近期更新

- 新增知乎和掘金富文本复制，和微信公众号复制一起覆盖常见内容发布平台。
- 桌面端新增「最近打开」，可从启动页或原生菜单快速回到近期文件和文件夹。
- 预览区支持一键收起、显示恢复和预览优先布局，编辑长文时可按当前任务调整空间。
- 侧边栏新增文件夹刷新入口，外部新增、删除或移动文件后可以手动同步文件树。

---

## 🚀 快速开始

### 桌面版下载

前往 [Releases](https://github.com/kingus188/DraftPort/releases) 下载对应平台安装包：

- **macOS**: `.dmg`（Intel 版）/ `-arm64.dmg`（Apple Silicon 版）
- **Windows**: `.exe`
- **Linux**: `.AppImage`

> ⚠️ **macOS 用户注意**：首次打开时如提示"应用已损坏"，请在终端执行：
>
> ```bash
> xattr -cr /Applications/DraftPort.app
> ```
>
> ⚠️ **Windows 用户注意**：如 SmartScreen 提示"未知发布者"，点击「更多信息」→「仍要运行」
>
> ⚠️ **Linux 用户注意**：运行前需设置可执行权限：`chmod +x DraftPort.AppImage`

---

## 🛠️ 本地开发

### 环境要求

- Node.js ≥ 18
- pnpm ≥ 9（推荐 `corepack enable pnpm`）
- Rust stable toolchain（桌面端 Tauri 内核需要）

### 安装与运行

```bash
# 安装依赖
pnpm install

# 启动 Web 开发服务器
pnpm dev:web

# 启动桌面端（Tauri 内核，会先构建 Web）
pnpm dev:desktop
```

### 构建

```bash
# 构建 Web
pnpm --filter @draftport/web build

# 构建桌面应用（Tauri 内核）
pnpm build:desktop
```

---

## 📁 项目结构

```
DraftPort/
├── apps/
│   ├── web/        # React + Vite 前端
│   └── tauri/      # Tauri 桌面端
├── packages/
│   └── core/       # Markdown 解析 / 主题 / 工具
├── templates/      # 主题 CSS 模板
└── turbo.json      # Turborepo 配置
```

---

## 💬 反馈

如有问题或建议，欢迎提交 [Issue](https://github.com/kingus188/DraftPort/issues)。

---

## 🔁 来源与协议

DraftPort 是基于 [WeMD](https://github.com/tenngoxars/WeMD) 的二次开发项目，后续会沿着多平台内容编辑与发布方向继续演进。

本项目继续使用 [MIT](LICENSE) 协议。原项目的 MIT 授权与版权声明应随源码和分发包一同保留。

---

## 🤝 致谢

本项目的微信深色模式预览算法深度参考了微信官方开源的 [wechatjs/mp-darkmode](https://github.com/wechatjs/mp-darkmode) 核心逻辑。感谢微信团队为开发者提供的优秀解决方案！

---

## 📄 License

[MIT](LICENSE) © DraftPort Team
