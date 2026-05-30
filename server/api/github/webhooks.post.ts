/**
 * Create a GitHub webhook for a repository (server-side)
 * Keeps webhook secret server-side, never exposed to client
 */
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: 'Missing token' })
  }

  const token = authHeader.replace('Bearer ', '')
  const body = await readBody(event)
  const { repoFullName } = body

  if (!repoFullName || !repoFullName.includes('/')) {
    throw createError({ statusCode: 400, message: 'Invalid repoFullName' })
  }

  const config = useRuntimeConfig()
  const webhookUrl = `${config.public.appUrl}/api/webhook/github`
  const secret = config.githubAppWebhookSecret

  const [owner, repo] = repoFullName.split('/')

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/hooks`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'AI-PR-Reviewer',
        },
        body: JSON.stringify({
          name: 'web',
          active: true,
          events: ['pull_request'],
          config: {
            url: webhookUrl,
            content_type: 'json',
            secret: secret,
          },
        }),
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error(`GitHub webhook creation failed: ${response.status}`, errText)
      throw createError({
        statusCode: response.status,
        message: `GitHub API error: ${response.status} — ${errText}`,
      })
    }

    const data = await response.json() as { id: number; active: boolean }
    return {
      webhook_id: String(data.id),
      active: data.active,
      webhook_url: webhookUrl,
    }
  } catch (err: any) {
    if (err.statusCode) throw err // re-throw H3 errors
    console.error('Webhook creation error:', err)
    throw createError({
      statusCode: 500,
      message: err.message || 'Failed to create webhook',
    })
  }
})
