/**
 * Authentication composable
 */
export function useAuth() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const loading = ref(false)
  const error = ref('')

  const isAuthenticated = computed(() => !!user.value)

  async function signInWithGitHub() {
    loading.value = true
    error.value = ''

    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (err) error.value = err.message
    } catch (e) {
      error.value = 'Failed to connect to GitHub'
    } finally {
      loading.value = false
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigateTo('/login')
  }

  return {
    user,
    isAuthenticated,
    loading,
    error,
    signInWithGitHub,
    signOut,
  }
}
