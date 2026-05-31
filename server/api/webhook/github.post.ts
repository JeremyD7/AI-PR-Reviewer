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
    const isValid = await verifyWebhookSignature(body, signature, secret)
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
  const { runReviewInBackground } = await import('~/server/utils/review-pipeline')
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
