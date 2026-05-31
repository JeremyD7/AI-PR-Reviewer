// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-05-30",

  devtools: { enabled: true },

  modules: ["@nuxt/ui", "@nuxtjs/supabase"],

  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
    redirect: false,
  },

  runtimeConfig: {
    // Server-side only
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
    githubAppId: process.env.GITHUB_APP_ID,
    githubAppPrivateKey: process.env.GITHUB_APP_PRIVATE_KEY,
    githubAppWebhookSecret: process.env.GITHUB_APP_WEBHOOK_SECRET,
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,

    // Public (exposed to client) — never expose secrets here
    public: {
      githubClientId: process.env.GITHUB_CLIENT_ID,
      githubRedirectUri: process.env.GITHUB_REDIRECT_URI,
      appUrl: process.env.NUXT_PUBLIC_APP_URL,
      deepseekConfigured: !!process.env.DEEPSEEK_API_KEY,
    },
  },

  // Cloudflare Pages deployment (edge functions)
  nitro: {
    preset: 'cloudflare-pages',
  },

  // Nuxt UI v2 config
  ui: {
    icons: ["heroicons", "simple-icons"],
  },

  // App config
  app: {
    head: {
      title: "AI PR Reviewer",
      meta: [
        {
          name: "description",
          content: "Automated AI-powered code review for your pull requests",
        },
      ],
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    },
  },

  // Enable TypeScript strict mode
  typescript: {
    strict: true,
  },

  // Allow ngrok tunneling for webhook testing (dev only)
  ...(process.env.NODE_ENV === 'development' ? {
    vite: {
      server: {
        allowedHosts: ['.ngrok-free.dev', '.ngrok.io'],
      },
    },
  } : {}),
});
