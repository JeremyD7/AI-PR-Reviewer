/**
 * GitHub Webhook Receiver
 * Listens for PR events and triggers AI reviews
 *
 * GitHub → POST /api/webhook/github → verify → create PR record → trigger AI review
 */
import { verifyWebhookSignature } from '~/server/utils/github'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = config.githubAppWebhookSecret

  // Read raw body for signature verification
  const signature = getHeader(event, 'x-hub-signature-256') || ''
  const eventType = getHeader(event, 'x-github-event')
  const deliveryId = getHeader(event, 'x-github-delivery-id')

  console.log(`[Webhook] Received: ${eventType} (delivery: ${deliveryId})`)

  // Verify webhook signature (skip if secret not configured — useful for dev/testing)
  let body: string
  try {
    body = await readRawBody(event) || ''
  } catch {
    console.error('[Webhook] Failed to read body')
    throw createError({ statusCode: 400, message: 'Cannot read request body' })
  }

  if (!body) {
    console.error('[Webhook] Empty body')
    throw createError({ statusCode: 400, message: 'Empty body' })
  }

  if (secret) {
    const isValid = verifyWebhookSignature(body, signature, secret)
    if (!isValid) {
      console.error('[Webhook] Invalid signature')
      throw createError({ statusCode: 401, message: 'Invalid signature' })
    }
  } else {
    console.warn('[Webhook] ⚠️  No webhook secret configured — skipping verification')
  }

  // Parse payload
  let payload: any
  try {
    payload = JSON.parse(body)
  } catch {
    console.error('[Webhook] Invalid JSON')
    throw createError({ statusCode: 400, message: 'Invalid JSON' })
  }

  // Only handle PR events
  if (eventType !== 'pull_request') {
    return { message: 'Event ignored', type: eventType }
  }

  const action = payload.action
  console.log(`[Webhook] PR ${action}: ${payload.pull_request?.title || 'unknown'}`)

  // Only review on: opened, synchronize (new push), reopened
  if (!['opened', 'synchronize', 'reopened'].includes(action)) {
    return { message: `PR ${action} — no review needed` }
  }

  const repoFullName = payload.repository?.full_name
  if (!repoFullName) {
    throw createError({ statusCode: 400, message: 'Missing repository info' })
  }

  // Find matching repo in our database
  const supabase = getServerSupabase()
  const { data: repoRecord, error: repoError } = await supabase
    .from('repositories')
    .select('*')
    .eq('github_repo', repoFullName)
    .eq('is_active', true)
    .single()

  if (repoError || !repoRecord) {
    console.log(`[Webhook] Repo not configured or inactive: ${repoFullName}`)
    return { message: `Repository ${repoFullName} not configured for auto-review` }
  }

  if (!repoRecord.settings?.auto_review) {
    console.log(`[Webhook] Auto-review disabled for: ${repoFullName}`)
    return { message: `Auto-review disabled for ${repoFullName}` }
  }

  const pr = payload.pull_request

  // Upsert PR record
  const { data: prRecord, error: prError } = await supabase
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

  if (prError || !prRecord) {
    console.error('[Webhook] Failed to save PR:', prError)
    throw createError({ statusCode: 500, message: 'Failed to save PR record' })
  }

  console.log(`[Webhook] PR saved: #${pr.number} (id: ${prRecord.id})`)

  // Trigger review asynchronously (fire-and-forget — don't block webhook response)
  runReviewInBackground(prRecord.id, repoRecord.id).catch(err => {
    console.error('[Webhook] Background review failed:', err)
  })

  return {
    message: 'Review triggered',
    pr_id: prRecord.id,
    repo: repoFullName,
    pr_number: pr.number,
  }
})

/**
 * Run the full review pipeline in the background:
 * Fetch diff → AI analyze → save results → post to GitHub PR
 */
async function runReviewInBackground(prId: string, repoId: string) {
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
        summary: 'No code changes to review.',
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
      '## 🤖 AI Code Review',
      '',
      `**Score: ${result.score}/10** | ${result.comments.length} issues found`,
      '',
      result.summary,
    ]
    if (criticalOnly.length > 0) {
      body.push('', '### 🔴 Critical & Warnings')
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
        c.suggestion ? `\n💡 **Suggestion:**\n\`\`\`suggestion\n${c.suggestion}\n\`\`\`` : '',
      ].join('\n'),
    }))

    const { postPRReview } = await import('~/server/utils/github')
    await postPRReview(owner, repoName, prRecord.pr_number, body.join('\n'), reviewComments, token)
    console.log(`[Review] ✅ Review posted to GitHub PR #${prRecord.pr_number}`)

  } catch (err) {
    console.error('[Review] ❌ Review failed:', err)
    await supabase.from('reviews').update({
      status: 'failed',
      summary: `Review failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
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
