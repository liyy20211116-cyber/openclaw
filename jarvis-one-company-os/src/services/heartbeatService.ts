import { chatCompletion } from './llmService'
import { buildMemoryContext } from './memoryService'
import { buildPersona, agentKeyToId, loadAgentMemory, now } from './agentRegistry'

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

  const folderId = agentKeyToId[agentKey] ?? agentKey
  let memoryBlock = await buildMemoryContext(folderId).catch(() => '')
  if (!memoryBlock) {
    const agentMemory = await loadAgentMemory(folderId, 'learnings.md')
    memoryBlock = agentMemory ? `\n\n## 你的工作记忆\n${agentMemory.slice(-1200)}` : ''
  }

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
      { role: 'system', content: persona.systemPrompt + memoryBlock },
      { role: 'user', content: prompt },
    ], { temperature: 0.8, maxTokens: 300, callerFunction: 'heartbeat', agentId: agentKeyToId[agentKey] ?? agentKey })

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
  } catch (e) {
    console.warn(`[heartbeat] ${agentKey} failed:`, e)
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
