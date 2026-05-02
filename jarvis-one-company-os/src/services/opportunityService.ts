import seeds from '../../../config/opportunity-seeds.json'
import type { Opportunity, OpportunitySource } from '../types'
import { localPersistenceService, localStateKeys } from './localPersistenceService'

type OpportunitySeedFile = {
  opportunities: Opportunity[]
}

const seedData = seeds as OpportunitySeedFile
const seedOpportunities = seedData.opportunities

type OpportunityCreateInput = Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Opportunity, 'id' | 'createdAt' | 'updatedAt'>>

let localOpportunities: Opportunity[] = localPersistenceService.getOrSeed(localStateKeys.opportunities, seedOpportunities)

function nowStamp() {
  return new Date().toISOString()
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10)
}

function makeOpportunityId(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'manual'
  return `opp_${slug}_${Date.now()}`
}

function refreshOpportunities() {
  localOpportunities = localPersistenceService.getOrSeed(localStateKeys.opportunities, seedOpportunities)
  return localOpportunities
}

function persistOpportunities(opportunities: Opportunity[]) {
  localOpportunities = localPersistenceService.setItem(localStateKeys.opportunities, opportunities)
  return localOpportunities
}

const sourceRisk: Record<OpportunitySource, number> = {
  xiaohongshu: 10,
  douyin: 15,
  bilibili: 12,
  wechat: 8,
  tender: 32,
  job_site: 18,
  manual: 10,
  other: 20,
}

const urgencyScore: Record<Opportunity['urgency'], number> = {
  low: 8,
  medium: 16,
  high: 26,
}

function hasAny(text: string, keywords: string[]) {
  const normalized = text.toLowerCase()
  return keywords.some(keyword => normalized.includes(keyword))
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function recommendOwnerAgent(opportunity: Opportunity): string {
  const text = `${opportunity.title} ${opportunity.painPoint}`.toLowerCase()

  if (opportunity.source === 'tender' || opportunity.estimatedBudget >= 20000) {
    return 'mcgonagall'
  }
  if (hasAny(text, ['content', 'video', 'posting', 'creator', 'traffic', 'private domain'])) {
    return 'luna'
  }
  if (hasAny(text, ['customer service', 'support', 'onboarding', 'customer'])) {
    return 'dobby'
  }
  return 'fred'
}

export function recommendOffer(opportunity: Opportunity): string {
  const text = `${opportunity.title} ${opportunity.painPoint}`.toLowerCase()

  if (opportunity.estimatedBudget >= 20000 || opportunity.source === 'tender') {
    return '2999 元行业 Agent 启动包'
  }
  if (hasAny(text, ['diagnosis', '适合', 'whether', '判断'])) {
    return '99 元快速体检'
  }
  if (opportunity.estimatedBudget <= 500) {
    return '399 元 60 分钟诊断咨询'
  }
  if (hasAny(text, ['system', 'workflow', 'automation', 'agent', 'operating system'])) {
    return '999 元最小经营闭环启动包'
  }
  return 'Jarvis One Company OS 基础版'
}

export function scoreOpportunity(opportunity: Opportunity): Opportunity {
  const text = `${opportunity.title} ${opportunity.painPoint} ${opportunity.contactHint}`.toLowerCase()
  const budgetFit =
    opportunity.estimatedBudget >= 999 && opportunity.estimatedBudget <= 15000
      ? 30
      : opportunity.estimatedBudget > 15000
        ? 22
        : 14
  const painFit = hasAny(text, ['automation', 'workflow', 'agent', 'content', 'lead', 'operating system', 'sop'])
    ? 28
    : 16
  const sourceFit = opportunity.source === 'manual' || opportunity.source === 'wechat'
    ? 18
    : opportunity.source === 'tender'
      ? 10
      : 15
  const fitScore = clampScore(budgetFit + painFit + sourceFit + urgencyScore[opportunity.urgency])

  const highRiskSignals = ['refund', 'contract', 'sla', 'strict', 'compliance', 'guarantee', '群发', '私信']
  const riskScore = clampScore(
    sourceRisk[opportunity.source]
    + (opportunity.estimatedBudget >= 20000 ? 18 : 0)
    + (hasAny(text, highRiskSignals) ? 18 : 0)
    + (opportunity.contactHint.trim() ? 0 : 12),
  )

  return {
    ...opportunity,
    fitScore,
    riskScore,
    ownerAgentId: opportunity.ownerAgentId || recommendOwnerAgent({ ...opportunity, fitScore, riskScore }),
    suggestedOffer: opportunity.suggestedOffer || recommendOffer({ ...opportunity, fitScore, riskScore }),
  }
}

export function listOpportunities(): Opportunity[] {
  return refreshOpportunities().map(scoreOpportunity)
}

export function getOpportunityById(id: string): Opportunity | undefined {
  return listOpportunities().find(opportunity => opportunity.id === id)
}

export function createOpportunity(input: OpportunityCreateInput): Opportunity {
  const createdAt = input.createdAt ?? dateStamp()
  const opportunity = scoreOpportunity({
    ...input,
    id: input.id ?? makeOpportunityId(input.title),
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
  })
  persistOpportunities([opportunity, ...listOpportunities().filter(item => item.id !== opportunity.id)])
  return opportunity
}

export function updateOpportunity(id: string, partial: Partial<Opportunity>): Opportunity | undefined {
  let updated: Opportunity | undefined
  const next = listOpportunities().map(opportunity => {
    if (opportunity.id !== id) return opportunity
    updated = scoreOpportunity({
      ...opportunity,
      ...partial,
      id: opportunity.id,
      updatedAt: nowStamp(),
    })
    return updated
  })
  if (updated) persistOpportunities(next)
  return updated
}

export function deleteOpportunity(id: string): boolean {
  const current = listOpportunities()
  const next = current.filter(opportunity => opportunity.id !== id)
  if (next.length === current.length) return false
  persistOpportunities(next)
  return true
}

export function resetOpportunitiesToSeed(): Opportunity[] {
  return persistOpportunities(seedOpportunities.map(scoreOpportunity))
}

export function exportOpportunities(): Opportunity[] {
  return listOpportunities()
}

export const opportunityService = {
  listOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  resetOpportunitiesToSeed,
  exportOpportunities,
  scoreOpportunity,
  recommendOwnerAgent,
  recommendOffer,
}
