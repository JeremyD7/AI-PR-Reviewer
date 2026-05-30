<template>
  <div>
    <!-- Back link -->
    <div class="mb-6">
      <UButton to="/repos" variant="link" color="gray" icon="i-heroicons-arrow-left" size="sm">
        Back to repositories
      </UButton>
    </div>

    <!-- Repo header -->
    <div v-if="repo" class="flex items-center gap-4 mb-8">
      <UIcon name="i-simple-icons-github" class="w-10 h-10 text-gray-700 dark:text-gray-300" />
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ repo.github_repo }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ repo.is_active ? 'Active' : 'Inactive' }} · Settings configured
        </p>
      </div>
      <div class="ml-auto">
        <UButton
          color="indigo"
          icon="i-heroicons-play"
          :loading="triggeringReview"
          @click="triggerManualReview"
        >
          Manual Review
        </UButton>
      </div>
    </div>

    <!-- Settings -->
    <UCard class="mb-8 bg-white dark:bg-gray-900">
      <template #header>
        <h2 class="font-semibold text-gray-900 dark:text-white">Review Settings</h2>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Auto Review
          </label>
          <UToggle
            v-model="settings.auto_review"
            @update:model-value="saveSettings"
          />
          <p class="text-xs text-gray-400 mt-1">Automatically review new PRs</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Max Files Per Review
          </label>
          <UInput
            v-model.number="settings.max_files_per_review"
            type="number"
            @update:model-value="saveSettings"
          />
        </div>

        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Review Categories
          </label>
          <div class="flex flex-wrap gap-2">
            <UChip
              v-for="cat in allCategories"
              :key="cat.value"
              :color="settings.review_categories?.includes(cat.value) ? 'indigo' : 'gray'"
              :text="cat.label"
              clickable
              @click="toggleCategory(cat.value)"
            />
          </div>
        </div>

        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Ignore Patterns
          </label>
          <UInput
            v-model="ignorePatternsStr"
            placeholder="*.lock, *.json, *.md"
            @blur="savePatterns"
          />
          <p class="text-xs text-gray-400 mt-1">Comma-separated file patterns to skip</p>
        </div>
      </div>
    </UCard>

    <!-- Recent PRs -->
    <UCard class="bg-white dark:bg-gray-900">
      <template #header>
        <h2 class="font-semibold text-gray-900 dark:text-white">Pull Requests</h2>
      </template>

      <div v-if="prs.length === 0" class="text-center py-8">
        <UIcon name="i-heroicons-inbox" class="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p class="text-gray-500 dark:text-gray-400 text-sm">No pull requests reviewed yet.</p>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="pr in prs"
          :key="pr.id"
          class="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
          @click="navigateTo(`/prs/${pr.id}`)"
        >
          <UIcon
            :name="pr.status === 'open' ? 'i-heroicons-arrow-path' : pr.status === 'merged' ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
            :class="pr.status === 'open' ? 'text-green-500' : pr.status === 'merged' ? 'text-purple-500' : 'text-gray-400'"
            class="w-5 h-5 flex-shrink-0"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
              #{{ pr.pr_number }} {{ pr.title }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ pr.branch_from }} → {{ pr.branch_to }} · {{ pr.author }}
            </p>
          </div>
          <UBadge :color="pr.status === 'open' ? 'green' : 'gray'" size="sm">
            {{ pr.status }}
          </UBadge>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { ReviewSettings } from '~/types/database'

const route = useRoute()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const triggeringReview = ref(false)

const repo = ref<any>(null)
const prs = ref<any[]>([])
const settings = ref<ReviewSettings>({
  auto_review: true,
  review_categories: ['security', 'performance', 'logic', 'style', 'best_practice'],
  max_files_per_review: 50,
  ignore_patterns: ['*.lock', '*.json', '*.md', '*.svg'],
  language: 'en',
})
const ignorePatternsStr = ref('')

const allCategories = [
  { value: 'security', label: 'Security' },
  { value: 'performance', label: 'Performance' },
  { value: 'logic', label: 'Logic' },
  { value: 'style', label: 'Code Style' },
  { value: 'best_practice', label: 'Best Practices' },
]

function toggleCategory(cat: string) {
  const idx = settings.value.review_categories.indexOf(cat)
  if (idx > -1) {
    settings.value.review_categories.splice(idx, 1)
  } else {
    settings.value.review_categories.push(cat)
  }
  saveSettings()
}

async function saveSettings() {
  if (!repo.value) return
  await supabase.from('repositories').update({ settings: settings.value }).eq('id', repo.value.id)
}

async function savePatterns() {
  settings.value.ignore_patterns = ignorePatternsStr.value.split(',').map(s => s.trim()).filter(Boolean)
  await saveSettings()
}

async function triggerManualReview() {
  triggeringReview.value = true
  try {
    await $fetch('/api/reviews/trigger', {
      method: 'POST',
      body: { repo_id: repo.value.id },
    })
  } catch (e) {
    console.error('Failed to trigger review:', e)
  } finally {
    triggeringReview.value = false
  }
}

onMounted(async () => {
  const repoId = route.params.id as string

  const { data: repoData } = await supabase.from('repositories').select('*').eq('id', repoId).single()
  if (repoData) {
    repo.value = repoData
    settings.value = repoData.settings
    ignorePatternsStr.value = settings.value.ignore_patterns?.join(', ') || ''
  }

  const { data: prData } = await supabase
    .from('pull_requests')
    .select('*')
    .eq('repo_id', repoId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (prData) prs.value = prData
})
</script>
