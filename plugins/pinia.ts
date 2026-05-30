/**
 * Manual Pinia plugin for Nuxt 3 (avoiding @pinia/nuxt compatibility issues)
 */
import { createPinia } from 'pinia'

export default defineNuxtPlugin((nuxtApp) => {
  const pinia = createPinia()
  nuxtApp.vueApp.use(pinia)

  // Make pinia available via useNuxtApp().$pinia
  nuxtApp.provide('pinia', pinia)

  // Also return for injection
  return {
    provide: {
      pinia,
    },
  }
})
