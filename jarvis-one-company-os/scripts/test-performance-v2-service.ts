import assert from 'node:assert/strict'
import type { AppSnapshot } from '../src/types'
import type { AppConfig } from '../src/services/configService'
import {
  COMMERCIAL_DIMENSIONS,
  computeCommercialReadinessReport,
} from '../src/services/performanceV2Service'

const config: AppConfig = {
  _version: 'test',
  company: {
    name: 'Test Co',
    ceo_name: 'CEO',
    industry: 'AI',
    tagline: 'Test',
    mission: 'Test',
    vision: 'Test',
    timezone: 'Asia/Shanghai',
    language: 'zh-CN',
    currency: 'CNY',
  },
  contact: { name: 'CEO', phone: '', email: '', wechat: '' },
  agents: [
    {
      id: 'agent-a',
      display_name: 'Agent A',
      role: 'sales',
      role_label: 'Sales',
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
      display_name: 'Agent B',
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

const snapshot: AppSnapshot = {
  agents: [
    {
      id: 'ceo',
      name: 'CEO',
      role: 'CEO',
      department: 'Exec',
      persona: 'Leader',
      status: 'idle',
      walletBalance: 0,
      currentTasks: 0,
      complianceScore: 100,
      goals: ['lead'],
    },
    {
      id: 'agent-a',
      name: 'Agent A',
      role: 'Sales',
      department: 'Sales',
      persona: 'Sharp closer',
      status: 'busy',
      walletBalance: 0,
      currentTasks: 2,
      complianceScore: 96,
      goals: ['close deals', 'improve rpc'],
    },
    {
      id: 'agent-b',
      name: 'Agent B',
      role: 'Ops',
      department: 'Ops',
      persona: 'Executor',
      status: 'review',
      walletBalance: 0,
      currentTasks: 2,
      complianceScore: 82,
      goals: ['keep system running'],
    },
  ],
  tasks: [
    {
      id: 'task-a1',
      title: 'Close package',
      owner: 'Agent A',
      ownerAgentId: 'agent-a',
      taskType: 'sales',
      priority: 'high',
      status: 'completed',
      budgetToken: 1000,
      spentToken: 900,
      dueAt: '2026-04-30',
      requiresApproval: false,
      timeline: [{ id: 't1', type: 'created', submissionIndex: 1, actor: 'Agent A', note: 'self created', createdAt: '2026-04-22 10:00' }],
    },
    {
      id: 'task-a2',
      title: 'Follow up lead',
      owner: 'Agent A',
      ownerAgentId: 'agent-a',
      taskType: 'sales',
      priority: 'medium',
      status: 'in_progress',
      budgetToken: 400,
      spentToken: 200,
      dueAt: '2026-04-28',
      requiresApproval: false,
      timeline: [{ id: 't2', type: 'created', submissionIndex: 1, actor: 'Agent A', note: 'self created', createdAt: '2026-04-23 09:00' }],
    },
    {
      id: 'task-b1',
      title: 'Routine cleanup',
      owner: 'Agent B',
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
    {
      id: 'task-b2',
      title: 'Prepare report',
      owner: 'Agent B',
      ownerAgentId: 'agent-b',
      taskType: 'ops',
      priority: 'low',
      status: 'review',
      budgetToken: 200,
      spentToken: 100,
      dueAt: '2026-04-19',
      requiresApproval: true,
      timeline: [{ id: 't4', type: 'created', submissionIndex: 1, actor: 'CEO', note: 'assigned', createdAt: '2026-04-18 11:00' }],
    },
  ],
  approvals: [],
  ledger: [
    { id: 'l1', type: 'budget', actor: 'Agent A', amount: -1100, note: 'spend', createdAt: '2026-04-22 11:00' },
    { id: 'l2', type: 'budget', actor: 'Agent B', amount: -550, note: 'spend', createdAt: '2026-04-22 12:00' },
  ],
  revenues: [
    { id: 'r1', title: 'Deal', businessLine: 'AI Service', sourceTask: 'Close package', amount: 5200, tokenMapped: 900, roi: 5.7 },
  ],
  auditEvents: [],
  storeItems: [],
  storeOrders: [],
  treasury: { totalBalance: 0, reservedBalance: 0, availableBalance: 0 },
  businessLines: [],
  playbookRuns: [],
}

const report = computeCommercialReadinessReport(snapshot, config, new Date('2026-04-23T12:00:00Z'))

assert.equal(COMMERCIAL_DIMENSIONS.length, 5)
assert.equal(report.records.length, 2)
assert.equal(report.summary.count, 2)
assert.equal(report.records[0].agentId, 'agent-a')
assert.equal(report.records[0].breakdown.revenue_contribution > report.records[1].breakdown.revenue_contribution, true)
assert.equal(report.records[0].breakdown.autonomy > report.records[1].breakdown.autonomy, true)
assert.equal(report.records[0].score > report.records[1].score, true)
assert.equal(report.records[1].grade, 'D')
assert.equal(report.summary.avgScore > 0, true)
assert.equal(report.summary.topPerformer, 'Agent A')
assert.equal(report.summary.companyReadinessGrade === report.summary.grade, true)

console.log('performance v2 service tests passed')
