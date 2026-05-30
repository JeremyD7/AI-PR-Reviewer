# 🤖 AI PR Reviewer

基于 AI 自动审查 GitHub Pull Request 的代码质量工具。

## 技术栈

| 层级 | 技术 |
|-------|-----------|
| 框架 | **Nuxt 3** (Vue 3 + Vite + Nitro) |
| UI 库 | **Nuxt UI v2** (Tailwind CSS + Headless UI) |
| 数据库 | **Supabase** (PostgreSQL + Auth + Realtime) |
| AI 引擎 | **DeepSeek API** (V3，兼容 OpenAI 接口) |
| 状态管理 | **Pinia** |
| 部署 | Vercel / Node 服务器 |

## 项目结构

```
├── app.vue                    # 根组件
├── app.config.ts              # 应用级 UI 配置
├── nuxt.config.ts             # Nuxt 配置
├── pages/
│   ├── index.vue              # 仪表盘（统计数据 + 最近审查）
│   ├── login.vue              # GitHub OAuth 登录
│   ├── auth/callback.vue      # OAuth 回调处理
│   ├── repos/
│   │   ├── index.vue          # 仓库列表 + 添加仓库
│   │   └── [id].vue           # 单个仓库详情 + 设置
│   ├── prs/
│   │   └── [id].vue           # PR 审查结果
│   └── settings.vue           # 用户设置
├── layouts/
│   ├── default.vue            # 主布局（含导航栏）
│   └── auth.vue               # 登录页布局
├── components/
│   ├── ToastContainer.vue     # Toast 通知组件
│   └── EmptyState.vue         # 空状态占位组件
├── composables/
│   ├── useAuth.ts             # 认证相关钩子
│   └── useGitHub.ts           # GitHub API 客户端
├── stores/
│   └── app.ts                 # 全局状态管理（Pinia）
├── server/
│   ├── api/
│   │   ├── webhook/github.post.ts    # GitHub Webhook 接收
│   │   ├── reviews/trigger.post.ts   # 手动触发审查
│   │   ├── github/repos.get.ts       # GitHub 仓库代理
│   │   └── repos/index.get.ts        # 用户仓库列表
│   └── utils/
│       ├── ai-reviewer.ts      # ⭐ AI 审查引擎（DeepSeek）
│       ├── github.ts           # GitHub API 工具函数
│       └── supabase.ts         # 服务端 Supabase 客户端
├── middleware/
│   └── auth.ts                 # 鉴权守卫
├── types/
│   ├── database.ts             # 数据库类型定义
│   └── github.ts               # GitHub API 类型
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # 数据库建表语句
└── assets/css/main.css         # 全局样式
```

## 准备工作

1. **Node.js** ≥ 18
2. **Supabase** 账号 → [supabase.com](https://supabase.com)
3. **GitHub OAuth App** → [github.com/settings/developers](https://github.com/settings/developers)
4. **DeepSeek API Key** → [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 Supabase 项目

1. 前往 [supabase.com](https://supabase.com) → New Project
2. 复制 `SUPABASE_URL` 和 `SUPABASE_KEY`（anon key）
3. 进入 SQL Editor → 粘贴并执行 `supabase/migrations/001_initial_schema.sql`

### 3. 创建 GitHub OAuth App

1. GitHub → Settings → Developer Settings → OAuth Apps
2. 注册新应用：
   - 主页 URL：`http://localhost:3000`
   - 回调 URL：`http://localhost:3000/auth/callback`
3. 复制 `Client ID` 和 `Client Secret`

### 4. 配置 Supabase Auth

在 Supabase Dashboard → Authentication → Providers：
- 启用 **GitHub**
- 填入步骤 3 的 Client ID 和 Client Secret

### 5. 填写 `.env`

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
GITHUB_REDIRECT_URI=http://localhost:3000/auth/callback

DEEPSEEK_API_KEY=sk-your-key
NUXT_PUBLIC_APP_URL=http://localhost:3000
```

### 6. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

## 工作流程

```
1. 用户通过 GitHub OAuth 登录
2. 用户连接 GitHub 上的仓库
3. 当 PR 被创建/更新 → GitHub 发送 Webhook
4. 服务端接收 Webhook → 获取 PR diff
5. AI（DeepSeek）分析代码变更：
   • 安全漏洞
   • 逻辑 Bug / 边界情况
   • 性能问题
   • 最佳实践违规
   • 代码风格问题
6. 审查结果保存到数据库 + 以 PR 评论形式发布
```

## API 接口

| 方法 | 路径 | 说明 |
|--------|------|-------------|
| `POST` | `/api/webhook/github` | 接收 GitHub PR Webhook |
| `POST` | `/api/reviews/trigger` | 手动触发代码审查 |
| `GET`  | `/api/github/repos` | 代理 GitHub 仓库 API |
| `GET`  | `/api/repos` | 列出用户已配置的仓库 |

## 数据库结构

5 张表，均启用 RLS（行级安全）：
- `profiles` — 关联 Supabase Auth 用户
- `repositories` — 受监控仓库及设置
- `pull_requests` — PR 记录
- `reviews` — AI 审查结果
- `review_comments` — 每条审查发现

## 开源协议

MIT
