<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h1>

    <!-- Profile -->
    <UCard class="mb-6 bg-white dark:bg-gray-900">
      <template #header>
        <h2 class="font-semibold text-gray-900 dark:text-white">Profile</h2>
      </template>
      <div class="flex items-center gap-4">
        <UAvatar
          :src="user?.user_metadata?.avatar_url"
          :alt="user?.user_metadata?.user_name"
          size="lg"
        />
        <div>
          <p class="font-medium text-gray-900 dark:text-white">
            {{ user?.user_metadata?.user_name || 'Unknown' }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ user?.email }}</p>
        </div>
      </div>
    </UCard>

    <!-- API Status -->
    <UCard class="mb-6 bg-white dark:bg-gray-900">
      <template #header>
        <h2 class="font-semibold text-gray-900 dark:text-white">Service Status</h2>
      </template>
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">Supabase Connection</span>
          <UBadge :color="services.supabase ? 'green' : 'red'" size="sm">
            {{ services.supabase ? 'Connected' : 'Disconnected' }}
          </UBadge>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">GitHub OAuth</span>
          <UBadge :color="services.github ? 'green' : 'red'" size="sm">
            {{ services.github ? 'Connected' : 'Disconnected' }}
          </UBadge>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">DeepSeek API</span>
          <UBadge :color="services.deepseek ? 'green' : 'red'" size="sm">
            {{ services.deepseek ? 'Configured' : 'Not Configured' }}
          </UBadge>
        </div>
      </div>
    </UCard>

    <!-- Danger Zone -->
    <UCard class="bg-white dark:bg-gray-900 border-red-200 dark:border-red-900">
      <template #header>
        <h2 class="font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
      </template>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Sign out of your account. You can sign back in at any time.
      </p>
      <UButton color="red" variant="soft" @click="signOut">
        Sign Out
      </UButton>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '~/stores/app'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const appStore = useAppStore()

const services = ref({
  supabase: false,
  github: false,
  deepseek: false,
})

async function signOut() {
  await supabase.auth.signOut()
  appStore.addToast('已退出登录', { color: 'indigo', timeout: 3000 })
  navigateTo('/login')
}

onMounted(async () => {
  // Check Supabase
  services.value.supabase = !!user.value

  // Check GitHub
  const { data: session } = await supabase.auth.getSession()
  services.value.github = !!session.session?.provider_token

  // Check DeepSeek (via public runtime config — boolean flag only, no key exposed)
  const config = useRuntimeConfig()
  services.value.deepseek = !!config.public.deepseekConfigured
})
</script>
