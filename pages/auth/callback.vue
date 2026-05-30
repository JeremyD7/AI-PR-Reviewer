<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
    <div class="text-center">
      <ULoadingIcon v-if="loading" name="i-heroicons-arrow-path-20-solid" class="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
      <p class="mt-4 text-gray-600 dark:text-gray-400">{{ statusMessage }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
})

const supabase = useSupabaseClient()
const loading = ref(true)
const statusMessage = ref('Completing sign in...')

onMounted(async () => {
  const { data, error } = await supabase.auth.getSession()

  if (error || !data.session) {
    statusMessage.value = 'Sign in failed. Redirecting...'
    setTimeout(() => navigateTo('/login'), 2000)
    return
  }

  // Upsert profile in database
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: data.session.user.id,
    github_id: data.session.user.user_metadata.user_name,
    github_user: data.session.user.user_metadata.user_name,
    avatar_url: data.session.user.user_metadata.avatar_url,
  }, { onConflict: 'id' })

  if (profileError) {
    console.error('Failed to save profile:', profileError)
  }

  statusMessage.value = 'Welcome! Redirecting...'
  loading.value = false
  setTimeout(() => navigateTo('/'), 1000)
})
</script>
