import assert from 'node:assert/strict'
import {
  listOpportunities,
  getOpportunityById,
  scoreOpportunity,
  recommendOffer,
  recommendOwnerAgent,
} from '../src/services/opportunityService'
import type { Opportunity } from '../src/types'

const opportunities = listOpportunities()

assert.equal(opportunities.length, 5)
assert.equal(opportunities.every(item => item.id && item.title && item.painPoint), true)
assert.equal(opportunities.every(item => item.fitScore >= 0 && item.fitScore <= 100), true)
assert.equal(opportunities.every(item => item.riskScore >= 0 && item.riskScore <= 100), true)
assert.equal(opportunities.every(item => item.ownerAgentId.length > 0), true)
assert.equal(opportunities.every(item => item.suggestedOffer.length > 0), true)

const first = getOpportunityById(opportunities[0].id)
assert.equal(first?.id, opportunities[0].id)
assert.equal(getOpportunityById('missing-opportunity'), undefined)

const highFit: Opportunity = {
  id: 'test-high-fit',
  source: 'manual',
  title: 'AI workflow automation for a growing team',
  companyName: 'Test Co',
  contactHint: 'founder asked for workflow automation help',
  painPoint: 'Manual operations create repeated handoffs and reporting delays',
  estimatedBudget: 12000,
  urgency: 'high',
  fitScore: 0,
  riskScore: 0,
  suggestedOffer: '',
  ownerAgentId: '',
  status: 'discovered',
  evidenceUrl: 'https://example.com/high-fit',
  createdAt: '2026-05-01',
  updatedAt: '2026-05-01',
}

const scoredHighFit = scoreOpportunity(highFit)
assert.equal(scoredHighFit.fitScore >= 70, true)
assert.equal(scoredHighFit.riskScore < 50, true)
assert.equal(recommendOwnerAgent(scoredHighFit), 'fred')
assert.match(recommendOffer(scoredHighFit), /999|2999|Jarvis|Agent|启动|诊断/)

const riskyTender: Opportunity = {
  ...highFit,
  id: 'test-risky-tender',
  source: 'tender',
  title: 'Enterprise tender with compliance-heavy contract terms',
  painPoint: 'Needs custom integration, strict contract, refund clauses and external SLA',
  estimatedBudget: 30000,
  urgency: 'medium',
}

const scoredRiskyTender = scoreOpportunity(riskyTender)
assert.equal(scoredRiskyTender.riskScore >= scoredHighFit.riskScore, true)
assert.equal(recommendOwnerAgent(scoredRiskyTender), 'mcgonagall')

console.log('opportunity service tests passed')
