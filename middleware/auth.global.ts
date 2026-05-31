/**
 * Auth middleware — redirects unauthenticated users to login.
 *
 * IMPORTANT: We skip redirect during SSR because the Supabase session
 * may not be available server-side (slow API, network issues, token
 * refresh). Redirecting during SSR causes page flashes and redirect
 * loops. Client-side auth is enforced by the auth plugin instead.
 */
export default defineNuxtRouteMiddleware((to) => {
  // Skip during SSR — Supabase session is resolved client-side
  // Prevents flicker/redirect-loops when Supabase API is slow
  if (import.meta.server) return

  const user = useSupabaseUser()

  // Allow access to login and auth callback pages
  if (to.path === '/login' || to.path.startsWith('/auth/')) {
    if (user.value) {
      return navigateTo('/')
    }
    return
  }

  // Redirect to login if not authenticated
  if (!user.value) {
    return navigateTo('/login')
  }
})
