/**
 * Validate required environment variables at startup
 * Fails fast with clear error messages instead of runtime surprises
 */
export default defineNitroPlugin(() => {
  const errors: string[] = []

  const required = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  }

  for (const [name, value] of Object.entries(required)) {
    if (!value || value.trim() === '') {
      errors.push(`❌ 缺少 ${name}，请在 .env 中配置`)
    }
  }

  // Warnings (optional but recommended)
  const warnings: string[] = []
  if (!process.env.GITHUB_APP_WEBHOOK_SECRET) {
    warnings.push('⚠️  GITHUB_APP_WEBHOOK_SECRET 未配置 — Webhook 签名验证将跳过（仅开发环境可接受）')
  }
  if (!process.env.NUXT_PUBLIC_APP_URL) {
    warnings.push('⚠️  NUXT_PUBLIC_APP_URL 未配置 — Webhook 将使用默认地址')
  }

  if (errors.length > 0) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('🔴 环境变量配置错误：')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    for (const err of errors) console.error(err)
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    throw new Error(`缺少 ${errors.length} 个必需的环境变量`)
  }

  if (warnings.length > 0) {
    console.warn('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    for (const w of warnings) console.warn(w)
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  }

  console.log('✅ 环境变量校验通过')
})
