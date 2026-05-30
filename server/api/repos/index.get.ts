/**
 * List user's configured repositories
 */
export default defineEventHandler(async (event) => {
  const supabase = getServerSupabase()

  // Get user from session
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const { data, error } = await supabase
    .from('repositories')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return { repos: data }
})
