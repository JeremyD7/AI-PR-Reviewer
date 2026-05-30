<template>
  <div class="text-center py-12">
    <UIcon
      :name="icon"
      class="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4"
    />
    <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-1">
      {{ title }}
    </h3>
    <p class="text-sm text-gray-500 dark:text-gray-400">
      {{ description }}
    </p>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description: string
}>()
</script>
