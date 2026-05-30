<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
    <div class="text-center">
      <UIcon v-if="loading" name="i-heroicons-arrow-path-20-solid" class="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
      <p class="mt-4 text-gray-600 dark:text-gray-400">{{ statusMessage }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const loading = ref(true)
const statusMessage = ref('Completing sign in...')

// Watch for user state change (more reliable than getSession timing)
watch(user, async (newUser) => {
  if (!newUser) return

  try {
    // Get session to access provider_token for GitHub API calls
    const { data: sessionData } = await supabase.auth.getSession()
    const githubToken = sessionData.session?.provider_token || ''

    // Save profile to database
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: newUser.id,
      github_id: newUser.user_metadata?.user_name || '',
      github_user: newUser.user_metadata?.user_name || '',
      avatar_url: newUser.user_metadata?.avatar_url || '',
      github_token: githubToken,
    }, { onConflict: 'id' })

    if (profileError) {
      console.error('Failed to save profile:', profileError.message)
      statusMessage.value = `Profile error: ${profileError.message}`
    } else {
      statusMessage.value = 'Welcome! Redirecting...'
    }
  } catch (e: any) {
    console.error('Profile upsert error:', e)
    statusMessage.value = 'Saved session, profile error.'
  }

  loading.value = false
  setTimeout(() => navigateTo('/'), 1500)
}, { immediate: true })

// Fallback: if watch hasn't triggered after 3s, try getSession
onMounted(async () => {
  // Give onAuthStateChange a moment to fire first
  await new Promise(r => setTimeout(r, 500))

  if (user.value) return // already handled by watch

  const { data, error } = await supabase.auth.getSession()

  if (error) {
    statusMessage.value = `Auth error: ${error.message}`
    loading.value = false
    setTimeout(() => navigateTo('/login'), 3000)
    return
  }

  if (!data.session) {
    statusMessage.value = 'No session found. Redirecting...'
    loading.value = false
    setTimeout(() => navigateTo('/login'), 2000)
    return
  }

  // If watch didn't fire but we have a session, save profile anyway
  try {
    // Also save the GitHub provider_token for API calls
    const githubToken = data.session.provider_token || ''

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.session.user.id,
      github_id: data.session.user.user_metadata?.user_name || '',
      github_user: data.session.user.user_metadata?.user_name || '',
      avatar_url: data.session.user.user_metadata?.avatar_url || '',
      github_token: githubToken,
    }, { onConflict: 'id' })

    if (profileError) {
      console.error('Failed to save profile:', profileError.message)
    }
  } catch (e: any) {
    console.error('Profile upsert error:', e)
  }

  statusMessage.value = 'Welcome! Redirecting...'
  loading.value = false
  setTimeout(() => navigateTo('/'), 1500)
})
</script>
