/**
 * Review Pipeline
 * Shared utility for running the full review pipeline:
 * Fetch diff → AI analyze → save results → post to GitHub PR
 *
 * Used by both the webhook receiver and the manual trigger endpoint.
 */
import { getServerSupabase } from './supabase'

/**
 * Run the full review pipeline in the background:
 * Fetch diff → AI analyze → save results → post to GitHub PR
 */
export async function runReviewInBackground(prId: string, repoId: string) {
  const supabase = getServerSupabase()

  console.log(`[Review] Starting review for PR: ${prId}`)

  // 1. Get repo + linked user
  const { data: repo } = await supabase
    .from('repositories')
    .select('*, user:profiles(*)')
    .eq('id', repoId)
    .single()

  if (!repo) {
    console.error('[Review] Repository not found:', repoId)
    return
  }

  const [owner, repoName] = repo.github_repo.split('/')

  // 2. Get PR from DB
  const { data: prRecord } = await supabase
    .from('pull_requests')
    .select('*')
    .eq('id', prId)
    .single()

  if (!prRecord) {
    console.error('[Review] PR not found:', prId)
    return
  }

  // 3. Create review record (in_progress)
  const { data: review, error: reviewError } = await supabase
    .from('reviews')
    .insert({
      pr_id: prId,
      repo_id: repoId,
      status: 'in_progress',
      issue_count: 0,
      model: 'deepseek-chat',
    })
    .select()
    .single()

  if (reviewError || !review) {
    console.error('[Review] Failed to create review record:', reviewError)
    return
  }

  console.log(`[Review] Review record created: ${review.id}`)

  try {
    // 4. Get GitHub token for API calls
    const token = await getUserGitHubToken(repo.user_id)
    if (!token) {
      console.warn('[Review] No GitHub token — cannot fetch PR diff or post comments')
      await supabase.from('reviews').update({
        status: 'failed',
        summary: 'No GitHub token available. User needs to re-authenticate.',
        completed_at: new Date().toISOString(),
      }).eq('id', review.id)
      return
    }

    // 5. Fetch PR diff from GitHub
    console.log(`[Review] Fetching PR diff: ${repo.github_repo}#${prRecord.pr_number}`)
    const { fetchPRFiles } = await import('~/server/utils/github')
    const files = await fetchPRFiles(owner, repoName, prRecord.pr_number, token)

    // Build diff content
    const diffContent = files
      .map(f => `diff --git a/${f.filename} b/${f.filename}\n--- a/${f.filename}\n+++ b/${f.filename}\n${f.patch || ''}`)
      .join('\n')

    if (!diffContent.trim()) {
      console.log('[Review] No diff content to review')
      await supabase.from('reviews').update({
        status: 'completed',
        summary: '没有代码变更可供审查。',
        score: 10,
        completed_at: new Date().toISOString(),
      }).eq('id', review.id)
      return
    }

    console.log(`[Review] Diff size: ${diffContent.length} chars, ${files.length} files`)

    // 6. Run AI review
    console.log('[Review] Calling DeepSeek API...')
    const { reviewPullRequest } = await import('~/server/utils/ai-reviewer')
    const result = await reviewPullRequest(diffContent, prRecord.title, repo.settings || {})

    console.log(`[Review] AI review complete: score=${result.score}, ${result.comments.length} issues`)

    // 7. Save comments
    if (result.comments.length > 0) {
      const comments = result.comments.map(c => ({
        ...c,
        review_id: review.id,
      }))
      await supabase.from('review_comments').insert(comments)
      console.log(`[Review] Saved ${comments.length} comments`)
    }

    // 8. Update review status
    await supabase.from('reviews').update({
      status: 'completed',
      summary: result.summary,
      score: result.score,
      issue_count: result.comments.length,
      completed_at: new Date().toISOString(),
    }).eq('id', review.id)

    // 9. Post review to GitHub PR
    console.log('[Review] Posting review to GitHub...')
    const criticalOnly = result.comments.filter(c => c.severity === 'critical' || c.severity === 'warning')
    const body = [
      '## 🤖 AI 代码审查',
      '',
      `**评分: ${result.score}/10** | 发现 ${result.comments.length} 个问题`,
      '',
      result.summary,
    ]
    if (criticalOnly.length > 0) {
      body.push('', '### 🔴 严重问题 & 警告')
      criticalOnly.forEach(c => {
        body.push(`- **\`${c.file_path}\`** — ${c.message}`)
      })
    }
    const reviewComments = result.comments.slice(0, 20).map(c => ({
      path: c.file_path,
      line: c.line_start || 1,
      body: [
        `**${c.severity.toUpperCase()}** [${c.category}]`,
        '',
        c.message,
        c.suggestion ? `\n💡 **建议:**\n\`\`\`suggestion\n${c.suggestion}\n\`\`\`` : '',
      ].join('\n'),
    }))

    const { postPRReview } = await import('~/server/utils/github')
    await postPRReview(owner, repoName, prRecord.pr_number, body.join('\n'), reviewComments, token)
    console.log(`[Review] ✅ Review posted to GitHub PR #${prRecord.pr_number}`)

  } catch (err) {
    console.error('[Review] ❌ Review failed:', err)
    await supabase.from('reviews').update({
      status: 'failed',
      summary: `审查失败: ${err instanceof Error ? err.message : '未知错误'}`,
      completed_at: new Date().toISOString(),
    }).eq('id', review.id)
  }
}

/**
 * Get a user's GitHub token — stored in profiles during OAuth callback
 */
async function getUserGitHubToken(userId: string): Promise<string | null> {
  const supabase = getServerSupabase()

  const { data } = await supabase
    .from('profiles')
    .select('github_token')
    .eq('id', userId)
    .single()

  if (data?.github_token) {
    return data.github_token
  }

  console.warn(`[Review] No GitHub token found for user: ${userId}`)
  return null
}
