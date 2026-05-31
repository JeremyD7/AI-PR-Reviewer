/**
 * Validate required environment variables at startup.
 *
 * IMPORTANT: In serverless environments (Netlify), this runs on each cold start.
 * We use useRuntimeConfig() instead of process.env directly because Nuxt's
 * runtimeConfig supports NUXT_ prefix overrides at runtime. We also downgrade
 * missing vars to warnings rather than hard crashes — individual API handlers
 * will fail with clear errors if config is truly missing.
 */
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const warnings: string[] = []

  // Required: check via runtimeConfig (build-time + NUXT_ runtime overrides)
  const checks: Array<[string, any, string]> = [
    ['SUPABASE_URL', config.public.supabase?.url, 'Supabase 连接地址'],
    ['SUPABASE_KEY', config.public.supabase?.key, 'Supabase Anon Key'],
    ['SUPABASE_SERVICE_KEY', config.supabaseServiceKey, 'Supabase Service Role Key'],
    ['GITHUB_CLIENT_ID', config.public.githubClientId, 'GitHub OAuth Client ID'],
    ['GITHUB_CLIENT_SECRET', config.githubClientSecret, 'GitHub OAuth Client Secret'],
    ['DEEPSEEK_API_KEY', config.deepseekApiKey, 'DeepSeek API Key'],
  ]

  for (const [name, value, label] of checks) {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      warnings.push(`⚠️  缺少 ${name}（${label}）— 请在 Netlify 环境变量中配置`)
    }
  }

  // Optional but recommended
  if (!config.githubAppWebhookSecret) {
    warnings.push('💡 GITHUB_APP_WEBHOOK_SECRET 未配置 — Webhook 签名验证将跳过（仅开发环境可接受）')
  }
  if (!config.public.appUrl) {
    warnings.push('💡 NUXT_PUBLIC_APP_URL 未配置 — Webhook 将使用默认地址')
  }

  if (warnings.length > 0) {
    console.warn('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.warn('🔶 环境变量检查：')
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    for (const w of warnings) console.warn(w)
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  } else {
    console.log('✅ 环境变量校验通过')
  }
})
