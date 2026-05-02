import salesLeadSeed from '../../../config/sales-leads.json'
import type { SalesLead, SalesLeadStage } from '../types'
import { offerCatalogService } from './offerCatalogService'
import { localPersistenceService, localStateKeys } from './localPersistenceService'
import { opportunityService } from './opportunityService'

type SalesLeadFile = {
  leads: SalesLead[]
}

const seedData = salesLeadSeed as SalesLeadFile
const stageLabels: Record<SalesLeadStage, string> = {
  discovered: '已发现',
  qualified: '已确认',
  diagnosis: '诊断中',
  proposal: '方案中',
  quote_review: '报价审批',
  payment_pending: '待收款',
  won: '已成交',
  lost: '已丢单',
}

const nextActions: Record<SalesLeadStage, string> = {
  discovered: '补充客户背景和痛点',
  qualified: '生成需求诊断问题',
  diagnosis: '生成初步方案',
  proposal: '生成报价草稿',
  quote_review: '提交 CEO 审批正式报价',
  payment_pending: '等待 CEO 确认收款',
  won: '创建交付工作流',
  lost: '记录丢单原因并复盘',
}

const seedLeads = seedData.leads.map(normalizeLead)
let localLeads: SalesLead[] = localPersistenceService.getOrSeed(localStateKeys.salesLeads, seedLeads).map(normalizeLead)

function today() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeLead(lead: SalesLead): SalesLead {
  return {
    ...lead,
    nextAction: getNextAction(lead),
    requiresCeoApproval: checkApprovalRequired(lead),
    approvalReason: checkApprovalRequired(lead)
      ? lead.approvalReason || getStageRiskHint(lead) || '该动作需要 CEO 审批'
      : '',
  }
}

export function listSalesLeads(): SalesLead[] {
  localLeads = localPersistenceService.getOrSeed(localStateKeys.salesLeads, seedLeads).map(normalizeLead)
  return localLeads.map(normalizeLead)
}

export function getSalesLeadById(id: string): SalesLead | undefined {
  return listSalesLeads().find(lead => lead.id === id)
}

export function createSalesLeadFromOpportunity(opportunityId: string): { lead: SalesLead; created: boolean; message: string } {
  const existing = listSalesLeads().find(lead => lead.opportunityId === opportunityId)
  if (existing) {
    return { lead: existing, created: false, message: '该项目机会已存在销售线索，未重复创建' }
  }

  const opportunity = opportunityService.getOpportunityById(opportunityId)
  if (!opportunity) {
    throw new Error(`Opportunity not found: ${opportunityId}`)
  }

  const offerMatch = offerCatalogService.matchOfferByOpportunity(opportunity)
  const stage: SalesLeadStage = 'qualified'
  const lead = normalizeLead({
    id: `lead_${opportunity.id}`,
    opportunityId: opportunity.id,
    customerName: opportunity.companyName,
    contactHint: opportunity.contactHint,
    painPoint: opportunity.painPoint,
    stage,
    valueEstimate: offerMatch.offer.price || opportunity.estimatedBudget,
    recommendedOfferId: offerMatch.offer.id,
    nextAction: nextActions[stage],
    ownerAgentId: opportunity.ownerAgentId,
    requiresCeoApproval: false,
    approvalReason: '',
    createdAt: today(),
    updatedAt: today(),
  })

  localLeads = [lead, ...localLeads]
  localPersistenceService.setItem(localStateKeys.salesLeads, localLeads)
  return { lead, created: true, message: '已转为销售线索' }
}

export function updateSalesLeadStage(leadId: string, stage: SalesLeadStage): SalesLead | undefined {
  let updated: SalesLead | undefined
  localLeads = localLeads.map(lead => {
    if (lead.id !== leadId) return lead
    updated = normalizeLead({
      ...lead,
      stage,
      updatedAt: today(),
    })
    return updated
  })
  if (updated) localPersistenceService.setItem(localStateKeys.salesLeads, localLeads)
  return updated
}

export function getNextAction(lead: Pick<SalesLead, 'stage'>): string {
  return nextActions[lead.stage]
}

export function checkApprovalRequired(lead: Pick<SalesLead, 'stage'>): boolean {
  return lead.stage === 'quote_review' || lead.stage === 'payment_pending' || lead.stage === 'won'
}

export function getStageLabel(stage: SalesLeadStage): string {
  return stageLabels[stage]
}

export function getStageRiskHint(lead: Pick<SalesLead, 'stage'>): string {
  if (lead.stage === 'quote_review') return '正式报价前必须 CEO 审批'
  if (lead.stage === 'payment_pending') return '不得自动确认收款'
  if (lead.stage === 'won') return '成交必须基于已确认付款或 CEO 明确确认'
  return ''
}

export function resetSalesPipelineMockStateForTest() {
  resetSalesLeadsToSeed()
}

export function resetSalesLeadsToSeed() {
  localLeads = seedLeads.map(normalizeLead)
  localPersistenceService.setItem(localStateKeys.salesLeads, localLeads)
}

export function exportSalesLeads(): SalesLead[] {
  return listSalesLeads()
}

export const salesPipelineService = {
  listSalesLeads,
  getSalesLeadById,
  createSalesLeadFromOpportunity,
  updateSalesLeadStage,
  getNextAction,
  checkApprovalRequired,
  getStageLabel,
  getStageRiskHint,
  resetSalesPipelineMockStateForTest,
  resetSalesLeadsToSeed,
  exportSalesLeads,
}
