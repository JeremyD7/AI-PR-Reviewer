/**
 * AI Review Engine
 * Core logic for analyzing PR diffs using DeepSeek API (OpenAI-compatible)
 */
import type { ReviewComment, ReviewSettings } from '~/types/database'

interface ReviewResult {
  summary: string
  score: number
  comments: Omit<ReviewComment, 'id' | 'review_id' | 'created_at' | 'github_comment_id'>[]
}

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-chat' // DeepSeek-V3

const SYSTEM_PROMPT = `你是一名资深代码审查专家。请分析提供的 Pull Request diff 并找出有意义的问题。

**所有回复必须使用中文。** summary、message、suggestion 字段全部用中文输出。

## 审查类别（按优先级排序）：
1. **security** — 安全漏洞、密钥泄露、SQL 注入、XSS、不安全的反序列化、缺少鉴权
2. **logic** — Bug、边界情况、空值检查、竞态条件、错误处理不当、逻辑错误
3. **performance** — N+1 查询、不必要的内存分配、阻塞操作、缺少缓存、大数据量处理
4. **best_practice** — 设计模式、SOLID 原则、缺少测试、硬编码、耦合过紧
5. **style** — 命名规范、过度复杂（函数超过50行、嵌套超过4层）

## 审查规则：
- 只报告真正有问题的地方，不要吹毛求疵。
- 忽略：代码格式化、空白符、import 排序、个人风格偏好。
- 每个问题必须附带具体的修复建议和代码示例。
- 如果 PR 整体质量不错，给出高分即可。10 分代表完美。
- 每条评论控制在 2-4 句话内，言简意赅。
- 关注重点：安全漏洞 > 逻辑错误 > 性能问题 > 最佳实践 > 代码风格。

## 输出格式：
必须只返回合法的 JSON，不要包含 markdown 标记或 JSON 之外的任何解释文字。

{
  "summary": "整体评估（2-3句中文总结）",
  "score": 7,
  "comments": [
    {
      "file_path": "src/utils/auth.ts",
      "line_start": 42,
      "line_end": 45,
      "severity": "critical",
      "category": "security",
      "message": "JWT Token 存储在 localStorage 中，容易受到 XSS 攻击。",
      "suggestion": "建议改用 httpOnly Cookie 存储 Token。示例：res.cookie('token', jwt, { httpOnly: true, secure: true, sameSite: 'strict' });"
    }
  ]
}

severity 可选值: "critical", "warning", "suggestion", "info"
category 可选值: "security", "logic", "performance", "best_practice", "style"
line_start 和 line_end 为可选项（不适用于特定行时设为 null）。`

export async function reviewPullRequest(
  diffContent: string,
  prTitle: string,
  settings: ReviewSettings,
): Promise<ReviewResult> {
  const config = useRuntimeConfig()
  const apiKey = config.deepseekApiKey

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured')
  }

  // Filter diff by ignore patterns
  const filteredDiff = filterDiffByPatterns(diffContent, settings.ignore_patterns || [])

  // Truncate if too large (DeepSeek context: 64K tokens ≈ ~180K chars for safety)
  const maxChars = 150000
  const truncatedDiff = filteredDiff.length > maxChars
    ? filteredDiff.slice(0, maxChars) + '\n\n... [diff truncated due to size]'
    : filteredDiff

  const userMessage = `## Pull Request: ${prTitle}

## 审查关注点：
${settings.review_categories?.join(', ') || '所有类别'}

## 代码变更 (Diff)：
\`\`\`diff
${truncatedDiff}
\`\`\`

⚠️ **请用中文回复，所有内容必须为中文。**`

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 4096,
      temperature: 0.1, // Low temperature for consistent code review
      stream: false,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`DeepSeek API error (${response.status}): ${errText}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>
  }

  const text = data.choices?.[0]?.message?.content || ''

  if (!text) {
    throw new Error('Empty response from DeepSeek API')
  }

  // Extract JSON (handle possible markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Failed to extract JSON from AI response: ${text.slice(0, 300)}`)
  }

  let result: ReviewResult
  try {
    result = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error(`Invalid JSON in AI response: ${text.slice(0, 500)}`)
  }

  // Validate and sanitize
  return {
    summary: result.summary || 'No summary provided.',
    score: Math.max(1, Math.min(10, result.score || 7)),
    comments: (result.comments || []).map(c => ({
      file_path: c.file_path || '',
      line_start: c.line_start || null,
      line_end: c.line_end || null,
      severity: ['critical', 'warning', 'suggestion', 'info'].includes(c.severity) ? c.severity : 'info',
      category: ['security', 'logic', 'performance', 'best_practice', 'style'].includes(c.category) ? c.category : 'best_practice',
      message: c.message || '',
      suggestion: c.suggestion || null,
    })),
  }
}

/**
 * Filter out files matching ignore patterns
 */
function filterDiffByPatterns(diff: string, patterns: string[]): string {
  if (!patterns.length) return diff

  const files = diff.split(/(?=^diff --git)/m)
  const filteredFiles = files.filter(fileBlock => {
    const match = fileBlock.match(/^diff --git a\/(.+) b\//)
    if (!match) return true
    const filename = match[1]

    return !patterns.some(pattern => {
      const regex = new RegExp(
        '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      )
      return regex.test(filename)
    })
  })

  return filteredFiles.join('')
}
