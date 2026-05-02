import type {
  Opportunity,
  OpportunityDraft,
  OpportunityIntakeRecord,
  OpportunityIntakeRecordStatus,
  OpportunityIntakeSource,
  OpportunitySource,
} from '../types'
import { ceoActionBoundaryService } from './ceoActionBoundaryService'
import { localPersistenceService, localStateKeys } from './localPersistenceService'
import { offerCatalogService } from './offerCatalogService'
import { opportunityService } from './opportunityService'

type ParseOptions = {
  source?: OpportunitySource | OpportunityIntakeSource
  sourceUrl?: string
  intakeRecordId?: string
}

type IntakeInput = {
  sourceType: OpportunityIntakeSource
  sourceUrl?: string
  rawInput: string
  parsedDraftIds?: string[]
  status?: OpportunityIntakeRecordStatus
}

const validOpportunitySources: OpportunitySource[] = ['xiaohongshu', 'douyin', 'bilibili', 'wechat', 'tender', 'job_site', 'manual', 'other']
const validUrgencies: Opportunity['urgency'][] = ['low', 'medium', 'high']

let localDrafts: OpportunityDraft[] = localPersistenceService.getOrSeed(localStateKeys.opportunityDrafts, [] as OpportunityDraft[])
let localRecords: OpportunityIntakeRecord[] = localPersistenceService.getOrSeed(localStateKeys.opportunityIntakeRecords, [] as OpportunityIntakeRecord[])

function nowStamp() {
  return new Date().toISOString()
}

function idStamp(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function refreshDrafts() {
  localDrafts = localPersistenceService.getOrSeed(localStateKeys.opportunityDrafts, [] as OpportunityDraft[])
  return localDrafts
}

function persistDrafts(drafts: OpportunityDraft[]) {
  localDrafts = localPersistenceService.setItem(localStateKeys.opportunityDrafts, drafts)
  return localDrafts
}

function refreshRecords() {
  localRecords = localPersistenceService.getOrSeed(localStateKeys.opportunityIntakeRecords, [] as OpportunityIntakeRecord[])
  return localRecords
}

function persistRecords(records: OpportunityIntakeRecord[]) {
  localRecords = localPersistenceService.setItem(localStateKeys.opportunityIntakeRecords, records)
  return localRecords
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function normalizeSpace(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function splitSentences(text: string) {
  return text
    .split(/[。！？!?；;\n\r]+/)
    .map(normalizeSpace)
    .filter(Boolean)
}

function extractTitle(rawText: string) {
  const firstLine = rawText.split(/\r?\n/).map(normalizeSpace).find(Boolean)
  const fallback = normalizeSpace(rawText).slice(0, 42)
  return (firstLine || fallback || '待补充项目机会').slice(0, 80)
}

function extractCompanyName(rawText: string) {
  const patterns = [
    /([\u4e00-\u9fa5A-Za-z0-9_-]{2,24})(?:公司|企业|团队|部门|店铺|客户)/,
    /(?:公司|企业|团队|部门|店铺|客户)[:：\s]*([\u4e00-\u9fa5A-Za-z0-9_-]{2,32})/,
    /([A-Z][A-Za-z0-9\s&-]{1,32})(?:\s+Co|\s+Company|\s+Team)/,
  ]
  for (const pattern of patterns) {
    const match = rawText.match(pattern)
    if (match?.[1]) return normalizeSpace(match[1])
  }
  return ''
}

function extractContactHint(rawText: string) {
  const email = rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
  const phone = rawText.match(/(?:\+?86[-\s]?)?1[3-9]\d{9}/)?.[0]
  const wechat = rawText.match(/(?:微信|wechat|wx)[:：\s]*([A-Za-z0-9_-]{4,32})/i)?.[0]
  const contact = rawText.match(/(?:联系人|联系|contact)[:：\s]*([\u4e00-\u9fa5A-Za-z0-9_\-@\s.]{2,40})/i)?.[0]
  return normalizeSpace(email || phone || wechat || contact || '')
}

function extractPainPoint(rawText: string) {
  const keywords = ['痛点', '问题', '麻烦', '低效', '人工', '报表', '客服', '仓库', '仓储', '库存', '数据', '自动化', 'AI', '系统', '流程', 'dashboard', 'automation', 'manual', 'report', 'customer service']
  const sentences = splitSentences(rawText)
  const hit = sentences.find(sentence => keywords.some(keyword => sentence.toLowerCase().includes(keyword.toLowerCase())))
  return hit || normalizeSpace(rawText).slice(0, 120)
}

function extractBudget(rawText: string) {
  const wanMatch = rawText.match(/(?:预算|报价|金额|price|budget)?[^\d]{0,8}(\d+(?:\.\d+)?)\s*(?:万|w)/i)
  if (wanMatch?.[1]) return Math.round(Number(wanMatch[1]) * 10000)
  const yuanMatch = rawText.match(/(?:预算|报价|金额|price|budget)?[^\d]{0,8}(\d{3,7})\s*(?:元|rmb|cny|¥)?/i)
  if (yuanMatch?.[1]) return Number(yuanMatch[1])
  return 0
}

function extractUrgency(rawText: string): Opportunity['urgency'] {
  if (/紧急|尽快|本周|月底|马上|近期|today|urgent|asap|this week/i.test(rawText)) return 'high'
  if (/下月|本月|计划|soon|next month/i.test(rawText)) return 'medium'
  return 'low'
}

function normalizeOpportunitySource(source: OpportunitySource | OpportunityIntakeSource | undefined): OpportunitySource {
  return validOpportunitySources.includes(source as OpportunitySource) ? source as OpportunitySource : 'manual'
}

function normalizeIntakeSource(source: OpportunitySource | OpportunityIntakeSource | undefined): OpportunityIntakeSource {
  if (source === 'url' || source === 'csv' || source === 'manual' || source === 'other') return source
  return 'pasted_text'
}

function buildMissingFields(draft: Pick<OpportunityDraft, 'companyName' | 'contactHint' | 'painPoint' | 'estimatedBudget' | 'title'>) {
  const missing: string[] = []
  if (!draft.title) missing.push('title')
  if (!draft.companyName) missing.push('companyName')
  if (!draft.contactHint) missing.push('contactHint')
  if (!draft.painPoint) missing.push('painPoint')
  if (!draft.estimatedBudget) missing.push('budget')
  return missing
}

function calculateConfidence(missingFields: string[], hasUrl: boolean) {
  const score = 100 - missingFields.length * 16 + (hasUrl ? 6 : 0)
  return Math.max(20, Math.min(100, Math.round(score)))
}

function calculateRisk(rawText: string, missingFields: string[], estimatedBudget: number) {
  const risky = /退款|合同|保底|担保|发票|法律|群发|私信|refund|contract|guarantee|invoice|legal/i.test(rawText) ? 18 : 0
  const budgetRisk = estimatedBudget >= 50000 ? 18 : estimatedBudget === 0 ? 10 : 0
  return Math.min(100, 12 + missingFields.length * 8 + risky + budgetRisk)
}

function upsertDraft(draft: OpportunityDraft) {
  persistDrafts([draft, ...refreshDrafts().filter(item => item.id !== draft.id)])
  return draft
}

function updateRecordDrafts(recordId: string | undefined, draftIds: string[], status: OpportunityIntakeRecordStatus) {
  if (!recordId) return
  const records = refreshRecords().map(record => {
    if (record.id !== recordId) return record
    return {
      ...record,
      parsedDraftIds: uniqueValues([...record.parsedDraftIds, ...draftIds]),
      status,
      updatedAt: nowStamp(),
    }
  })
  persistRecords(records)
}

export function createIntakeRecord(input: IntakeInput): OpportunityIntakeRecord {
  const timestamp = nowStamp()
  const record: OpportunityIntakeRecord = {
    id: idStamp('intake'),
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl ?? '',
    rawInput: input.rawInput,
    parsedDraftIds: input.parsedDraftIds ?? [],
    status: input.status ?? 'received',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  persistRecords([record, ...refreshRecords()])
  return record
}

export function parseTextToOpportunityDraft(rawText: string, options: ParseOptions = {}): OpportunityDraft {
  const record = options.intakeRecordId
    ? undefined
    : createIntakeRecord({
      sourceType: normalizeIntakeSource(options.source),
      sourceUrl: options.sourceUrl,
      rawInput: rawText,
      status: 'received',
    })
  const intakeRecordId = options.intakeRecordId ?? record?.id

  ceoActionBoundaryService.evaluateAction({
    actionType: 'scan_opportunity',
    sourceModule: 'opportunity',
    sourceId: options.sourceUrl ?? 'manual_text',
    title: 'Parse external opportunity text',
    description: rawText.slice(0, 180),
    amount: 0,
    customerName: '',
    relatedOfferId: '',
    relatedWorkflowRunId: '',
    requestedByAgentId: 'jarvis',
    metadata: { source: options.source ?? 'pasted_text' },
  })

  const timestamp = nowStamp()
  const source = options.source ?? 'pasted_text'
  const opportunitySource = normalizeOpportunitySource(source)
  const title = extractTitle(rawText)
  const companyName = extractCompanyName(rawText)
  const contactHint = extractContactHint(rawText)
  const painPoint = extractPainPoint(rawText)
  const estimatedBudget = extractBudget(rawText)
  const urgency = extractUrgency(rawText)
  const missingFields = buildMissingFields({ title, companyName, contactHint, painPoint, estimatedBudget })
  const riskScore = calculateRisk(rawText, missingFields, estimatedBudget)

  const scored = opportunityService.scoreOpportunity({
    id: 'draft',
    source: opportunitySource,
    title,
    companyName,
    contactHint,
    painPoint,
    estimatedBudget,
    urgency,
    fitScore: 0,
    riskScore,
    suggestedOffer: '',
    ownerAgentId: '',
    status: 'discovered',
    evidenceUrl: options.sourceUrl ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  const offerMatch = offerCatalogService.matchOfferByOpportunity(scored)
  const draft: OpportunityDraft = {
    id: idStamp('draft'),
    rawText,
    source,
    sourceUrl: options.sourceUrl ?? '',
    title,
    companyName,
    contactHint,
    painPoint,
    estimatedBudget,
    urgency,
    fitScore: scored.fitScore,
    riskScore,
    suggestedOffer: offerMatch.offer.name,
    recommendedOfferId: offerMatch.offer.id,
    matchReason: offerMatch.matchReason,
    ownerAgentId: scored.ownerAgentId,
    evidenceUrl: options.sourceUrl ?? '',
    parseConfidence: calculateConfidence(missingFields, Boolean(options.sourceUrl)),
    missingFields,
    status: missingFields.length > 0 ? 'needs_review' : 'parsed',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  upsertDraft(draft)
  updateRecordDrafts(intakeRecordId, [draft.id], draft.status === 'parsed' ? 'parsed' : 'partially_parsed')
  return draft
}

export function parseUrlToOpportunityDraft(url: string, rawText = ''): OpportunityDraft {
  const record = createIntakeRecord({
    sourceType: 'url',
    sourceUrl: url,
    rawInput: rawText || url,
    status: 'received',
  })
  if (rawText.trim()) {
    return parseTextToOpportunityDraft(rawText, { source: 'url', sourceUrl: url, intakeRecordId: record.id })
  }
  const timestamp = nowStamp()
  const draft: OpportunityDraft = {
    id: idStamp('draft'),
    rawText: '',
    source: 'url',
    sourceUrl: url,
    title: 'URL 机会待补充',
    companyName: '',
    contactHint: '',
    painPoint: '需要补充 URL 对应的需求描述后再解析。',
    estimatedBudget: 0,
    urgency: 'low',
    fitScore: 0,
    riskScore: 35,
    suggestedOffer: '',
    recommendedOfferId: '',
    matchReason: '仅记录 URL，不抓取网页内容。',
    ownerAgentId: 'fred',
    evidenceUrl: url,
    parseConfidence: 20,
    missingFields: ['rawText', 'companyName', 'contactHint', 'budget'],
    status: 'needs_review',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  upsertDraft(draft)
  updateRecordDrafts(record.id, [draft.id], 'partially_parsed')
  return draft
}

function splitCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

export function parseCsvToOpportunityDrafts(csvText: string): OpportunityDraft[] {
  const record = createIntakeRecord({ sourceType: 'csv', rawInput: csvText, status: 'received' })
  const lines = csvText.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (lines.length <= 1) {
    persistRecords(refreshRecords().map(item => item.id === record.id ? { ...item, status: 'failed', updatedAt: nowStamp() } : item))
    return []
  }

  const headers = splitCsvLine(lines[0]).map(header => header.trim())
  const drafts = lines.slice(1).map(line => {
    const cells = splitCsvLine(line)
    const row = headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = cells[index] ?? ''
      return acc
    }, {})
    const raw = [
      row.title,
      row.companyName,
      row.contactHint,
      row.painPoint,
      row.estimatedBudget ? `budget ${row.estimatedBudget}` : '',
    ].filter(Boolean).join('\n')
    const draft = parseTextToOpportunityDraft(raw || line, {
      source: validOpportunitySources.includes(row.source as OpportunitySource) ? row.source as OpportunitySource : 'csv',
      sourceUrl: row.sourceUrl,
      intakeRecordId: record.id,
    })
    const urgency = validUrgencies.includes(row.urgency as Opportunity['urgency']) ? row.urgency as Opportunity['urgency'] : draft.urgency
    const updated: OpportunityDraft = {
      ...draft,
      title: row.title || draft.title,
      companyName: row.companyName || draft.companyName,
      contactHint: row.contactHint || draft.contactHint,
      painPoint: row.painPoint || draft.painPoint,
      estimatedBudget: row.estimatedBudget ? extractBudget(row.estimatedBudget) || Number(row.estimatedBudget) || draft.estimatedBudget : draft.estimatedBudget,
      sourceUrl: row.sourceUrl || draft.sourceUrl,
      evidenceUrl: row.sourceUrl || draft.evidenceUrl,
      urgency,
      updatedAt: nowStamp(),
    }
    const missingFields = buildMissingFields(updated)
    const rescored = opportunityService.scoreOpportunity({
      id: 'draft',
      source: normalizeOpportunitySource(updated.source),
      title: updated.title,
      companyName: updated.companyName,
      contactHint: updated.contactHint,
      painPoint: updated.painPoint,
      estimatedBudget: updated.estimatedBudget,
      urgency: updated.urgency,
      fitScore: 0,
      riskScore: updated.riskScore,
      suggestedOffer: updated.suggestedOffer,
      ownerAgentId: updated.ownerAgentId,
      status: 'discovered',
      evidenceUrl: updated.evidenceUrl,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    })
    const offerMatch = offerCatalogService.matchOfferByOpportunity(rescored)
    return upsertDraft({
      ...updated,
      fitScore: rescored.fitScore,
      riskScore: calculateRisk(raw || line, missingFields, updated.estimatedBudget),
      ownerAgentId: rescored.ownerAgentId,
      suggestedOffer: offerMatch.offer.name,
      recommendedOfferId: offerMatch.offer.id,
      matchReason: offerMatch.matchReason,
      missingFields,
      parseConfidence: calculateConfidence(missingFields, Boolean(updated.evidenceUrl)),
      status: missingFields.length > 0 ? 'needs_review' : 'parsed',
    })
  })
  updateRecordDrafts(record.id, drafts.map(draft => draft.id), drafts.every(draft => draft.status === 'parsed') ? 'parsed' : 'partially_parsed')
  return drafts
}

export function listOpportunityDrafts(): OpportunityDraft[] {
  return [...refreshDrafts()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getOpportunityDraftById(id: string): OpportunityDraft | undefined {
  return listOpportunityDrafts().find(draft => draft.id === id)
}

export function updateOpportunityDraft(draftId: string, partial: Partial<OpportunityDraft>): OpportunityDraft | undefined {
  let updated: OpportunityDraft | undefined
  const next = refreshDrafts().map(draft => {
    if (draft.id !== draftId) return draft
    updated = { ...draft, ...partial, id: draft.id, updatedAt: nowStamp() }
    return updated
  })
  if (updated) persistDrafts(next)
  return updated
}

export function approveDraftToOpportunity(draftId: string): { draft: OpportunityDraft; opportunity: Opportunity } {
  const draft = getOpportunityDraftById(draftId)
  if (!draft) throw new Error(`Opportunity draft not found: ${draftId}`)
  ceoActionBoundaryService.assertActionAllowed({
    actionType: 'update_internal_status',
    sourceModule: 'opportunity',
    sourceId: draft.id,
    title: `Import opportunity draft: ${draft.title}`,
    description: draft.painPoint,
    amount: draft.estimatedBudget,
    customerName: draft.companyName,
    relatedOfferId: draft.recommendedOfferId,
    relatedWorkflowRunId: '',
    requestedByAgentId: draft.ownerAgentId || 'jarvis',
    metadata: { target: 'opportunity' },
  })
  const opportunity = opportunityService.createOpportunity({
    source: normalizeOpportunitySource(draft.source),
    title: draft.title,
    companyName: draft.companyName || 'Unknown customer',
    contactHint: draft.contactHint,
    painPoint: draft.painPoint,
    estimatedBudget: draft.estimatedBudget,
    urgency: draft.urgency,
    fitScore: draft.fitScore,
    riskScore: draft.riskScore,
    suggestedOffer: draft.suggestedOffer,
    ownerAgentId: draft.ownerAgentId || 'fred',
    status: 'discovered',
    evidenceUrl: draft.evidenceUrl || draft.sourceUrl,
  })
  const importedDraft = updateOpportunityDraft(draft.id, { status: 'imported' }) ?? draft
  const draftIds = [draft.id]
  persistRecords(refreshRecords().map(record => {
    if (!record.parsedDraftIds.some(id => draftIds.includes(id))) return record
    return { ...record, status: 'imported', updatedAt: nowStamp() }
  }))
  return { draft: importedDraft, opportunity }
}

export function rejectOpportunityDraft(draftId: string, reason = ''): OpportunityDraft {
  const draft = updateOpportunityDraft(draftId, {
    status: 'rejected',
    matchReason: reason ? `${getOpportunityDraftById(draftId)?.matchReason ?? ''} Rejected: ${reason}` : getOpportunityDraftById(draftId)?.matchReason,
  })
  if (!draft) throw new Error(`Opportunity draft not found: ${draftId}`)
  return draft
}

export function listIntakeRecords(): OpportunityIntakeRecord[] {
  return [...refreshRecords()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getIntakeSummary() {
  const drafts = listOpportunityDrafts()
  const records = listIntakeRecords()
  const confidenceTotal = drafts.reduce((sum, draft) => sum + draft.parseConfidence, 0)
  return {
    totalRecords: records.length,
    draftCount: drafts.length,
    reviewCount: drafts.filter(draft => draft.status === 'needs_review' || draft.status === 'parsed').length,
    importedCount: drafts.filter(draft => draft.status === 'imported').length,
    rejectedCount: drafts.filter(draft => draft.status === 'rejected').length,
    averageParseConfidence: drafts.length ? Math.round(confidenceTotal / drafts.length) : 0,
  }
}

export function resetOpportunityIntakeState() {
  persistDrafts([])
  persistRecords([])
}

export function exportOpportunityIntakeState() {
  return {
    drafts: listOpportunityDrafts(),
    records: listIntakeRecords(),
  }
}

export const opportunityIntakeService = {
  parseTextToOpportunityDraft,
  parseUrlToOpportunityDraft,
  parseCsvToOpportunityDrafts,
  listOpportunityDrafts,
  getOpportunityDraftById,
  approveDraftToOpportunity,
  rejectOpportunityDraft,
  updateOpportunityDraft,
  listIntakeRecords,
  createIntakeRecord,
  getIntakeSummary,
  resetOpportunityIntakeState,
  exportOpportunityIntakeState,
}
