const MODEL = import.meta.env.VITE_LLM_MODEL || 'Nshen-NN-4.6'
const DEFAULT_PROVIDER = import.meta.env.VITE_LLM_DEFAULT_PROVIDER || 'chatgpt-plus-gpt-5-4'
const DEFAULT_MODEL_LABEL = import.meta.env.VITE_LLM_MODEL || 'Nshen-NN-4.6'

export type TaskComplexity = 'light' | 'standard' | 'premium'

const TASK_KEYWORDS: Record<TaskComplexity, RegExp> = {
  light: /翻译|格式化|确认|回复|FAQ|模板|简单|客服|通知/,
  standard: /分析|统计|生成|内容|报告|文案|排期|数据/,
  premium: /战略|架构|决策|代码审查|方案设计|分解|复杂推理|创意/,
}

export function classifyTaskComplexity(prompt: string): TaskComplexity {
  if (TASK_KEYWORDS.premium.test(prompt)) return 'premium'
  if (TASK_KEYWORDS.light.test(prompt)) return 'light'
  return 'standard'
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmModelInfo {
  id: string
  name: string
  description: string
  provider: string
  isDefault: boolean
}

export interface LlmFallbackConfigItem {
  provider: string
  model: string
  fallbackTo: string[]
}

let _selectedProvider: string = DEFAULT_PROVIDER
let _lastUsedModel: string = ''

export function getDefaultProvider(): string {
  return DEFAULT_PROVIDER
}

export function getDefaultModelLabel(): string {
  return DEFAULT_MODEL_LABEL
}

export function setSelectedProvider(provider: string) {
  _selectedProvider = provider
}

export function getSelectedProvider(): string {
  return _selectedProvider
}

export function getLastUsedModel(): string {
  return _lastUsedModel
}

export async function fetchAvailableModels(): Promise<LlmModelInfo[]> {
  try {
    const res = await fetch('/api/llm/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) return []
    const data = (await res.json()) as { models?: LlmModelInfo[] }
    return data.models ?? []
  } catch {
    return []
  }
}

export async function fetchFallbackConfig(): Promise<LlmFallbackConfigItem[]> {
  try {
    const res = await fetch('/api/llm/fallback-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) return []
    const data = (await res.json()) as { items?: LlmFallbackConfigItem[] }
    return data.items ?? []
  } catch {
    return []
  }
}

export async function saveFallbackConfig(items: LlmFallbackConfigItem[]): Promise<boolean> {
  const res = await fetch('/api/llm/fallback-config/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`保存回退链失败: ${errorBody}`)
  }

  return true
}

const RETRY_MAX = 3
const RETRY_BASE_MS = 1500
const REQUEST_TIMEOUT_MS = 60_000

function isRetryableError(status: number, errorText: string): boolean {
  if ([429, 502, 503, 504].includes(status)) return true
  const lower = errorText.toLowerCase()
  return /failed to fetch|networkerror|econnrefused|econnreset|timeout|aborted|aggregate/i.test(lower)
}

function retryDelay(attempt: number): number {
  return RETRY_BASE_MS * Math.pow(2, attempt) + Math.random() * 500
}

export interface LlmUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  model: string
  provider: string
  durationMs: number
}

export interface ChatCompletionResult {
  content: string
  usage: LlmUsage
}

const MODEL_COST_PER_1K: Record<string, { input: number; output: number }> = {
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-5-4': { input: 0.005, output: 0.015 },
  'deepseek-chat': { input: 0.001, output: 0.002 },
  'deepseek-reasoner': { input: 0.004, output: 0.016 },
  'moonshot-v1-128k': { input: 0.06, output: 0.06 },
  'default': { input: 0.005, output: 0.015 },
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const key = Object.keys(MODEL_COST_PER_1K).find(k => model.toLowerCase().includes(k)) ?? 'default'
  const rate = MODEL_COST_PER_1K[key]
  return (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output
}

function reportUsage(usage: LlmUsage, callerFunction: string, agentId?: string, taskId?: string): void {
  const cost = estimateCost(usage.model, usage.inputTokens, usage.outputTokens)
  fetch('/api/llm/usage-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: agentId ?? null,
      taskId: taskId ?? null,
      provider: usage.provider,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      estimatedCost: cost,
      callerFunction,
      durationMs: usage.durationMs,
    }),
  }).catch(() => {})
}

let _lastUsage: LlmUsage | null = null
export function getLastUsage(): LlmUsage | null { return _lastUsage }

export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number; callerFunction?: string; agentId?: string; taskId?: string },
): Promise<string> {
  let lastError: Error | null = null
  const t0 = Date.now()

  for (let attempt = 0; attempt <= RETRY_MAX; attempt++) {
    if (attempt > 0) {
      const delay = retryDelay(attempt - 1)
      console.log(`[LLM] retry ${attempt}/${RETRY_MAX} after ${Math.round(delay)}ms`)
      await new Promise(r => setTimeout(r, delay))
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          provider: _selectedProvider,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2000,
        }),
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!res.ok) {
        const errorBody = await res.text()
        if (attempt < RETRY_MAX && isRetryableError(res.status, errorBody)) {
          lastError = new Error(`LLM API error ${res.status}: ${errorBody}`)
          continue
        }
        throw new Error(`LLM API error ${res.status}: ${errorBody}`)
      }

      const data = (await res.json()) as {
        choices: { message: { content: string } }[]
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
        model?: string
        model_provider?: string
        model_display?: string
      }

      const content = data.choices[0]?.message?.content?.trim() ?? ''
      if (!content && attempt < RETRY_MAX) {
        lastError = new Error('LLM returned empty content')
        continue
      }

      const durationMs = Date.now() - t0
      _lastUsedModel = data.model_display ?? data.model_provider ?? data.model ?? ''

      const usage: LlmUsage = {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
        model: data.model ?? _lastUsedModel,
        provider: data.model_provider ?? _selectedProvider,
        durationMs,
      }
      _lastUsage = usage

      if (usage.totalTokens > 0 || usage.inputTokens > 0) {
        reportUsage(usage, options?.callerFunction ?? 'chatCompletion', options?.agentId, options?.taskId)
      }

      if (attempt > 0) console.log(`[LLM] succeeded on retry ${attempt}`)
      return content
    } catch (err) {
      clearTimeout(timer)
      const msg = err instanceof Error ? err.message : String(err)
      if (attempt < RETRY_MAX && isRetryableError(0, msg)) {
        lastError = err instanceof Error ? err : new Error(msg)
        continue
      }
      throw err
    }
  }

  throw lastError ?? new Error('LLM call failed after retries')
}

export async function chatCompletionStream(
  messages: ChatMessage[],
  onDelta: (text: string) => void,
  options?: { temperature?: number; maxTokens?: number; callerFunction?: string; agentId?: string },
): Promise<string> {
  const t0 = Date.now()

  const res = await fetch('/api/llm/chat-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      provider: _selectedProvider,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
      stream: true,
    }),
  })

  if (!res.ok) throw new Error(`Stream API error: ${res.status}`)
  if (!res.body) throw new Error('No response body for streaming')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let fullContent = ''
  let buffer = ''
  let upstreamError: string | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]' || payload === '') continue

      try {
        const chunk = JSON.parse(payload) as {
          choices?: Array<{
            delta?: { content?: string; reasoning_content?: string }
            message?: { content?: string; reasoning_content?: string }
          }>
          model?: string
          model_provider?: string
          error?: unknown
        }

        if (chunk.error) {
          const errMsg = typeof chunk.error === 'string'
            ? chunk.error
            : (chunk.error as { message?: string })?.message ?? JSON.stringify(chunk.error)
          upstreamError = errMsg
          continue
        }

        const choice = chunk.choices?.[0]
        const delta =
          choice?.delta?.content ??
          choice?.delta?.reasoning_content ??
          choice?.message?.content ??
          choice?.message?.reasoning_content ??
          ''
        if (delta) {
          fullContent += delta
          onDelta(delta)
        }
        if (chunk.model) _lastUsedModel = chunk.model_provider ?? chunk.model ?? ''
      } catch { /* skip malformed chunks */ }
    }
  }

  const durationMs = Date.now() - t0

  if (upstreamError && !fullContent) {
    throw new Error(`LLM stream error: ${upstreamError}`)
  }

  if (!fullContent || !fullContent.trim()) {
    throw new Error('LLM stream returned empty content')
  }

  const charBasedTokenEstimate = Math.ceil(fullContent.length / 2)
  reportUsage(
    {
      inputTokens: 0,
      outputTokens: charBasedTokenEstimate,
      totalTokens: charBasedTokenEstimate,
      model: _lastUsedModel,
      provider: _selectedProvider,
      durationMs,
    },
    options?.callerFunction ?? 'chatCompletionStream',
    options?.agentId,
  )

  return fullContent
}

export interface OpenClawSessionResult {
  sessionId: string
  status: string
  result?: string
}

export async function openclawAgentChat(
  agentId: string,
  task: string,
  timeoutSeconds?: number,
): Promise<OpenClawSessionResult> {
  const res = await fetch('/api/openclaw/agent-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, task, timeoutSeconds: timeoutSeconds ?? 120 }),
  })

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`OpenClaw agent error ${res.status}: ${errorBody}`)
  }

  return (await res.json()) as OpenClawSessionResult
}
