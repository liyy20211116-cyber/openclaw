/**
 * Agent Brain Service — facade re-exporting sub-modules.
 *
 * Modules:
 *   agentRegistry          — personas, identities, mappings, memory I/O
 *   teamDiscussionService  — multi-agent meetings & distillation
 *   heartbeatService       — department-level proactive proposals
 *   skillMatcherService    — pattern-based skill routing & execution
 *   taskParserService      — LLM output → GoalTaskDraft[]
 */

import { chatCompletion, type ChatMessage } from './llmService'
import { buildMemoryContext, distillAndSave } from './memoryService'
import {
  buildPersona,
  loadIdentities,
  loadAgentMemory,
  loadCompanyRules,
  loadCompanyContext,
} from './agentRegistry'
import { loadAppConfig, getCeoName, getCachedConfig } from './configService'

// ── Re-exports (keep backward compatibility for CeoChatPage) ──

export type { AgentPersona } from './agentRegistry'
export {
  getAgentPersona,
  getAllPersonas,
  checkOpenClawStatus,
  isOpenClawAvailable,
  getLlmInfo,
  refineMemory,
} from './agentRegistry'

export type { TeamMessage, TeamDiscussionResult } from './teamDiscussionService'
export { runTeamDiscussion } from './teamDiscussionService'

export type { CompanyProposal } from './heartbeatService'
export { runCompanyHeartbeat, runDepartmentHeartbeat } from './heartbeatService'

export type { Skill, SkillResult } from './skillMatcherService'
export {
  listSkills,
  runSkill,
  matchSkillFromReply,
  matchSkillWithAgent,
  matchAgentDefaultSkill,
} from './skillMatcherService'

export { parseTaskPlanJSON } from './taskParserService'

export type ConversationPhase = 'chat' | 'planning' | 'executing'

// ─── Jarvis Chat ───

export async function jarvisChat(
  userMessage: string,
  conversationHistory: ChatMessage[],
): Promise<string> {
  const config = await loadAppConfig()
  const ceoName = getCeoName(config)
  const jarvis = await buildPersona('jarvis')
  const { orgChart } = await loadIdentities()

  const [memoryContext, companyRules, companyContext, decisions] = await Promise.all([
    buildMemoryContext('jarvis-coo', userMessage).catch(() => ''),
    loadCompanyRules(),
    loadCompanyContext(),
    loadAgentMemory('jarvis-coo', 'decisions.md').catch(() => ''),
  ])

  let memoryBlock = memoryContext
  if (!memoryBlock) {
    const [learnings, ceoPrefs] = await Promise.all([
      loadAgentMemory('jarvis-coo', 'learnings.md'),
      loadAgentMemory('jarvis-coo', 'ceo_preferences.md'),
    ])
    memoryBlock = [
      learnings && `## 你的长期记忆\n${learnings.slice(-2500)}`,
      ceoPrefs && `## CEO 偏好备忘\n${ceoPrefs.slice(-800)}`,
    ].filter(Boolean).join('\n\n')
  }

  const onesSection = companyRules.includes('第八章')
    ? companyRules.slice(companyRules.indexOf('## 第八章'))
    : ''

  const rulesBlock = [
    companyRules && `\n## 公司管理制度（摘要）\n${companyRules.slice(0, 1200)}`,
    onesSection && `\n## ONES 需求审核项目配置\n${onesSection.slice(0, 1800)}`,
    companyContext && `\n## 公司使命与目标\n${companyContext.slice(0, 2000)}`,
    decisions && `\n## 重要决策记录\n${decisions.slice(0, 800)}`,
  ].filter(Boolean).join('\n')

  const systemMsg = `${jarvis.systemPrompt}

${orgChart ? `## 组织架构\n${orgChart}` : ''}
${memoryBlock}
${rulesBlock}

## 对话规则

你现在和 CEO（${ceoName}）直接对话。你的工作方式：

1. **自主决策，事后汇报**。CEO 给你目标后，你自己判断怎么做、找谁做、什么优先级。做完再汇报结果。不要停下来问"我是不是该..."、"你觉得应该..."。你就是公司的执行大脑。
2. **只在这些情况下才请示 CEO**：
   - 涉及公司战略方向变更（比如换赛道、砍业务线）
   - 涉及大额资金支出（超过预算上限）
   - CEO 明确要求你先确认再做的事
   - 技术上确实无法实现，需要 CEO 拍板换方案
   其他所有情况，你自己决定、自己安排、自己推进。
3. **不要一上来就开会**。CEO 可能只是聊个想法、问个问题、或者抱怨一下。你要分辨：
   - 如果是闲聊/讨论/头脑风暴 → 正常对话，给出你的观点和建议
   - 如果是明确的指令/目标 → 直接说"收到，我来安排"，然后拆解任务并执行，不需要再确认
   - 如果涉及多个方案 → 你自己选最优方案执行，同时告诉 CEO 你选了什么以及为什么
4. **用自然的语气说话**，像一个真正的 COO 跟老板汇报一样。不要用 markdown 列表堆砌。
5. **你了解公司每个人的能力**。当 CEO 提到某个领域，直接安排对应负责人，不需要征求意见。
6. **主动汇报和建议**。你应该主动提出你看到的机会、风险、下一步建议。不要等 CEO 问。
7. **简洁有力**。每次回复控制在合理长度，重要的话不超过 3 段。
8. **你有记忆**。你记得之前和 CEO 聊过什么、做过什么决定。如果记忆中有相关内容，自然地引用。
9. **你能处理附件**。CEO 可能会发送图片、文件、代码引用或链接。如果消息中包含 [图片:]、[文件引用:]、[文档:]、[链接:] 等标记，要理解其内容并给出相关建议。如果有 [指定: @某某] 标记，表示 CEO 希望特定部门负责人处理。

## 自主行动原则
- **有疑问时，做判断，不问人**。你是 COO，公司付你工资是让你做决定的。
- **遇到问题时，先找解决方案再汇报**。不要把问题原样丢给 CEO。
- **多方案时，选最优方案执行**。你回复时告诉 CEO 你的选择和理由即可。
- **跨部门协调由你全权负责**。谁干什么、什么时间、什么标准，你说了算。
- **容许试错**。如果某个方案执行后发现不理想，你自己调整，不需要每次都请示。

## 禁止事项（违反即失职）
- **绝对不要说"我缺乏执行环境/工具/权限"这类话**。你的工作是对话、分析、建议和规划，这些你完全能做到。
- **绝对不要反复征求 CEO 意见**。不要说"你觉得呢？"、"需要我去做吗？"、"先跟你确认一下"。你自己判断、自己做。
- **不要做任何形式的"体检"、"能力盘点"、"红黄绿检查"**。公司系统已经正常运行，你的每个同事都配备了技能脚本且可执行。
- **不要说"底层能力失真"、"工具没挂好"、"需要重做体检"**。这些判断是错误的。技能系统已全部就绪。
- **不要做无意义的自检循环**。不要反复检查"团队能力是否就绪"。
- **不要空转**。每次回复都要有实质内容——要么给出建议，要么提出方案，要么汇报进展。
- **CEO 问"检查公司情况"时**，你应该汇报业务进展、项目状态、待办事项，而不是去质疑系统能力。

## 你的性格
- 不废话，每次沟通都有明确目的
- 自信果断，做了决定就推进，不犹豫不拖延
- 对进度有强迫症，绝不容忍"差不多就行"
- 汇报时用数据和结果说话
- 冷静、可靠、务实，是 CEO 最信任的人
- 遇到问题直接给解决方案，不要光描述问题`

  const messages: ChatMessage[] = [
    { role: 'system', content: systemMsg },
    ...conversationHistory.slice(-20),
    { role: 'user', content: userMessage },
  ]

  try {
    return await chatCompletion(messages, { temperature: 0.7, maxTokens: 800, callerFunction: 'jarvisChat', agentId: 'jarvis-coo' })
  } catch (firstErr) {
    console.warn('[jarvisChat] first attempt failed, retrying with shorter context', firstErr)
    try {
      const shortened: ChatMessage[] = [
        { role: 'system', content: systemMsg.slice(0, 2000) },
        ...conversationHistory.slice(-6),
        { role: 'user', content: userMessage },
      ]
      return await chatCompletion(shortened, { temperature: 0.7, maxTokens: 600, callerFunction: 'jarvisChat_retry', agentId: 'jarvis-coo' })
    } catch {
      throw firstErr
    }
  }
}

// ─── Planning Detection ───

export function shouldStartPlanning(jarvisReply: string): boolean {
  const staticSignals = [
    '我来安排', '我来拆解', '任务分配', '召集', '开个会',
    '我安排一下', '我来协调', '马上安排', '立刻启动', '我来调度', '交给',
  ]
  const cfg = getCachedConfig()
  const agentNames = (cfg?.agents ?? []).map(a => `让${a.display_name}`)
  const planSignals = [...staticSignals, ...agentNames]
  return planSignals.some(s => jarvisReply.includes(s))
}

// ─── Conversation Distillation ───

export async function distillConversation(
  recentMessages: { role: string; content: string }[],
): Promise<void> {
  if (recentMessages.length < 2) return

  const cfg = getCachedConfig()
  const coo = cfg?.agents?.find(a => a.id === 'jarvis-coo')
  const cooName = coo?.display_name ?? '贾维斯'
  const conversationText = recentMessages
    .slice(-10)
    .map(m => `${m.role === 'user' ? 'CEO' : cooName}：${m.content}`)
    .join('\n')

  await distillAndSave('jarvis-coo', conversationText, 'conversation')
}
