<template>
  <!-- Toast notifications container -->
  <Teleport to="body">
    <div
      v-if="toasts.length > 0"
      class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm"
    >
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4`"
        >
          <div class="flex items-start gap-3">
            <UIcon
              :name="toastIcon(toast.color)"
              :class="`w-5 h-5 flex-shrink-0 text-${toast.color}-500`"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ toast.title }}</p>
              <p v-if="toast.description" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {{ toast.description }}
              </p>
            </div>
            <button
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
              @click="appStore.removeToast(toast.id)"
            >
              <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useAppStore } from '~/stores/app'

const appStore = useAppStore()
const toasts = computed(() => appStore.toastMessages)

function toastIcon(color: string): string {
  const map: Record<string, string> = {
    green: 'i-heroicons-check-circle',
    red: 'i-heroicons-x-circle',
    yellow: 'i-heroicons-exclamation-triangle',
    indigo: 'i-heroicons-information-circle',
  }
  return map[color] || 'i-heroicons-bell'
}
</script>

<style scoped>
.toast-enter-active { transition: all 0.3s ease; }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translateX(100px); }
.toast-leave-to { opacity: 0; transform: translateX(100px); }
</style>
