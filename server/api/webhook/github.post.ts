/**
 * GitHub Webhook Receiver
 * Listens for PR events and triggers AI reviews
 */
import { verifyWebhookSignature } from '~/server/utils/github'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = config.githubAppWebhookSecret

  // Verify signature
  const signature = getHeader(event, 'x-hub-signature-256') || ''
  const body = await readRawBody(event)

  if (!body) {
    throw createError({ statusCode: 400, message: 'Empty body' })
  }

  if (secret && !verifyWebhookSignature(body, signature, secret)) {
    throw createError({ statusCode: 401, message: 'Invalid signature' })
  }

  const payload = JSON.parse(body)
  const eventType = getHeader(event, 'x-github-event')

  // Only handle PR events
  if (eventType !== 'pull_request') {
    return { message: 'Event ignored', type: eventType }
  }

  const action = payload.action
  if (!['opened', 'synchronize', 'reopened'].includes(action)) {
    return { message: `PR ${action} — review not needed` }
  }

  const repoFullName = payload.repository?.full_name
  if (!repoFullName) {
    throw createError({ statusCode: 400, message: 'Missing repository info' })
  }

  // Find matching repo in our database
  const supabase = getServerSupabase()
  const { data: repoRecord } = await supabase
    .from('repositories')
    .select('*')
    .eq('github_repo', repoFullName)
    .eq('is_active', true)
    .single()

  if (!repoRecord) {
    return { message: `Repository ${repoFullName} not configured for auto-review` }
  }

  if (!repoRecord.settings?.auto_review) {
    return { message: `Auto-review disabled for ${repoFullName}` }
  }

  const pr = payload.pull_request

  // Upsert PR record
  const { data: prRecord } = await supabase
    .from('pull_requests')
    .upsert({
      repo_id: repoRecord.id,
      pr_number: pr.number,
      title: pr.title,
      author: pr.user?.login || 'unknown',
      branch_from: pr.head?.ref || '',
      branch_to: pr.base?.ref || '',
      status: pr.state,
      last_commit: pr.head?.sha || '',
    }, { onConflict: 'repo_id,pr_number' })
    .select()
    .single()

  if (!prRecord) {
    throw createError({ statusCode: 500, message: 'Failed to save PR record' })
  }

  // Trigger review asynchronously (fire-and-forget for webhook response speed)
  // In production, use a queue or edge function
  runReviewInBackground(prRecord.id, repoRecord.id).catch(err => {
    console.error('Background review failed:', err)
  })

  return {
    message: 'Review triggered',
    pr_id: prRecord.id,
    repo: repoFullName,
    pr_number: pr.number,
  }
})

/**
 * Run the review process in the background
 */
async function runReviewInBackground(prId: string, repoId: string) {
  const supabase = getServerSupabase()

  // 1. Get repo settings & user info
  const { data: repo } = await supabase
    .from('repositories')
    .select('*, user:profiles(*)')
    .eq('id', repoId)
    .single()

  if (!repo) throw new Error('Repository not found')

  const [owner, repoName] = repo.github_repo.split('/')

  // 2. Get PR from DB
  const { data: prRecord } = await supabase
    .from('pull_requests')
    .select('*')
    .eq('id', prId)
    .single()

  if (!prRecord) throw new Error('PR not found')

  // 3. Create review record (in_progress)
  const { data: review } = await supabase
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

  if (!review) throw new Error('Failed to create review record')

  try {
    // 4. Get GitHub token for API calls (use user's OAuth token or GitHub App)
    const token = await getUserGitHubToken(repo.user_id)

    // 5. Fetch PR diff from GitHub
    const files = await import('~/server/utils/github').then(m =>
      m.fetchPRFiles(owner, repoName, prRecord.pr_number, token)
    )

    // Build diff content
    const diffContent = files
      .map(f => `diff --git a/${f.filename} b/${f.filename}\n--- a/${f.filename}\n+++ b/${f.filename}\n${f.patch || ''}`)
      .join('\n')

    if (!diffContent.trim()) {
      await supabase.from('reviews').update({
        status: 'completed',
        summary: 'No code changes to review.',
        score: 10,
        completed_at: new Date().toISOString(),
      }).eq('id', review.id)
      return
    }

    // 6. Run AI review
    const result = await import('~/server/utils/ai-reviewer').then(m =>
      m.reviewPullRequest(diffContent, prRecord.title, repo.settings || {})
    )

    // 7. Save comments
    const comments = result.comments.map(c => ({
      ...c,
      review_id: review.id,
    }))

    if (comments.length > 0) {
      await supabase.from('review_comments').insert(comments)
    }

    // 8. Update review status
    await supabase.from('reviews').update({
      status: 'completed',
      summary: result.summary,
      score: result.score,
      issue_count: result.comments.length,
      completed_at: new Date().toISOString(),
    }).eq('id', review.id)

    // 9. Post review to GitHub PR (if token available)
    if (token) {
      const criticalOnly = result.comments.filter(c => c.severity === 'critical' || c.severity === 'warning')
      const body = `## 🤖 AI Code Review\n\n**Score: ${result.score}/10** | ${result.comments.length} issues found\n\n${result.summary}\n\n${criticalOnly.length > 0 ? '### 🔴 Critical & Warnings\n' + criticalOnly.map(c => `- **\`${c.file_path}\`** — ${c.message}`).join('\n') : ''}`
      const reviewComments = result.comments.slice(0, 20).map(c => ({
        path: c.file_path,
        line: c.line_start || 1,
        body: `**${c.severity.toUpperCase()}** [${c.category}]\n\n${c.message}\n\n${c.suggestion ? `💡 Suggestion:\n\`\`\`suggestion\n${c.suggestion}\n\`\`\`` : ''}`,
      }))

      await import('~/server/utils/github').then(m =>
        m.postPRReview(owner, repoName, prRecord.pr_number, body, reviewComments, token)
      ).catch(err => {
        console.error('Failed to post review to GitHub:', err)
      })
    }

  } catch (err) {
    console.error('Review failed:', err)
    await supabase.from('reviews').update({
      status: 'failed',
      summary: `Review failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      completed_at: new Date().toISOString(),
    }).eq('id', review.id)
  }
}

async function getUserGitHubToken(userId: string): Promise<string> {
  const supabase = getServerSupabase()
  // Try to get a valid session token — this is a simplification
  // In production, store encrypted tokens in the profiles table
  const { data } = await supabase
    .from('profiles')
    .select('github_token')
    .eq('id', userId)
    .single()

  if (data?.github_token) return data.github_token

  throw new Error('No GitHub token available. User needs to re-authenticate.')
}
