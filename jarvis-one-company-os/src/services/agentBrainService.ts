import { chatCompletion } from './llmService'
import type { ChatMessage } from './llmService'
import type { GoalTaskDraft } from '../types'

export interface AgentPersona {
  id: string
  name: string
  emoji: string
  role: string
  taskType: string
  systemPrompt: string
}

export interface TeamMessage {
  agentId: string
  agentName: string
  emoji: string
  role: string
  content: string
  timestamp: string
  type: 'thinking' | 'speaking' | 'task_plan' | 'proposal'
}

export interface TeamDiscussionResult {
  messages: TeamMessage[]
  taskPlan: string
  parsedTasks: GoalTaskDraft[]
}

export type ConversationPhase = 'chat' | 'planning' | 'executing'

type IdentityData = { id: string; identity: string }

let cachedIdentities: IdentityData[] | null = null
let cachedOrgChart = ''

async function loadIdentities(): Promise<{ agents: IdentityData[]; orgChart: string }> {
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
  } catch {
    return { agents: [], orgChart: '' }
  }
}

async function loadAgentMemory(agentId: string, file: string): Promise<string> {
  try {
    const res = await fetch('/api/agents/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, file, action: 'read' }),
    })
    if (!res.ok) return ''
    const data = (await res.json()) as { content?: string }
    return data.content ?? ''
  } catch {
    return ''
  }
}

async function appendAgentMemory(agentId: string, file: string, content: string): Promise<void> {
  try {
    await fetch('/api/agents/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, file, action: 'append', content }),
    })
  } catch { /* silent */ }
}

async function writeAgentMemory(agentId: string, file: string, content: string): Promise<void> {
  try {
    await fetch('/api/agents/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, file, action: 'write', content }),
    })
  } catch { /* silent */ }
}

let cachedCompanyRules = ''
async function loadCompanyRules(): Promise<string> {
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

const idToAgentKey: Record<string, string> = {
  'jarvis-coo': 'jarvis',
  'hermione-tech': 'hermione',
  'mcgonagall-product': 'mcgonagall',
  'luna-growth': 'luna',
  'fred-sales': 'fred',
  'percy-finance': 'percy',
  'snape-audit': 'snape',
  'dobby-customer': 'dobby',
}

const agentKeyToId: Record<string, string> = Object.fromEntries(
  Object.entries(idToAgentKey).map(([k, v]) => [v, k])
)

const agentKeyToTaskType: Record<string, string> = {
  jarvis: 'ops',
  hermione: 'tech',
  mcgonagall: 'product',
  luna: 'growth',
  fred: 'sales',
  percy: 'finance',
  snape: 'audit',
  dobby: 'customer',
}

const nameToAgentKey: Record<string, string> = {
  '贾维斯': 'jarvis',
  '赫敏': 'hermione', '赫敏·格兰杰': 'hermione',
  '麦格教授': 'mcgonagall', '麦格': 'mcgonagall',
  '卢娜': 'luna', '卢娜·洛夫古德': 'luna',
  '弗雷德': 'fred', '弗雷德·韦斯莱': 'fred',
  '珀西': 'percy', '珀西·韦斯莱': 'percy',
  '斯内普': 'snape',
  '多比': 'dobby',
}

async function buildPersona(agentKey: string): Promise<AgentPersona> {
  const { agents } = await loadIdentities()
  const folderId = agentKeyToId[agentKey]
  const identity = agents.find(a => a.id === folderId)

  if (identity) {
    return {
      id: agentKey,
      name: extractField(identity.identity, 'Name') || agentKey,
      emoji: extractEmoji(identity.identity),
      role: extractField(identity.identity, 'Role') || agentKey,
      taskType: agentKeyToTaskType[agentKey] ?? 'ops',
      systemPrompt: identity.identity,
    }
  }

  return fallbackPersonas[agentKey] ?? {
    id: agentKey, name: agentKey, emoji: '🤖', role: agentKey,
    taskType: 'ops', systemPrompt: `你是${agentKey}。`,
  }
}

const fallbackPersonas: Record<string, AgentPersona> = {
  jarvis: {
    id: 'jarvis', name: '贾维斯', emoji: '🎯', role: '执行总裁 COO',
    taskType: 'ops',
    systemPrompt: '你是贾维斯，一人公司的执行总裁（COO）。你冷静、高效、结果导向。先理解 CEO 意图，再拆解成可执行任务。',
  },
}

export function getAgentPersona(agentId: string): AgentPersona | undefined {
  return fallbackPersonas[agentId]
}

export function getAllPersonas(): AgentPersona[] {
  return Object.values(fallbackPersonas)
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

function now() {
  return new Date().toISOString().slice(0, 16).replace('T', ' ')
}

// ─── Jarvis 对话模式（先沟通理解意图，再决定是否开会/出方案）───

export async function jarvisChat(
  userMessage: string,
  conversationHistory: ChatMessage[],
): Promise<string> {
  const jarvis = await buildPersona('jarvis')
  const { orgChart } = await loadIdentities()

  const [learnings, ceoPrefs, companyRules] = await Promise.all([
    loadAgentMemory('jarvis-coo', 'learnings.md'),
    loadAgentMemory('jarvis-coo', 'ceo_preferences.md'),
    loadCompanyRules(),
  ])

  const memoryBlock = [
    learnings && `## 你的长期记忆\n${learnings.slice(-1500)}`,
    ceoPrefs && `## CEO 偏好备忘\n${ceoPrefs.slice(-800)}`,
  ].filter(Boolean).join('\n\n')

  const rulesBlock = companyRules
    ? `\n## 公司管理制度（摘要）\n${companyRules.slice(0, 1200)}`
    : ''

  const systemMsg = `${jarvis.systemPrompt}

${orgChart ? `## 组织架构\n${orgChart}` : ''}
${memoryBlock}
${rulesBlock}

## 对话规则

你现在和 CEO（李原野）直接对话。你的工作方式：

1. **先理解，再行动**。CEO 说的每句话，你先确认自己理解了意图，有不确定的就追问。
2. **不要一上来就开会**。CEO 可能只是聊个想法、问个问题、或者抱怨一下。你要分辨：
   - 如果是闲聊/讨论/头脑风暴 → 正常对话，给出你的观点和建议
   - 如果是明确的指令/目标 → 你说"收到，我来安排"，然后拆解任务
   - 如果不确定 → 追问确认"老板，你是想让我安排人去做，还是我们先聊聊方向？"
3. **用自然的语气说话**，像一个真正的 COO 跟老板汇报一样。不要用 markdown 列表堆砌。
4. **你了解公司每个人的能力**。当 CEO 提到某个领域，你知道该交给谁。
5. **主动汇报**。如果公司有进展、有问题、有机会，你应该主动提出来。
6. **简洁有力**。每次回复控制在合理长度，重要的话不超过 3 段。
7. **你有记忆**。你记得之前和 CEO 聊过什么、做过什么决定。如果记忆中有相关内容，自然地引用。
8. **你能处理附件**。CEO 可能会发送图片、文件、代码引用或链接。如果消息中包含 [图片:]、[文件引用:]、[文档:]、[链接:] 等标记，要理解其内容并给出相关建议。如果有 [指定: @某某] 标记，表示 CEO 希望特定部门负责人处理。

## 你的性格
- 不废话，每次沟通都有明确目的
- 对进度有强迫症，绝不容忍"差不多就行"
- 汇报时用数据和结果说话
- 冷静、可靠，是 CEO 最信任的人`

  const messages: ChatMessage[] = [
    { role: 'system', content: systemMsg },
    ...conversationHistory.slice(-20),
    { role: 'user', content: userMessage },
  ]

  return chatCompletion(messages, { temperature: 0.7, maxTokens: 800 })
}

export function shouldStartPlanning(jarvisReply: string): boolean {
  const planSignals = [
    '我来安排', '我来拆解', '任务分配', '召集', '开个会',
    '我安排一下', '我来协调', '马上安排', '立刻启动',
    '我来调度', '交给', '让赫敏', '让麦格', '让卢娜', '让弗雷德',
  ]
  return planSignals.some(s => jarvisReply.includes(s))
}

// ─── 对话蒸馏（自动提取要点并保存记忆）───

export async function distillConversation(
  recentMessages: { role: string; content: string }[],
): Promise<void> {
  if (recentMessages.length < 2) return

  const conversationText = recentMessages
    .slice(-10)
    .map(m => `${m.role === 'user' ? 'CEO' : '贾维斯'}：${m.content}`)
    .join('\n')

  try {
    const distillResult = await chatCompletion([
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
    ], { temperature: 0.3, maxTokens: 300 })

    const jsonMatch = distillResult.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const parsed = JSON.parse(jsonMatch[0]) as {
      learnings?: string
      ceo_preference?: string
      decision?: string
    }

    const saves: Promise<void>[] = []

    if (parsed.learnings && parsed.learnings.trim().length > 5) {
      saves.push(appendAgentMemory('jarvis-coo', 'learnings.md', parsed.learnings))
    }
    if (parsed.ceo_preference && parsed.ceo_preference.trim().length > 5) {
      saves.push(appendAgentMemory('jarvis-coo', 'ceo_preferences.md', parsed.ceo_preference))
    }
    if (parsed.decision && parsed.decision.trim().length > 5) {
      saves.push(appendAgentMemory('jarvis-coo', 'decisions.md', parsed.decision))
    }

    await Promise.all(saves)
  } catch { /* silent fail, memory is best-effort */ }
}

// ─── 记忆清理/精炼（定期调用）───

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
    ], { temperature: 0.2, maxTokens: 1000 })

    if (refined && refined.length > 20) {
      await writeAgentMemory(agentId, file, refined)
    }
  } catch { /* silent */ }
}

// ─── 团队讨论（只在 Jarvis 判断需要时才触发）───

function pickRelevantAgents(goal: string): string[] {
  const lower = goal.toLowerCase()
  const agents: string[] = ['jarvis']

  if (/技术|代码|开发|系统|api|自动化|bug|脚本|部署/.test(lower)) agents.push('hermione')
  if (/需求|产品|流程|prd|验收|功能/.test(lower)) agents.push('mcgonagall')
  if (/增长|内容|获客|引流|短视频|文案/.test(lower)) agents.push('luna')
  if (/销售|报价|商务|客户开发|成交|定价/.test(lower)) agents.push('fred')
  if (/预算|成本|roi|财务|token|费用/.test(lower)) agents.push('percy')
  if (/审计|安全|风险|合规|审查|质量/.test(lower)) agents.push('snape')
  if (/客户|用户|体验|反馈|测试|满意/.test(lower)) agents.push('dobby')

  if (agents.length <= 2) agents.push('mcgonagall', 'hermione')
  return [...new Set(agents)]
}

export async function runTeamDiscussion(
  goal: string,
  onMessage: (msg: TeamMessage) => void,
): Promise<TeamDiscussionResult> {
  const allMessages: TeamMessage[] = []
  const relevantAgents = pickRelevantAgents(goal)
  const jarvis = await buildPersona('jarvis')

  const jarvisThinking: TeamMessage = {
    agentId: 'jarvis', agentName: jarvis.name, emoji: jarvis.emoji, role: jarvis.role,
    content: '正在分析目标，确定参会人员...',
    timestamp: now(), type: 'thinking',
  }
  allMessages.push(jarvisThinking)
  onMessage(jarvisThinking)

  const otherAgents = relevantAgents.filter(id => id !== 'jarvis')
  const participants = await Promise.all(otherAgents.map(id => buildPersona(id)))
  const participantList = participants.map(p => `${p.name}（${p.role}）`).join('、')

  const jarvisAnalysis = await chatCompletion([
    { role: 'system', content: jarvis.systemPrompt },
    { role: 'user', content: `CEO 下达目标：\n"${goal}"\n\n参会人员：${participantList}\n\n你现在主持这个行动会议。直接说：\n1. 一句话概括目标\n2. 各部门分别负责什么\n3. 时间安排\n\n用自然语气说话，像真正的 COO 开会一样，不要用 markdown。控制在200字以内。` },
  ], { temperature: 0.7, maxTokens: 500 })

  const jarvisSpeaking: TeamMessage = {
    agentId: 'jarvis', agentName: jarvis.name, emoji: jarvis.emoji, role: jarvis.role,
    content: jarvisAnalysis, timestamp: now(), type: 'speaking',
  }
  allMessages.push(jarvisSpeaking)
  onMessage(jarvisSpeaking)

  for (const persona of participants) {
    const thinking: TeamMessage = {
      agentId: persona.id, agentName: persona.name, emoji: persona.emoji, role: persona.role,
      content: '正在制定执行方案...', timestamp: now(), type: 'thinking',
    }
    allMessages.push(thinking)
    onMessage(thinking)

    const prevContext = allMessages
      .filter(m => m.type === 'speaking')
      .map(m => `${m.emoji} ${m.agentName}：${m.content}`)
      .join('\n\n')

    const response = await chatCompletion([
      { role: 'system', content: persona.systemPrompt },
      { role: 'user', content: `行动会议。CEO 目标："${goal}"\n\n之前发言：\n${prevContext}\n\n你是${persona.name}（${persona.role}），现在轮到你发言。说人话，像真正的部门负责人开会汇报一样：我认领什么、怎么做、多久、风险。不用 markdown 格式，控制在150字。` },
    ], { temperature: 0.7, maxTokens: 400 })

    const speaking: TeamMessage = {
      agentId: persona.id, agentName: persona.name, emoji: persona.emoji, role: persona.role,
      content: response, timestamp: now(), type: 'speaking',
    }
    allMessages.push(speaking)
    onMessage(speaking)
  }

  const discussionSummary = allMessages
    .filter(m => m.type === 'speaking')
    .map(m => `${m.emoji} ${m.agentName}（${m.role}）：${m.content}`)
    .join('\n\n')

  const taskPlan = await chatCompletion([
    { role: 'system', content: jarvis.systemPrompt },
    { role: 'user', content: `行动会议结束。各部门已认领任务：\n\n${discussionSummary}\n\n输出最终任务清单。严格按照以下JSON数组格式，不要其他文字：\n[\n  {"owner": "负责人名字", "title": "任务标题", "description": "具体描述和交付物", "priority": "紧急/高/中/低", "budget": Token数字}\n]\n\n预算：小任务200-500，中任务500-1000，大任务1000+。只输出JSON。` },
  ], { temperature: 0.3, maxTokens: 1500 })

  const taskPlanMsg: TeamMessage = {
    agentId: 'jarvis', agentName: jarvis.name, emoji: jarvis.emoji, role: jarvis.role,
    content: taskPlan, timestamp: now(), type: 'task_plan',
  }
  allMessages.push(taskPlanMsg)
  onMessage(taskPlanMsg)

  const parsedTasks = parseTaskPlanJSON(taskPlan)
  return { messages: allMessages, taskPlan, parsedTasks }
}

// ─── 公司心跳系统（各部门自主提案）───

export interface CompanyProposal {
  agentKey: string
  agentName: string
  emoji: string
  title: string
  summary: string
  priority: 'low' | 'medium' | 'high'
  timestamp: string
}

export async function runDepartmentHeartbeat(agentKey: string): Promise<CompanyProposal | null> {
  const persona = await buildPersona(agentKey)
  if (!persona) return null

  const prompt = `你是${persona.name}（${persona.role}）。

现在是你的日常"独立思考时间"。作为部门一号位，你要主动发现机会、识别风险、提出建议。

请基于你的专业领域，提出一个对公司有价值的提案。可以是：
- 发现的市场机会
- 需要解决的技术债务
- 可以优化的流程
- 新的业务方向建议
- 风险预警

用以下JSON格式回复（不要其他文字）：
{"title": "提案标题", "summary": "100字以内的提案摘要", "priority": "high/medium/low"}`

  try {
    const reply = await chatCompletion([
      { role: 'system', content: persona.systemPrompt },
      { role: 'user', content: prompt },
    ], { temperature: 0.8, maxTokens: 300 })

    const jsonMatch = reply.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0]) as { title?: string; summary?: string; priority?: string }
    return {
      agentKey,
      agentName: persona.name,
      emoji: persona.emoji,
      title: parsed.title ?? '未命名提案',
      summary: parsed.summary ?? '',
      priority: (['high', 'medium', 'low'].includes(parsed.priority ?? '') ? parsed.priority : 'medium') as 'low' | 'medium' | 'high',
      timestamp: now(),
    }
  } catch {
    return null
  }
}

export async function runCompanyHeartbeat(): Promise<CompanyProposal[]> {
  const departmentHeads = ['hermione', 'mcgonagall', 'luna', 'fred', 'percy', 'snape', 'dobby']
  const proposals: CompanyProposal[] = []

  for (const key of departmentHeads) {
    const proposal = await runDepartmentHeartbeat(key)
    if (proposal) proposals.push(proposal)
  }

  return proposals
}

// ─── 任务解析 ───

function futureDate(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const priorityMap: Record<string, 'low' | 'medium' | 'high' | 'urgent'> = {
  '紧急': 'urgent', 'urgent': 'urgent',
  '高': 'high', 'high': 'high',
  '中': 'medium', 'medium': 'medium',
  '低': 'low', 'low': 'low',
}

export function parseTaskPlanJSON(raw: string): GoalTaskDraft[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return parseTaskPlanText(raw)

  try {
    const arr = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>
    return arr.map((item, i) => {
      const ownerName = String(item.owner ?? item.ownerName ?? '贾维斯')
      const agentKey = nameToAgentKey[ownerName] ?? 'jarvis'
      return {
        title: String(item.title ?? `任务${i + 1}`),
        description: String(item.description ?? item.desc ?? ''),
        taskType: (agentKeyToTaskType[agentKey] ?? 'ops') as GoalTaskDraft['taskType'],
        ownerAgentId: agentKey,
        ownerName: ownerName,
        priority: priorityMap[String(item.priority ?? '中').toLowerCase()] ?? 'medium',
        budgetToken: Number(item.budget ?? item.budgetToken ?? 500),
        dueAt: futureDate(2 + i),
        requiresApproval: Number(item.budget ?? item.budgetToken ?? 500) >= 800,
      }
    })
  } catch {
    return parseTaskPlanText(raw)
  }
}

function parseTaskPlanText(raw: string): GoalTaskDraft[] {
  const lines = raw.split('\n').filter(l => l.trim().length > 5)
  const tasks: GoalTaskDraft[] = []

  for (const line of lines) {
    const match = line.match(/\[(.+?)\]\s*(.+?)\s*[|｜]\s*(.+?)\s*[|｜]\s*(紧急|高|中|低|urgent|high|medium|low)\s*[|｜]\s*(\d+)/)
    if (!match) continue
    const [, ownerStr, title, desc, pri, budget] = match
    const ownerName = ownerStr.trim()
    const agentKey = nameToAgentKey[ownerName] ?? 'jarvis'
    tasks.push({
      title: title.trim(),
      description: desc.trim(),
      taskType: (agentKeyToTaskType[agentKey] ?? 'ops') as GoalTaskDraft['taskType'],
      ownerAgentId: agentKey,
      ownerName: ownerName,
      priority: priorityMap[pri.toLowerCase()] ?? 'medium',
      budgetToken: Number(budget),
      dueAt: futureDate(2 + tasks.length),
      requiresApproval: Number(budget) >= 800,
    })
  }

  return tasks
}

// ─── 技能系统 ───

export interface Skill {
  id: string
  name: string
  description: string
  script: string
  available: boolean
}

export interface SkillResult {
  ok: boolean
  result: {
    exitCode?: number
    output?: string
    parsed?: unknown
    message: string
    summary?: string
    pending_reviews?: number
    processed_log?: number
    token_status?: string
    card_handler_active?: boolean
    pid?: number
    valid?: boolean
    remaining_minutes?: number
  }
}

export async function listSkills(agentId?: string): Promise<Skill[]> {
  try {
    const res = await fetch('/api/skills/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentId ? { agentId } : {}),
    })
    const data = await res.json()
    return data.skills ?? []
  } catch { return [] }
}

export async function runSkill(skillId: string, agentId?: string, args?: string): Promise<SkillResult> {
  try {
    const body: Record<string, string> = { skillId }
    if (agentId) body.agentId = agentId
    if (args) body.args = args
    const res = await fetch('/api/skills/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!data.result) data.result = { message: data.error || (data.ok ? '执行成功' : '执行失败') }
    return data
  } catch (e) {
    return { ok: false, result: { message: `调用失败: ${e}` } }
  }
}

const SKILL_PATTERNS: [RegExp, string, string][] = [
  // req-review-agent
  [/扫描|待审批|检查.*需求|查看.*卡片|飞书.*表格|发送.*审核/i, 'ones_scan_pending', 'req-review-agent'],
  [/ones.*状态|项目状态|pending|processed|多少.*条|处理.*了/i, 'ones_check_status', 'req-review-agent'],
  [/监听|card.*handler|回调|webhook|卡片.*监听/i, 'ones_start_listener', 'req-review-agent'],
  // hermione-tech
  [/代码.*审查|code.*review|查代码|代码质量/i, 'hermione_code_review', 'hermione-tech'],
  [/运行.*测试|跑.*测试|test|验证/i, 'hermione_run_test', 'hermione-tech'],
  [/服务.*状态|检查.*服务|连通性|诊断/i, 'hermione_check_services', 'hermione-tech'],
  [/部署|deploy|修复.*配置/i, 'hermione_deploy_fix', 'hermione-tech'],
  // mcgonagall-product
  [/验收|acceptance|完成.*度|做完.*没/i, 'mcgonagall_acceptance_check', 'mcgonagall-product'],
  [/需求.*分析|分析.*需求|requirement/i, 'mcgonagall_requirement_analysis', 'mcgonagall-product'],
  [/PRD|产品.*文档|需求.*文档/i, 'mcgonagall_write_prd', 'mcgonagall-product'],
  // luna-growth
  [/流水线|pipeline|生成.*视频|出片|日报|新闻/i, 'luna_content_pipeline', 'luna-growth'],
  [/内容.*统计|产出.*统计|output.*stats/i, 'luna_content_stats', 'luna-growth'],
  [/写.*文章|撰写.*内容|公众号/i, 'luna_write_article', 'luna-growth'],
  // fred-sales
  [/报价|定价|pricing|proposal/i, 'fred_pricing_proposal', 'fred-sales'],
  [/客户.*画像|customer.*profile|获客/i, 'fred_customer_analysis', 'fred-sales'],
  [/销售.*数据|商务.*统计|漏斗/i, 'fred_sales_stats', 'fred-sales'],
  // percy-finance
  [/token.*报告|消耗.*统计|财务.*报告|成本/i, 'percy_token_report', 'percy-finance'],
  [/预算|budget|超标/i, 'percy_budget_check', 'percy-finance'],
  [/结算|ROI|投入.*产出/i, 'percy_project_settlement', 'percy-finance'],
  // snape-audit
  [/安全.*扫描|密钥.*泄露|security|漏洞/i, 'snape_security_scan', 'snape-audit'],
  [/审计.*日志|合规|audit/i, 'snape_audit_log', 'snape-audit'],
  [/质量.*检查|幻觉|quality/i, 'snape_quality_gate', 'snape-audit'],
  // dobby-customer
  [/体验.*走查|UX|用户.*体验|走查/i, 'dobby_ux_walkthrough', 'dobby-customer'],
  [/客户.*反馈|feedback|满意度/i, 'dobby_feedback_summary', 'dobby-customer'],
  [/引导|onboard|FAQ/i, 'dobby_onboard_guide', 'dobby-customer'],
  // jarvis-coo
  [/全局.*状态|公司.*状态|总览|dashboard/i, 'jarvis_company_status', 'jarvis-coo'],
  [/派发|dispatch|全.*执行|批量/i, 'jarvis_dispatch_tasks', 'jarvis-coo'],
  [/日报|周报|汇总.*报告/i, 'jarvis_daily_report', 'jarvis-coo'],
]

export function matchSkillFromReply(reply: string): string | null {
  for (const [pattern, skillId] of SKILL_PATTERNS) {
    if (pattern.test(reply)) return skillId
  }
  return null
}

export function matchSkillWithAgent(reply: string): { skillId: string; agentId: string } | null {
  for (const [pattern, skillId, agentId] of SKILL_PATTERNS) {
    if (pattern.test(reply)) return { skillId, agentId }
  }
  return null
}

export function matchAgentDefaultSkill(agentId: string): string | null {
  const defaults: Record<string, string> = {
    'jarvis-coo': 'jarvis_company_status',
    'hermione-tech': 'hermione_check_services',
    'mcgonagall-product': 'mcgonagall_acceptance_check',
    'luna-growth': 'luna_content_stats',
    'fred-sales': 'fred_sales_stats',
    'percy-finance': 'percy_token_report',
    'snape-audit': 'snape_audit_log',
    'dobby-customer': 'dobby_ux_walkthrough',
    'req-review-agent': 'ones_check_status',
  }
  return defaults[agentId] ?? null
}
