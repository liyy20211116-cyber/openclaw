import { useEffect, useRef, useState, useCallback } from 'react'
import type { ChatMessage, GoalTaskDraft, TeamDiscussionMessage, ChatAttachment, QuotedMessage } from '../types'
import { useSnapshot } from '../hooks/useSnapshot'
import { chatHistoryService } from '../services/chatHistoryService'
import { jarvisChat, shouldStartPlanning, runTeamDiscussion, checkOpenClawStatus, getLlmInfo, runCompanyHeartbeat, distillConversation, runSkill, matchSkillFromReply, matchSkillWithAgent, matchAgentDefaultSkill } from '../services/agentBrainService'
import type { TeamMessage, CompanyProposal, SkillResult } from '../services/agentBrainService'
import { writebackService } from '../services/writebackService'
import { ChatInputBar } from '../components/ChatInputBar'
import type { ChatInputSubmission } from '../components/ChatInputBar'
import { ModelSelector } from '../components/ModelSelector'

interface WorkStatus {
  phase: string
  detail: string
  startTime: number
  icon: string
}

function WorkIndicator({ status }: { status: WorkStatus | null }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!status) { setElapsed(0); return }
    setElapsed(0)
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - status.startTime) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [status])

  if (!status) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 16px',
      borderRadius: 12,
      background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(139, 92, 246, 0.08))',
      border: '1px solid rgba(56, 189, 248, 0.2)',
      animation: 'fadeIn 0.3s ease-in',
    }}>
      <span style={{
        width: 10, height: 10, borderRadius: '50%',
        background: '#38bdf8',
        display: 'inline-block',
        animation: 'pulse 1.2s ease-in-out infinite',
        boxShadow: '0 0 8px rgba(56, 189, 248, 0.6)',
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>{status.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#38bdf8' }}>
            {status.phase}
          </span>
          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
            {elapsed}s
          </span>
        </div>
        {status.detail && (
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>{status.detail}</p>
        )}
      </div>
    </div>
  )
}

interface ActiveAction {
  id: string
  summary: string
  assignee: string
  status: 'working' | 'waiting' | 'done' | 'failed'
  steps: { label: string; done: boolean }[]
  startedAt: number
  updatedAt: number
  skillId?: string
  skillResult?: string
}

const ACTION_SIGNALS = [
  '我来盯', '我来安排', '马上安排', '立刻启动', '我来协调',
  '我来调度', '交给', '我来跟', '我去安排', '我来推',
  '马上执行', '立刻安排', '我来处理', '我盯着', '我来跑',
  '我来测', '跑通', '我来验', '安排赫敏', '安排麦格',
]

const AGENT_NAMES_MAP: Record<string, { agentId: string; emoji: string }> = {
  '赫敏': { agentId: 'hermione-tech', emoji: '📚' },
  '赫敏·格兰杰': { agentId: 'hermione-tech', emoji: '📚' },
  '麦格': { agentId: 'mcgonagall-product', emoji: '🐱' },
  '麦格教授': { agentId: 'mcgonagall-product', emoji: '🐱' },
  '卢娜': { agentId: 'luna-growth', emoji: '🌙' },
  '弗雷德': { agentId: 'fred-sales', emoji: '🎪' },
  '珀西': { agentId: 'percy-finance', emoji: '📊' },
  '斯内普': { agentId: 'snape-audit', emoji: '🦇' },
  '多比': { agentId: 'dobby-customer', emoji: '🧦' },
  '纳威': { agentId: 'neville-hr', emoji: '🌱' },
  '纳威·隆巴顿': { agentId: 'neville-hr', emoji: '🌱' },
  '贾维斯': { agentId: 'jarvis-coo', emoji: '🎯' },
}

interface DetectedDelegation {
  detected: boolean
  summary: string
  steps: string[]
  delegatedAgents: { name: string; agentId: string; emoji: string; task: string }[]
}

function detectAction(jarvisReply: string): DetectedDelegation {
  const hasSignal = ACTION_SIGNALS.some(s => jarvisReply.includes(s))
  if (!hasSignal) return { detected: false, summary: '', steps: [], delegatedAgents: [] }

  const lines = jarvisReply.split('\n').filter(l => l.trim())
  const summary = lines[0]?.replace(/^[^，。：]+[，。：]/, '').trim().slice(0, 60) || '执行中'

  const stepPatterns = [/^\d+[\.\、\)]/,  /^[-•▸]/,  /^\*\*/]
  const steps = lines
    .filter(l => stepPatterns.some(p => p.test(l.trim())))
    .map(l => l.trim().replace(/^\d+[\.\、\)]|\*\*|^[-•▸]\s*/, '').replace(/\*\*/g, '').trim())
    .filter(s => s.length > 3 && s.length < 80)
    .slice(0, 5)

  const delegatedAgents: DetectedDelegation['delegatedAgents'] = []
  const fullText = jarvisReply
  for (const [name, info] of Object.entries(AGENT_NAMES_MAP)) {
    if (name === '贾维斯') continue
    if (fullText.includes(name)) {
      const taskLine = lines.find(l => l.includes(name)) ?? ''
      const task = taskLine.replace(new RegExp(`.*${name}[^，。：]*[，。：]?\\s*`), '').trim().slice(0, 50) || '执行分配任务'
      if (!delegatedAgents.some(a => a.agentId === info.agentId)) {
        delegatedAgents.push({ name, agentId: info.agentId, emoji: info.emoji, task })
      }
    }
  }

  return { detected: true, summary, steps: steps.length > 0 ? steps : ['准备执行...'], delegatedAgents }
}

function ActionTrackerCard({ action, onDismiss }: { action: ActiveAction; onDismiss: () => void }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (action.status === 'done' || action.status === 'failed') return
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - action.startedAt) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [action.startedAt, action.status])

  const isActive = action.status === 'working' || action.status === 'waiting'
  const statusConfig = {
    working: { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.08)', border: 'rgba(56, 189, 248, 0.25)', label: '执行中', icon: '⚡' },
    waiting: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.25)', label: '等待中', icon: '⏳' },
    done:    { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.25)', label: '已完成', icon: '✅' },
    failed:  { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.25)', label: '异常', icon: '❌' },
  }
  const cfg = statusConfig[action.status]

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    return `${m}m ${s % 60}s`
  }

  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: 14,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      animation: 'fadeIn 0.3s ease-in',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isActive && (
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: cfg.color,
              display: 'inline-block',
              animation: 'pulse 1.5s ease-in-out infinite',
              boxShadow: `0 0 8px ${cfg.color}60`,
            }} />
          )}
          <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>
            {cfg.icon} {action.assignee || '贾维斯'} · {cfg.label}
          </span>
          {isActive && (
            <span style={{ fontSize: 11, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(elapsed)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'none', border: 'none', color: '#64748b',
            cursor: 'pointer', fontSize: 14, padding: '2px 6px', borderRadius: 4,
          }}
          title={isActive ? '标记完成' : '关闭'}
        >
          {isActive ? '✓ 完成' : '×'}
        </button>
      </div>

      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>
        {action.summary}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {action.steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{
              width: 16, height: 16, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, flexShrink: 0,
              background: step.done ? 'rgba(34, 197, 94, 0.2)' : 'rgba(148, 163, 184, 0.1)',
              color: step.done ? '#22c55e' : '#64748b',
              border: `1px solid ${step.done ? 'rgba(34, 197, 94, 0.3)' : 'rgba(148, 163, 184, 0.15)'}`,
            }}>
              {step.done ? '✓' : i + 1}
            </span>
            <span style={{
              color: step.done ? '#94a3b8' : '#cbd5e1',
              textDecoration: step.done ? 'line-through' : 'none',
            }}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {action.skillResult && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 8,
          background: action.status === 'done' ? 'rgba(34, 197, 94, 0.06)' : 'rgba(239, 68, 68, 0.06)',
          border: `1px solid ${action.status === 'done' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
          fontSize: 12, color: '#94a3b8', whiteSpace: 'pre-wrap', lineHeight: 1.6,
        }}>
          {action.skillResult}
        </div>
      )}
    </div>
  )
}

const quickGoals = [
  'ONES 需求审核自动化项目还有缺口没闭环，安排相关部门协作把它做完。',
  '我们要做一个 AI 自动化搭建服务，先完成产品定义、报价方案和获客内容。',
  '接下来 7 天要连续产出增长内容和转化素材，优先提高首单成交率。',
]

const typeColors: Record<string, string> = {
  thinking: 'rgba(148, 163, 184, 0.5)',
  speaking: 'rgba(56, 189, 248, 0.15)',
  task_plan: 'rgba(34, 197, 94, 0.15)',
}

export function CeoChatPage() {
  useSnapshot()
  const [messages, setMessages] = useState<ChatMessage[]>(() => chatHistoryService.getAll())
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [liveMessages, setLiveMessages] = useState<TeamDiscussionMessage[]>([])
  const [pendingTasks, setPendingTasks] = useState<GoalTaskDraft[]>([])
  const [isCreatingTasks, setIsCreatingTasks] = useState(false)
  const [createdTaskIds, setCreatedTaskIds] = useState<string[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionStatus, setExecutionStatus] = useState<string>('')
  const [openclawOnline, setOpenclawOnline] = useState<boolean | null>(null)
  const [llmModel, setLlmModel] = useState<string>('检测中...')
  const [proposals, setProposals] = useState<CompanyProposal[]>([])
  const [isHeartbeating, setIsHeartbeating] = useState(false)
  const [workStatus, setWorkStatus] = useState<WorkStatus | null>(null)
  const [activeActions, setActiveActions] = useState<ActiveAction[]>([])
  const [quotedMessage, setQuotedMessage] = useState<QuotedMessage | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const updateWork = useCallback((phase: string, detail: string, icon: string) => {
    setWorkStatus({ phase, detail, startTime: Date.now(), icon })
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, liveMessages])

  useEffect(() => {
    checkOpenClawStatus().then(setOpenclawOnline)
    getLlmInfo().then(setLlmModel)
    const interval = setInterval(() => { checkOpenClawStatus().then(setOpenclawOnline) }, 30000)
    return () => clearInterval(interval)
  }, [])

  async function handleCreateTasks() {
    if (pendingTasks.length === 0 || isCreatingTasks) return
    setIsCreatingTasks(true)
    setExecutionStatus('正在创建任务...')
    const ids: string[] = []

    try {
      for (const task of pendingTasks) {
        const result = await writebackService.createTask({
          title: task.title,
          description: task.description,
          taskType: task.taskType,
          creatorAgentId: 'jarvis',
          ownerAgentId: task.ownerAgentId,
          priority: task.priority,
          budgetToken: task.budgetToken,
          dueAt: task.dueAt,
          requiresApproval: task.requiresApproval,
          approverId: task.requiresApproval ? 'ceo' : undefined,
        })
        if (result.taskId) ids.push(result.taskId)
      }
      setCreatedTaskIds(ids)
      setExecutionStatus(`已创建 ${ids.length} 个任务`)
      setPendingTasks([])
    } catch (err) {
      setExecutionStatus(`创建失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setIsCreatingTasks(false)
    }
  }

  async function handleExecuteAll() {
    if (createdTaskIds.length === 0 || isExecuting) return
    setIsExecuting(true)
    let success = 0
    let failed = 0

    for (const taskId of createdTaskIds) {
      setExecutionStatus(`正在执行任务 ${success + failed + 1}/${createdTaskIds.length}...`)
      try {
        await writebackService.executeTaskOpenClaw({ taskId, operatorId: 'agent_jarvis' })
        success++
      } catch {
        failed++
      }
    }
    setExecutionStatus(`执行完成: ${success} 成功${failed > 0 ? `, ${failed} 失败` : ''}`)
    setIsExecuting(false)
    setCreatedTaskIds([])
  }

  async function executeSkillForAction(actionId: string, skillId: string) {
    const updateAction = (patch: Partial<ActiveAction>) => {
      setActiveActions(prev => prev.map(a => a.id === actionId ? { ...a, ...patch, updatedAt: Date.now() } : a))
    }

    try {
      updateAction({
        steps: [
          { label: '检查项目状态...', done: false },
          { label: '执行技能脚本...', done: false },
          { label: '汇报结果', done: false },
        ],
      })

      updateAction({
        steps: [
          { label: '检查项目状态...', done: true },
          { label: '执行技能脚本...', done: false },
          { label: '汇报结果', done: false },
        ],
      })

      const result: SkillResult = await runSkill(skillId)
      const r = result?.result ?? { message: result?.ok ? '执行成功' : '执行失败' }

      const resultText = result?.ok
        ? (r.summary || r.message || '执行成功')
        : (r.message || '执行失败')

      const resultMsg: ChatMessage = {
        id: `msg_${Date.now()}_skill`,
        role: 'jarvis',
        content: `📋 **技能执行报告** (${skillId})\n\n${resultText}${r.output ? '\n\n```\n' + r.output.slice(-800) + '\n```' : ''}`,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      }
      chatHistoryService.append(resultMsg)
      setMessages(prev => [...prev, resultMsg])

      updateAction({
        status: result?.ok ? 'done' : 'failed',
        skillResult: resultText,
        steps: [
          { label: '检查项目状态', done: true },
          { label: '执行技能脚本', done: true },
          { label: '汇报结果', done: true },
        ],
      })
    } catch (e) {
      updateAction({
        status: 'failed',
        skillResult: `执行异常: ${e}`,
        steps: [
          { label: '检查项目状态', done: true },
          { label: '执行技能脚本', done: false },
          { label: '汇报结果', done: false },
        ],
      })
    }
  }

  async function dispatchMultiAgent(
    agents: { name: string; agentId: string; emoji: string; task: string }[],
    goal: string,
  ) {
    const actionCards: ActiveAction[] = agents.map((a, i) => ({
      id: `dispatch_${Date.now()}_${i}_${a.agentId}`,
      summary: `${a.emoji} ${a.name}: ${a.task}`,
      assignee: a.name,
      status: 'working' as const,
      skillId: matchAgentDefaultSkill(a.agentId) ?? undefined,
      steps: [
        { label: `${a.name} 接收任务`, done: true },
        { label: '执行中...', done: false },
        { label: '汇报结果', done: false },
      ],
      startedAt: Date.now(),
      updatedAt: Date.now(),
    }))

    setActiveActions(prev => [...actionCards, ...prev].slice(0, 10))

    const allResults: { name: string; emoji: string; ok: boolean; summary: string }[] = []

    await Promise.all(actionCards.map(async (card) => {
      const skillId = card.skillId
      if (!skillId) {
        setActiveActions(prev => prev.map(a => a.id === card.id ? {
          ...a, status: 'failed' as const, skillResult: '无可用技能', updatedAt: Date.now(),
          steps: [{ label: `${card.assignee} 接收任务`, done: true }, { label: '无可用技能', done: false }, { label: '汇报结果', done: false }],
        } : a))
        allResults.push({ name: card.assignee, emoji: agents.find(ag => ag.name === card.assignee)?.emoji ?? '', ok: false, summary: '无可用技能' })
        return
      }

      const agentId = agents.find(ag => ag.name === card.assignee)?.agentId ?? ''
      try {
        const result: SkillResult = await runSkill(skillId, agentId)
        const r = result?.result ?? { message: result?.ok ? '完成' : '失败' }
        const summary = result?.ok ? (r.summary || r.message || '完成') : (r.message || '失败')

        setActiveActions(prev => prev.map(a => a.id === card.id ? {
          ...a,
          status: result?.ok ? 'done' as const : 'failed' as const,
          skillResult: summary,
          steps: [
            { label: `${card.assignee} 接收任务`, done: true },
            { label: '执行完成', done: true },
            { label: '汇报结果', done: true },
          ],
          updatedAt: Date.now(),
        } : a))
        allResults.push({ name: card.assignee, emoji: agents.find(ag => ag.name === card.assignee)?.emoji ?? '', ok: result?.ok ?? false, summary })
      } catch (e) {
        setActiveActions(prev => prev.map(a => a.id === card.id ? {
          ...a, status: 'failed' as const, skillResult: `异常: ${e}`, updatedAt: Date.now(),
        } : a))
        allResults.push({ name: card.assignee, emoji: agents.find(ag => ag.name === card.assignee)?.emoji ?? '', ok: false, summary: `异常: ${e}` })
      }
    }))

    if (allResults.length > 0) {
      const okCount = allResults.filter(r => r.ok).length
      const lines = allResults.map(r => `${r.ok ? '✅' : '❌'} ${r.emoji} **${r.name}**: ${r.summary}`)
      const reportMsg: ChatMessage = {
        id: `msg_${Date.now()}_multi_report`,
        role: 'jarvis',
        content: `📊 **各部门执行报告** (${okCount}/${allResults.length} 成功)\n\n${lines.join('\n')}`,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      }
      chatHistoryService.append(reportMsg)
      setMessages(prev => [...prev, reportMsg])
    }
  }

  const agentIdMap: Record<string, string> = {
    '赫敏': 'hermione-tech', '赫敏·格兰杰': 'hermione-tech',
    '麦格': 'mcgonagall-product', '麦格教授': 'mcgonagall-product',
    '卢娜': 'luna-growth', '卢娜·洛夫古德': 'luna-growth',
    '弗雷德': 'fred-sales', '弗雷德·韦斯莱': 'fred-sales',
    '珀西': 'percy-finance', '珀西·韦斯莱': 'percy-finance',
    '斯内普': 'snape-audit',
    '多比': 'dobby-customer',
    '纳威': 'neville-hr', '纳威·隆巴顿': 'neville-hr',
    '贾维斯': 'jarvis-coo',
  }

  async function autoExecuteTasks(tasks: GoalTaskDraft[], goal: string) {
    const results: { owner: string; skillId: string; ok: boolean; summary: string }[] = []

    for (const task of tasks) {
      const ownerName = task.ownerName ?? ''
      const agentId = agentIdMap[ownerName] ?? task.ownerAgentId ?? ''
      if (!agentId) continue

      const defaultSkill = matchAgentDefaultSkill(agentId)
      const skillMatch = matchSkillWithAgent(task.title + ' ' + task.description)
      const matchedIsOwnSkill = skillMatch && skillMatch.agentId === agentId
      const skillId = matchedIsOwnSkill ? skillMatch.skillId : (defaultSkill ?? skillMatch?.skillId)
      if (!skillId) continue

      const actionId = `auto_${Date.now()}_${agentId}`
      const newAction: ActiveAction = {
        id: actionId,
        summary: `${ownerName}: ${task.title}`,
        assignee: ownerName || agentId,
        status: 'working',
        skillId,
        steps: [
          { label: `${ownerName} 接收任务`, done: true },
          { label: '执行中...', done: false },
          { label: '汇报结果', done: false },
        ],
        startedAt: Date.now(),
        updatedAt: Date.now(),
      }
      setActiveActions(prev => [newAction, ...prev].slice(0, 8))

      try {
        const result: SkillResult = await runSkill(skillId, agentId)
        const r = result?.result ?? { message: result?.ok ? '完成' : '失败' }
        const summary = result?.ok
          ? (r.summary || r.message || '完成')
          : (r.message || '失败')

        setActiveActions(prev => prev.map(a => a.id === actionId ? {
          ...a,
          status: result?.ok ? 'done' as const : 'failed' as const,
          skillResult: summary,
          steps: [
            { label: `${ownerName} 接收任务`, done: true },
            { label: '执行中', done: true },
            { label: '汇报结果', done: true },
          ],
          updatedAt: Date.now(),
        } : a))

        results.push({ owner: ownerName, skillId, ok: result?.ok ?? false, summary })
      } catch (e) {
        setActiveActions(prev => prev.map(a => a.id === actionId ? {
          ...a,
          status: 'failed' as const,
          skillResult: `执行异常: ${e}`,
          updatedAt: Date.now(),
        } : a))
        results.push({ owner: ownerName, skillId, ok: false, summary: `异常: ${e}` })
      }
    }

    if (results.length > 0) {
      const okCount = results.filter(r => r.ok).length
      const reportLines = results.map(r =>
        `${r.ok ? '✅' : '❌'} **${r.owner}** (${r.skillId}): ${r.summary}`
      )
      const reportMsg: ChatMessage = {
        id: `msg_${Date.now()}_exec_report`,
        role: 'jarvis',
        content: `📊 **全员执行报告** (${okCount}/${results.length} 成功)\n\n${reportLines.join('\n')}`,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      }
      chatHistoryService.append(reportMsg)
      setMessages(prev => [...prev, reportMsg])
    }
  }

  async function handleSendGoal(goalText?: string, submission?: ChatInputSubmission) {
    const goal = (goalText ?? submission?.text ?? input).trim()
    const attachments = submission?.attachments ?? []
    const mentions = submission?.mentions ?? []
    const quoted = submission?.quotedMessage

    if ((!goal && attachments.length === 0) || isThinking) return

    const attachmentContext = attachments.map(att => {
      if (att.type === 'image') return `[图片: ${att.name}]`
      if (att.type === 'code_ref' && att.textContent) return `[文件引用: ${att.filePath}]\n\`\`\`\n${att.textContent.slice(0, 2000)}\n\`\`\``
      if (att.type === 'document' && att.textContent) return `[文档: ${att.name}]\n${att.textContent.slice(0, 2000)}`
      if (att.type === 'url_preview') return `[链接: ${att.previewTitle}] ${att.url}\n${att.previewSummary ?? ''}`
      return `[附件: ${att.name}]`
    }).join('\n')

    const mentionContext = mentions.length > 0
      ? `\n[指定: ${mentions.map(m => `@${m.name}`).join(' ')}]`
      : ''

    const quoteContext = quoted
      ? `\n[引用 ${quoted.role === 'ceo' ? 'CEO' : '贾维斯'}: ${quoted.contentPreview}]`
      : ''

    const fullGoal = [goal, attachmentContext, mentionContext, quoteContext].filter(Boolean).join('\n')

    const ceoMsg: ChatMessage = {
      id: `msg_${Date.now()}_ceo`,
      role: 'ceo',
      content: goal,
      attachments: attachments.length > 0 ? attachments : undefined,
      mentions: mentions.length > 0 ? mentions : undefined,
      quotedMessage: quoted,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    }
    chatHistoryService.append(ceoMsg)
    setMessages(prev => [...prev, ceoMsg])
    setInput('')
    setQuotedMessage(null)
    setIsThinking(true)
    setLiveMessages([])
    setPendingTasks([])
    setCreatedTaskIds([])
    setExecutionStatus('')
    updateWork('连接大脑', '正在加载记忆和公司制度...', '🧠')

    try {
      const history = messages
        .filter(m => m.role === 'ceo' || m.role === 'jarvis')
        .slice(-10)
        .map(m => ({
          role: m.role === 'ceo' ? 'user' as const : 'assistant' as const,
          content: m.content,
        }))

      updateWork('贾维斯思考中', '理解你的意图，组织回复...', '💭')
      const jarvisReply = await jarvisChat(fullGoal, history)

      const jarvisMsg: ChatMessage = {
        id: `msg_${Date.now()}_jarvis`,
        role: 'jarvis',
        content: jarvisReply,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      }
      chatHistoryService.append(jarvisMsg)
      setMessages(prev => [...prev, jarvisMsg])

      const actionDetect = detectAction(jarvisReply)
      if (actionDetect.detected && !shouldStartPlanning(jarvisReply)) {
        if (actionDetect.delegatedAgents.length > 0) {
          dispatchMultiAgent(actionDetect.delegatedAgents, goal)
        } else {
          const skillId = matchSkillFromReply(jarvisReply) || matchSkillFromReply(goal) || 'ones_check_status'
          const actionId = `action_${Date.now()}`
          const newAction: ActiveAction = {
            id: actionId,
            summary: actionDetect.summary,
            assignee: '贾维斯',
            status: 'working',
            steps: actionDetect.steps.map(s => ({ label: s, done: false })),
            startedAt: Date.now(),
            updatedAt: Date.now(),
            skillId,
          }
          setActiveActions(prev => [newAction, ...prev].slice(0, 8))
          executeSkillForAction(actionId, skillId)
        }
      }

      updateWork('记忆沉淀', '提取对话要点，更新长期记忆...', '📝')
      distillConversation([...history, { role: 'user', content: goal }, { role: 'assistant', content: jarvisReply }]).catch(() => {})

      if (shouldStartPlanning(jarvisReply)) {
        updateWork('召集团队', '正在组织相关部门讨论...', '🏢')
        const collectedMessages: TeamDiscussionMessage[] = []

        const { messages: teamMsgs, parsedTasks } = await runTeamDiscussion(goal, (msg: TeamMessage) => {
          const tmsg: TeamDiscussionMessage = { ...msg }
          collectedMessages.push(tmsg)
          setLiveMessages([...collectedMessages])
          updateWork('团队讨论中', `${msg.agentName} 正在发言...`, msg.emoji ?? '💬')
        })

        updateWork('整理方案', '汇总讨论结果，生成任务清单...', '📋')
        const discussionMsg: ChatMessage = {
          id: `msg_${Date.now()}_team`,
          role: 'team_discussion',
          content: '',
          teamMessages: teamMsgs as TeamDiscussionMessage[],
          createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        }
        chatHistoryService.append(discussionMsg)
        setMessages(prev => [...prev, discussionMsg])
        setLiveMessages([])

        if (parsedTasks.length > 0) {
          setPendingTasks(parsedTasks)

          updateWork('自动执行', '开始派发任务给各部门...', '🚀')
          autoExecuteTasks(parsedTasks, goal)
        }
      }
    } catch (err) {
      const errorContent = err instanceof Error ? err.message : 'LLM 调用失败'
      const errorMsg: ChatMessage = {
        id: `msg_${Date.now()}_error`,
        role: 'jarvis',
        content: `⚠️ LLM API error: ${errorContent}`,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      }
      chatHistoryService.append(errorMsg)
      setMessages(prev => [...prev, errorMsg])
      setLiveMessages([])
    } finally {
      setIsThinking(false)
      setWorkStatus(null)
    }
  }

  async function handleRunHeartbeat() {
    if (isHeartbeating) return
    setIsHeartbeating(true)
    try {
      const results = await runCompanyHeartbeat()
      setProposals(prev => [...results, ...prev].slice(0, 20))
    } catch { /* silent */ }
    setIsHeartbeating(false)
  }

  function handleProposalToChat(proposal: CompanyProposal) {
    const msg = `${proposal.emoji} ${proposal.agentName}提出了一个建议：「${proposal.title}」—— ${proposal.summary}`
    handleSendGoal(msg)
  }

  function handleClearHistory() {
    chatHistoryService.clear()
    setMessages([])
    setLiveMessages([])
  }

  function handleInputSubmit(submission: ChatInputSubmission) {
    handleSendGoal(undefined, submission)
  }

  function handleQuoteMessage(msg: ChatMessage) {
    setQuotedMessage({
      messageId: msg.id,
      role: msg.role,
      contentPreview: msg.content.slice(0, 80) + (msg.content.length > 80 ? '...' : ''),
    })
  }

  function renderTeamMessage(msg: TeamDiscussionMessage, index: number) {
    const isThinkingMsg = msg.type === 'thinking'
    const isTaskPlan = msg.type === 'task_plan'

    return (
      <div
        key={`${msg.agentId}-${index}`}
        style={{
          display: 'flex',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 12,
          background: typeColors[msg.type] ?? 'transparent',
          opacity: isThinkingMsg ? 0.6 : 1,
          animation: 'fadeIn 0.3s ease-in',
        }}
      >
        <div style={{ fontSize: 20, flexShrink: 0, paddingTop: 2 }}>{msg.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <strong style={{ fontSize: 13, color: isTaskPlan ? '#22c55e' : '#e2e8f0' }}>
              {msg.agentName}
            </strong>
            <span style={{ fontSize: 11, color: '#64748b' }}>{msg.role}</span>
            {isTaskPlan && (
              <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>📋 最终方案</span>
            )}
          </div>
          <p style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.6,
            color: isThinkingMsg ? '#94a3b8' : '#cbd5e1',
            fontStyle: isThinkingMsg ? 'italic' : 'normal',
            whiteSpace: 'pre-wrap',
          }}>
            {msg.content}
          </p>
        </div>
      </div>
    )
  }

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">CEO 办公室</p>
          <h2>和贾维斯对话</h2>
          <p className="muted">先沟通想法，贾维斯会理解你的意图并安排执行。</p>
        </div>
        <div className="panel-header-metrics" style={{ gap: 8, alignItems: 'center' }}>
          <ModelSelector onModelChange={(id, name) => setLlmModel(`${name}`)} />
          <div className="metric-inline">对话 {messages.length} 条</div>
          {messages.length > 0 && (
            <button type="button" className="link-button" onClick={handleClearHistory} style={{ fontSize: 12 }}>
              清空历史
            </button>
          )}
        </div>
      </div>

      <div className="page-split-grid ceo-page-grid">
        <div className="stack-list compact-gap">
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>快速目标</p>
          </div>
          {quickGoals.map((goal, index) => (
            <button
              key={index}
              type="button"
              className="template-card"
              onClick={() => handleSendGoal(goal)}
              disabled={isThinking}
            >
              <p style={{ margin: 0, fontSize: 14 }}>{goal}</p>
            </button>
          ))}

          {workStatus && (
            <div style={{
              padding: 12,
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.06), rgba(139, 92, 246, 0.06))',
              border: '1px solid rgba(56, 189, 248, 0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#38bdf8',
                  display: 'inline-block',
                  animation: 'pulse 1.2s ease-in-out infinite',
                  boxShadow: '0 0 6px rgba(56, 189, 248, 0.5)',
                }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#38bdf8' }}>
                  {workStatus.icon} {workStatus.phase}
                </span>
              </div>
            </div>
          )}

          <div style={{
            padding: 14,
            borderRadius: 12,
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
          }}>
            <p className="eyebrow" style={{ marginBottom: 8 }}>工作流程</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
              <li>聊想法 → 贾维斯理解意图</li>
              <li>确认方向 → 召集团队讨论</li>
              <li>方案确定 → 一键创建任务</li>
              <li>执行 → 审核 → 完成</li>
            </ul>
          </div>

          <div style={{
            padding: 14,
            borderRadius: 12,
            background: openclawOnline
              ? 'rgba(34, 197, 94, 0.06)'
              : 'rgba(239, 68, 68, 0.06)',
            border: `1px solid ${openclawOnline ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: openclawOnline === null ? '#64748b' : openclawOnline ? '#22c55e' : '#ef4444',
                  display: 'inline-block',
                  boxShadow: openclawOnline ? '0 0 6px rgba(34, 197, 94, 0.5)' : 'none',
                }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: openclawOnline ? '#22c55e' : '#ef4444' }}>
                  OpenClaw {openclawOnline === null ? '检测中...' : openclawOnline ? '已连接' : '未连接'}
                </span>
              </div>
              <span style={{ fontSize: 11, color: llmModel === '未连接' ? '#ef4444' : '#94a3b8' }}>
                {llmModel !== '检测中...' && llmModel !== '未连接' ? `LLM: ${llmModel}` : ''}
              </span>
            </div>
          </div>

          <div style={{
            padding: 14,
            borderRadius: 12,
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p className="eyebrow" style={{ margin: 0 }}>公司动态</p>
              <button
                type="button"
                className="link-button"
                onClick={handleRunHeartbeat}
                disabled={isHeartbeating}
                style={{ fontSize: 11 }}
              >
                {isHeartbeating ? '思考中...' : '让团队想想'}
              </button>
            </div>
            {proposals.length === 0 ? (
              <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                点击"让团队想想"，各部门会主动提出建议。
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {proposals.slice(0, 5).map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleProposalToChat(p)}
                    style={{
                      display: 'block',
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: p.priority === 'high' ? 'rgba(239, 68, 68, 0.06)' : 'rgba(56, 189, 248, 0.05)',
                      border: `1px solid ${p.priority === 'high' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(148, 163, 184, 0.08)'}`,
                      cursor: 'pointer',
                      color: '#e2e8f0',
                      fontSize: 12,
                      lineHeight: 1.5,
                      width: '100%',
                    }}
                  >
                    <span>{p.emoji} {p.agentName}：</span>
                    <span style={{ fontWeight: 500 }}>{p.title}</span>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                      {p.summary.length > 60 ? p.summary.slice(0, 60) + '...' : p.summary}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="stack-list compact-gap">
          <div className="chat-area" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minHeight: 200,
            maxHeight: 700,
            overflowY: 'auto',
            padding: '0 2px',
          }}>
            {messages.length === 0 && liveMessages.length === 0 && (
              <div className="empty-state-card" style={{ textAlign: 'center', padding: 32 }}>
                <p>跟贾维斯聊聊你的想法，或直接下达目标。</p>
                <p className="muted">贾维斯会先理解你的意图，需要时召集团队制定方案。</p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === 'ceo' ? (
                  <div className="prompt-box" style={{ borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                    <div className="msg-action-row">
                      <button type="button" className="msg-action-btn" onClick={() => handleQuoteMessage(msg)}>引用</button>
                    </div>
                    <p className="prompt-label">👤 CEO（你）</p>
                    {msg.quotedMessage && (
                      <div className="msg-quote">
                        <span className="msg-quote-role">{msg.quotedMessage.role === 'ceo' ? '👤 CEO' : '🎯 贾维斯'}</span>
                        <span>{msg.quotedMessage.contentPreview}</span>
                      </div>
                    )}
                    {msg.mentions && msg.mentions.length > 0 && (
                      <div className="msg-mentions">
                        {msg.mentions.map(m => (
                          <span key={m.agentId} className="msg-mention-badge">{m.emoji} @{m.name}</span>
                        ))}
                      </div>
                    )}
                    <p>{msg.content}</p>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="msg-attachments">
                        {msg.attachments.map(att => (
                          <div key={att.id} className="msg-attachment">
                            {att.type === 'image' && att.url ? (
                              <img src={att.url} alt={att.name} />
                            ) : att.type === 'code_ref' ? (
                              <div style={{ width: '100%' }}>
                                <div className="msg-attachment-file-info">
                                  <span className="file-name">📝 {att.filePath ?? att.name}</span>
                                  {att.size && <span className="file-meta">{(att.size / 1024).toFixed(1)} KB</span>}
                                </div>
                                {att.textContent && (
                                  <div className="msg-attachment-code">{att.textContent.slice(0, 500)}</div>
                                )}
                              </div>
                            ) : (
                              <div className="msg-attachment-file-info">
                                <span className="file-name">{att.type === 'document' ? '📄' : att.type === 'url_preview' ? '🔗' : '📎'} {att.name}</span>
                                {att.size && <span className="file-meta">{(att.size / 1024).toFixed(1)} KB</span>}
                                {att.previewSummary && <span className="file-meta">{att.previewSummary.slice(0, 100)}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="history-note">{msg.createdAt}</p>
                  </div>
                ) : msg.role === 'team_discussion' && msg.teamMessages ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 14,
                    borderRadius: 14,
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(148, 163, 184, 0.12)',
                  }}>
                    <p className="eyebrow" style={{ marginBottom: 4, color: '#38bdf8' }}>
                      🏢 团队讨论会 · {msg.createdAt}
                    </p>
                    {msg.teamMessages
                      .filter(tm => tm.type !== 'thinking')
                      .map((tm, i) => renderTeamMessage(tm, i))}
                  </div>
                ) : (
                  <div className="prompt-box">
                    <div className="msg-action-row">
                      <button type="button" className="msg-action-btn" onClick={() => handleQuoteMessage(msg)}>引用</button>
                    </div>
                    <p className="prompt-label">🎯 贾维斯</p>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                    <p className="history-note">{msg.createdAt}</p>
                  </div>
                )}
              </div>
            ))}

            {liveMessages.length > 0 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 14,
                borderRadius: 14,
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
              }}>
                <p className="eyebrow" style={{ marginBottom: 4, color: '#38bdf8' }}>
                  🏢 团队讨论进行中...
                </p>
                {liveMessages.map((tm, i) => renderTeamMessage(tm, i))}
              </div>
            )}

            {pendingTasks.length > 0 && (
              <div style={{
                padding: 16,
                borderRadius: 14,
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}>
                <p className="eyebrow" style={{ color: '#22c55e', marginBottom: 10 }}>
                  📋 待创建任务（{pendingTasks.length} 项）
                </p>
                {pendingTasks.map((task, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    marginBottom: 6,
                    borderRadius: 8,
                    background: 'rgba(15, 23, 42, 0.6)',
                    fontSize: 13,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{task.title}</span>
                      <span style={{ color: '#64748b', marginLeft: 8, fontSize: 11 }}>
                        {task.ownerName} · {task.priority === 'urgent' ? '紧急' : task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'} · {task.budgetToken}T
                      </span>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    type="button"
                    className="approve-button"
                    onClick={handleCreateTasks}
                    disabled={isCreatingTasks}
                    style={{ flex: 1, border: 'none', cursor: isCreatingTasks ? 'not-allowed' : 'pointer' }}
                  >
                    {isCreatingTasks ? '创建中...' : '⚡ 一键创建全部任务'}
                  </button>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setPendingTasks([])}
                    style={{ fontSize: 12, padding: '8px 12px' }}
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {createdTaskIds.length > 0 && (
              <div style={{
                padding: 16,
                borderRadius: 14,
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}>
                <p className="eyebrow" style={{ color: '#38bdf8', marginBottom: 10 }}>
                  🚀 {createdTaskIds.length} 个任务已创建，准备执行
                </p>
                {openclawOnline ? (
                  <button
                    type="button"
                    className="approve-button"
                    onClick={handleExecuteAll}
                    disabled={isExecuting}
                    style={{
                      width: '100%',
                      border: 'none',
                      cursor: isExecuting ? 'not-allowed' : 'pointer',
                      background: isExecuting ? '#334155' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    }}
                  >
                    {isExecuting ? '执行中...' : '🚀 一键执行全部任务 (OpenClaw)'}
                  </button>
                ) : (
                  <div style={{
                    padding: 10,
                    borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    fontSize: 12,
                    color: '#f87171',
                    textAlign: 'center',
                  }}>
                    ⚠️ OpenClaw 未运行，任务已创建到看板。启动 OpenClaw 后可在任务看板中手动执行。
                  </div>
                )}
              </div>
            )}

            {executionStatus && pendingTasks.length === 0 && createdTaskIds.length === 0 && (
              <div style={{
                padding: 12,
                borderRadius: 10,
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                textAlign: 'center',
                fontSize: 13,
                color: '#22c55e',
              }}>
                ✅ {executionStatus}
              </div>
            )}

            {activeActions.map(action => (
              <ActionTrackerCard
                key={action.id}
                action={action}
                onDismiss={() => {
                  setActiveActions(prev =>
                    prev.map(a => a.id === action.id
                      ? { ...a, status: a.status === 'done' || a.status === 'failed' ? a.status : 'done' as const, updatedAt: Date.now() }
                      : a
                    ).filter(a => !(a.id === action.id && (a.status === 'done' || a.status === 'failed')))
                  )
                }}
              />
            ))}

            <WorkIndicator status={workStatus} />
            <div ref={chatEndRef} />
          </div>

          <ChatInputBar
            onSubmit={handleInputSubmit}
            disabled={isThinking}
            quotedMessage={quotedMessage}
            onClearQuote={() => setQuotedMessage(null)}
          />
        </div>
      </div>
    </section>
  )
}
