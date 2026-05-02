import assert from 'node:assert/strict'
import type { AppSnapshot, BusinessLine } from '../src/types'
import type { AppConfig } from '../src/services/configService'
import {
  buildCommercialReadinessReport,
  buildCommercialReadinessSummary,
  renderCommercialReadinessMarkdown,
} from '../src/services/commercialReadinessReportService'

const config: AppConfig = {
  _version: 'test',
  company: {
    name: '一人公司测试',
    ceo_name: '野子哥',
    industry: 'AI Automation',
    tagline: 'Let AI run your company',
    mission: 'Test',
    vision: 'Test',
    timezone: 'Asia/Shanghai',
    language: 'zh-CN',
    currency: 'CNY',
  },
  contact: { name: '野子哥', phone: '', email: '', wechat: '' },
  agents: [
    {
      id: 'fred-sales',
      display_name: 'Fred',
      role: 'sales',
      role_label: 'Sales Closer',
      enabled: true,
      capabilities: ['sales', 'pricing', 'outreach'],
      max_concurrent_tasks: 3,
      task_types: ['sales'],
      monthly_token_salary: 1000,
      level: 'L2',
      model_tier: 'premium',
      persona_keywords: ['fast', 'commercial'],
      skills_file: 'skills.json',
    },
    {
      id: 'agent-b',
      display_name: 'B',
      role: 'ops',
      role_label: 'Ops',
      enabled: true,
      capabilities: ['ops'],
      max_concurrent_tasks: 2,
      task_types: ['ops'],
      monthly_token_salary: 1000,
      level: 'L1',
      model_tier: 'light',
      persona_keywords: ['stable'],
      skills_file: 'skills.json',
    },
  ],
  token_economy: {
    monthly_total_budget: 10000,
    salary_payout_rule: 'monthly',
    surplus_cap_multiplier: 2,
    performance_bonus: {
      kpi_exceed_bonus_rate: 0.1,
      innovation_reward_range: [0, 100],
      failure_penalty_rate: 0.1,
    },
    audit_thresholds: {
      daily_cost_alert_usd: 10,
      monthly_budget_alert_percent: 80,
      auto_downgrade_on_exceed: false,
    },
    profit_distribution: {
      token_infrastructure_percent: 60,
      performance_bonus_percent: 20,
      skill_upgrade_percent: 10,
      reserve_percent: 10,
    },
  },
  content_strategy: {
    brand_positioning: 'Test',
    target_audience: [],
    content_style: 'plain',
    platforms: [],
  },
  llm: {
    monthly_budget_usd: 50,
    default_provider: 'test',
    default_model: 'test',
    routing_rules_file: '',
    cache_identical_prompts: false,
    batch_similar_requests: false,
    providers: [],
    fallback_chains: {},
  },
  ui: {
    theme: 'dark',
    accent_color: '#38bdf8',
    show_token_cost: true,
    show_agent_avatars: true,
    dashboard_refresh_interval_ms: 60000,
  },
  integrations_file: '',
  workflow_templates_file: '',
  operation_targets: {
    phase_label: 'test',
    orders: 1,
    revenue_cny: 1,
    scripts_label: '1',
    videos_label: '1',
    posters_label: '1',
  },
}

const businessLines: BusinessLine[] = [
  {
    id: 'bl_automation',
    name: 'AI Automation',
    description: 'Automation delivery',
    status: 'active',
    pricingTiers: [
      { name: 'Starter', price: 3000, description: 'Starter delivery' },
      { name: 'Growth', price: 6000, description: 'Growth delivery' },
    ],
    costStructure: [
      { label: 'Model', tokenCost: 400, fiatCost: 120 },
      { label: 'Delivery', tokenCost: 200, fiatCost: 80 },
    ],
    targetCustomers: 'SMB',
    createdAt: '2026-04-01',
  },
]

const snapshotWithRevenue: AppSnapshot = {
  agents: [
    { id: 'ceo', name: 'CEO', role: 'CEO', department: 'Exec', persona: 'Leader', status: 'idle', walletBalance: 0, currentTasks: 0, complianceScore: 100, goals: [] },
    { id: 'fred-sales', name: 'Fred', role: 'Sales', department: 'Sales', persona: 'Sharp closer', status: 'busy', walletBalance: 0, currentTasks: 1, complianceScore: 96, goals: ['close deals'] },
    { id: 'agent-b', name: 'B', role: 'Ops', department: 'Ops', persona: 'Executor', status: 'review', walletBalance: 0, currentTasks: 1, complianceScore: 80, goals: [] },
  ],
  tasks: [
    {
      id: 'task-a1',
      title: 'Close package',
      owner: 'Fred',
      ownerAgentId: 'fred-sales',
      taskType: 'sales',
      priority: 'high',
      status: 'completed',
      budgetToken: 1000,
      spentToken: 900,
      dueAt: '2026-04-30',
      requiresApproval: false,
      timeline: [{ id: 't1', type: 'created', submissionIndex: 1, actor: 'Fred', note: 'self created', createdAt: '2026-04-22 10:00' }],
    },
    {
      id: 'task-b1',
      title: 'Routine cleanup',
      owner: 'B',
      ownerAgentId: 'agent-b',
      taskType: 'ops',
      priority: 'medium',
      status: 'frozen',
      budgetToken: 300,
      spentToken: 450,
      dueAt: '2026-04-20',
      requiresApproval: true,
      timeline: [{ id: 't3', type: 'created', submissionIndex: 1, actor: 'CEO', note: 'assigned', createdAt: '2026-04-18 10:00' }],
    },
  ],
  approvals: [],
  ledger: [
    { id: 'l1', type: 'budget', actor: 'Fred', amount: -1100, note: 'spend', createdAt: '2026-04-22 11:00' },
    { id: 'l2', type: 'budget', actor: 'B', amount: -550, note: 'spend', createdAt: '2026-04-22 12:00' },
  ],
  revenues: [
    { id: 'r1', title: 'Customer Pilot Deal', businessLine: 'AI Automation', sourceTask: 'Close package', amount: 5200, tokenMapped: 900, roi: 5.7 },
  ],
  auditEvents: [],
  storeItems: [],
  storeOrders: [],
  treasury: { totalBalance: 0, reservedBalance: 0, availableBalance: 0 },
  businessLines,
  playbookRuns: [],
}

const snapshotEmpty: AppSnapshot = {
  ...snapshotWithRevenue,
  ledger: [],
  revenues: [],
  tasks: [],
  businessLines,
}

const referenceDate = new Date('2026-04-23T12:00:00Z')
const { summary, markdown } = buildCommercialReadinessReport(snapshotWithRevenue, config, businessLines, referenceDate)

assert.equal(summary.companyName, '一人公司测试')
assert.equal(summary.ceoName, '野子哥')
assert.equal(summary.teamCount, 2)
assert.equal(summary.companyReadinessScore > 0, true)
assert.ok(['S', 'A', 'B', 'C', 'D'].includes(summary.companyReadinessGrade))
assert.equal(summary.profitability.currentRevenue, 5200)
assert.equal(summary.profitability.currentCostFiat > 0, true)
assert.equal(summary.profitability.bestBreakEven !== null, true)
assert.equal(summary.profitability.bestBreakEven?.name, 'AI Automation')
assert.equal(summary.paidUsers, 1)

assert.equal(summary.milestones.M1.reached, true)
assert.equal(summary.milestones.M3.reached, summary.companyReadinessScore >= 70 && summary.paidUsers >= 1)

assert.match(markdown, /商业化就绪报告/)
assert.match(markdown, /AI Automation/)
assert.match(markdown, /北极星 5 维团队均分/)
assert.match(markdown, /商业化里程碑/)
assert.match(markdown, /对齐北极星 Checklist/)
assert.match(markdown, /M1 挣到第一块钱/)
assert.match(markdown, /头号选手/)

const emptySummary = buildCommercialReadinessSummary(snapshotEmpty, config, businessLines, referenceDate)
assert.equal(emptySummary.profitability.hasData, false)
assert.equal(emptySummary.profitability.currentRevenue, 0)
assert.equal(emptySummary.milestones.M1.reached, false)

const emptyMarkdown = renderCommercialReadinessMarkdown(emptySummary)
assert.match(emptyMarkdown, /ledger \/ revenues 表为空/)
assert.match(emptyMarkdown, /商业化里程碑/)

console.log('commercial readiness export tests passed')
