/**
 * Client-side auth plugin — handles redirects when auth state changes.
 *
 * The global auth middleware only runs during navigation and skips SSR.
 * This plugin fills the gap: it listens for auth state changes and
 * redirects to /login when the user signs out (session expiry, etc.).
 *
 * IMPORTANT: We do NOT redirect on INITIAL_SESSION or TOKEN_REFRESHED —
 * those are handled by the middleware and reactive UI updates.
 */
export default defineNuxtPlugin(() => {
  const supabase = useSupabaseClient()

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      // Session expired or user explicitly signed out
      // Navigate to login (client-side only, no full page reload)
      navigateTo('/login', { replace: true })
    }
  })
})
