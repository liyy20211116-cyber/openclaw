import { useEffect, useRef, useState, useCallback } from 'react'
import type { ChatMessage, GoalTaskDraft, TeamDiscussionMessage, QuotedMessage } from '../types'
import { useSnapshot } from '../hooks/useSnapshot'
import { chatTopicService } from '../services/chatTopicService'
import type { ChatTopic } from '../services/chatTopicService'
import { jarvisChat, shouldStartPlanning, runTeamDiscussion, checkOpenClawStatus, getLlmInfo, distillConversation, runSkill, matchSkillFromReply, matchSkillWithAgent, matchAgentDefaultSkill } from '../services/agentBrainService'
import type { TeamMessage, CompanyProposal, SkillResult } from '../services/agentBrainService'
import { writebackService } from '../services/writebackService'
import { ChatInputBar } from '../components/ChatInputBar'
import type { ChatInputSubmission } from '../components/ChatInputBar'
import { ModelSelector } from '../components/ModelSelector'
import { getDefaultModelLabel, getLastUsedModel, chatCompletionStream } from '../services/llmService'

import { StickyWorkBar } from '../components/StickyWorkBar'
import type { WorkStatus, ActiveAction } from '../components/StickyWorkBar'
import { ActionTrackerPanel } from '../components/ActionTrackerPanel'
import { detectAction, summarizeLlmError, QUICK_GOALS, TYPE_COLORS } from '../utils/chatHelpers'


const quickGoals = QUICK_GOALS
const typeColors = TYPE_COLORS

/* detectAction, summarizeLlmError, etc. moved to ../utils/chatHelpers.ts */




export function CeoChatPage() {
  useSnapshot()

  const [topics, setTopics] = useState<ChatTopic[]>([])
  const [activeTopicId, setActiveTopicId] = useState<string>(() => {
    return chatTopicService.getActiveTopicId() ?? ''
  })
  const [topicSidebarOpen, setTopicSidebarOpen] = useState(true)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [chatReady, setChatReady] = useState(false)

  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        let allTopics = await chatTopicService.getTopics()
        if (cancelled) return

        const saved = chatTopicService.getActiveTopicId()
        let tid = ''
        if (saved && allTopics.find(t => t.id === saved)) {
          tid = saved
        } else if (allTopics.length > 0) {
          tid = allTopics[0].id
        } else {
          const first = await chatTopicService.createTopic('新对话')
          allTopics = [first]
          tid = first.id
        }

        if (cancelled) return
        setTopics(allTopics)
        setActiveTopicId(tid)
        chatTopicService.setActiveTopicId(tid)

        const msgs = await chatTopicService.getMessages(tid)
        if (cancelled) return
        setMessages(msgs)
        setChatReady(true)
      } catch (e) {
        console.error('[CeoChatPage] init failed:', e)
        if (!cancelled) setChatReady(true)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [liveMessages, setLiveMessages] = useState<TeamDiscussionMessage[]>([])
  const [pendingTasks, setPendingTasks] = useState<GoalTaskDraft[]>([])
  const [isCreatingTasks, setIsCreatingTasks] = useState(false)
  const [createdTaskIds, setCreatedTaskIds] = useState<string[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionStatus, setExecutionStatus] = useState<string>('')
  const [openclawOnline, setOpenclawOnline] = useState<boolean | null>(null)
  const [, setLlmModel] = useState<string>('检测中...')
  const [actualLlmModel, setActualLlmModel] = useState<string>('')
  const [workStatus, setWorkStatus] = useState<WorkStatus | null>(null)
  const [activeActions, setActiveActions] = useState<ActiveAction[]>([])
  const [, setProposals] = useState<CompanyProposal[]>([])
  const [quotedMessage, setQuotedMessage] = useState<QuotedMessage | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const defaultModelLabel = getDefaultModelLabel()

  const workStartRef = useRef<number>(0)
  const updateWork = useCallback((phase: string, detail: string, icon: string, step?: number, totalSteps?: number) => {
    if (step === 0 || step === 1) workStartRef.current = Date.now()
    setWorkStatus({ phase, detail, startTime: workStartRef.current || Date.now(), icon, step, totalSteps })
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

  useEffect(() => {
    const syncActualModel = () => {
      const model = getLastUsedModel()
      setActualLlmModel(prev => (model === prev ? prev : model))
    }

    syncActualModel()
    const interval = setInterval(syncActualModel, 1500)
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
      chatTopicService.appendMessage(activeTopicId, resultMsg)
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
    _goal: string,
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
      chatTopicService.appendMessage(activeTopicId, reportMsg)
      setMessages(prev => [...prev, reportMsg])

      await generateFollowUp(_goal, allResults.map(r => ({ owner: r.name, ok: r.ok, summary: r.summary })))
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
    const results: { owner: string; task: string; ok: boolean; summary: string }[] = []

    for (const task of tasks) {
      const ownerName = task.ownerName ?? ''
      const agentId = agentIdMap[ownerName] ?? task.ownerAgentId ?? ''
      if (!agentId) continue

      const defaultSkill = matchAgentDefaultSkill(agentId)
      const skillMatch = matchSkillWithAgent(task.title + ' ' + task.description)
      const matchedIsOwnSkill = skillMatch && skillMatch.agentId === agentId
      const skillId = matchedIsOwnSkill ? skillMatch.skillId : defaultSkill
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

        results.push({ owner: ownerName, task: task.title, ok: result?.ok ?? false, summary })
      } catch (e) {
        setActiveActions(prev => prev.map(a => a.id === actionId ? {
          ...a,
          status: 'failed' as const,
          skillResult: `执行异常: ${e}`,
          updatedAt: Date.now(),
        } : a))
        results.push({ owner: ownerName, task: task.title, ok: false, summary: `异常: ${e}` })
      }
    }

    if (results.length > 0) {
      const okCount = results.filter(r => r.ok).length
      const reportLines = results.map(r =>
        `${r.ok ? '✅' : '❌'} **${r.owner}**（${r.task}）: ${r.summary}`
      )
      const reportMsg: ChatMessage = {
        id: `msg_${Date.now()}_exec_report`,
        role: 'jarvis',
        content: `📊 **各部门执行报告** (${okCount}/${results.length} 成功)\n\n${reportLines.join('\n')}`,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      }
      chatTopicService.appendMessage(activeTopicId, reportMsg)
      setMessages(prev => [...prev, reportMsg])

      await generateFollowUp(goal, results)
    }
  }

  async function generateFollowUp(
    goal: string,
    results: { owner: string; task?: string; ok: boolean; summary: string }[],
  ) {
    try {
      const okCount = results.filter(r => r.ok).length
      const failCount = results.length - okCount
      const resultsSummary = results.map(r =>
        `${r.ok ? '成功' : '失败'} - ${r.owner}${r.task ? `(${r.task})` : ''}: ${r.summary}`
      ).join('\n')

      const followUpPrompt = `你刚刚指挥团队执行了一个目标：「${goal}」

执行结果如下（${okCount} 成功 / ${failCount} 失败）：
${resultsSummary}

现在请你作为 COO，简要分析这些结果，指出关键发现，并明确告诉 CEO 下一步该做什么。
要求：
- 直接说结论，不要重复列举结果
- 如果有失败项，说明原因和解决思路
- 给出明确的下一步行动建议（1-3 条）
- 控制在 3 段以内`

      updateWork('贾维斯分析中', '正在分析执行结果，准备下一步...', '📋', 6, 7)
      const followUp = await jarvisChat(followUpPrompt, [])
      const followUpMsg: ChatMessage = {
        id: `msg_${Date.now()}_followup`,
        role: 'jarvis',
        content: followUp,
        llmModelUsed: getLastUsedModel() || undefined,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      }
      chatTopicService.appendMessage(activeTopicId, followUpMsg)
      setMessages(prev => [...prev, followUpMsg])
    } catch {
      // silent - don't block on follow-up failure
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
    chatTopicService.appendMessage(activeTopicId, ceoMsg)
    setMessages(prev => [...prev, ceoMsg])

    const currentTopic = topics.find(t => t.id === activeTopicId)
    if (currentTopic && (currentTopic.title === '新对话' || currentTopic.title === '新建对话') && messages.length === 0) {
      const autoTitle = goal.replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24) + (goal.length > 24 ? '...' : '')
      if (autoTitle.length > 1) {
        chatTopicService.renameTopic(activeTopicId, autoTitle).catch(() => {})
      }
    }
    chatTopicService.getTopics().then(setTopics).catch(() => {})

    setInput('')
    setQuotedMessage(null)
    setIsThinking(true)
    setLiveMessages([])
    setPendingTasks([])
    setCreatedTaskIds([])
    setExecutionStatus('')
    updateWork('连接大脑', '正在加载记忆和公司制度...', '🧠', 1, 7)

    try {
      const history = messages
        .filter(m => m.role === 'ceo' || m.role === 'jarvis')
        .slice(-10)
        .map(m => ({
          role: m.role === 'ceo' ? 'user' as const : 'assistant' as const,
          content: m.content,
        }))

      updateWork('贾维斯思考中', '理解你的意图，组织回复...', '💭', 2, 7)

      const jarvisMsgId = `msg_${Date.now()}_jarvis`
      let jarvisReply = ''
      let placeholderVisible = false

      try {
        const streamMsg: ChatMessage = {
          id: jarvisMsgId,
          role: 'jarvis',
          content: '',
          llmModelUsed: undefined,
          createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        }
        setMessages(prev => [...prev, streamMsg])
        placeholderVisible = true

        const streamReply = await chatCompletionStream(
          [
            { role: 'system', content: 'You are Jarvis, the COO assistant.' },
            ...history,
            { role: 'user', content: fullGoal },
          ],
          (delta) => {
            jarvisReply += delta
            setMessages(prev => prev.map(m => m.id === jarvisMsgId ? { ...m, content: m.content + delta } : m))
          },
          { temperature: 0.7, maxTokens: 800, callerFunction: 'jarvisChat_stream', agentId: 'jarvis-coo' },
        )

        if (!streamReply || !streamReply.trim()) {
          throw new Error('LLM stream returned empty content')
        }
        jarvisReply = streamReply

        setMessages(prev => prev.map(m => m.id === jarvisMsgId ? { ...m, content: jarvisReply, llmModelUsed: getLastUsedModel() || undefined } : m))
      } catch (streamErr) {
        console.warn('[CeoChatPage] streaming failed, falling back to non-streaming jarvisChat:', streamErr)
        if (placeholderVisible) {
          setMessages(prev => prev.filter(m => m.id !== jarvisMsgId))
          placeholderVisible = false
        }
        let fallbackErr: unknown = null
        try {
          jarvisReply = await jarvisChat(fullGoal, history)
        } catch (err) {
          fallbackErr = err
          console.error('[CeoChatPage] non-streaming fallback also failed:', err)
          jarvisReply = ''
        }

        if (!jarvisReply || !jarvisReply.trim()) {
          const streamSummary = summarizeLlmError(streamErr)
          const fallbackSummary = fallbackErr ? summarizeLlmError(fallbackErr) : '回退接口同样未返回内容'
          console.error('[CeoChatPage] both streaming and non-streaming returned empty', {
            streamErr,
            fallbackErr,
            model: getLastUsedModel(),
          })
          const errorMsg: ChatMessage = {
            id: jarvisMsgId,
            role: 'jarvis',
            content: `⚠️ Jarvis 回复失败，请检查模型接口或运行日志。\n· 流式通道：${streamSummary}\n· 兜底通道：${fallbackSummary}`,
            isError: true,
            llmModelUsed: getLastUsedModel() || undefined,
            createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
          }
          chatTopicService.appendMessage(activeTopicId, errorMsg)
          setMessages(prev => [...prev, errorMsg])
          setIsThinking(false)
          setWorkStatus(null)
          return
        }

        const fallbackMsg: ChatMessage = {
          id: jarvisMsgId,
          role: 'jarvis',
          content: jarvisReply,
          llmModelUsed: getLastUsedModel() || undefined,
          createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        }
        setMessages(prev => [...prev, fallbackMsg])
      }

      const jarvisMsg: ChatMessage = {
        id: jarvisMsgId,
        role: 'jarvis',
        content: jarvisReply,
        llmModelUsed: getLastUsedModel() || undefined,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      }
      chatTopicService.appendMessage(activeTopicId, jarvisMsg)

      const actionDetect = detectAction(jarvisReply)
      if (actionDetect.detected && !shouldStartPlanning(jarvisReply)) {
        if (actionDetect.delegatedAgents.length > 0) {
          await dispatchMultiAgent(actionDetect.delegatedAgents, goal)
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

      updateWork('记忆沉淀', '提取对话要点，更新长期记忆...', '📝', 6, 7)
      distillConversation([...history, { role: 'user', content: goal }, { role: 'assistant', content: jarvisReply }]).catch(() => {})

      if (shouldStartPlanning(jarvisReply)) {
        updateWork('召集团队', '正在组织相关部门讨论...', '🏢', 3, 7)
        const collectedMessages: TeamDiscussionMessage[] = []

        const { messages: teamMsgs, parsedTasks } = await runTeamDiscussion(goal, (msg: TeamMessage) => {
          const tmsg: TeamDiscussionMessage = { ...msg }
          collectedMessages.push(tmsg)
          setLiveMessages([...collectedMessages])
          updateWork('团队讨论中', `${msg.agentName} 正在发言...`, msg.emoji ?? '💬')
        })

        updateWork('整理方案', '汇总讨论结果，生成任务清单...', '📋', 4, 7)
        const discussionMsg: ChatMessage = {
          id: `msg_${Date.now()}_team`,
          role: 'team_discussion',
          content: '',
          teamMessages: teamMsgs as TeamDiscussionMessage[],
          createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        }
        chatTopicService.appendMessage(activeTopicId, discussionMsg)
        setMessages(prev => [...prev, discussionMsg])
        setLiveMessages([])

        if (parsedTasks.length > 0) {
          setPendingTasks(parsedTasks)

          updateWork('自动执行', '开始派发任务给各部门...', '🚀', 5, 7)
          await autoExecuteTasks(parsedTasks, goal)
        }
      }
    } catch (err) {
      console.error('[CeoChatPage] Jarvis chat failed after all retries', err)
      const errorMsg: ChatMessage = {
        id: `msg_${Date.now()}_error`,
        role: 'jarvis',
        content: `⚠️ ${summarizeLlmError(err)}`,
        isError: true,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      }
      chatTopicService.appendMessage(activeTopicId, errorMsg)
      setMessages(prev => [...prev, errorMsg])
      setLiveMessages([])
    } finally {
      setIsThinking(false)
      setWorkStatus(null)
    }
  }

  function _handleProposalToChat(proposal: CompanyProposal) {
    const msg = `${proposal.emoji} ${proposal.agentName}提出了一个建议：「${proposal.title}」—— ${proposal.summary}`
    handleSendGoal(msg)
  }

  void _handleProposalToChat

  async function handleClearHistory() {
    setMessages([])
    setLiveMessages([])
    await chatTopicService.clearMessages(activeTopicId)
  }

  async function handleNewTopic() {
    try {
      const t = await chatTopicService.createTopic('新对话')
      setActiveTopicId(t.id)
      chatTopicService.setActiveTopicId(t.id)
      setMessages([])
      setLiveMessages([])
      setPendingTasks([])
      setCreatedTaskIds([])
      setActiveActions([])
      setProposals([])
      setWorkStatus(null)
      const fresh = await chatTopicService.getTopics()
      setTopics(fresh)
    } catch (e) {
      console.error('[CeoChatPage] handleNewTopic failed:', e)
    }
  }

  async function handleSwitchTopic(id: string) {
    if (id === activeTopicId) return
    setActiveTopicId(id)
    chatTopicService.setActiveTopicId(id)
    setLiveMessages([])
    setPendingTasks([])
    setCreatedTaskIds([])
    setActiveActions([])
    setProposals([])
    setWorkStatus(null)
    const msgs = await chatTopicService.getMessages(id)
    setMessages(msgs)
  }

  async function handleDeleteTopic(id: string) {
    await chatTopicService.deleteTopic(id)
    const remaining = await chatTopicService.getTopics()
    setTopics(remaining)
    if (id === activeTopicId) {
      if (remaining.length > 0) {
        handleSwitchTopic(remaining[0].id)
      } else {
        handleNewTopic()
      }
    }
  }

  function handleStartRename(id: string, currentTitle: string) {
    setRenamingId(id)
    setRenameValue(currentTitle)
  }

  async function handleFinishRename() {
    if (renamingId && renameValue.trim()) {
      await chatTopicService.renameTopic(renamingId, renameValue.trim())
      chatTopicService.getTopics().then(setTopics).catch(() => {})
    }
    setRenamingId(null)
    setRenameValue('')
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

  const activeTopic = topics.find(t => t.id === activeTopicId)

  if (!chatReady) {
    return (
      <section className="ceo-chat-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 14 }}>正在加载对话记录...</div>
        </div>
      </section>
    )
  }

  return (
    <section className="ceo-chat-layout">
      {/* === 话题侧边栏 === */}
      <aside className={`topic-sidebar ${topicSidebarOpen ? '' : 'collapsed'}`}>
        <div className="topic-sidebar-header">
          {topicSidebarOpen && <span className="topic-sidebar-title">项目话题</span>}
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setTopicSidebarOpen(p => !p)}
            title={topicSidebarOpen ? '收起话题栏' : '展开话题栏'}
          >
            {topicSidebarOpen ? '◀' : '▶'}
          </button>
        </div>
        {topicSidebarOpen && (
          <>
            <button type="button" className="topic-new-btn" onClick={handleNewTopic}>
              + 新建对话
            </button>
            <div className="topic-list">
              {topics.map(t => (
                <div
                  key={t.id}
                  className={`topic-item ${t.id === activeTopicId ? 'active' : ''}`}
                  onClick={() => handleSwitchTopic(t.id)}
                >
                  {renamingId === t.id ? (
                    <input
                      className="topic-rename-input"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={e => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') } }}
                      onClick={e => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <>
                      <div className="topic-item-text">
                        <span className="topic-item-title">{t.title}</span>
                        <span className="topic-item-meta">{t.messageCount} 条 · {t.updatedAt.slice(5, 10)}</span>
                      </div>
                      <div className="topic-item-actions" onClick={e => e.stopPropagation()}>
                        <button type="button" onClick={() => handleStartRename(t.id, t.title)} title="重命名">✏</button>
                        <button type="button" onClick={() => { if (confirm('确定删除此话题？')) handleDeleteTopic(t.id) }} title="删除">✕</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </aside>

      {/* === 主对话区 === */}
      <div className="chat-main">
        {/* 顶部栏 */}
        <div className="chat-topbar">
          <div className="chat-topbar-left">
            <h2 className="chat-topbar-title">{activeTopic?.title ?? '对话'}</h2>
            <span className="chat-topbar-count">{messages.length} 条消息</span>
          </div>
          <div className="chat-topbar-right">
            <ModelSelector onModelChange={(_id, name) => setLlmModel(`${name}`)} />
            <div className={`chat-status-dot ${openclawOnline === null ? 'detecting' : openclawOnline ? 'online' : 'offline'}`} title={openclawOnline === null ? '检测中' : openclawOnline ? 'OpenClaw 已连接' : 'OpenClaw 未连接'} />
            <span className="chat-topbar-model">{actualLlmModel ? `${actualLlmModel}` : defaultModelLabel}</span>
            {messages.length > 0 && (
              <button type="button" className="chat-topbar-btn" onClick={handleClearHistory}>清空</button>
            )}
          </div>
        </div>

        {/* 聊天消息区 */}
        <div className="chat-messages-area">
          {messages.length === 0 && liveMessages.length === 0 && (
            <div className="chat-empty-state">
              <div className="chat-empty-icon">💬</div>
              <h3>和贾维斯聊聊你的想法</h3>
              <p>输入目标或选择快速启动，贾维斯会理解你的意图并安排执行。</p>
              <div className="chat-quick-goals">
                {quickGoals.map((goal, index) => (
                  <button
                    key={index}
                    type="button"
                    className="chat-quick-goal-btn"
                    onClick={() => handleSendGoal(goal)}
                    disabled={isThinking}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === 'ceo' ? (
                  <div className="prompt-box" style={{ borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                    <div className="msg-action-row">
                      <button type="button" className="msg-action-btn" onClick={() => handleQuoteMessage(msg)}>引用</button>
                    </div>
                    <p className="prompt-label">👤 CEO（你手动输入）</p>
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
                  <div
                    className="prompt-box"
                    style={msg.isError ? {
                      borderColor: 'rgba(239, 68, 68, 0.5)',
                      background: 'rgba(239, 68, 68, 0.08)',
                    } : undefined}
                  >
                    <div className="msg-action-row">
                      <button type="button" className="msg-action-btn" onClick={() => handleQuoteMessage(msg)}>引用</button>
                    </div>
                    <p
                      className="prompt-label"
                      style={msg.isError ? { color: '#f87171' } : undefined}
                    >
                      {msg.isError ? '⚠️ 贾维斯（回复失败）' : '🎯 贾维斯'}
                    </p>
                    <p style={{
                      whiteSpace: 'pre-wrap',
                      color: msg.isError ? '#fecaca' : undefined,
                    }}>{msg.content}</p>
                    {msg.llmModelUsed && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        marginTop: 8,
                        borderRadius: 999,
                        background: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.18)',
                        fontSize: 11,
                        color: '#7dd3fc',
                      }}>
                        <span>🧠</span>
                        <span>本次模型：{msg.llmModelUsed}</span>
                      </div>
                    )}
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

            <ActionTrackerPanel
              actions={activeActions}
              onDismiss={(id) => {
                setActiveActions(prev =>
                  prev.map(a => a.id === id
                    ? { ...a, status: a.status === 'done' || a.status === 'failed' ? a.status : 'done' as const, updatedAt: Date.now() }
                    : a
                  ).filter(a => !(a.id === id && (a.status === 'done' || a.status === 'failed')))
                )
              }}
            />

            <div ref={chatEndRef} />
          </div>

          {/* 固定在输入框上方的实时状态条 */}
          <StickyWorkBar status={workStatus} activeActions={activeActions} />

          {/* 输入区 */}
          <ChatInputBar
            onSubmit={handleInputSubmit}
            disabled={isThinking}
            quotedMessage={quotedMessage}
            onClearQuote={() => setQuotedMessage(null)}
          />
        </div>
    </section>
  )
}
