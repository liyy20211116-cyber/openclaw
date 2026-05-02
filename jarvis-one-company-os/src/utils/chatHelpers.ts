export const ACTION_SIGNALS = [
  '我来盯',
  '我来安排',
  '马上安排',
  '立即启动',
  '我来协调',
  '我来调度',
  '交给',
  '我来跟',
  '我去安排',
  '马上执行',
  '立即安排',
  '我来处理',
  '我来跑',
  '跑通',
  '安排赫敏',
  '安排麦格',
]

export const AGENT_NAMES_MAP: Record<string, { agentId: string; emoji: string }> = {
  '赫敏': { agentId: 'hermione-tech', emoji: '📎' },
  '麦格': { agentId: 'mcgonagall-product', emoji: '🧭' },
  '卢娜': { agentId: 'luna-growth', emoji: '🌙' },
  '弗雷德': { agentId: 'fred-sales', emoji: '🎯' },
  '珀西': { agentId: 'percy-finance', emoji: '📊' },
  '斯内普': { agentId: 'snape-audit', emoji: '🛡️' },
  '多比': { agentId: 'dobby-customer', emoji: '🤝' },
  '纳威': { agentId: 'neville-hr', emoji: '🌱' },
  '贾维斯': { agentId: 'jarvis-coo', emoji: '🎛️' },
}

export interface DetectedDelegation {
  detected: boolean
  summary: string
  steps: string[]
  delegatedAgents: { name: string; agentId: string; emoji: string; task: string }[]
}

export function detectAction(jarvisReply: string): DetectedDelegation {
  const hasSignal = ACTION_SIGNALS.some(signal => jarvisReply.includes(signal))
  if (!hasSignal) return { detected: false, summary: '', steps: [], delegatedAgents: [] }

  const lines = jarvisReply.split('\n').filter(line => line.trim())
  const summary = lines[0]
    ?.replace(/^[^，。、：]+[，。、：]/, '')
    .trim()
    .slice(0, 60) || '执行中'

  const stepPatterns = [/^\d+[.、)]/, /^[-•*]/, /^\*\*/]
  const steps = lines
    .filter(line => stepPatterns.some(pattern => pattern.test(line.trim())))
    .map(line => line.trim().replace(/^\d+[.、)]|\*\*|^[-•*]\s*/g, '').replace(/\*\*/g, '').trim())
    .filter(step => step.length > 3 && step.length < 80)
    .slice(0, 5)

  const delegatedAgents: DetectedDelegation['delegatedAgents'] = []
  for (const [name, info] of Object.entries(AGENT_NAMES_MAP)) {
    if (name === '贾维斯') continue
    if (!jarvisReply.includes(name)) continue

    const taskLine = lines.find(line => line.includes(name)) ?? ''
    const task = taskLine
      .replace(new RegExp(`.*${name}[^，。、：]*[，。、：]?\\s*`), '')
      .trim()
      .slice(0, 50) || '执行分配任务'

    if (!delegatedAgents.some(agent => agent.agentId === info.agentId)) {
      delegatedAgents.push({ name, agentId: info.agentId, emoji: info.emoji, task })
    }
  }

  return {
    detected: true,
    summary,
    steps: steps.length > 0 ? steps : ['准备执行'],
    delegatedAgents,
  }
}

export function summarizeLlmError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const text = raw.toLowerCase()
  const retried = text.includes('retry') || text.includes('retries')
  const suffix = retried ? '（已自动重试多次仍未成功）' : ''

  if (text.includes('insufficient_quota') || text.includes('quota') || text.includes('insufficient balance') || text.includes('余额不足')) {
    return `当前模型通道额度不足，请切换其他模型或充值后重试。${suffix}`
  }
  if (text.includes('401') || text.includes('unauthorized') || text.includes('invalid api key') || text.includes('authentication')) {
    return `当前模型通道鉴权失败，请检查 API Key 或中转配置。${suffix}`
  }
  if (text.includes('403') || text.includes('forbidden')) {
    return `当前模型通道暂无访问权限，请检查账号余额或服务授权状态。${suffix}`
  }
  if (text.includes('429') || text.includes('rate limit')) {
    return `当前模型通道繁忙，建议稍后再发。${suffix}`
  }
  if (text.includes('502') || text.includes('503') || text.includes('504') || text.includes('bad gateway') || text.includes('all llm providers failed')) {
    return `模型服务暂时不可用，建议稍后重发或切换模型。${suffix}`
  }
  if (text.includes('aborted') || text.includes('timeout')) {
    return `模型响应超时，建议稍后再试。${suffix}`
  }
  if (text.includes('aggregateerror') || text.includes('failed to fetch') || text.includes('networkerror') || text.includes('econnrefused') || text.includes('connect')) {
    return `暂时连不上模型服务，请检查本地后端、代理或网络连接。${suffix}`
  }
  return `模型调用失败${suffix}，请稍后重试或切换其他模型。`
}

export const QUICK_GOALS = [
  'ONES 需求审核自动化项目还有缺口没闭环，安排相关部门协作把它做完。',
  '我们要做一个 AI 自动化搭建服务，先完成产品定义、报价方案和获客内容。',
  '接下来 7 天要连续产出增长内容和转化素材，优先提高首单成交率。',
]

export const TYPE_COLORS: Record<string, string> = {
  thinking: 'rgba(148, 163, 184, 0.5)',
  speaking: 'rgba(56, 189, 248, 0.15)',
  task_plan: 'rgba(34, 197, 94, 0.15)',
}
