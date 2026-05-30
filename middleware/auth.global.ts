/**
 * Auth middleware — redirects unauthenticated users to login
 */
export default defineNuxtRouteMiddleware((to) => {
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
