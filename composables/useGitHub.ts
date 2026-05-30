/**
 * GitHub API composable (client-side)
 */
import type { GitHubRepo, GitHubPR, GitHubPRFile } from '~/types/github'

export function useGitHub() {
  const supabase = useSupabaseClient()
  const loading = ref(false)

  /**
   * Get the current user's GitHub access token
   */
  async function getToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data.session?.provider_token || null
  }

  /**
   * Fetch user's GitHub repositories (via server proxy)
   */
  async function fetchRepos(): Promise<GitHubRepo[]> {
    loading.value = true
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated with GitHub')

      const { data } = await $fetch<{ repos: GitHubRepo[] }>('/api/github/repos', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return data?.repos || []
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a webhook for a repository
   */
  async function createWebhook(repoFullName: string): Promise<string | null> {
    try {
      const token = await getToken()
      if (!token) return null

      const config = useRuntimeConfig()
      const webhookUrl = `${config.public.appUrl}/api/webhook/github`

      const [owner, repo] = repoFullName.split('/')
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/hooks`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'web',
            active: true,
            events: ['pull_request'],
            config: {
              url: webhookUrl,
              content_type: 'json',
              secret: '',
            },
          }),
        }
      )

      if (!response.ok) return null
      const data = await response.json() as { id: string }
      return data.id
    } catch {
      return null
    }
  }

  return {
    loading,
    fetchRepos,
    getToken,
    createWebhook,
  }
}
