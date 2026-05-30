<template>
  <div>
    <!-- Welcome Banner -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        Welcome back{{ user ? `, ${user.user_metadata?.user_name || ''}` : '' }}
      </h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">
        Monitor your pull request reviews across repositories.
      </p>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <UCard v-for="stat in stats" :key="stat.label" class="bg-white dark:bg-gray-900">
        <div class="flex items-center gap-4">
          <div :class="`p-3 rounded-lg ${stat.bgColor}`">
            <UIcon :name="stat.icon" :class="`w-6 h-6 ${stat.iconColor}`" />
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stat.value }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ stat.label }}</p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Recent Reviews -->
    <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <h2 class="font-semibold text-gray-900 dark:text-white">Recent Reviews</h2>
        <UButton to="/repos" variant="link" color="indigo" size="sm">View all repositories</UButton>
      </div>

      <div v-if="recentReviews.length === 0" class="p-12 text-center">
        <UIcon name="i-heroicons-document-magnifying-glass" class="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <p class="text-gray-500 dark:text-gray-400">No reviews yet.</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Connect a repository to get started with automated PR reviews.
        </p>
        <UButton to="/repos" color="indigo" class="mt-4">
          Browse Repositories
        </UButton>
      </div>

      <div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
        <div
          v-for="review in recentReviews"
          :key="review.id"
          class="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
          @click="navigateTo(`/prs/${review.pr_id}`)"
        >
          <UIcon
            :name="review.status === 'completed' ? 'i-heroicons-check-circle' : 'i-heroicons-clock'"
            :class="review.status === 'completed' ? 'text-green-500' : 'text-yellow-500'"
            class="w-5 h-5 flex-shrink-0"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ review.pr_title }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ review.repo_name }} · {{ formatTimeAgo(review.created_at) }}
            </p>
          </div>
          <UBadge
            v-if="review.issue_count > 0"
            :color="review.issue_count > 5 ? 'red' : review.issue_count > 2 ? 'yellow' : 'green'"
            size="sm"
          >
            {{ review.issue_count }} {{ review.issue_count === 1 ? 'issue' : 'issues' }}
          </UBadge>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const stats = ref([
  {
    label: 'Active Repos',
    value: 0,
    icon: 'i-heroicons-folder',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    label: 'Reviews Completed',
    value: 0,
    icon: 'i-heroicons-check-badge',
    bgColor: 'bg-green-50 dark:bg-green-950',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  {
    label: 'Issues Found',
    value: 0,
    icon: 'i-heroicons-exclamation-triangle',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    label: 'Avg Score',
    value: '—',
    icon: 'i-heroicons-chart-bar',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
])

const recentReviews = ref<any[]>([])

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

onMounted(async () => {
  if (!user.value) return

  const userId = user.value.id

  // Get user's repo IDs for scoping
  const { data: userRepos } = await supabase
    .from('repositories')
    .select('id')
    .eq('user_id', userId)

  const userRepoIds = userRepos?.map(r => r.id) || []

  // Fetch stats scoped to user's repos
  const { count: repoCount } = await supabase
    .from('repositories')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true)

  const { count: reviewCount, data: reviewStats } = await supabase
    .from('reviews')
    .select('issue_count, score', { count: 'exact' })
    .eq('status', 'completed')
    .in('repo_id', userRepoIds.length > 0 ? userRepoIds : ['00000000-0000-0000-0000-000000000000'])

  // Calculate issues found and average score
  let totalIssues = 0
  let totalScore = 0
  if (reviewStats) {
    reviewStats.forEach(r => {
      totalIssues += r.issue_count || 0
      totalScore += r.score || 0
    })
  }
  const avgScore = reviewStats && reviewStats.length > 0
    ? (totalScore / reviewStats.length).toFixed(1)
    : '—'

  stats.value[0].value = repoCount || 0
  stats.value[1].value = reviewCount || 0
  stats.value[2].value = totalIssues
  stats.value[3].value = avgScore

  // Fetch recent reviews scoped to user's repos
  const { data: reviews } = await supabase
    .from('reviews')
    .select(`
      id, status, issue_count, score, created_at,
      pr:pull_requests!inner(id, title, pr_number),
      repo:repositories!inner(repo_name)
    `)
    .in('repo_id', userRepoIds.length > 0 ? userRepoIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at', { ascending: false })
    .limit(10)

  if (reviews) {
    recentReviews.value = reviews.map((r: any) => ({
      id: r.id,
      pr_id: r.pr?.id,
      pr_title: r.pr?.title || `PR #${r.pr?.pr_number}`,
      repo_name: r.repo?.repo_name,
      status: r.status,
      issue_count: r.issue_count,
      created_at: r.created_at,
    }))
  }
})
</script>
