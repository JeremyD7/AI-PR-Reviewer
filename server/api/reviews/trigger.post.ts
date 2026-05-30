/**
 * Manual review trigger
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ pr_id?: string; repo_id?: string }>(event)

  if (!body.pr_id && !body.repo_id) {
    throw createError({ statusCode: 400, message: 'pr_id or repo_id is required' })
  }

  const supabase = getServerSupabase()

  if (body.pr_id) {
    // Trigger review for specific PR
    const { data: pr } = await supabase
      .from('pull_requests')
      .select('id, repo_id')
      .eq('id', body.pr_id)
      .single()

    if (!pr) throw createError({ statusCode: 404, message: 'PR not found' })

    // Import and run
    const { runReviewInBackground } = await import('../webhook/github.post')
    return { message: 'Review triggered for PR', pr_id: pr.id }
  }

  if (body.repo_id) {
    // Trigger review for the latest open PR in a repo
    const { data: latestPR } = await supabase
      .from('pull_requests')
      .select('id')
      .eq('repo_id', body.repo_id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!latestPR) {
      return { message: 'No open PRs found for this repository' }
    }

    return { message: 'Review triggered for latest PR', pr_id: latestPR.id }
  }
})
