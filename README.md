# 🤖 AI PR Reviewer

基于 AI 自动审查 GitHub Pull Request 的代码质量工具。

## 🔗 开始使用

👉 **[ai-pr-reviewer.pages.dev](https://ai-pr-reviewer.pages.dev)**

用 GitHub 账号登录，连接仓库，即可自动审查 PR。无需安装、无需配置。

## 📺 视频演示

[![视频演示](https://img.shields.io/badge/B站-观看演示视频-fb7299)](https://www.bilibili.com/video/BV1KqVU6JEXw?t=213.3)

## ✨ 功能特性

- **一键登录** — GitHub OAuth 登录，自动获取仓库权限
- **自动审查** — PR 创建/更新时自动触发 AI 审查，无需手动操作
- **五大维度** — 安全漏洞、逻辑错误、性能问题、最佳实践、代码风格，按优先级排序
- **四级严重度** — critical / warning / suggestion / info，快速区分必修复项
- **PR 内联评论** — 审查结果直接出现在 GitHub PR 页面对应代码行上
- **灵活配置** — 每个仓库独立设置审查类别、忽略规则、最大文件数
- **可视化仪表盘** — 评分趋势、问题分类统计、审查历史，一目了然

## ⚙️ 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | **Nuxt 3** (Vue 3 + Vite + Nitro) |
| UI | **Nuxt UI v2** (Tailwind CSS + Headless UI) |
| 数据库 | **Supabase** (PostgreSQL + Auth) |
| AI 引擎 | **DeepSeek API** (V3，兼容 OpenAI 接口) |
| 部署 | Cloudflare Pages |

## 🔄 工作流程

```
用户登录 (GitHub OAuth)
    ↓
连接仓库 (自动创建 Webhook)
    ↓
PR 创建/更新 → GitHub Webhook → 服务端
    ↓
拉取 PR diff → AI 分析 (DeepSeek-V3)
    ↓
审查结果 → 保存数据库 + 发布到 GitHub PR
```

AI 审查覆盖五类问题：**安全漏洞 > 逻辑 Bug > 性能问题 > 最佳实践 > 代码风格**。

## 📐 设计思路

系统在设计上围绕**分析准确性、上下文理解、误报与漏报控制、响应速度、使用体验**五个关键因素做了针对性考量。

### 分析准确性

选用 **DeepSeek-V3**（`deepseek-chat`）作为审查引擎，该模型在代码理解任务上表现优异，原生 64K token 上下文窗口可容纳大型 PR 的完整 diff。

System Prompt 确立了明确的审查优先级——**安全漏洞 → 逻辑错误 → 性能问题 → 最佳实践 → 代码风格**——确保 AI 聚焦于真正关键的问题。输出采用严格 JSON Schema 约束，服务端对每个字段做白名单校验（非法 `severity`/`category` 自动降级为安全默认值），保证结果始终结构化、可消费。

### 上下文理解

AI 审查综合以下多维度信息进行判断，而非仅依赖裸 diff：

| 上下文来源 | 作用 |
|-----------|------|
| PR 标题 | 理解变更的业务意图与修改背景 |
| 审查类别偏好 | 用户可为每个仓库自定义关注维度（如仅关注安全 + 性能） |
| 忽略规则 | glob 模式过滤（`*.lock`、`*.json`、`*.md`），排除噪声文件 |
| Diff 智能截断 | 超过 150K 字符自动截断，平衡完整性与 token 消耗 |
| GitHub patch 上下文行 | 每个 hunk 自带 ±3 行未修改代码，提供改动点周边视野 |

> 当前局限性：AI 仅能看到 diff 片段，无法获取变更文件的完整内容、未被修改的上下游依赖文件、项目编码规范等更广泛上下文。这些已在"未来扩展方向"中规划。

### 误报与漏报控制

采用四层漏斗策略：

```
低温度推理 (0.1)      →  降低随机性，同一份 diff 多次审查结果一致
    ↓
四级严重度分级        →  critical / warning / suggestion / info，快速区分优先级
    ↓
PR 评论智能过滤       →  仅推送 critical + warning 到 GitHub，避免信息过载
    ↓
白名单校验 + 降级兜底 →  异常输出自动修正，杜绝脏数据入库
```

- **低温度推理**（`temperature: 0.1`）：显著降低随机波动，避免"同一段代码有时报有时不报"
- **四级严重度**：帮助开发者按优先级处理，关键问题不遗漏，建议类问题不骚扰
- **PR 评论过滤**：完整报告保留在 Dashboard 中，GitHub 上只展示严重 + 警告级别摘要
- **输出校验层**：字段级白名单校验，非法值自动映射为安全默认值

### 响应速度

| 环节 | 策略 | 收益 |
|------|------|------|
| Webhook 接收 | 立即返回 200，审查异步执行 | GitHub 3 秒超时不触发重试 |
| AI 推理 | `stream: false`，一次性返回 | 减少网络往返，简化错误处理 |
| 数据库查询 | 高频字段（`user_id`、`pr_id`、`status`）建立索引 | 列表/详情页毫秒级响应 |
| 部署架构 | Cloudflare Pages 边缘网络 | 全球 CDN 就近响应 |
| 文件预过滤 | 忽略规则在 diff 进入 AI 前生效 | 减少无效数据占用 token |

### 使用体验

- **零配置上手**：GitHub OAuth 一键登录，自动获取仓库权限
- **全自动化**：Webhook 自动创建、PR 自动触发审查，开发者无需额外操作
- **Dashboard 可视化**：评分趋势、问题分类统计、审查历史，项目质量一目了然
- **按仓库灵活配置**：审查类别、忽略规则、最大文件数均可独立设置
- **PR 内联反馈**：审查结果以 Review 评论形式直接出现在 GitHub 对应代码行，无缝融入现有开发流程

### 模型选择

| 决策维度 | 选择 | 设计理由 |
|----------|------|---------|
| 基础模型 | DeepSeek-V3 (`deepseek-chat`) | 代码理解能力业内第一梯队，API 完全兼容 OpenAI 格式，降低供应商锁定风险 |
| 上下文窗口 | 64K tokens（≈180K 字符） | 覆盖绝大多数 PR 的 diff 规模，超出时自动截断保护 |
| 推理温度 | `0.1` | 代码审查要求高确定性和可复现性，低温度是必然选择 |
| 输出格式 | 约束 JSON Schema | 结构化数据可直接入库、前端直接渲染，无需二次解析 |
| max_tokens | `4096` | 在审查覆盖度与响应延迟之间取均衡点 |

**架构上的模型无关性**：系统通过 OpenAI-compatible 接口设计，天然支持切换至任意兼容模型（Claude、GPT-4o、Gemini、Qwen 等）。`reviews` 表的 `model` 字段记录了每次审查实际使用的模型，为后续 A/B 对比和模型迁移提供数据基础。

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
2. **身份验证** — HMAC-SHA256（Web Crypto API）校验 `X-Hub-Signature-256` 请求头
3. **Diff 拉取** — 以用户 OAuth Token 调用 GitHub REST API，获取每个文件的完整 patch（含上下文行）
4. **上下文拼装** — PR 标题 + 仓库审查偏好 + 忽略规则 + diff 合并为单条 User Message
5. **AI 推理** — System Prompt（角色定义 + 审查规则）+ User Message（具体变更）→ 结构化 JSON
6. **结果双写** — 持久化至 Supabase（供 Dashboard 展示）+ 以 PR Review 形式回传 GitHub

### 未来扩展方向

**短期（1-3 个月）**

- **多 Provider 抽象层**：抽离 AI 调用接口，支持按仓库选择偏好模型（Claude、GPT-4o、Gemini）
- **增量审查**：利用 `synchronize` 事件的 before/after commit SHA，仅分析增量 diff，避免重复审查
- **审查反馈闭环**：通过 GitHub Reaction API 回收开发者对 AI 评论的"有用 / 无用"反馈，积累标注数据

**中期（3-6 个月）**

- **自定义规则引擎**：正则匹配 + AST 模式（Tree-sitter）作为确定性规则补充——规则负责"一定会错"（如 `console.log` 残留），AI 负责"可能有风险"
- **跨文件依赖分析**：拉取 PR 文件的 import 上下游，构建依赖图，检测接口变更是否影响调用方
- **团队协作**：团队 Dashboard、审查覆盖率统计、成员贡献排行

**长期（6-12 个月）**

- **项目级代码知识库**：持续索引仓库代码，构建 RAG（检索增强生成）知识库，让 AI 理解项目约定和历史决策
- **审查质量评估**：建立误报率、检出率、采纳率指标体系，自动化评估 + 人工抽检
- **自托管部署**：支持私有化部署，满足企业数据安全合规要求

## 📁 项目结构

```
├── app.vue                    # 根组件
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
├── server/
│   ├── api/
│   │   ├── webhook/github.post.ts    # GitHub Webhook 接收
│   │   ├── reviews/trigger.post.ts   # 手动触发审查
│   │   └── github/repos.get.ts       # GitHub 仓库代理
│   └── utils/
│       ├── ai-reviewer.ts      # ⭐ AI 审查引擎（DeepSeek）
│       ├── github.ts           # GitHub API 工具函数
│       ├── review-pipeline.ts  # 审查管道
│       └── supabase.ts         # 服务端 Supabase 客户端
├── composables/               # Vue 组合式函数
├── stores/                    # Pinia 状态管理
├── types/                     # TypeScript 类型定义
└── supabase/migrations/       # 数据库迁移
```

## 🔧 本地开发

仅面向二次开发或自托管部署。

### 环境要求

- **Node.js** ≥ 18
- **Supabase** 项目 → [supabase.com](https://supabase.com)
- **GitHub OAuth App** → [github.com/settings/developers](https://github.com/settings/developers)
- **DeepSeek API Key** → [platform.deepseek.com](https://platform.deepseek.com/api_keys)

### 启动步骤

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（复制 .env.example 为 .env 并填写）
cp .env.example .env

# 3. 在 Supabase SQL Editor 中执行 supabase/migrations/001_initial_schema.sql

# 4. 在 Supabase Dashboard → Auth → Providers 中启用 GitHub，填入 OAuth App 的 Client ID 和 Secret

# 5. 启动开发服务器
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

### 部署

本项目部署在 Cloudflare Pages，使用 `cloudflare-pages` nitro preset。部署时需在 Cloudflare Dashboard 中配置与 `.env.example` 一致的环境变量。

## 📡 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/webhook/github` | 接收 GitHub PR Webhook |
| `POST` | `/api/reviews/trigger` | 手动触发代码审查 |
| `GET` | `/api/github/repos` | 代理 GitHub 仓库 API |
| `GET` | `/api/repos` | 列出用户已配置的仓库 |

## 🗄️ 数据库

5 张表，均启用 RLS（行级安全）：

| 表 | 说明 |
|----|------|
| `profiles` | 关联 Supabase Auth 用户，存储 GitHub Token |
| `repositories` | 受监控仓库及审查设置 |
| `pull_requests` | PR 记录（编号、分支、状态） |
| `reviews` | AI 审查结果（评分、摘要、模型） |
| `review_comments` | 每条审查发现（严重度、类别、建议） |

## 设计思路

系统在设计上围绕**分析准确性、上下文理解、误报与漏报控制、响应速度、使用体验**五个关键因素做了针对性考量。

### 分析准确性

选用 **DeepSeek-V3**（`deepseek-chat`）作为审查引擎，该模型在代码理解任务上表现优异，原生 64K token 上下文窗口可容纳大型 PR 的完整 diff。

System Prompt 确立了明确的审查优先级——**安全漏洞 → 逻辑错误 → 性能问题 → 最佳实践 → 代码风格**——确保 AI 聚焦于真正关键的问题。输出采用严格 JSON Schema 约束，服务端对每个字段做白名单校验（非法 `severity`/`category` 自动降级为安全默认值），保证结果始终结构化、可消费。

### 上下文理解

AI 审查综合以下多维度信息进行判断，而非仅依赖裸 diff：

| 上下文来源 | 作用 |
|-----------|------|
| PR 标题 | 理解变更的业务意图与修改背景 |
| 审查类别偏好 | 用户可为每个仓库自定义关注维度（如仅关注安全 + 性能） |
| 忽略规则 | glob 模式过滤（`*.lock`、`*.json`、`*.md`），排除噪声文件 |
| Diff 智能截断 | 超过 150K 字符自动截断，平衡完整性与 token 消耗 |
| GitHub patch 上下文行 | 每个 hunk 自带 ±3 行未修改代码，提供改动点周边视野 |

> 当前局限性：AI 仅能看到 diff 片段，无法获取变更文件的完整内容、未被修改的上下游依赖文件、项目编码规范等更广泛上下文。这些已在"未来扩展方向"中规划。

### 误报与漏报控制

采用四层漏斗策略：

```
低温度推理 (0.1)      →  降低随机性，同一份 diff 多次审查结果一致
    ↓
四级严重度分级        →  critical / warning / suggestion / info，快速区分优先级
    ↓
PR 评论智能过滤       →  仅推送 critical + warning 到 GitHub，避免信息过载
    ↓
白名单校验 + 降级兜底 →  异常输出自动修正，杜绝脏数据入库
```

- **低温度推理**（`temperature: 0.1`）：显著降低随机波动，避免"同一段代码有时报有时不报"
- **四级严重度**：帮助开发者按优先级处理，关键问题不遗漏，建议类问题不骚扰
- **PR 评论过滤**：完整报告保留在 Dashboard 中，GitHub 上只展示严重 + 警告级别摘要
- **输出校验层**：字段级白名单校验，非法值自动映射为安全默认值

### 响应速度

| 环节 | 策略 | 收益 |
|------|------|------|
| Webhook 接收 | 立即返回 200，审查异步执行 | GitHub 3 秒超时不触发重试 |
| AI 推理 | `stream: false`，一次性返回 | 减少网络往返，简化错误处理 |
| 数据库查询 | 高频字段（`user_id`、`pr_id`、`status`）建立索引 | 列表/详情页毫秒级响应 |
| 部署架构 | Cloudflare Pages 边缘网络 | 全球 CDN 就近响应 |
| 文件预过滤 | 忽略规则在 diff 进入 AI 前生效 | 减少无效数据占用 token |

### 使用体验

- **零配置上手**：GitHub OAuth 一键登录，自动获取仓库权限
- **全自动化**：Webhook 自动创建、PR 自动触发审查，开发者无需额外操作
- **Dashboard 可视化**：评分趋势、问题分类统计、审查历史，项目质量一目了然
- **按仓库灵活配置**：审查类别、忽略规则、最大文件数均可独立设置
- **PR 内联反馈**：审查结果以 Review 评论形式直接出现在 GitHub 对应代码行，无缝融入现有开发流程

### 模型选择

| 决策维度 | 选择 | 设计理由 |
|----------|------|---------|
| 基础模型 | DeepSeek-V3 (`deepseek-chat`) | 代码理解能力业内第一梯队，API 完全兼容 OpenAI 格式，降低供应商锁定风险 |
| 上下文窗口 | 64K tokens（≈180K 字符） | 覆盖绝大多数 PR 的 diff 规模，超出时自动截断保护 |
| 推理温度 | `0.1` | 代码审查要求高确定性和可复现性，低温度是必然选择 |
| 输出格式 | 约束 JSON Schema | 结构化数据可直接入库、前端直接渲染，无需二次解析 |
| max_tokens | `4096` | 在审查覆盖度与响应延迟之间取均衡点 |

**架构上的模型无关性**：系统通过 OpenAI-compatible 接口设计，天然支持切换至任意兼容模型（Claude、GPT-4o、Gemini、Qwen 等）。`reviews` 表的 `model` 字段记录了每次审查实际使用的模型，为后续 A/B 对比和模型迁移提供数据基础。

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
2. **身份验证** — HMAC-SHA256（Web Crypto API）校验 `X-Hub-Signature-256` 请求头
3. **Diff 拉取** — 以用户 OAuth Token 调用 GitHub REST API，获取每个文件的完整 patch（含上下文行）
4. **上下文拼装** — PR 标题 + 仓库审查偏好 + 忽略规则 + diff 合并为单条 User Message
5. **AI 推理** — System Prompt（角色定义 + 审查规则）+ User Message（具体变更）→ 结构化 JSON
6. **结果双写** — 持久化至 Supabase（供 Dashboard 展示）+ 以 PR Review 形式回传 GitHub

### 未来扩展方向

**短期（1-3 个月）**

- **多 Provider 抽象层**：抽离 AI 调用接口，支持按仓库选择偏好模型（Claude、GPT-4o、Gemini）
- **增量审查**：利用 `synchronize` 事件的 before/after commit SHA，仅分析增量 diff，避免重复审查
- **审查反馈闭环**：通过 GitHub Reaction API 回收开发者对 AI 评论的"有用 / 无用"反馈，积累标注数据

**中期（3-6 个月）**

- **自定义规则引擎**：正则匹配 + AST 模式（Tree-sitter）作为确定性规则补充——规则负责"一定会错"（如 `console.log` 残留），AI 负责"可能有风险"
- **跨文件依赖分析**：拉取 PR 文件的 import 上下游，构建依赖图，检测接口变更是否影响调用方
- **团队协作**：团队 Dashboard、审查覆盖率统计、成员贡献排行

**长期（6-12 个月）**

- **项目级代码知识库**：持续索引仓库代码，构建 RAG（检索增强生成）知识库，让 AI 理解项目约定和历史决策
- **审查质量评估**：建立误报率、检出率、采纳率指标体系，自动化评估 + 人工抽检
- **自托管部署**：支持私有化部署，满足企业数据安全合规要求

---

## 开源协议

MIT
