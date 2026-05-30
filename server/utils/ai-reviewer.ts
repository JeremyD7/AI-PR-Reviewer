/**
 * AI Review Engine
 * Core logic for analyzing PR diffs using Claude API
 */
import Anthropic from '@anthropic-ai/sdk'
import type { ReviewComment, ReviewSettings } from '~/types/database'

interface ReviewResult {
  summary: string
  score: number
  comments: Omit<ReviewComment, 'id' | 'review_id' | 'created_at' | 'github_comment_id'>[]
}

const SYSTEM_PROMPT = `You are an expert code reviewer. Analyze the provided pull request diff and identify meaningful issues.

## Review Categories (in order of priority):
1. **security** — vulnerabilities, exposed secrets, SQL injection, XSS, unsafe deserialization, missing auth checks
2. **logic** — bugs, edge cases, null checks, race conditions, incorrect error handling, wrong assumptions
3. **performance** — N+1 queries, unnecessary allocations, blocking operations, missing caching, large payloads
4. **best_practice** — design patterns, SOLID violations, missing tests, hardcoded values, tight coupling
5. **style** — naming conventions, excessive complexity (>50 line functions, >4 nested levels)

## Rules:
- ONLY report issues that are genuinely problematic. Do NOT nitpick.
- IGNORE: formatting, whitespace, import ordering, personal style preferences.
- For each issue, provide a CONCRETE fix suggestion with code.
- If the PR looks good overall, say so with a high score. A score of 10 means perfect.
- Be CONCISE. Each comment should be 2-4 sentences max.
- Focus on what MATTERS: security bugs > logic errors > performance > best practices > style.

## Output Format:
You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.

{
  "summary": "Brief overall assessment (2-3 sentences)",
  "score": 7,
  "comments": [
    {
      "file_path": "src/utils/auth.ts",
      "line_start": 42,
      "line_end": 45,
      "severity": "critical",
      "category": "security",
      "message": "The JWT token is stored in localStorage which is vulnerable to XSS attacks.",
      "suggestion": "Use httpOnly cookies for token storage instead:\\n\\n// Set cookie server-side\\nres.cookie('token', jwt, { httpOnly: true, secure: true, sameSite: 'strict' });"
    }
  ]
}

Valid severity values: "critical", "warning", "suggestion", "info"
Valid category values: "security", "logic", "performance", "best_practice", "style"
line_start and line_end are optional (use null if not applicable to a specific line).`

export async function reviewPullRequest(
  diffContent: string,
  prTitle: string,
  settings: ReviewSettings,
): Promise<ReviewResult> {
  const config = useRuntimeConfig()
  const apiKey = config.anthropicApiKey

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  // Filter diff by ignore patterns
  const filteredDiff = filterDiffByPatterns(diffContent, settings.ignore_patterns || [])

  // Truncate if too large (Claude has context limits)
  const maxChars = 100000
  const truncatedDiff = filteredDiff.length > maxChars
    ? filteredDiff.slice(0, maxChars) + '\n\n... [diff truncated due to size]'
    : filteredDiff

  const anthropic = new Anthropic({ apiKey })

  const userMessage = `## Pull Request: ${prTitle}

## Review Focus:
${settings.review_categories?.join(', ') || 'all categories'}

## Code Diff:
\`\`\`diff
${truncatedDiff}
\`\`\``

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userMessage },
    ],
  })

  // Parse JSON from response
  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('')

  // Extract JSON (handle possible markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON from AI response')
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
