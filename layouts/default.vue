<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <!-- Top navigation -->
    <header class="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-2.5 font-semibold text-lg text-gray-900 dark:text-white">
          <UIcon name="i-heroicons-code-bracket-square" class="w-7 h-7 text-indigo-500" />
          <span>AI PR Reviewer</span>
        </NuxtLink>

        <!-- Nav links -->
        <nav class="hidden md:flex items-center gap-6">
          <NuxtLink
            to="/repos"
            class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            active-class="text-indigo-600 dark:text-indigo-400 font-medium"
          >
            Repositories
          </NuxtLink>
          <NuxtLink
            to="/"
            class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            active-class="text-indigo-600 dark:text-indigo-400 font-medium"
            exact
          >
            Dashboard
          </NuxtLink>
        </nav>

        <!-- User menu -->
        <div class="flex items-center gap-3">
          <UAvatar
            v-if="user"
            :src="user.user_metadata?.avatar_url"
            :alt="user.user_metadata?.user_name"
            size="sm"
          />
          <UButton
            v-if="!user"
            to="/login"
            color="indigo"
            size="sm"
          >
            Sign in with GitHub
          </UButton>
          <UDropdown
            v-else
            :items="userMenuItems"
            :ui="{ item: { base: 'text-sm' } }"
          >
            <UButton color="gray" variant="ghost" size="sm" trailing-icon="i-heroicons-chevron-down-20-solid">
              {{ user.user_metadata?.user_name || user.email }}
            </UButton>
          </UDropdown>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>

    <!-- Toast notifications -->
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const userMenuItems = [
  [
    {
      label: 'Settings',
      icon: 'i-heroicons-cog-6-tooth',
      to: '/settings',
    },
  ],
  [
    {
      label: 'Sign out',
      icon: 'i-heroicons-arrow-left-on-rectangle',
      click: async () => {
        await supabase.auth.signOut()
        navigateTo('/login')
      },
    },
  ],
]
</script>
