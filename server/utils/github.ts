/**
 * GitHub API helpers (server-side)
 */
import crypto from 'crypto'
import type { GitHubPRFile, GitHubRepo, GitHubPR, GitHubWebhookPayload } from '~/types/github'

/**
 * Fetch user's GitHub repositories using their OAuth token
 */
export async function fetchUserRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = []
  let page = 1

  while (page <= 5) {
    const response = await fetch(
      `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'AI-PR-Reviewer',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const data = await response.json() as GitHubRepo[]
    if (!data.length) break

    repos.push(...data)
    page++
  }

  return repos
}

/**
 * Fetch a single PR's files/diff from GitHub
 */
export async function fetchPRFiles(
  owner: string,
  repo: string,
  prNumber: number,
  token: string,
): Promise<GitHubPRFile[]> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'AI-PR-Reviewer',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }

  return response.json()
}

/**
 * Fetch a single PR's details
 */
export async function fetchPR(
  owner: string,
  repo: string,
  prNumber: number,
  token: string,
): Promise<GitHubPR> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'AI-PR-Reviewer',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }

  return response.json()
}

/**
 * Post a review comment on a GitHub PR
 */
export async function postPRReview(
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
  comments: Array<{
    path: string
    line?: number
    body: string
  }>,
  token: string,
): Promise<void> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'AI-PR-Reviewer',
      },
      body: JSON.stringify({
        body,
        event: 'COMMENT',
        comments: comments.map(c => ({
          path: c.path,
          line: c.line || 1,
          body: c.body,
        })),
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Failed to post review: ${response.status} ${err}`)
  }
}

/**
 * Verify GitHub webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

/**
 * Get GitHub App installation token
 */
export async function getInstallationToken(
  installationId: number,
): Promise<string> {
  const config = useRuntimeConfig()
  const appId = config.githubAppId
  const privateKey = config.githubAppPrivateKey

  if (!appId || !privateKey) {
    throw new Error('GitHub App not configured')
  }

  // Generate JWT for GitHub App
  const jwt = generateAppJwt(appId, privateKey)

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'AI-PR-Reviewer',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to get installation token: ${response.status}`)
  }

  const data = await response.json() as { token: string }
  return data.token
}

function generateAppJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000)

  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  }

  const header = { alg: 'RS256', typ: 'JWT' }
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const toSign = `${encodedHeader}.${encodedPayload}`
  const signature = crypto.sign('sha256', Buffer.from(toSign), privateKey)
  const encodedSignature = signature.toString('base64url')

  return `${toSign}.${encodedSignature}`
}
