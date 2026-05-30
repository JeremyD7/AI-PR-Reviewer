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
          <UIcon name="i-heroicons-arrow-path-20-solid" class="w-6 h-6 text-indigo-500 animate-spin mx-auto" />
          <p class="text-sm text-gray-400 mt-2">Loading your repositories...</p>
        </div>

        <div v-else-if="repoLoadError" class="text-center py-8">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p class="text-sm text-red-600 dark:text-red-400">{{ repoLoadError }}</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="repo in filteredGitHubRepos"
            :key="repo.id"
            class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
            :class="addingRepo === repo.full_name ? 'opacity-50 cursor-wait' : 'cursor-pointer'"
            @click="addingRepo ? undefined : addRepo(repo)"
          >
            <UIcon name="i-simple-icons-github" class="w-5 h-5 text-gray-500 flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ repo.full_name }}</p>
              <p class="text-xs text-gray-400 truncate">{{ repo.description || 'No description' }}</p>
            </div>
            <UIcon
              v-if="addingRepo === repo.full_name"
              name="i-heroicons-arrow-path-20-solid"
              class="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0"
            />
            <UIcon
              v-else-if="isRepoConnected(repo.full_name)"
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
import { useAppStore } from '~/stores/app'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const appStore = useAppStore()
const { fetchRepos, createWebhook, deleteWebhook, error: githubError } = useGitHub()

const showRepoSelector = ref(false)
const repoSearch = ref('')
const loadingRepos = ref(false)
const repoLoadError = ref('')
const githubRepos = ref<GitHubRepo[]>([])
const addingRepo = ref('') // track which repo is being added

interface ConnectedRepo {
  id: string
  github_repo: string
  is_active: boolean
  webhook_id: string | null
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

function isRepoConnected(fullName: string): boolean {
  return connectedRepos.value.some(r => r.github_repo === fullName)
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
  repoLoadError.value = ''
  try {
    const repos = await fetchRepos()
    githubRepos.value = repos
    repoLoadError.value = githubError.value
  } catch (e: any) {
    repoLoadError.value = e?.message || 'Failed to load repos'
  } finally {
    loadingRepos.value = false
  }
}

async function addRepo(repo: GitHubRepo) {
  addingRepo.value = repo.full_name

  // 1. Save repo to database
  const { error: dbError } = await supabase.from('repositories').upsert({
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

  if (dbError) {
    appStore.addToast(`添加仓库失败: ${dbError.message}`, { color: 'red' })
    addingRepo.value = ''
    return
  }

  // 2. Create webhook on GitHub
  const whResult = await createWebhook(repo.full_name)

  if (whResult) {
    // Save webhook ID to DB
    await supabase.from('repositories').update({
      webhook_id: whResult.webhook_id,
    }).eq('user_id', user.value?.id).eq('github_repo', repo.full_name)
    appStore.addToast(`仓库已连接: ${repo.full_name}`, { color: 'green' })
  } else {
    // Webhook creation failed — still keep the repo but warn
    appStore.addToast(`仓库已连接但 Webhook 创建失败: ${githubError.value || '未知错误'}`, {
      color: 'yellow',
      description: '请尝试在 GitHub 上手动配置 Webhook',
      timeout: 8000,
    })
  }

  addingRepo.value = ''
  await loadConnectedRepos()
}

async function toggleRepo(repoId: string, active: boolean) {
  await supabase.from('repositories').update({ is_active: active }).eq('id', repoId)
  appStore.addToast(active ? '自动审查已开启' : '自动审查已关闭', { color: 'indigo' })
}

onMounted(async () => {
  if (user.value) await loadConnectedRepos()
})

watch(showRepoSelector, (show) => {
  if (show) loadGitHubRepos()
})
</script>
