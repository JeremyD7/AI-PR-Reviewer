/**
 * Proxy endpoint: fetch user's GitHub repositories
 * Avoids CORS issues and token exposure
 */
import { fetchUserRepos } from '~/server/utils/github'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: 'Missing token' })
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    const repos = await fetchUserRepos(token)
    return { repos }
  } catch (err) {
    throw createError({
      statusCode: 500,
      message: err instanceof Error ? err.message : 'Failed to fetch repos',
    })
  }
})
