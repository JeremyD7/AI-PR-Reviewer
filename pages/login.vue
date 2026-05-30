<template>
  <NuxtLayout name="auth">
    <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
      <!-- Logo -->
      <div class="text-center mb-8">
        <UIcon name="i-heroicons-code-bracket-square" class="w-14 h-14 text-indigo-500 mx-auto mb-4" />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">AI PR Reviewer</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">
          Automated code review powered by AI
        </p>
      </div>

      <!-- GitHub Login -->
      <UButton
        block
        size="xl"
        color="gray"
        variant="solid"
        class="justify-center gap-3 font-medium"
        :loading="loading"
        @click="signInWithGitHub"
      >
        <UIcon name="i-simple-icons-github" class="w-5 h-5" />
        Sign in with GitHub
      </UButton>

      <p class="text-xs text-gray-400 dark:text-gray-500 text-center mt-6">
        By signing in, you agree to allow access to your repositories
        for automated PR review.
      </p>

      <!-- Error -->
      <UAlert
        v-if="error"
        color="red"
        variant="soft"
        class="mt-4"
        :title="error"
      />
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
})

const supabase = useSupabaseClient()
const loading = ref(false)
const error = ref('')

async function signInWithGitHub() {
  loading.value = true
  error.value = ''

  try {
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'user:email repo admin:repo_hook',
      },
    })

    if (err) {
      error.value = err.message
    }
  } catch (e) {
    error.value = 'Failed to connect to GitHub. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>
