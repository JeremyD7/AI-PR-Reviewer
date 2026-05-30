-- =====================================================
-- AI PR Reviewer — Initial Database Schema
-- Run against your Supabase project
-- =====================================================

-- 1. Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_id TEXT UNIQUE,
  github_user TEXT,
  avatar_url TEXT,
  github_token TEXT,  -- encrypted in production
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS: users can read/write their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can upsert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);


-- 2. Repositories table
CREATE TABLE IF NOT EXISTS public.repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  github_repo TEXT NOT NULL,  -- "owner/repo"
  repo_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  webhook_id TEXT,
  settings JSONB DEFAULT '{
    "auto_review": true,
    "review_categories": ["security", "performance", "logic", "style", "best_practice"],
    "max_files_per_review": 50,
    "ignore_patterns": ["*.lock", "*.json", "*.md", "*.svg"],
    "language": "en"
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, github_repo)
);

ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own repos"
  ON public.repositories FOR ALL
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_repositories_updated_at
  BEFORE UPDATE ON public.repositories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- 3. Pull Requests table
CREATE TABLE IF NOT EXISTS public.pull_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  pr_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  branch_from TEXT NOT NULL,
  branch_to TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'merged')),
  last_commit TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repo_id, pr_number)
);

ALTER TABLE public.pull_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read PRs of their repos"
  ON public.pull_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = pull_requests.repo_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert PRs to their repos"
  ON public.pull_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = pull_requests.repo_id
      AND r.user_id = auth.uid()
    )
  );

CREATE TRIGGER tr_pull_requests_updated_at
  BEFORE UPDATE ON public.pull_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- 4. Reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id UUID NOT NULL REFERENCES public.pull_requests(id) ON DELETE CASCADE,
  repo_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  summary TEXT,
  score INTEGER CHECK (score >= 1 AND score <= 10),
  issue_count INTEGER DEFAULT 0,
  model TEXT DEFAULT 'claude-sonnet-4-6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read reviews of their repos"
  ON public.reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = reviews.repo_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage reviews"
  ON public.reviews FOR ALL
  USING (true)
  WITH CHECK (true);


-- 5. Review Comments table
CREATE TABLE IF NOT EXISTS public.review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  line_start INTEGER,
  line_end INTEGER,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'suggestion', 'info')),
  category TEXT NOT NULL CHECK (category IN ('security', 'performance', 'style', 'logic', 'best_practice')),
  message TEXT NOT NULL,
  suggestion TEXT,
  github_comment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.review_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read comments of their repos"
  ON public.review_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews rev
      JOIN public.repositories r ON r.id = rev.repo_id
      WHERE rev.id = review_comments.review_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage comments"
  ON public.review_comments FOR ALL
  USING (true)
  WITH CHECK (true);


-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_repos_user_id ON public.repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_repos_github_repo ON public.repositories(github_repo);
CREATE INDEX IF NOT EXISTS idx_prs_repo_id ON public.pull_requests(repo_id);
CREATE INDEX IF NOT EXISTS idx_prs_status ON public.pull_requests(status);
CREATE INDEX IF NOT EXISTS idx_reviews_pr_id ON public.reviews(pr_id);
CREATE INDEX IF NOT EXISTS idx_reviews_repo_id ON public.reviews(repo_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);
CREATE INDEX IF NOT EXISTS idx_comments_review_id ON public.review_comments(review_id);
