# PromptPlay · 提示即玩

> *Type a theme, play a world.*  
> 输入一个主题，进入一个可玩的像素世界。

An experimental **2D pixel side-scroller** powered by AI image generation.  
一款由 **AI 图像生成** 驱动的实验性 **2D 像素横版** 网页游戏。

Pick a preset theme or write your own prompt — the system generates pixel-art characters, backgrounds, ground tiles, and obstacles, then drops you straight into the game.  
选择预设主题或输入自定义提示词，系统自动生成像素风角色、背景、地面与障碍物，并让你 **立刻开始游玩**。

---

## ✨ Features / 功能亮点

- **AI Asset Pipeline / AI 资产生成** — Character, background, ground & obstacle via DashScope Qwen-Image
- **Theme System / 主题系统** — Fantasy, Cyberpunk, Western, Underwater + custom themes
- **Multi-level Worlds / 多关卡** — Generate 1–10 levels in one run
- **Background Cutout / 自动抠图** — Checkerboard removal for sprites & obstacles
- **Play Instantly / 即玩即走** — WASD / Arrow keys move, Space jump, ESC pause
- **Local Persistence / 本地持久化** — Themes & game data saved in browser storage

---

## 🛠 Tech Stack / 技术栈

| Layer | Stack |
|-------|-------|
| Framework | Next.js 15 (App Router) + React 19 |
| UI | Ant Design 5 + Tailwind CSS 4 |
| State | Zustand + localStorage |
| Animation | Framer Motion + GSAP |
| Image AI | DashScope Qwen-Image API |
| Image Processing | Sharp (server-side cutout) |

---

## 🚀 Quick Start / 快速开始

### Prerequisites / 前置要求

- Node.js 18+
- pnpm（推荐）或 npm
- DashScope API Key（[阿里云百炼](https://dashscope.aliyun.com/)）

### Install & Run / 安装与运行

```bash
git clone git@github.com:zbjgrhr/pixel-seed.git
cd pixel-seed
pnpm install

# 配置 API Key — 复制并编辑:
cp .env.example .env.local
# 在 .env.local 中设置: DASHSCOPE_API_KEY=your-key-here

pnpm dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

也可以在页面左侧 **API Key** 输入框中填写密钥（会随请求传给后端）。  
You can also enter your API Key in the sidebar — it will be sent with each generation request.

### Build / 构建

```bash
pnpm build
pnpm start
```

---

## 🎮 How to Play / 游玩方式

1. **Select or create a theme / 选择或创建主题** — 左侧菜单选预设，或填写自定义名称 + 描述后点 *Create Theme*
2. **Preview assets / 预览资源** — 右侧面板查看角色、关卡背景、地面、障碍物
3. **Start Game / 开始游戏** — 点击 *Start Game* 进入 Canvas
4. **Controls / 操作**
   - `A` / `D` 或 `←` / `→`：移动 Move
   - `Space`：跳跃 Jump
   - `ESC`：暂停 Pause

---

## 📁 Project Structure / 项目结构

```
app/
  api/generate/       # AI 图像生成 API
  api/process-image/  # 抠图处理 API
  page.tsx            # 主页面
components/
  GameCanvas.tsx      # 游戏画布与物理逻辑
  SideMenu.tsx        # 侧边栏（模型、主题、操作）
  ThemePreview.tsx    # 主题资源预览
lib/
  store.ts            # Zustand 全局状态
  theme-utils.ts      # 主题 ID 工具函数
configs/
  index.ts            # 预设主题 & 提示词模板
```

---

## ⚙️ Environment Variables / 环境变量

| Variable | Required | Description |
|----------|----------|-------------|
| `DASHSCOPE_API_KEY` | Yes* | DashScope API 密钥 |
| `NEXT_PUBLIC_BASE_URL` | No | 服务端抠图回调地址，默认 `http://localhost:3000` |

\* 也可仅在 UI 中填写 API Key。  
\* Or provide the key only in the UI input field.

---

<p align="center">
  <b>PromptPlay</b> — From prompt to playable pixel world.<br>
  从提示词，到可玩的像素世界。
</p>
