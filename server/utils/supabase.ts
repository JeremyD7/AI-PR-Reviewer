/**
 * Server-side Supabase client (with service role for admin operations)
 */
import { createClient } from '@supabase/supabase-js'

let serverClient: ReturnType<typeof createClient> | null = null

export function getServerSupabase() {
  if (serverClient) return serverClient

  const config = useRuntimeConfig()
  const url = process.env.SUPABASE_URL || ''
  const serviceKey = config.supabaseServiceKey || ''

  if (!url || !serviceKey) {
    throw new Error('Supabase URL and service key are required')
  }

  serverClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  })

  return serverClient
}
