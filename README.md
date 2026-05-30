# 🤖 AI PR Reviewer

Automated AI-powered code review for your GitHub pull requests.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Nuxt 3** (Vue 3 + Vite + Nitro) |
| UI Library | **Nuxt UI v2** (Tailwind CSS + Headless UI) |
| Database | **Supabase** (PostgreSQL + Auth + Realtime) |
| AI Engine | **DeepSeek API** (V3, OpenAI-compatible) |
| State | **Pinia** |
| Deploy | Vercel / Node server |

## Project Structure

```
├── app.vue                    # Root component
├── app.config.ts              # App-level UI config
├── nuxt.config.ts             # Nuxt configuration
├── pages/
│   ├── index.vue              # Dashboard (stats + recent reviews)
│   ├── login.vue              # GitHub OAuth login
│   ├── auth/callback.vue      # OAuth callback handler
│   ├── repos/
│   │   ├── index.vue          # Repository list + add repo
│   │   └── [id].vue           # Single repo detail + settings
│   ├── prs/
│   │   └── [id].vue           # PR review results
│   └── settings.vue           # User settings
├── layouts/
│   ├── default.vue            # Main app layout w/ nav
│   └── auth.vue               # Auth pages layout
├── components/
│   ├── ToastContainer.vue     # Toast notifications
│   └── EmptyState.vue         # Empty state placeholder
├── composables/
│   ├── useAuth.ts             # Auth helpers
│   └── useGitHub.ts           # GitHub API client
├── stores/
│   └── app.ts                 # Global app store (Pinia)
├── server/
│   ├── api/
│   │   ├── webhook/github.post.ts    # GitHub webhook receiver
│   │   ├── reviews/trigger.post.ts   # Manual review trigger
│   │   ├── github/repos.get.ts       # GitHub repos proxy
│   │   └── repos/index.get.ts        # User repos list
│   └── utils/
│       ├── ai-reviewer.ts      # ⭐ AI review engine (Claude)
│       ├── github.ts           # GitHub API helpers
│       └── supabase.ts         # Server Supabase client
├── middleware/
│   └── auth.ts                 # Auth guard
├── types/
│   ├── database.ts             # DB schema types
│   └── github.ts               # GitHub API types
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Database schema
└── assets/css/main.css         # Global styles
```

## Prerequisites

1. **Node.js** ≥ 18
2. **Supabase** account → [supabase.com](https://supabase.com)
3. **GitHub OAuth App** → [github.com/settings/developers](https://github.com/settings/developers)
4. **DeepSeek API Key** → [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy `SUPABASE_URL` and `SUPABASE_KEY` (anon key)
3. Go to SQL Editor → paste & run `supabase/migrations/001_initial_schema.sql`

### 3. Create a GitHub OAuth App

1. Go to GitHub → Settings → Developer Settings → OAuth Apps
2. Register new app:
   - Homepage: `http://localhost:3000`
   - Callback: `http://localhost:3000/auth/callback`
3. Copy `Client ID` and `Client Secret`

### 4. Configure Supabase Auth

In Supabase Dashboard → Authentication → Providers:
- Enable **GitHub**
- Paste Client ID and Client Secret from step 3

### 5. Fill in `.env`

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

### 6. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## How It Works

```
1. User logs in with GitHub OAuth
2. User connects repositories from GitHub
3. When a PR is opened/updated → GitHub sends webhook
4. Server receives webhook → fetches PR diff
5. AI (Claude) analyzes the diff for:
   • Security vulnerabilities
   • Logic bugs / edge cases
   • Performance issues
   • Best practice violations
   • Code style problems
6. Review results saved to database + posted as PR comments
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/webhook/github` | Receive GitHub PR webhooks |
| `POST` | `/api/reviews/trigger` | Manually trigger a review |
| `GET`  | `/api/github/repos` | Proxy GitHub repos API |
| `GET`  | `/api/repos` | List user's configured repos |

## Database Schema

5 tables with RLS (Row Level Security):
- `profiles` — linked to Supabase Auth users
- `repositories` — monitored repos with settings
- `pull_requests` — PR records
- `reviews` — AI review results
- `review_comments` — individual review findings

## License

MIT
