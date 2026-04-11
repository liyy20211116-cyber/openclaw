import type { GoalDecomposition, GoalTaskDraft } from '../types'

const agentMap: Record<string, { id: string; name: string }> = {
  jarvis:     { id: 'jarvis',     name: '贾维斯' },
  hermione:   { id: 'hermione',   name: '赫敏·格兰杰' },
  mcgonagall: { id: 'mcgonagall', name: '麦格教授' },
  luna:       { id: 'luna',       name: '卢娜·洛夫古德' },
  fred:       { id: 'fred',       name: '弗雷德·韦斯莱' },
  percy:      { id: 'percy',      name: '珀西·韦斯莱' },
  snape:      { id: 'snape',      name: '斯内普' },
  dobby:      { id: 'dobby',      name: '多比' },
}

function futureDate(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

type RuleMatch = {
  keywords: string[]
  tasks: Omit<GoalTaskDraft, 'dueAt'>[]
  summary: string
  risks: string[]
}

const rules: RuleMatch[] = [
  {
    keywords: ['ONES', '需求审核', '自动化', '闭环', '缺口'],
    summary: '贾维斯已分析 ONES 需求审核自动化项目的 5 个缺口，安排麦格教授梳理需求、赫敏开发修复、斯内普审查质量、珀西记录成本、多比测试体验。',
    risks: ['Playwright 页面自动化依赖浏览器环境，需确保 ONES 已登录', 'config.json 中包含密钥，斯内普需审查安全风险', '定时扫描频率过高可能触发飞书 API 限流'],
    tasks: [
      { title: '梳理 ONES 自动化 5 个缺口的产品需求', description: '审查现有流程，输出每个缺口的需求描述、验收标准和优先级。缺口：1)自动定时扫描 2)通过后通知提报人 3)待补链接回填 4)建单失败重试 5)异常告警。', taskType: 'product', ownerAgentId: agentMap.mcgonagall.id, ownerName: agentMap.mcgonagall.name, priority: 'urgent', budgetToken: 400, requiresApproval: false },
      { title: '实现自动定时扫描待审批需求', description: '在 scan_and_send.py 中加入定时循环（每 10 分钟），自动拉取新的待审批记录并发送审核卡片。', taskType: 'tech', ownerAgentId: agentMap.hermione.id, ownerName: agentMap.hermione.name, priority: 'urgent', budgetToken: 600, requiresApproval: true },
      { title: '补全审批通过后通知提报人逻辑', description: '在 card_action_handler.py 的 _run_approve_job 中，建单成功后向提报人发送飞书消息（含 ONES 链接）。', taskType: 'tech', ownerAgentId: agentMap.hermione.id, ownerName: agentMap.hermione.name, priority: 'high', budgetToken: 400, requiresApproval: false },
      { title: '实现 link_pending 自动回填与失败重试', description: '对"已提交ONES-待补链接"的记录自动补全链接；对"建单失败"的记录支持自动重试并发送飞书告警。', taskType: 'tech', ownerAgentId: agentMap.hermione.id, ownerName: agentMap.hermione.name, priority: 'high', budgetToken: 500, requiresApproval: true },
      { title: '审查 ONES 自动化代码安全与异常处理', description: '审查 config.json 密钥暴露风险、API 调用兜底逻辑、幂等保护和边界 case。', taskType: 'audit', ownerAgentId: agentMap.snape.id, ownerName: agentMap.snape.name, priority: 'high', budgetToken: 300, requiresApproval: false },
      { title: '测试提报人视角的完整体验', description: '模拟需求提报人，验证：审批通知是否清晰、退回理由是否易懂、ONES 链接是否可用。输出体验问题清单。', taskType: 'customer', ownerAgentId: agentMap.dobby.id, ownerName: agentMap.dobby.name, priority: 'medium', budgetToken: 200, requiresApproval: false },
      { title: '记录 ONES 项目 Token 消耗与 ROI', description: '跟踪本项目各部门 Token 消耗，项目结束后出具结算报告。', taskType: 'finance', ownerAgentId: agentMap.percy.id, ownerName: agentMap.percy.name, priority: 'low', budgetToken: 100, requiresApproval: false },
    ],
  },
  {
    keywords: ['自动化', '搭建', '服务', '产品'],
    summary: '围绕 AI 自动化搭建服务，麦格教授定义产品、赫敏搭建技术底盘、弗雷德制定报价、卢娜产出获客内容。',
    risks: ['需要明确服务边界，避免 MVP 范围膨胀', '报价方案需参考竞品，防止定价失误'],
    tasks: [
      { title: '完成服务产品定义与边界', description: '明确服务范围、交付物标准和首批目标客户画像。', taskType: 'product', ownerAgentId: agentMap.mcgonagall.id, ownerName: agentMap.mcgonagall.name, priority: 'urgent', budgetToken: 800, requiresApproval: true },
      { title: '输出报价方案与销售话术', description: '基于产品定义，输出 2~3 档报价和对应的销售话术。', taskType: 'sales', ownerAgentId: agentMap.fred.id, ownerName: agentMap.fred.name, priority: 'high', budgetToken: 500, requiresApproval: true },
      { title: '搭建技术交付底盘', description: '确定技术栈、工作流引擎和标准交付模板。', taskType: 'tech', ownerAgentId: agentMap.hermione.id, ownerName: agentMap.hermione.name, priority: 'high', budgetToken: 1200, requiresApproval: true },
      { title: '产出获客内容与引流素材', description: '围绕服务卖点，产出短视频脚本、案例文章和朋友圈素材。', taskType: 'growth', ownerAgentId: agentMap.luna.id, ownerName: agentMap.luna.name, priority: 'medium', budgetToken: 600, requiresApproval: false },
    ],
  },
  {
    keywords: ['增长', '内容', '获客', '引流', '转化', '短视频'],
    summary: '以内容驱动增长为核心，卢娜主导选题与创作，弗雷德配合转化，赫敏搭建追踪工具。',
    risks: ['内容质量需斯内普抽检，避免低质量发布', '需要跟踪转化数据，不能只看阅读量'],
    tasks: [
      { title: '制定 7 天内容选题排期', description: '结合目标用户痛点，规划每天的选题与发布渠道。', taskType: 'growth', ownerAgentId: agentMap.luna.id, ownerName: agentMap.luna.name, priority: 'high', budgetToken: 400, requiresApproval: false },
      { title: '生产 5 条短视频脚本', description: '每条包含 hook、痛点、解决方案和 CTA。', taskType: 'growth', ownerAgentId: agentMap.luna.id, ownerName: agentMap.luna.name, priority: 'high', budgetToken: 600, requiresApproval: false },
      { title: '制定转化话术与成交路径', description: '从内容引流到首单成交的完整路径设计。', taskType: 'sales', ownerAgentId: agentMap.fred.id, ownerName: agentMap.fred.name, priority: 'medium', budgetToken: 400, requiresApproval: false },
      { title: '搭建转化追踪工具', description: '配置表单、落地页和数据回收流程。', taskType: 'tech', ownerAgentId: agentMap.hermione.id, ownerName: agentMap.hermione.name, priority: 'medium', budgetToken: 500, requiresApproval: true },
    ],
  },
  {
    keywords: ['预算', '审批', '规则', '制度', '风控', '合规'],
    summary: '完善内部管理制度，珀西建立预算规则，斯内普制定审计标准，形成完整风控闭环。',
    risks: ['规则不宜过于复杂，避免审批流程成为瓶颈', '需要定期回顾规则有效性'],
    tasks: [
      { title: '定义预算阈值与审批节点', description: '按任务类型和金额区间，明确哪些需要审批、谁来审批。', taskType: 'finance', ownerAgentId: agentMap.percy.id, ownerName: agentMap.percy.name, priority: 'high', budgetToken: 300, requiresApproval: false },
      { title: '搭建异常驳回与复核流程', description: '审批驳回后的修正路径、复核标准和升级机制。', taskType: 'finance', ownerAgentId: agentMap.percy.id, ownerName: agentMap.percy.name, priority: 'high', budgetToken: 300, requiresApproval: false },
      { title: '建立审计巡检标准', description: '幻觉检测、越权检查、质量打分的标准化流程。', taskType: 'audit', ownerAgentId: agentMap.snape.id, ownerName: agentMap.snape.name, priority: 'medium', budgetToken: 400, requiresApproval: true },
    ],
  },
  {
    keywords: ['技术', '代码', '系统', '架构', '开发', '部署'],
    summary: '聚焦技术基础设施建设，赫敏主导架构与开发，斯内普负责代码审查。',
    risks: ['避免过度设计，MVP 阶段以可用为优先', '需要考虑后续扩展性'],
    tasks: [
      { title: '完成系统架构设计', description: '确定技术栈、模块划分和数据流设计。', taskType: 'tech', ownerAgentId: agentMap.hermione.id, ownerName: agentMap.hermione.name, priority: 'urgent', budgetToken: 800, requiresApproval: true },
      { title: '搭建核心功能模块', description: '按优先级实现核心业务逻辑和 API。', taskType: 'tech', ownerAgentId: agentMap.hermione.id, ownerName: agentMap.hermione.name, priority: 'high', budgetToken: 1500, requiresApproval: true },
      { title: '代码审查与安全检测', description: '审查代码质量、安全漏洞和异常处理完整性。', taskType: 'audit', ownerAgentId: agentMap.snape.id, ownerName: agentMap.snape.name, priority: 'medium', budgetToken: 300, requiresApproval: false },
    ],
  },
  {
    keywords: ['客户', '用户', '体验', '反馈', '满意'],
    summary: '以客户体验为核心，多比主导体验评估，麦格整理需求，弗雷德优化转化。',
    risks: ['需要区分用户反馈的优先级，不能什么都做', '体验改进需要数据支撑，避免主观臆断'],
    tasks: [
      { title: '客户体验走查与问题收集', description: '从用户视角完整走查产品流程，收集体验问题。', taskType: 'customer', ownerAgentId: agentMap.dobby.id, ownerName: agentMap.dobby.name, priority: 'high', budgetToken: 300, requiresApproval: false },
      { title: '整理客户反馈为产品需求', description: '将体验问题分类整理，输出优先级排序的需求清单。', taskType: 'product', ownerAgentId: agentMap.mcgonagall.id, ownerName: agentMap.mcgonagall.name, priority: 'medium', budgetToken: 300, requiresApproval: false },
      { title: '优化客户转化与留存策略', description: '基于反馈数据优化成交路径和续费策略。', taskType: 'sales', ownerAgentId: agentMap.fred.id, ownerName: agentMap.fred.name, priority: 'medium', budgetToken: 400, requiresApproval: false },
    ],
  },
]

const fallbackRule: RuleMatch = {
  keywords: [],
  summary: '贾维斯将此目标拆解为以下执行任务，已分配给对应部门一号位，请检查并调整后一键创建。',
  risks: ['目标较为通用，建议在创建后进一步细化各任务描述'],
  tasks: [
    { title: '目标分析与方案规划', description: '麦格教授分析 CEO 目标，输出可执行方案与资源需求清单。', taskType: 'product', ownerAgentId: agentMap.mcgonagall.id, ownerName: agentMap.mcgonagall.name, priority: 'high', budgetToken: 500, requiresApproval: true },
    { title: '核心执行任务', description: '赫敏根据方案规划，推进核心交付物的生产。', taskType: 'tech', ownerAgentId: agentMap.hermione.id, ownerName: agentMap.hermione.name, priority: 'high', budgetToken: 800, requiresApproval: true },
    { title: '成果验收与复盘', description: '斯内普验收交付成果，珀西出具成本报告。', taskType: 'audit', ownerAgentId: agentMap.snape.id, ownerName: agentMap.snape.name, priority: 'medium', budgetToken: 300, requiresApproval: false },
  ],
}

function matchRule(goal: string): RuleMatch {
  const lower = goal.toLowerCase()
  let bestMatch: RuleMatch | null = null
  let bestScore = 0

  for (const rule of rules) {
    const score = rule.keywords.filter((kw) => lower.includes(kw.toLowerCase())).length
    if (score > bestScore) {
      bestScore = score
      bestMatch = rule
    }
  }

  return bestMatch && bestScore > 0 ? bestMatch : fallbackRule
}

export function decomposeGoal(goal: string): GoalDecomposition {
  const rule = matchRule(goal)
  const id = `goal_${Date.now()}`

  return {
    id,
    goal,
    summary: rule.summary,
    riskNotes: rule.risks,
    tasks: rule.tasks.map((t, i) => ({
      ...t,
      dueAt: futureDate(3 + i * 2),
    })),
    createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  }
}
