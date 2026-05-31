/**
 * GitHub API helpers (server-side)
 *
 * All crypto operations use Web Crypto API (crypto.subtle) for
 * Cloudflare Workers / Pages compatibility (no Node.js 'crypto' module).
 */
import type { GitHubPRFile, GitHubRepo, GitHubPR } from '~/types/github'

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

// ── Web Crypto helpers (Cloudflare-compatible) ──

/** HMAC-SHA256 → hex string using Web Crypto API */
async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Constant-time string comparison */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Verify GitHub webhook signature (Web Crypto, Cloudflare-compatible)
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const hex = await hmacSha256Hex(secret, payload)
  const expected = `sha256=${hex}`
  return timingSafeEqual(signature, expected)
}

