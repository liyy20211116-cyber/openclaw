import { chatCompletion, type ChatMessage } from './llmService'
import {
  loadAppConfig,
  getCachedConfig,
  buildIdToAgentKeyMap,
  buildAgentKeyToIdMap,
  buildAgentKeyToTaskTypeMap,
  buildNameToAgentKeyMap,
  getAgentDisplayName,
} from './configService'

export interface AgentPersona {
  id: string
  name: string
  emoji: string
  role: string
  taskType: string
  systemPrompt: string
}

type IdentityData = { id: string; identity: string }

let cachedIdentities: IdentityData[] | null = null
let cachedOrgChart = ''

export async function loadIdentities(): Promise<{ agents: IdentityData[]; orgChart: string }> {
  if (cachedIdentities) return { agents: cachedIdentities, orgChart: cachedOrgChart }
  try {
    const res = await fetch('/api/agents/identities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) return { agents: [], orgChart: '' }
    const data = (await res.json()) as { agents?: IdentityData[]; orgChart?: string }
    cachedIdentities = data.agents ?? []
    cachedOrgChart = data.orgChart ?? ''
    setTimeout(() => { cachedIdentities = null }, 300000)
    return { agents: cachedIdentities, orgChart: cachedOrgChart }
  } catch (e) {
    console.warn('[agentRegistry] loadIdentities failed:', e)
    return { agents: [], orgChart: '' }
  }
}

export async function loadAgentMemory(agentId: string, file: string): Promise<string> {
  try {
    const res = await fetch('/api/agents/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, file, action: 'read' }),
    })
    if (!res.ok) return ''
    const data = (await res.json()) as { content?: string }
    return data.content ?? ''
  } catch (e) {
    console.warn(`[agentRegistry] loadAgentMemory(${agentId}, ${file}) failed:`, e)
    return ''
  }
}

export async function appendAgentMemory(agentId: string, file: string, content: string): Promise<void> {
  try {
    await fetch('/api/agents/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, file, action: 'append', content }),
    })
  } catch (e) {
    console.warn(`[agentRegistry] appendAgentMemory(${agentId}, ${file}) failed:`, e)
  }
}

export async function writeAgentMemory(agentId: string, file: string, content: string): Promise<void> {
  try {
    await fetch('/api/agents/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, file, action: 'write', content }),
    })
  } catch (e) {
    console.warn(`[agentRegistry] writeAgentMemory(${agentId}, ${file}) failed:`, e)
  }
}

let cachedCompanyRules = ''
export async function loadCompanyRules(): Promise<string> {
  if (cachedCompanyRules) return cachedCompanyRules
  try {
    const res = await fetch('/api/company/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) return ''
    const data = (await res.json()) as { content?: string }
    cachedCompanyRules = data.content ?? ''
    setTimeout(() => { cachedCompanyRules = '' }, 600000)
    return cachedCompanyRules
  } catch (e) {
    console.warn('[agentRegistry] loadCompanyRules failed:', e)
    return ''
  }
}

let cachedCompanyContext = ''
export async function loadCompanyContext(): Promise<string> {
  if (cachedCompanyContext) return cachedCompanyContext
  try {
    const files = ['company-mission.md', 'company-okr.md']
    const results = await Promise.all(files.map(async (f) => {
      try {
        const res = await fetch('/api/company/config-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: f }),
        })
        if (!res.ok) return ''
        const data = (await res.json()) as { content?: string }
        return data.content ?? ''
      } catch { return '' }
    }))
    cachedCompanyContext = results.filter(Boolean).join('\n\n---\n\n')
    setTimeout(() => { cachedCompanyContext = '' }, 600000)
    return cachedCompanyContext
  } catch {
    return ''
  }
}

function extractField(md: string, field: string): string {
  const match = md.match(new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+)`))
  return match?.[1]?.trim() ?? ''
}

function extractEmoji(md: string): string {
  const match = md.match(/\*\*Emoji:\*\*\s*(\S+)/)
  return match?.[1] ?? '🤖'
}

const _fallbackIdToKey: Record<string, string> = {
  'jarvis-coo': 'jarvis', 'hermione-tech': 'hermione',
  'mcgonagall-product': 'mcgonagall', 'luna-growth': 'luna',
  'fred-sales': 'fred', 'percy-finance': 'percy',
  'snape-audit': 'snape', 'dobby-customer': 'dobby',
}

export function getIdToAgentKey(): Record<string, string> {
  const cfg = getCachedConfig()
  return cfg?.agents?.length ? buildIdToAgentKeyMap(cfg) : _fallbackIdToKey
}

export function getAgentKeyToId(): Record<string, string> {
  const cfg = getCachedConfig()
  return cfg?.agents?.length ? buildAgentKeyToIdMap(cfg) : Object.fromEntries(Object.entries(_fallbackIdToKey).map(([k, v]) => [v, k]))
}

export function getAgentKeyToTaskType(): Record<string, string> {
  const cfg = getCachedConfig()
  return cfg?.agents?.length ? buildAgentKeyToTaskTypeMap(cfg) : {
    jarvis: 'ops', hermione: 'tech', mcgonagall: 'product', luna: 'growth',
    fred: 'sales', percy: 'finance', snape: 'audit', dobby: 'customer',
  }
}

export function getNameToAgentKey(): Record<string, string> {
  const cfg = getCachedConfig()
  return cfg?.agents?.length ? buildNameToAgentKeyMap(cfg) : {
    '贾维斯': 'jarvis', '赫敏': 'hermione', '麦格教授': 'mcgonagall', '麦格': 'mcgonagall',
    '卢娜': 'luna', '弗雷德': 'fred', '珀西': 'percy', '斯内普': 'snape', '多比': 'dobby',
  }
}

/** @deprecated use getIdToAgentKey() */
export const idToAgentKey = _fallbackIdToKey
/** @deprecated use getAgentKeyToId() */
export const agentKeyToId = Object.fromEntries(Object.entries(_fallbackIdToKey).map(([k, v]) => [v, k]))
/** @deprecated use getAgentKeyToTaskType() */
export const agentKeyToTaskType: Record<string, string> = {
  jarvis: 'ops', hermione: 'tech', mcgonagall: 'product', luna: 'growth',
  fred: 'sales', percy: 'finance', snape: 'audit', dobby: 'customer',
}
/** @deprecated use getNameToAgentKey() */
export const nameToAgentKey: Record<string, string> = {
  '贾维斯': 'jarvis', '赫敏': 'hermione', '麦格教授': 'mcgonagall', '麦格': 'mcgonagall',
  '卢娜': 'luna', '弗雷德': 'fred', '珀西': 'percy', '斯内普': 'snape', '多比': 'dobby',
}

function buildFallbackPersona(): Record<string, AgentPersona> {
  const cfg = getCachedConfig()
  const coo = cfg?.agents?.find(a => a.id === 'jarvis-coo')
  const name = coo?.display_name ?? '贾维斯'
  const roleLabel = coo?.role_label ?? '执行总裁 COO'
  return {
    jarvis: {
      id: 'jarvis', name, emoji: '🎯', role: roleLabel,
      taskType: 'ops',
      systemPrompt: `你是${name}，一人公司的${roleLabel}。你冷静、高效、结果导向。先理解 CEO 意图，再拆解成可执行任务。`,
    },
  }
}

function getFallbackPersonas(): Record<string, AgentPersona> {
  return buildFallbackPersona()
}

export async function buildPersona(agentKey: string): Promise<AgentPersona> {
  await loadAppConfig()
  const { agents } = await loadIdentities()
  const keyToId = getAgentKeyToId()
  const keyToTask = getAgentKeyToTaskType()
  const folderId = keyToId[agentKey]
  const identity = agents.find(a => a.id === folderId)

  if (identity) {
    const cfgName = getAgentDisplayName(folderId)
    return {
      id: agentKey,
      name: extractField(identity.identity, 'Name') || cfgName || agentKey,
      emoji: extractEmoji(identity.identity),
      role: extractField(identity.identity, 'Role') || agentKey,
      taskType: keyToTask[agentKey] ?? 'ops',
      systemPrompt: identity.identity,
    }
  }

  const fallback = getFallbackPersonas()
  return fallback[agentKey] ?? {
    id: agentKey, name: agentKey, emoji: '🤖', role: agentKey,
    taskType: 'ops', systemPrompt: `你是${agentKey}。`,
  }
}

export function getAgentPersona(agentId: string): AgentPersona | undefined {
  return getFallbackPersonas()[agentId]
}

export function getAllPersonas(): AgentPersona[] {
  return Object.values(getFallbackPersonas())
}

export function now(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ')
}

export async function checkOpenClawStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/openclaw/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    if (!res.ok) return false
    const data = (await res.json()) as { openclawRunning?: boolean }
    return data.openclawRunning === true
  } catch {
    return false
  }
}

let _openclawAvailable: boolean | null = null

export async function isOpenClawAvailable(): Promise<boolean> {
  if (_openclawAvailable !== null) return _openclawAvailable
  _openclawAvailable = await checkOpenClawStatus()
  setTimeout(() => { _openclawAvailable = null }, 30000)
  return _openclawAvailable
}

export async function getLlmInfo(): Promise<string> {
  try {
    const testMessages: ChatMessage[] = [{ role: 'user', content: '回复"OK"两个字' }]
    const res = await fetch('/api/llm/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'cascade', messages: testMessages, max_tokens: 10 }),
    })
    if (!res.ok) return '未连接'
    const data = (await res.json()) as { model?: string }
    return data.model ?? '已连接'
  } catch {
    return '未连接'
  }
}

export async function refineMemory(agentId: string, file: string): Promise<void> {
  const content = await loadAgentMemory(agentId, file)
  if (!content || content.length < 500) return

  try {
    const refined = await chatCompletion([
      {
        role: 'system',
        content: `你是记忆精炼助手。将以下记忆内容精炼为不超过1500字的摘要。
规则：
1. 保留最重要的信息和最近的信息
2. 去除重复内容
3. 去除过时信息
4. 每条保留时间戳
5. 按重要性排序`,
      },
      { role: 'user', content },
    ], { temperature: 0.2, maxTokens: 1000, callerFunction: 'refineMemory', agentId })

    if (refined && refined.length > 20) {
      await writeAgentMemory(agentId, file, refined)
    }
  } catch (e) {
    console.warn(`[agentRegistry] refineMemory(${agentId}, ${file}) failed:`, e)
  }
}
