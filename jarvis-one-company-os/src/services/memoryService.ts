import { chatCompletion, type ChatMessage } from './llmService'

export interface MemoryEntry {
  id: string
  agentId: string
  category: string
  content: string
  source: string
  importance: number
  citedCount: number
  createdAt: string
}

export interface SaveMemoryParams {
  agentId: string
  category: string
  content: string
  source: string
  importance?: number
}

export interface SearchMemoryParams {
  agentId: string
  query: string
  category?: string
  limit?: number
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Memory API error ${res.status}`)
  return (await res.json()) as T
}

export async function saveMemory(params: SaveMemoryParams): Promise<{ id: string }> {
  return apiPost('/api/memory/save', params)
}

export async function searchMemory(params: SearchMemoryParams): Promise<MemoryEntry[]> {
  const { entries } = await apiPost<{ entries: MemoryEntry[] }>('/api/memory/search', params)
  return entries
}

export async function getAgentMemories(agentId: string, category?: string, limit = 20): Promise<MemoryEntry[]> {
  const { entries } = await apiPost<{ entries: MemoryEntry[] }>('/api/memory/list', {
    agentId,
    category,
    limit,
  })
  return entries
}

export async function buildMemoryContext(agentId: string, query?: string): Promise<string> {
  let memories: MemoryEntry[]

  if (query) {
    memories = await searchMemory({ agentId, query, limit: 8 })
  } else {
    memories = await getAgentMemories(agentId, undefined, 10)
  }

  if (memories.length === 0) return ''

  const lines = memories.map((m, i) => `[${i + 1}] (${m.category}) ${m.content}`).join('\n')
  return `\n---\n你的记忆（按相关性排序）：\n${lines}\n---\n`
}

export async function distillAndSave(
  agentId: string,
  conversationText: string,
  source: string,
): Promise<void> {
  if (!conversationText || conversationText.length < 50) return

  try {
    const result = await chatCompletion([
      {
        role: 'system',
        content: `你是一个记忆蒸馏助手。分析以下对话，提取值得长期记住的信息。

输出严格按以下JSON格式（不要其他文字）：
{
  "learnings": "本次对话中值得记住的要点（1-2句话，没有就留空）",
  "ceo_preference": "CEO 表达的偏好或决策风格（1句话，没有就留空）",
  "decision": "本次做出的决定（1句话，没有就留空）"
}

只提取有价值的信息，日常寒暄不用记录。如果全是闲聊，所有字段留空。`,
      },
      { role: 'user', content: conversationText },
    ] as ChatMessage[], { temperature: 0.3, maxTokens: 300, callerFunction: 'memoryDistill', agentId })

    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>
    const entries: Array<{ category: string; content: string; importance: number }> = []

    if (parsed.learnings?.trim()) {
      entries.push({ category: 'learnings', content: parsed.learnings.trim(), importance: 0.8 })
    }
    if (parsed.ceo_preference?.trim()) {
      entries.push({ category: 'ceo_preferences', content: parsed.ceo_preference.trim(), importance: 0.9 })
    }
    if (parsed.decision?.trim()) {
      entries.push({ category: 'decisions', content: parsed.decision.trim(), importance: 1.0 })
    }

    for (const entry of entries) {
      await saveMemory({
        agentId,
        category: entry.category,
        content: entry.content,
        source,
        importance: entry.importance,
      })
    }
  } catch (err) {
    console.warn('[memoryService] distillAndSave error:', err)
  }
}
