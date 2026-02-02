# X Post Grabber - 网页版

抓取 X (Twitter) 文章内容，支持 AI 生成标签并推送到 WordPress。

## 功能特性

- 输入 X 文章链接自动抓取内容
- 支持普通推文和长文章格式
- 保留文字、图片、代码块、标题格式
- AI 自动生成标签（支持多种 AI 服务）
- 一键推送到 WordPress（草稿）
- 支持 Gutenberg 和 Classic 编辑器格式

## 部署步骤

### 1. 部署 Cloudflare Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 Workers & Pages
3. 创建新 Worker
4. 将 `worker.js` 内容粘贴进去
5. 部署并记录 Worker URL（如 `https://x-grabber.xxx.workers.dev`）

### 2. 部署前端页面

将以下文件部署到任意静态托管服务：

```
index.html
styles.css
app.js
```

推荐平台：
- GitHub Pages
- Vercel
- Netlify
- Cloudflare Pages

### 3. 配置使用

1. 打开网页版
2. 点击右上角设置按钮
3. 填写 Cloudflare Worker URL
4. 配置 WordPress 信息（可选）
5. 配置 AI 服务（可选）
6. 保存设置

## AI 服务支持

| 服务 | 特点 | 获取 API Key |
|------|------|-------------|
| 硅基流动 | 完全免费 | https://siliconflow.cn |
| DeepSeek | 极低价格 | https://platform.deepseek.com |
| Groq | 完全免费 | https://console.groq.com |
| 阿里百炼 | 新用户免费 | https://dashscope.aliyun.com |
| OpenAI | GPT-3.5 | https://platform.openai.com |
| Claude | Anthropic | https://console.anthropic.com |
| Kimi | Moonshot | https://platform.moonshot.cn |
| GLM | 智谱 | https://open.bigmodel.cn |
| MiniMax | - | https://api.minimax.chat |

## 文件结构

```
x-post-grabber-web/
├── index.html      # 主页面
├── styles.css      # 样式文件
├── app.js          # 主逻辑
├── worker.js       # Cloudflare Worker 代理
└── README.md       # 说明文档
```

## 注意事项

- Cloudflare Worker 免费套餐每天 10 万次请求
- X 页面需要登录才能查看完整内容，Worker 可能无法获取需要登录的内容
- 设置保存在浏览器 localStorage 中，清除浏览器数据会丢失

## 与 Chrome 扩展版的区别

| 特性 | Chrome 扩展 | 网页版 |
|------|------------|--------|
| 需要安装 | 是 | 否 |
| 抓取方式 | 直接在页面执行 | 通过 Worker 代理 |
| 登录状态 | 使用用户登录状态 | 无法使用 |
| 跨平台 | 仅 Chrome | 任意浏览器 |

## License

MIT
