/**
 * Dashboard Data API
 *
 * 把原先 index.vue 里客户端 4~5 次串行 Supabase 查询合并为单一服务端端点，
 * 页面通过 useFetch 在 SSR 阶段直接取数，首帧直出、零客户端瀑布流。
 *
 * 身份校验：serverSupabaseUser 从浏览器携带的 Supabase auth cookie 中解析 JWT，
 * serverSupabaseClient 以该用户身份执行查询，RLS 策略仍然生效。
 *
 * 安全说明：reviews / review_comments 两张表存在遗留的
 * "Service role can manage *" USING(true) 策略（未限定 TO service_role，
 * 对所有角色放行）。为避免按用户 JWT 查询时跨用户泄露，这里仍保留
 * 显式的 repo_id IN (userRepos) 过滤，行为与改动前保持一致。
 */
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

const EMPTY_UUID = '00000000-0000-0000-0000-000000000000'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const supabase = serverSupabaseClient(event)

  // 1. 用户所属仓库（RLS 已按 auth.uid() 过滤 ownership）
  const { data: userRepos } = await supabase.from('repositories').select('id')
  const repoIds = (userRepos || []).map(r => r.id)
  const repoScope = repoIds.length ? repoIds : [EMPTY_UUID]

  // 2. 统计指标
  const { count: repoCount } = await supabase
    .from('repositories')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  const { data: reviewStats, count: reviewCount } = await supabase
    .from('reviews')
    .select('issue_count, score', { count: 'exact' })
    .eq('status', 'completed')
    .in('repo_id', repoScope)

  let totalIssues = 0
  let totalScore = 0
  for (const r of reviewStats || []) {
    totalIssues += r.issue_count || 0
    totalScore += r.score || 0
  }
  const avgScore = reviewStats && reviewStats.length > 0
    ? (totalScore / reviewStats.length).toFixed(1)
    : null

  // 3. 最近审查（带关联查询）
  const { data: reviews } = await supabase
    .from('reviews')
    .select(`
      id, status, issue_count, score, created_at,
      pr:pull_requests!inner(id, title, pr_number),
      repo:repositories!inner(repo_name)
    `)
    .in('repo_id', repoScope)
    .order('created_at', { ascending: false })
    .limit(10)

  return {
    repoCount: repoCount || 0,
    reviewCount: reviewCount || 0,
    totalIssues,
    avgScore,
    recentReviews: (reviews || []).map((r: any) => ({
      id: r.id,
      pr_id: r.pr?.id,
      pr_title: r.pr?.title || `PR #${r.pr?.pr_number}`,
      repo_name: r.repo?.repo_name,
      status: r.status,
      issue_count: r.issue_count,
      created_at: r.created_at,
    })),
  }
})