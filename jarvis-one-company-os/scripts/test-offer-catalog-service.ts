import assert from 'node:assert/strict'
import {
  getOfferById,
  listOffers,
  matchOfferByOpportunity,
  matchOfferByPainPoint,
} from '../src/services/offerCatalogService'
import type { Opportunity } from '../src/types'

const offers = listOffers()

assert.equal(offers.length, 5)
assert.equal(offers.every(offer => offer.id && offer.name && offer.price > 0), true)
assert.equal(offers.every(offer => offer.painPointTags.length > 0), true)
assert.equal(offers.every(offer => offer.deliverables.length > 0), true)

const starter = getOfferById('one_company_os_starter')
assert.equal(starter?.name, '一人公司 OS 体验版')
assert.equal(getOfferById('missing-offer'), undefined)

const workflowMatch = matchOfferByPainPoint('企业流程低效，人工重复操作多，不知道 AI 怎么落地')
assert.equal(workflowMatch.offer.id, 'ai_automation_diagnosis')
assert.match(workflowMatch.matchReason, /痛点|标签|默认|预算/)

const privateMatch = matchOfferByPainPoint('需要私有化部署，需要团队版 AI 经营系统')
assert.equal(privateMatch.offer.id, 'private_one_company_os')

const fallbackOpportunity: Opportunity = {
  id: 'opp-default',
  source: 'manual',
  title: 'General AI consulting lead',
  companyName: 'Default Co',
  contactHint: 'Asked for AI advice',
  painPoint: 'Wants to understand possible AI improvements',
  estimatedBudget: 1200,
  urgency: 'medium',
  fitScore: 50,
  riskScore: 20,
  suggestedOffer: '',
  ownerAgentId: 'fred',
  status: 'discovered',
  evidenceUrl: 'https://example.com/default',
  createdAt: '2026-05-01',
  updatedAt: '2026-05-01',
}
assert.equal(matchOfferByOpportunity(fallbackOpportunity).offer.id, 'ai_automation_diagnosis')

const enterpriseOpportunity: Opportunity = {
  ...fallbackOpportunity,
  id: 'opp-enterprise',
  painPoint: '客服重复咨询多，报表自动化，运营流程自动化',
  estimatedBudget: 30000,
}
assert.equal(matchOfferByOpportunity(enterpriseOpportunity).offer.id, 'enterprise_automation_mvp')

console.log('offer catalog service tests passed')
