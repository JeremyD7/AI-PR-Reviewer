/**
 * Global app store (Pinia)
 */
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', () => {
  const sidebarOpen = ref(false)
  const toastMessages = ref<Array<{
    id: string
    title: string
    description?: string
    color: string
    timeout: number
  }>>([])

  function addToast(title: string, options?: {
    description?: string
    color?: string
    timeout?: number
  }) {
    const id = Date.now().toString()
    toastMessages.value.push({
      id,
      title,
      description: options?.description,
      color: options?.color || 'indigo',
      timeout: options?.timeout || 5000,
    })
    setTimeout(() => removeToast(id), options?.timeout || 5000)
  }

  function removeToast(id: string) {
    toastMessages.value = toastMessages.value.filter(t => t.id !== id)
  }

  return {
    sidebarOpen,
    toastMessages,
    addToast,
    removeToast,
  }
})
