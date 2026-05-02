import type { GoalTaskDraft } from '../types'
import { nameToAgentKey, agentKeyToTaskType } from './agentRegistry'

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
