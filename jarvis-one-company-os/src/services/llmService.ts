const MODEL = import.meta.env.VITE_LLM_MODEL || 'cascade'

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

let _selectedProvider: string = 'cascade'
let _lastUsedModel: string = ''

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

export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
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
  })

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`LLM API error ${res.status}: ${errorBody}`)
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[]
    model?: string
    model_provider?: string
    model_display?: string
  }

  _lastUsedModel = data.model_display ?? data.model_provider ?? data.model ?? ''

  return data.choices[0]?.message?.content?.trim() ?? ''
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
