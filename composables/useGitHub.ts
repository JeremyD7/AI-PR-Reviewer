/**
 * GitHub API composable (client-side)
 * All GitHub API calls are proxied through our server to keep secrets server-side
 */
import type { GitHubRepo } from '~/types/github'

export function useGitHub() {
  const supabase = useSupabaseClient()
  const loading = ref(false)
  const error = ref('')

  /**
   * Get the current user's GitHub access token from their Supabase session
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
    error.value = ''
    try {
      const token = await getToken()
      if (!token) {
        error.value = 'Not authenticated with GitHub. Please re-login.'
        return []
      }

      const result = await $fetch<{ repos: GitHubRepo[] }>('/api/github/repos', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return result.repos || []
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch repositories'
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a webhook on a GitHub repository (via server proxy)
   * Returns webhook ID on success, null on failure
   */
  async function createWebhook(repoFullName: string): Promise<{ webhook_id: string; active: boolean } | null> {
    error.value = ''
    try {
      const token = await getToken()
      if (!token) {
        error.value = 'Not authenticated with GitHub. Please re-login.'
        return null
      }

      const result = await $fetch<{ webhook_id: string; active: boolean; webhook_url: string }>(
        '/api/github/webhooks',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: { repoFullName },
        }
      )
      return { webhook_id: result.webhook_id, active: result.active }
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || 'Failed to create webhook'
      console.error('Webhook creation failed:', e)
      return null
    }
  }

  /**
   * Delete a webhook from a GitHub repository (via server proxy)
   */
  async function deleteWebhook(repoFullName: string, webhookId: string): Promise<boolean> {
    error.value = ''
    try {
      const token = await getToken()
      if (!token) return false

      const [owner, repo] = repoFullName.split('/')
      const result = await $fetch<{ success: boolean }>('/api/github/webhooks', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        body: { owner, repo, webhookId },
      })
      return result.success
    } catch (e: any) {
      error.value = e?.message || 'Failed to delete webhook'
      return false
    }
  }

  return {
    loading,
    error,
    fetchRepos,
    getToken,
    createWebhook,
    deleteWebhook,
  }
}
