// Database schema types (matches Supabase migrations)

export interface Profile {
  id: string
  github_id: string
  github_user: string
  avatar_url: string | null
  created_at: string
}

export interface Repository {
  id: string
  user_id: string
  github_repo: string // "owner/repo"
  repo_name: string
  is_active: boolean
  webhook_id: string | null
  settings: ReviewSettings
  created_at: string
  updated_at: string
}

export interface PullRequest {
  id: string
  repo_id: string
  pr_number: number
  title: string
  author: string
  branch_from: string
  branch_to: string
  status: 'open' | 'closed' | 'merged'
  last_commit: string
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  pr_id: string
  repo_id: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  summary: string | null
  score: number | null
  issue_count: number
  model: string
  created_at: string
  completed_at: string | null
}

export interface ReviewComment {
  id: string
  review_id: string
  file_path: string
  line_start: number | null
  line_end: number | null
  severity: 'critical' | 'warning' | 'suggestion' | 'info'
  category: 'security' | 'performance' | 'style' | 'logic' | 'best_practice'
  message: string
  suggestion: string | null
  github_comment_id: string | null
  created_at: string
}

export interface ReviewSettings {
  auto_review: boolean
  review_categories: string[]
  max_files_per_review: number
  ignore_patterns: string[]
  language: string
}
