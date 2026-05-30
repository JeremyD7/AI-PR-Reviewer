<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Repositories</h1>
        <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Manage repositories for automated PR review.
        </p>
      </div>
      <UButton
        color="indigo"
        icon="i-heroicons-plus"
        @click="showRepoSelector = true"
      >
        Add Repository
      </UButton>
    </div>

    <!-- Connected repos -->
    <div v-if="connectedRepos.length === 0" class="text-center py-16">
      <UIcon name="i-heroicons-folder-open" class="w-14 h-14 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-1">No repositories connected</h3>
      <p class="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Add a repository to start reviewing pull requests automatically.
      </p>
      <UButton color="indigo" @click="showRepoSelector = true">
        Add your first repository
      </UButton>
    </div>

    <!-- Repo list -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <UCard
        v-for="repo in connectedRepos"
        :key="repo.id"
        class="bg-white dark:bg-gray-900 hover:shadow-md transition-shadow cursor-pointer"
        @click="navigateTo(`/repos/${repo.id}`)"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3">
            <UIcon name="i-simple-icons-github" class="w-8 h-8 text-gray-700 dark:text-gray-300" />
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white">{{ repo.github_repo }}</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {{ repo.settings?.auto_review ? 'Auto-review ON' : 'Auto-review OFF' }}
                · Added {{ formatDate(repo.created_at) }}
              </p>
            </div>
          </div>
          <UToggle
            v-model="repo.is_active"
            :color="repo.is_active ? 'green' : 'gray'"
            @update:model-value="(val: boolean) => toggleRepo(repo.id, val)"
            @click.stop
          />
        </div>
      </UCard>
    </div>

    <!-- Add repo slideover -->
    <USlideover v-model="showRepoSelector">
      <div class="p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">Add Repository</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Select repositories to enable automated PR reviews.
        </p>

        <UInput
          v-model="repoSearch"
          placeholder="Search repositories..."
          icon="i-heroicons-magnifying-glass"
          class="mb-4"
        />

        <div v-if="loadingRepos" class="text-center py-8">
          <ULoadingIcon class="w-6 h-6 text-indigo-500 animate-spin mx-auto" />
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="repo in filteredGitHubRepos"
            :key="repo.id"
            class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
            @click="addRepo(repo)"
          >
            <UIcon name="i-simple-icons-github" class="w-5 h-5 text-gray-500 flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ repo.full_name }}</p>
              <p class="text-xs text-gray-400 truncate">{{ repo.description || 'No description' }}</p>
            </div>
            <UIcon
              v-if="addedRepoIds.has(repo.id)"
              name="i-heroicons-check-circle"
              class="w-5 h-5 text-green-500 flex-shrink-0"
            />
            <UIcon
              v-else
              name="i-heroicons-plus-circle"
              class="w-5 h-5 text-indigo-500 flex-shrink-0"
            />
          </div>
        </div>
      </div>
    </USlideover>
  </div>
</template>

<script setup lang="ts">
import type { GitHubRepo } from '~/types/github'

const supabase = useSupabaseClient()
const user = useSupabaseUser()

const showRepoSelector = ref(false)
const repoSearch = ref('')
const loadingRepos = ref(false)
const githubRepos = ref<GitHubRepo[]>([])
const addedRepoIds = ref(new Set<number>())

interface ConnectedRepo {
  id: string
  github_repo: string
  is_active: boolean
  settings: any
  created_at: string
}
const connectedRepos = ref<ConnectedRepo[]>([])

const filteredGitHubRepos = computed(() => {
  if (!repoSearch.value) return githubRepos.value
  const q = repoSearch.value.toLowerCase()
  return githubRepos.value.filter(r => r.full_name.toLowerCase().includes(q))
})

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString()
}

async function loadConnectedRepos() {
  const { data } = await supabase
    .from('repositories')
    .select('*')
    .eq('user_id', user.value?.id)
    .order('created_at', { ascending: false })

  if (data) connectedRepos.value = data
}

async function loadGitHubRepos() {
  loadingRepos.value = true
  try {
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.provider_token

    if (!token) {
      // Re-auth to get GitHub token
      await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: `${window.location.origin}/repos` },
      })
      return
    }

    // Proxy through our server to avoid CORS
    const { data } = await $fetch<{ repos: GitHubRepo[] }>('/api/github/repos', {
      headers: { Authorization: `Bearer ${token}` },
    })
    githubRepos.value = data.repos || []
  } catch (e) {
    console.error('Failed to load GitHub repos:', e)
  } finally {
    loadingRepos.value = false
  }
}

async function addRepo(repo: GitHubRepo) {
  const { error } = await supabase.from('repositories').upsert({
    user_id: user.value?.id,
    github_repo: repo.full_name,
    repo_name: repo.name,
    is_active: true,
    settings: {
      auto_review: true,
      review_categories: ['security', 'performance', 'logic', 'style', 'best_practice'],
      max_files_per_review: 50,
      ignore_patterns: ['*.lock', '*.json', '*.md', '*.svg'],
    },
  }, { onConflict: 'user_id,github_repo' })

  if (!error) {
    addedRepoIds.value.add(repo.id)
    await loadConnectedRepos()
  }
}

async function toggleRepo(repoId: string, active: boolean) {
  await supabase.from('repositories').update({ is_active: active }).eq('id', repoId)
}

onMounted(async () => {
  if (user.value) await loadConnectedRepos()
})

watch(showRepoSelector, (show) => {
  if (show) loadGitHubRepos()
})
</script>
