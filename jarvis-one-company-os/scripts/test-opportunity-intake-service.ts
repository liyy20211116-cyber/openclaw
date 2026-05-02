import assert from 'node:assert/strict'
import { localPersistenceService, localStateKeys } from '../src/services/localPersistenceService'
import { opportunityService } from '../src/services/opportunityService'
import { opportunityIntakeService } from '../src/services/opportunityIntakeService'

localPersistenceService.clearAllOneCompanyLocalState()

const seeded = opportunityService.listOpportunities()
assert.equal(seeded.length >= 5, true, 'opportunity service should seed from local persistence')
assert.equal(localPersistenceService.getItem(localStateKeys.opportunities, []).length >= 5, true)

const created = opportunityService.createOpportunity({
  source: 'manual',
  title: 'Persisted automation lead',
  companyName: 'Persist Co',
  contactHint: 'founder@example.com',
  painPoint: 'Manual report cleanup needs automation dashboard',
  estimatedBudget: 12000,
  urgency: 'high',
  fitScore: 0,
  riskScore: 0,
  suggestedOffer: '',
  ownerAgentId: '',
  status: 'discovered',
  evidenceUrl: 'https://example.com/persisted',
})
assert.equal(opportunityService.getOpportunityById(created.id)?.title, 'Persisted automation lead')
assert.equal(localPersistenceService.getItem(localStateKeys.opportunities, []).some((item: any) => item.id === created.id), true)

const rawText = '\u67d0\u4ed3\u50a8\u56e2\u961f\u6bcf\u5929\u4eba\u5de5\u6574\u7406\u5e93\u5b58\u62a5\u8868\uff0c\u9700\u8981\u505a\u81ea\u52a8\u5316\u770b\u677f\u548c\u5f02\u5e38\u63d0\u9192\uff0c\u9884\u7b97\u7ea6 2 \u4e07\uff0c\u6708\u5e95\u524d\u60f3\u4e0a\u7ebf\u3002\u8054\u7cfb\u4eba\u5fae\u4fe1 warehouse_ops'
const draft = opportunityIntakeService.parseTextToOpportunityDraft(rawText)
assert.match(draft.painPoint, /\u5e93\u5b58|\u81ea\u52a8\u5316|\u62a5\u8868/)
assert.equal(draft.estimatedBudget, 20000)
assert.ok(draft.recommendedOfferId, 'draft should include recommended offer id')
assert.equal(draft.status === 'parsed' || draft.status === 'needs_review', true)
assert.equal(opportunityIntakeService.getIntakeSummary().totalRecords >= 1, true)

const urlDraft = opportunityIntakeService.parseUrlToOpportunityDraft('https://example.com/post/1')
assert.equal(urlDraft.status, 'needs_review')
assert.equal(urlDraft.evidenceUrl, 'https://example.com/post/1')
assert.ok(urlDraft.missingFields.includes('rawText'))

const csvDrafts = opportunityIntakeService.parseCsvToOpportunityDrafts([
  'title,companyName,contactHint,painPoint,estimatedBudget,sourceUrl,source,urgency',
  'Customer automation,A Co,wx_a,Customer service repeat questions,1999,https://example.com/a,wechat,high',
  'Warehouse dashboard,B Co,,Manual inventory report,20000,https://example.com/b,manual,medium',
].join('\n'))
assert.equal(csvDrafts.length, 2)
assert.equal(csvDrafts[0].companyName, 'A Co')

const imported = opportunityIntakeService.approveDraftToOpportunity(draft.id)
assert.equal(imported.draft.status, 'imported')
assert.equal(opportunityService.getOpportunityById(imported.opportunity.id)?.id, imported.opportunity.id)

const rejected = opportunityIntakeService.rejectOpportunityDraft(csvDrafts[0].id, 'not relevant')
assert.equal(rejected.status, 'rejected')

const exported = localPersistenceService.exportAllOneCompanyLocalState()
assert.ok(exported[localStateKeys.opportunities], 'export should include opportunities')
assert.ok(exported[localStateKeys.opportunityDrafts], 'export should include opportunity_drafts')
assert.ok(exported[localStateKeys.opportunityIntakeRecords], 'export should include opportunity_intake_records')

console.log('opportunity intake service tests passed')
