// GitHub API types

export interface GitHubUser {
  login: string
  id: number
  avatar_url: string
  name: string | null
  email: string | null
}

export interface GitHubRepo {
  id: number
  full_name: string // "owner/repo"
  name: string
  owner: {
    login: string
    avatar_url: string
  }
  description: string | null
  private: boolean
  default_branch: string
  language: string | null
  updated_at: string
}

export interface GitHubPR {
  id: number
  number: number
  title: string
  state: 'open' | 'closed'
  user: {
    login: string
  }
  head: {
    ref: string
    sha: string
  }
  base: {
    ref: string
  }
  created_at: string
  updated_at: string
  html_url: string
}

export interface GitHubPRFile {
  sha: string
  filename: string
  status: 'added' | 'modified' | 'removed' | 'renamed'
  additions: number
  deletions: number
  changes: number
  patch?: string
  previous_filename?: string
}

export interface GitHubWebhookPayload {
  action: 'opened' | 'synchronize' | 'closed' | 'reopened'
  pull_request: GitHubPR
  repository: {
    id: number
    full_name: string
    name: string
  }
  sender: GitHubUser
}
