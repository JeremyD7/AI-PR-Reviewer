/**
 * Manual review trigger
 * POST /api/reviews/trigger
 * Body: { pr_id?: string, repo_id?: string }
 */
import { runReviewInBackground } from '~/server/utils/review-pipeline'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ pr_id?: string; repo_id?: string }>(event)

  if (!body.pr_id && !body.repo_id) {
    throw createError({ statusCode: 400, message: 'pr_id 或 repo_id 是必填项' })
  }

  const supabase = getServerSupabase()

  let prId: string
  let repoId: string

  if (body.pr_id) {
    // Trigger review for specific PR
    const { data: pr } = await supabase
      .from('pull_requests')
      .select('id, repo_id')
      .eq('id', body.pr_id)
      .single()

    if (!pr) throw createError({ statusCode: 404, message: '未找到该 PR' })

    prId = pr.id
    repoId = pr.repo_id
  } else {
    // Trigger review for the latest open PR in a repo
    const { data: latestPR } = await supabase
      .from('pull_requests')
      .select('id, repo_id')
      .eq('repo_id', body.repo_id!)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!latestPR) {
      return { message: '该仓库没有打开的 PR' }
    }

    prId = latestPR.id
    repoId = latestPR.repo_id
  }

  // Fire review in background (don't block the HTTP response)
  runReviewInBackground(prId, repoId).catch(err => {
    console.error('[Trigger] Background review failed:', err)
  })

  return {
    message: '审查已触发',
    pr_id: prId,
    repo_id: repoId,
  }
})
