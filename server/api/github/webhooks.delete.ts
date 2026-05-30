/**
 * Delete a GitHub webhook (server-side)
 */
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: 'Missing token' })
  }

  const token = authHeader.replace('Bearer ', '')
  const body = await readBody(event)
  const { owner, repo, webhookId } = body

  if (!owner || !repo || !webhookId) {
    throw createError({ statusCode: 400, message: 'Missing owner, repo, or webhookId' })
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/hooks/${webhookId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'AI-PR-Reviewer',
        },
      }
    )

    if (!response.ok && response.status !== 404) {
      const errText = await response.text()
      console.error(`GitHub webhook deletion failed: ${response.status}`, errText)
      throw createError({
        statusCode: response.status,
        message: `GitHub API error: ${response.status}`,
      })
    }

    return { success: true }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('Webhook deletion error:', err)
    throw createError({
      statusCode: 500,
      message: err.message || 'Failed to delete webhook',
    })
  }
})
