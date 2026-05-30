<template>
  <div>
    <div class="mb-6">
      <UButton
        :to="pr ? `/repos/${pr.repo_id}` : '/repos'"
        variant="link" color="gray" icon="i-heroicons-arrow-left" size="sm"
      >
        Back
      </UButton>
    </div>

    <!-- PR Header -->
    <div v-if="pr" class="mb-8">
      <div class="flex items-center gap-3 mb-2">
        <UBadge :color="pr.status === 'open' ? 'green' : 'gray'">{{ pr.status }}</UBadge>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          #{{ pr.pr_number }} {{ pr.title }}
        </h1>
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ pr.branch_from }} → {{ pr.branch_to }} · by {{ pr.author }}
        · {{ formatTimeAgo(pr.created_at) }}
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-16">
      <ULoadingIcon class="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
      <p class="text-gray-500 dark:text-gray-400 mt-3">Loading review...</p>
    </div>

    <!-- No review yet -->
    <div v-else-if="!review" class="text-center py-16">
      <UIcon name="i-heroicons-clock" class="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
      <p class="text-gray-500 dark:text-gray-400">No review has been generated yet for this PR.</p>
      <UButton color="indigo" class="mt-4" @click="triggerReview">Run Review Now</UButton>
    </div>

    <!-- Review Result -->
    <div v-else>
      <!-- Summary Card -->
      <UCard class="mb-6 bg-white dark:bg-gray-900">
        <div class="flex items-start gap-6">
          <!-- Score -->
          <div class="text-center flex-shrink-0">
            <div
              class="w-20 h-20 rounded-full flex items-center justify-center border-4"
              :class="scoreColor"
            >
              <span class="text-2xl font-bold">{{ review.score }}/10</span>
            </div>
            <p class="text-xs text-gray-400 mt-1">Score</p>
          </div>

          <!-- Summary -->
          <div class="flex-1">
            <h3 class="font-semibold text-gray-900 dark:text-white mb-2">AI Review Summary</h3>
            <p class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
              {{ review.summary || 'No summary available.' }}
            </p>
            <div class="flex items-center gap-4 mt-4 text-xs text-gray-400">
              <span>{{ review.issue_count }} issues found</span>
              <span>Model: {{ review.model }}</span>
              <span>{{ formatTimeAgo(review.created_at) }}</span>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Comments -->
      <div class="space-y-4">
        <h2 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          Review Comments
          <span class="text-sm font-normal text-gray-400">({{ comments.length }})</span>
        </h2>

        <div
          v-for="(comment, idx) in comments"
          :key="comment.id"
          class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
        >
          <div class="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <UBadge :color="severityColor(comment.severity)" size="xs">
              {{ comment.severity }}
            </UBadge>
            <UBadge color="gray" size="xs" variant="soft">
              {{ formatCategory(comment.category) }}
            </UBadge>
            <span class="text-sm text-gray-500 dark:text-gray-400 font-mono truncate ml-auto">
              {{ comment.file_path }}{{ comment.line_start ? `:${comment.line_start}` : '' }}
            </span>
          </div>
          <div class="p-5">
            <p class="text-sm text-gray-800 dark:text-gray-200">{{ comment.message }}</p>
            <div
              v-if="comment.suggestion"
              class="mt-3 p-3 bg-indigo-50 dark:bg-indigo-950 rounded-lg border border-indigo-100 dark:border-indigo-900"
            >
              <p class="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">💡 Suggestion</p>
              <p class="text-sm text-indigo-800 dark:text-indigo-200">{{ comment.suggestion }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Re-run -->
      <div class="mt-8 text-center">
        <UButton
          color="gray"
          variant="ghost"
          icon="i-heroicons-arrow-path"
          :loading="triggering"
          @click="triggerReview"
        >
          Re-run Review
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Review, ReviewComment } from '~/types/database'

const route = useRoute()
const supabase = useSupabaseClient()
const loading = ref(true)
const triggering = ref(false)

const pr = ref<any>(null)
const review = ref<Review | null>(null)
const comments = ref<ReviewComment[]>([])

const scoreColor = computed(() => {
  if (!review.value) return 'border-gray-200 text-gray-400'
  const s = review.value.score || 0
  if (s >= 8) return 'border-green-400 text-green-600'
  if (s >= 6) return 'border-yellow-400 text-yellow-600'
  return 'border-red-400 text-red-600'
})

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function severityColor(s: string): string {
  const map: Record<string, string> = { critical: 'red', warning: 'yellow', suggestion: 'blue', info: 'gray' }
  return map[s] || 'gray'
}

function formatCategory(c: string): string {
  return c.replace(/_/g, ' ')
}

async function loadReview() {
  loading.value = true
  const prId = route.params.id as string

  // Load PR
  const { data: prData } = await supabase.from('pull_requests').select('*').eq('id', prId).single()
  if (prData) pr.value = prData

  // Load latest review
  const { data: reviewData } = await supabase
    .from('reviews')
    .select('*')
    .eq('pr_id', prId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (reviewData) {
    review.value = reviewData

    // Load comments
    const { data: commentData } = await supabase
      .from('review_comments')
      .select('*')
      .eq('review_id', reviewData.id)
      .order('severity', { ascending: true })

    if (commentData) comments.value = commentData
  }

  loading.value = false
}

async function triggerReview() {
  triggering.value = true
  try {
    await $fetch('/api/reviews/trigger', {
      method: 'POST',
      body: { pr_id: pr.value.id },
    })
    // Reload after a delay
    setTimeout(() => loadReview(), 5000)
  } catch (e) {
    console.error('Failed to trigger review:', e)
  } finally {
    triggering.value = false
  }
}

onMounted(loadReview)
</script>
