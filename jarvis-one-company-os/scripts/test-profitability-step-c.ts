import assert from 'node:assert/strict'
import type { AppSnapshot, BusinessLine } from '../src/types'
import {
  buildProfitabilityBoundary,
  buildProfitabilityWeeklyReport,
  computeWeeklyBurnComparison,
  simulateBoundaryWhatIf,
} from '../src/services/profitabilityService'

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
  {
    id: 'bl_content',
    name: 'Content Ops',
    description: 'Content delivery',
    status: 'active',
    pricingTiers: [
      { name: 'Basic', price: 900, description: 'Basic package' },
      { name: 'Pro', price: 1800, description: 'Pro package' },
    ],
    costStructure: [
      { label: 'Generation', tokenCost: 300, fiatCost: 90 },
      { label: 'Editing', tokenCost: 100, fiatCost: 30 },
    ],
    targetCustomers: 'Creators',
    createdAt: '2026-04-01',
  },
]

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
      goals: [],
    },
    {
      id: 'fred-sales',
      name: 'Fred',
      role: 'Sales',
      department: 'Sales',
      persona: 'Closer',
      status: 'busy',
      walletBalance: 0,
      currentTasks: 1,
      complianceScore: 95,
      goals: [],
    },
  ],
  tasks: [
    {
      id: 'task-1',
      title: 'Automation pilot',
      owner: 'Fred',
      ownerAgentId: 'fred-sales',
      priority: 'high',
      status: 'completed',
      budgetToken: 800,
      spentToken: 500,
      dueAt: '2026-04-23',
    },
  ],
  approvals: [],
  ledger: [
    {
      id: 'ledger-1',
      type: 'budget',
      actor: 'Fred',
      amount: -20000,
      note: 'current week spend',
      createdAt: '2026-04-22 10:00',
    },
    {
      id: 'ledger-2',
      type: 'budget',
      actor: 'Fred',
      amount: -10000,
      note: 'previous week spend',
      createdAt: '2026-04-14 10:00',
    },
  ],
  revenues: [
    {
      id: 'rev-1',
      title: 'Automation revenue',
      businessLine: 'AI Automation',
      sourceTask: 'Automation pilot',
      amount: 4800,
      tokenMapped: 500,
      roi: 9.6,
    },
  ],
  auditEvents: [],
  storeItems: [],
  storeOrders: [],
  treasury: {
    totalBalance: 0,
    reservedBalance: 0,
    availableBalance: 0,
  },
  businessLines,
  playbookRuns: [],
}

const base = buildProfitabilityBoundary(snapshot, businessLines)
const weekly = computeWeeklyBurnComparison(snapshot.ledger, new Date('2026-04-23T09:00:00Z'))
const scenario = simulateBoundaryWhatIf(snapshot, businessLines, {
  businessLineId: 'bl_automation',
  priceDeltaPercent: 20,
  costDeltaPercent: -10,
})
const report = buildProfitabilityWeeklyReport(snapshot, businessLines, new Date('2026-04-23T09:00:00Z'))

assert.equal(base.breakEven.length, 2)
assert.equal(weekly.trend, 'up')
assert.equal(weekly.currentWeekFiatSpend > weekly.previousWeekFiatSpend, true)
assert.equal(scenario.target.before.avgUnitProfit < scenario.target.after.avgUnitProfit, true)
assert.equal(
  scenario.target.before.ordersNeededPerMonth > scenario.target.after.ordersNeededPerMonth,
  true,
)
assert.match(report, /# /)
assert.match(report, /AI Automation/)
assert.match(report, /本周烧钱速率/)

console.log('profitability step-c tests passed')
