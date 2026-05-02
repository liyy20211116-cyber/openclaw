import { chatCompletion } from './llmService'
import { buildMemoryContext, saveMemory } from './memoryService'
import { buildPersona, agentKeyToId, loadAgentMemory, now } from './agentRegistry'
import type { GoalTaskDraft } from '../types'
import { parseTaskPlanJSON } from './taskParserService'

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
  ], { temperature: 0.7, maxTokens: 500, callerFunction: 'teamDiscussion_jarvis', agentId: 'jarvis-coo' })

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

    const folderId = agentKeyToId[persona.id] ?? persona.id
    let memoryBlock = await buildMemoryContext(folderId, goal).catch(() => '')
    if (!memoryBlock) {
      const agentMemory = await loadAgentMemory(folderId, 'learnings.md')
      memoryBlock = agentMemory ? `\n\n## 你的工作记忆\n${agentMemory.slice(-1500)}` : ''
    }

    const prevContext = allMessages
      .filter(m => m.type === 'speaking')
      .map(m => `${m.emoji} ${m.agentName}：${m.content}`)
      .join('\n\n')

    let response: string
    try {
      response = await chatCompletion([
        { role: 'system', content: persona.systemPrompt + memoryBlock },
        { role: 'user', content: `行动会议。CEO 目标："${goal}"\n\n之前发言：\n${prevContext}\n\n你是${persona.name}（${persona.role}），现在轮到你发言。说人话，像真正的部门负责人开会汇报一样：我认领什么、怎么做、多久、风险。不用 markdown 格式，控制在150字。` },
      ], { temperature: 0.7, maxTokens: 400, callerFunction: `teamDiscussion_${persona.id}`, agentId: agentKeyToId[persona.id] ?? persona.id })
    } catch (err) {
      console.warn(`[TeamDiscussion] ${persona.name} failed`, err)
      response = `（${persona.name}因网络波动暂时未能发言，后续补充。）`
    }

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
  ], { temperature: 0.3, maxTokens: 1500, callerFunction: 'teamDiscussion_taskPlan', agentId: 'jarvis-coo' })

  const taskPlanMsg: TeamMessage = {
    agentId: 'jarvis', agentName: jarvis.name, emoji: jarvis.emoji, role: jarvis.role,
    content: taskPlan, timestamp: now(), type: 'task_plan',
  }
  allMessages.push(taskPlanMsg)
  onMessage(taskPlanMsg)

  const parsedTasks = parseTaskPlanJSON(taskPlan)

  distillTeamDiscussion(goal, allMessages).catch((e) => {
    console.warn('[TeamDiscussion] distillation failed:', e)
  })

  return { messages: allMessages, taskPlan, parsedTasks }
}

async function distillTeamDiscussion(goal: string, messages: TeamMessage[]): Promise<void> {
  const speakingMsgs = messages.filter(m => m.type === 'speaking')
  if (speakingMsgs.length < 2) return

  const participantKeys = [...new Set(speakingMsgs.map(m => m.agentId))]
  const summary = speakingMsgs
    .map(m => `${m.agentName}：${m.content}`)
    .join('\n')

  try {
    const result = await chatCompletion([
      {
        role: 'system',
        content: `你是记忆蒸馏助手。以下是一次团队讨论，目标是："${goal}"。
为每个参与者提取值得记住的要点（1句话）。
输出 JSON：{"agentKey": "要点"}。没有要点的不输出。只输出 JSON。`,
      },
      { role: 'user', content: summary },
    ], { temperature: 0.3, maxTokens: 400, callerFunction: 'distillTeamDiscussion', agentId: 'jarvis-coo' })

    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>
    const dateStr = now()

    const saves: Promise<unknown>[] = []
    for (const key of participantKeys) {
      const learning = parsed[key]
      if (!learning || learning.trim().length < 5) continue
      const folderId = agentKeyToId[key] ?? key
      saves.push(saveMemory({
        agentId: folderId,
        category: 'learnings',
        content: `【团队讨论 ${dateStr}】${learning}`,
        source: 'team_discussion',
        importance: 0.85,
      }))
    }
    await Promise.all(saves)
  } catch (e) {
    console.warn('[TeamDiscussion] distillation error:', e)
  }
}
