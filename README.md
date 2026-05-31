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

## 设计思路

### 关键因素考量

#### 分析准确性

系统选用 **DeepSeek-V3**（`deepseek-chat`）作为 AI 审查引擎。该模型在代码理解任务上表现优异，原生支持 64K token 上下文窗口，能够完整容纳大型 PR 的 diff 内容。

通过精心设计的 System Prompt 确立审查优先级链路——**安全漏洞 → 逻辑错误 → 性能问题 → 最佳实践 → 代码风格**——确保 AI 将注意力集中在真正关键的问题上。审查输出采用严格 JSON Schema 约束，配合服务端字段校验与异常降级兜底（非法 `severity`/`category` 值自动修正为安全默认值），保证结果始终结构化、可消费。

#### 上下文理解

AI 审查并非仅依赖 diff 文本本身，而是综合多维度上下文信息进行判断：

| 上下文来源 | 作用 |
|-----------|------|
| **PR 标题** | 帮助 AI 理解本次变更的业务意图与修改背景 |
| **审查类别偏好** | 用户可为每个仓库自定义关注的审查维度（如仅关注安全+性能） |
| **忽略规则** | 支持 glob 模式（`*.lock`、`*.json`、`*.md`），过滤噪声文件，避免干扰审查焦点 |
| **Diff 智能截断** | 变更超过 150K 字符时自动截断，在完整性与 token 消耗之间取得平衡 |
| **GitHub OAuth Token** | 通过用户授权凭据调用 GitHub API，获取完整 PR 文件差异（含上下文行） |

#### 误报与漏报控制

```
低温度推理 (0.1)           →  高一致性，可复现的审查结果
    ↓
四级严重度分级             →  快速区分必修复项 vs 可选建议
    ↓
PR 评论智能过滤            →  仅推送 critical + warning 到 GitHub
    ↓
白名单校验 + 降级兜底      →  异常输出自动修正，不污染数据库
```

- **低温度推理**（`temperature: 0.1`）— 显著降低随机性，确保同一份 diff 多次审查结果一致，避免"有时报有时不报"的体验
- **四级严重度**（`critical` / `warning` / `suggestion` / `info`）— 帮助开发者快速分类处理，而非淹没在一堆同等重要的问题中
- **PR 评论过滤** — 向 GitHub 推送评论时，摘要仅展示 `critical` 和 `warning` 级别，完整报告保留在应用 Dashboard 中，避免在 PR 页面造成信息过载
- **输出校验层** — 对 AI 返回的每个字段做白名单合规检查，非法值自动映射为安全默认值，杜绝脏数据入库

#### 响应速度

| 环节 | 策略 | 收益 |
|------|------|------|
| Webhook 接收 | 立即返回 200，审查异步执行 | GitHub 3 秒超时不会触发重试 |
| AI 推理 | `stream: false`，一次性返回 | 简化错误处理，减少网络往返 |
| 数据库查询 | 高频字段索引覆盖 | 列表/详情页面毫秒级响应 |
| 部署架构 | Cloudflare Pages 边缘网络 | 全球 CDN 就近响应，首字节延迟 < 100ms |
| 文件忽略 | 构建时过滤 + diff 前过滤 | 减少无效数据进入 AI 上下文 |

#### 使用体验

- **零配置上手** — GitHub OAuth 一键登录，自动获取仓库权限，无需手动生成 Token
- **完全自动化** — Webhook 注册后，PR 创建/更新时自动触发审查，开发者无需任何额外操作
- **Dashboard 可视化** — 评分趋势、问题分类饼图、审查历史时间线，项目质量一目了然
- **灵活可配** — 每个仓库独立配置：审查类别、忽略规则、最大文件数、语言偏好
- **PR 内联反馈** — 审查结果以 PR Review 评论形式直接出现在 GitHub 对应代码行上，与现有开发流程无缝衔接

### 模型选择

当前以 **DeepSeek-V3** 作为默认引擎，核心考量：

| 决策维度 | 选择 | 设计理由 |
|----------|------|---------|
| 基础模型 | DeepSeek-V3 (`deepseek-chat`) | 代码理解能力业内第一梯队，API 完全兼容 OpenAI 格式，减少供应商锁定风险 |
| 上下文窗口 | 64K tokens（≈180K 字符） | 覆盖 95%+ 的 PR diff 规模，超出时自动截断保护 |
| 推理温度 | `0.1` | 代码审查场景要求高确定性和可复现性，低温度是最优解 |
| 输出格式 | 约束 JSON Schema | 结构化数据可直接入库、可直接渲染前端 UI，无需二次解析 |
| max_tokens | `4096` | 在审查覆盖度与响应延迟之间取均衡点 |

**架构上的模型无关性**：系统通过 `deepseek-chat` 常量 + OpenAI-compatible 接口设计，天然支持切换至任意兼容模型（Claude、GPT-4o、Gemini、Qwen 等）。`reviews` 表的 `model` 字段记录了每次审查实际使用的模型，为后续 A/B 对比和模型迁移提供数据支撑。

### 上下文获取方式

```
┌──────────────┐    Webhook Event    ┌─────────────────┐    OAuth Token    ┌──────────────┐
│  GitHub.com  │ ──────────────────→ │  Nitro Server    │ ────────────────→ │  GitHub API   │
│  PR opened / │                    │  /api/webhook/   │                   │  GET /pulls/  │
│  synchronize │ ←────────────────── │  github          │ ←──────────────── │  :number/files│
└──────────────┘    PR Review 评论    └───────┬─────────┘    PR files diff   └──────────────┘
                                              │
                                              │ diff + metadata
                                              ▼
                                     ┌─────────────────┐
                                     │  AI Review Engine │
                                     │  (DeepSeek-V3)    │
                                     │  System Prompt    │
                                     │  + User Context   │
                                     └────────┬────────┘
                                              │
                                              ▼
                                     ┌─────────────────┐
                                     │    Supabase       │
                                     │  reviews +        │
                                     │  review_comments  │
                                     └──────────────────┘
```

1. **事件入口** — GitHub 在 PR 创建/更新时向 `/api/webhook/github` 推送事件
2. **身份验证** — 使用 HMAC-SHA256（Web Crypto API，Cloudflare 兼容）校验 `X-Hub-Signature-256` 请求头，拒绝伪造请求
3. **Diff 拉取** — 以用户 OAuth Token 调用 [GitHub REST API](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files)，获取每个文件的完整 patch（含上下文行）
4. **上下文拼装** — 将 PR 标题、仓库审查偏好、忽略规则与 diff 合并为单条 User Message
5. **AI 推理** — System Prompt（角色定义 + 审查规则）+ User Message（具体变更）→ 结构化 JSON 输出
6. **结果双写** — 审查结果持久化至 Supabase PostgreSQL（供 App Dashboard 展示）+ 以 [PR Review](https://docs.github.com/en/rest/pulls/reviews) 形式回传 GitHub

### 未来扩展方向

**短期（1-3 个月）**

- **多 Provider 抽象层** — 抽离 AI 调用接口为 `AIProvider`，支持 Claude、GPT-4o、Gemini 等模型，允许用户按仓库选择偏好引擎
- **增量审查** — 利用 `synchronize` 事件的 `before`/`after` commit SHA，仅对增量 diff 做分析，避免重复审查已评审过的代码
- **审查反馈闭环** — 开发者对 AI 评论的"有用/无用的反应通过 GitHub Reaction API 回收，积累标注数据

**中期（3-6 个月）**

- **自定义规则引擎** — 支持正则匹配、文件模式、AST 模式（Tree-sitter）等确定性规则，作为 AI 审查的补充——确定性规则负责"一定会错"的场景（如 `console.log` 残留），AI 负责"可能有问题"的场景
- **跨文件依赖分析** — 拉取 PR 涉及文件的 import 上下游，构建依赖图，检测接口变更是否影响调用方
- **团队协作功能** — 团队 Dashboard、审查覆盖率统计、成员贡献排行

**长期（6-12 个月）**

- **项目级代码知识库** — 持续索引仓库代码，构建 RAG（检索增强生成）知识库，让 AI 审查时理解项目约定、历史决策和架构上下文
- **审查质量评估** — 建立审查质量指标体系（误报率、检出率、采纳率），自动化评估 + 人工抽检
- **自托管部署** — 支持私有化部署至自有服务器，满足企业数据安全合规要求

---

## 开源协议

MIT
