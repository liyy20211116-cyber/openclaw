export type AgentStatus = 'idle' | 'busy' | 'review' | 'frozen'
export type TaskStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'in_progress'
  | 'review'
  | 'completed'
  | 'frozen'
  | 'rejected'

export type TaskTimelineEventType = 'created' | 'resubmitted' | 'approval_requested' | 'approved' | 'rejected' | 'start' | 'approve' | 'complete'

export interface TaskTimelineEvent {
  id: string
  type: TaskTimelineEventType
  submissionIndex: number
  actor: string
  note: string
  createdAt: string
}

export type PerformanceGrade = 'S' | 'A' | 'B' | 'C' | 'D'

export type CommercialDimensionKey =
  | 'autonomy'
  | 'revenue_contribution'
  | 'intelligence'
  | 'execution'
  | 'productization'

export interface CommercialReadinessBreakdown {
  autonomy: number
  revenue_contribution: number
  intelligence: number
  execution: number
  productization: number
}

export interface AgentCommercialReadiness {
  agentId: string
  name: string
  score: number
  grade: PerformanceGrade
  breakdown: CommercialReadinessBreakdown
  dimensionPercentages: Record<CommercialDimensionKey, number>
  improvementAreas: CommercialDimensionKey[]
  summary: string
}

export interface CommercialReadinessSummary {
  count: number
  avgScore: number
  grade: PerformanceGrade
  companyReadinessScore: number
  companyReadinessGrade: PerformanceGrade
  topPerformer: string
  gradeDistribution: Record<PerformanceGrade, number>
  dimensionAverages: CommercialReadinessBreakdown
}

export interface PerformanceBreakdown {
  completeness?: number
  skills?: number
  memory_activity?: number
  scripts?: number
  growth?: number
  task_completion?: number
  budget_discipline?: number
  compliance_delta?: number
  revenue_contribution?: number
  [key: string]: number | undefined
}

export interface PerformanceHistoryPoint {
  id: string
  reviewedAt: string
  score: number
  grade: PerformanceGrade
  reviewer: string
  version: string
}

export interface AgentPerformance {
  score: number
  grade: PerformanceGrade
  breakdown: PerformanceBreakdown
  improvementAreas: string[]
  reviewedAt: string
  reviewer: string
}

export interface Agent {
  id: string
  name: string
  role: string
  department: string
  persona: string
  status: AgentStatus
  walletBalance: number
  currentTasks: number
  complianceScore: number
  goals: string[]
  performance?: AgentPerformance
}

export interface PerformanceSummary {
  reviewDate: string
  totalAgents: number
  avgScore: number
  gradeDistribution: Record<PerformanceGrade, number>
  topPerformer: string
  needsAttention: string[]
}

export interface TaskItem {
  id: string
  title: string
  owner: string
  ownerAgentId?: string
  description?: string
  taskType?: 'ops' | 'tech' | 'growth' | 'finance' | 'audit' | 'product' | 'sales' | 'customer'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: TaskStatus
  budgetToken: number
  spentToken: number
  dueAt: string
  requiresApproval?: boolean
  resubmissionCount?: number
  latestRejectionNote?: string
  latestRejectionAt?: string
  timeline?: TaskTimelineEvent[]
}

export interface ApprovalItem {
  id: string
  requester: string
  targetId?: string
  targetTitle: string
  amount: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  resubmissionCount?: number
  latestDecisionNote?: string
  latestRejectionNote?: string
}

export interface LedgerItem {
  id: string
  type: 'salary' | 'budget' | 'reward' | 'purchase' | 'revenue_mapping' | 'revenue_share'
  actor: string
  amount: number
  note: string
  createdAt: string
}

export interface RevenueItem {
  id: string
  title: string
  businessLine: string
  sourceTask: string
  amount: number
  tokenMapped: number
  roi: number
}

export type OpportunitySource =
  | 'xiaohongshu'
  | 'douyin'
  | 'bilibili'
  | 'wechat'
  | 'tender'
  | 'job_site'
  | 'manual'
  | 'other'

export type OpportunityStatus =
  | 'discovered'
  | 'qualified'
  | 'contact_draft'
  | 'contacted'
  | 'proposal'
  | 'won'
  | 'lost'

export interface Opportunity {
  id: string
  source: OpportunitySource
  title: string
  companyName: string
  contactHint: string
  painPoint: string
  estimatedBudget: number
  urgency: 'low' | 'medium' | 'high'
  fitScore: number
  riskScore: number
  suggestedOffer: string
  ownerAgentId: string
  status: OpportunityStatus
  evidenceUrl: string
  createdAt: string
  updatedAt: string
}

export type OpportunityDraftStatus = 'parsed' | 'needs_review' | 'approved' | 'rejected' | 'imported'

export type OpportunityIntakeSource = 'pasted_text' | 'url' | 'csv' | 'manual' | 'other'

export interface OpportunityDraft {
  id: string
  rawText: string
  source: OpportunitySource | OpportunityIntakeSource
  sourceUrl: string
  title: string
  companyName: string
  contactHint: string
  painPoint: string
  estimatedBudget: number
  urgency: 'low' | 'medium' | 'high'
  fitScore: number
  riskScore: number
  suggestedOffer: string
  recommendedOfferId: string
  matchReason: string
  ownerAgentId: string
  evidenceUrl: string
  parseConfidence: number
  missingFields: string[]
  status: OpportunityDraftStatus
  createdAt: string
  updatedAt: string
}

export type OpportunityIntakeRecordStatus = 'received' | 'parsed' | 'partially_parsed' | 'failed' | 'imported'

export interface OpportunityIntakeRecord {
  id: string
  sourceType: OpportunityIntakeSource
  sourceUrl: string
  rawInput: string
  parsedDraftIds: string[]
  status: OpportunityIntakeRecordStatus
  createdAt: string
  updatedAt: string
}

export interface Offer {
  id: string
  name: string
  price: number
  targetCustomer: string
  deliveryCycle: string
  description: string
  painPointTags: string[]
  deliverables: string[]
  requiresCeoQuoteApproval: boolean
  deliveryWorkflowId: string
}

export interface OfferMatch {
  offer: Offer
  matchReason: string
  score: number
}

export type SalesLeadStage =
  | 'discovered'
  | 'qualified'
  | 'diagnosis'
  | 'proposal'
  | 'quote_review'
  | 'payment_pending'
  | 'won'
  | 'lost'

export interface SalesLead {
  id: string
  opportunityId: string
  customerName: string
  contactHint: string
  painPoint: string
  stage: SalesLeadStage
  valueEstimate: number
  recommendedOfferId: string
  nextAction: string
  ownerAgentId: string
  requiresCeoApproval: boolean
  approvalReason: string
  createdAt: string
  updatedAt: string
}

export type RevenueStatus =
  | 'expected'
  | 'quoted'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'delivery_started'
  | 'delivered'
  | 'recognized'
  | 'refunded'

export type RevenueSourceType = 'opportunity' | 'sales_lead' | 'workflow' | 'manual' | 'external'

export interface RevenueRecord {
  id: string
  sourceType: RevenueSourceType
  sourceId: string
  customerName: string
  offerId: string
  offerName: string
  amount: number
  status: RevenueStatus
  paymentEvidence: string
  confirmedBy: string
  confirmedAt: string
  deliveryWorkflowRunId: string
  notes: string
  requiresCeoApproval: boolean
  approvalReason: string
  createdAt: string
  updatedAt: string
}

export interface RevenueConfirmationSummary {
  expectedRevenue: number
  paymentPending: number
  confirmedCash: number
  recognizedRevenue: number
  refunded: number
  requiresCeoApprovalCount: number
  totalRecords: number
}

export type DailyRunStatus = 'not_started' | 'running' | 'incomplete' | 'completed' | 'blocked'
export type DailyRunArtifactStatus = 'missing' | 'draft' | 'completed' | 'blocked'
export type DailyRunSourceModule = 'opportunity' | 'sales' | 'workflow' | 'revenue' | 'audit' | 'content' | 'runtime' | 'manual'

export interface DailyRunArtifact {
  key: string
  label: string
  ownerAgentId: string
  status: DailyRunArtifactStatus
  description: string
  sourceModule: DailyRunSourceModule
  completedAt: string
  evidence: string
}

export interface DailyAgentReport {
  agentId: string
  agentName: string
  role: string
  todayFocus: string
  completedItems: string[]
  blockedItems: string[]
  suggestedNextActions: string[]
  riskNotes: string[]
}

export interface DailyOpportunitySummary {
  totalOpportunities: number
  todayNewOpportunities: number
  highFitOpportunities: number
  needsCeoDecision: number
}

export interface DailySalesSummary {
  totalLeads: number
  quoteReviewCount: number
  paymentPendingCount: number
  wonCount: number
  lostCount: number
  pipelineValue: number
}

export interface DailyWorkflowSummary {
  totalRuns: number
  runningRuns: number
  waitingApprovalRuns: number
  completedRuns: number
  failedRuns: number
}

export interface DailyRevenueSummary {
  expectedRevenue: number
  pendingPayment: number
  confirmedCash: number
  recognizedRevenue: number
  refundedRevenue: number
  needsCeoApproval: number
}

export interface DailyRiskSummary {
  totalRisks: number
  blockingRisks: number
  ceoApprovalRequiredCount: number
  riskNotes: string[]
}

export interface DailyRun {
  id: string
  date: string
  status: DailyRunStatus
  artifacts: DailyRunArtifact[]
  agentReports: DailyAgentReport[]
  opportunitySummary: DailyOpportunitySummary
  salesSummary: DailySalesSummary
  workflowSummary: DailyWorkflowSummary
  revenueSummary: DailyRevenueSummary
  riskSummary: DailyRiskSummary
  jarvisStandup: string
  completionRate: number
  createdAt: string
  updatedAt: string
}

export interface DailyApprovalSummary {
  totalApprovals: number
  pendingApprovals: number
  approvedApprovals: number
  rejectedApprovals: number
  a3PendingCount: number
  a4PendingCount: number
  highRiskApprovalCount: number
  latestApprovalTitles: string[]
}

export interface DailyRunLog {
  id: string
  runDate: string
  generatedAt: string
  generatedBy: 'manual' | 'system' | 'jarvis'
  status: DailyRunStatus
  completionRate: number
  healthStatus: 'healthy' | 'attention' | 'blocked'
  dailyRunId: string
  opportunitySummary: DailyOpportunitySummary
  salesSummary: DailySalesSummary
  workflowSummary: DailyWorkflowSummary
  revenueSummary: DailyRevenueSummary
  riskSummary: DailyRiskSummary
  approvalSummary: DailyApprovalSummary
  artifacts: DailyRunArtifact[]
  jarvisStandup: string
  agentReports: DailyAgentReport[]
  notes: string
  snapshotVersion: string
}

export type ActionLevel =
  | 'A0_READ_ONLY'
  | 'A1_INTERNAL_DRAFT'
  | 'A2_INTERNAL_WRITE'
  | 'A3_EXTERNAL_ACTION'
  | 'A4_FINANCIAL_LEGAL'

export type ActionType =
  | 'scan_opportunity'
  | 'score_lead'
  | 'match_offer'
  | 'generate_draft'
  | 'generate_proposal_draft'
  | 'generate_quote_draft'
  | 'create_internal_task'
  | 'create_workflow_run'
  | 'update_internal_status'
  | 'generate_daily_report'
  | 'mark_artifact_completed'
  | 'mark_artifact_blocked'
  | 'publish_content'
  | 'send_private_message'
  | 'send_external_email'
  | 'send_proposal'
  | 'quote_price'
  | 'external_customer_commitment'
  | 'schedule_customer_meeting'
  | 'change_public_offer'
  | 'confirm_payment'
  | 'recognize_revenue'
  | 'issue_refund'
  | 'sign_contract'
  | 'issue_invoice'
  | 'change_large_amount_revenue'
  | 'delete_revenue_record'
  | 'legal_commitment'

export type ActionBoundarySourceModule =
  | 'opportunity'
  | 'offer'
  | 'sales'
  | 'workflow'
  | 'revenue'
  | 'daily_run'
  | 'runtime'
  | 'approval'
  | 'manual'

export interface ActionDecision {
  actionType: ActionType
  actionLevel: ActionLevel
  allowed: boolean
  requiresCeoApproval: boolean
  blocked: boolean
  reason: string
  approvalTitle: string
  approvalDescription: string
  auditNote: string
  createdAt: string
}

export interface ActionBoundaryRequest {
  actionType: ActionType
  sourceModule: ActionBoundarySourceModule
  sourceId: string
  title: string
  description: string
  amount: number
  customerName: string
  relatedOfferId: string
  relatedWorkflowRunId: string
  requestedByAgentId: string
  metadata: Record<string, unknown>
}

export interface MockApprovalRequest {
  id: string
  title: string
  description: string
  sourceModule: ActionBoundarySourceModule
  sourceId: string
  actionType: ActionType
  actionLevel: ActionLevel
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  amount: number
  customerName: string
  requestedByAgentId: string
  createdAt: string
}

export interface UnifiedApproval {
  id: string
  title: string
  description: string
  sourceModule: ActionBoundarySourceModule | 'legacy'
  sourceId: string
  actionType: ActionType | 'legacy_approval'
  actionLevel: ActionLevel | 'LEGACY'
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  amount: number
  customerName: string
  requestedByAgentId: string
  createdAt: string
  updatedAt: string
  approvedBy: string
  rejectedBy: string
  rejectedReason: string
  decisionNote: string
  riskHint: string
  legacyApprovalId: string
}

export type WorkflowTrigger = 'manual' | 'lead_qualified' | 'payment_confirmed' | 'scheduled'

export interface WorkflowStepTemplate {
  id: string
  label: string
  agentId: string
  skillId: string
  description: string
  requiresApproval: boolean
  expectedOutput: string
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  trigger: WorkflowTrigger
  steps: WorkflowStepTemplate[]
}

export type WorkflowRunStatus = 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed'
export type WorkflowStepRunStatus = 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'skipped'
export type WorkflowContextType = 'sales_lead' | 'opportunity' | 'manual' | 'daily_run'

export interface DeliveryWorkflowRun {
  id: string
  templateId: string
  name: string
  status: WorkflowRunStatus
  contextType: WorkflowContextType
  contextId: string
  currentStepId: string
  createdAt: string
  updatedAt: string
}

export interface DeliveryWorkflowStep {
  id: string
  runId: string
  templateStepId: string
  label: string
  agentId: string
  skillId: string
  description: string
  status: WorkflowStepRunStatus
  requiresApproval: boolean
  expectedOutput: string
  outputSummary: string
  createdAt: string
  updatedAt: string
}

export interface WorkflowProgress {
  totalSteps: number
  completedSteps: number
  waitingApproval: boolean
  hasFailure: boolean
  percentComplete: number
}

export type TenantEnabledModule =
  | 'opportunity'
  | 'offers'
  | 'sales'
  | 'workflows'
  | 'revenue'
  | 'daily_run'
  | 'action_boundary'
  | 'runtime'
  | 'audit'

export interface TenantConfig {
  tenantId: string
  tenantName: string
  ownerName: string
  industry: string
  businessGoal: string
  defaultCurrency: string
  enabledModules: TenantEnabledModule[]
  agentTemplateId: string
  offerCatalogId: string
  dailyRunCadence: string
  createdAt: string
  updatedAt: string
}

export type LicensePlan = 'free' | 'pro' | 'team' | 'private'
export type LicenseStatus = 'trial' | 'active' | 'expired' | 'disabled'

export interface LicenseConfig {
  licenseId: string
  plan: LicensePlan
  status: LicenseStatus
  maxAgents: number
  maxOpportunities: number
  maxSalesLeads: number
  maxWorkflowRuns: number
  maxRevenueRecords: number
  expiresAt: string
  features: string[]
  createdAt: string
}

export interface IndustryTemplate {
  id: string
  name: string
  description: string
  targetUsers: string
  recommendedModules: TenantEnabledModule[]
  defaultBusinessGoal: string
  recommendedAgentTemplateId: string
  recommendedOfferCatalogId: string
  defaultDailyRunCadence: string
}

export interface AgentTeamTemplateAgent {
  agentId: string
  name: string
  role: string
  responsibility: string
  defaultSkills: string[]
}

export interface AgentTeamTemplate {
  id: string
  name: string
  description: string
  agents: AgentTeamTemplateAgent[]
}

export interface LicenseUsageMetric {
  used: number
  max: number
  remaining: number
  percentUsed: number
}

export interface LicenseUsage {
  agents: LicenseUsageMetric
  opportunities: LicenseUsageMetric
  salesLeads: LicenseUsageMetric
  workflowRuns: LicenseUsageMetric
  revenueRecords: LicenseUsageMetric
}

export interface DemoDataProfile {
  industryTemplateId: string
  demoTenantName: string
  demoBusinessGoal: string
  recommendedOffers: string[]
  sampleOpportunitiesCount: number
  sampleSalesLeadsCount: number
  sampleWorkflowsCount: number
  sampleRevenueRecordsCount: number
  salesTalkTrack: string
}

export interface SaasReadinessChecklistItem {
  key: string
  label: string
  ready: boolean
  detail: string
}

export interface CommercializationSummary {
  targetCustomers: string[]
  packagedPlans: string[]
  sellingPoints: string[]
  missingSaasCapabilities: string[]
}

export interface AuditEvent {
  id: string
  taskId: string
  agentId: string
  level: 'low' | 'medium' | 'high' | 'critical'
  issueType: string
  title: string
  detail: string
  status: 'open' | 'reviewing' | 'resolved' | 'ignored'
  createdAt: string
}

export interface StoreItem {
  id: string
  name: string
  itemType: string
  priceToken: number
  description: string
  stockMode: 'infinite' | 'limited'
  stockCount: number | null
  enabled: boolean
}

export interface StoreOrder {
  id: string
  buyerName: string
  buyerAgentId: string
  itemName: string
  itemId: string
  quantity: number
  totalPrice: number
  status: 'paid' | 'cancelled' | 'refunded'
  createdAt: string
}

export interface TreasurySnapshot {
  totalBalance: number
  reservedBalance: number
  availableBalance: number
}

export interface GoalTaskDraft {
  title: string
  description: string
  taskType: 'ops' | 'tech' | 'growth' | 'finance' | 'audit' | 'product' | 'sales' | 'customer'
  ownerAgentId: string
  ownerName: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  budgetToken: number
  dueAt: string
  requiresApproval: boolean
}

export interface GoalDecomposition {
  id: string
  goal: string
  summary: string
  riskNotes: string[]
  tasks: GoalTaskDraft[]
  createdAt: string
}

export interface TeamDiscussionMessage {
  agentId: string
  agentName: string
  emoji: string
  role: string
  content: string
  timestamp: string
  type: 'thinking' | 'speaking' | 'task_plan' | 'proposal'
}

export type AttachmentType = 'image' | 'file' | 'document' | 'code_ref' | 'url_preview'

export interface ChatAttachment {
  id: string
  type: AttachmentType
  name: string
  /** base64 data URL for images, file path for refs, URL for url_preview */
  url: string
  mimeType?: string
  size?: number
  /** extracted text content for documents/code */
  textContent?: string
  /** for code_ref: relative path within project */
  filePath?: string
  /** for code_ref: start/end line numbers */
  lineRange?: [number, number]
  /** for url_preview: page title + summary */
  previewTitle?: string
  previewSummary?: string
}

export interface MentionedAgent {
  agentId: string
  name: string
  emoji: string
}

export interface QuotedMessage {
  messageId: string
  role: string
  contentPreview: string
}

export interface ChatMessage {
  id: string
  role: 'ceo' | 'jarvis' | 'team_discussion'
  content: string
  attachments?: ChatAttachment[]
  mentions?: MentionedAgent[]
  quotedMessage?: QuotedMessage
  decomposition?: GoalDecomposition
  teamMessages?: TeamDiscussionMessage[]
  llmModelUsed?: string
  isError?: boolean
  createdAt: string
}

export interface BusinessLine {
  id: string
  name: string
  description: string
  status: 'active' | 'planning' | 'paused'
  pricingTiers: PricingTier[]
  costStructure: CostItem[]
  targetCustomers: string
  createdAt: string
}

export interface PricingTier {
  name: string
  price: number
  description: string
}

export interface CostItem {
  label: string
  tokenCost: number
  fiatCost: number
}

export type PlaybookStageStatus = 'pending' | 'active' | 'completed' | 'skipped'

export interface PlaybookStage {
  id: string
  name: string
  description: string
  status: PlaybookStageStatus
  startedAt?: string
  completedAt?: string
  metrics?: Record<string, number | string>
}

export interface PlaybookRun {
  id: string
  businessLineId: string
  businessLineName: string
  goal: string
  stages: PlaybookStage[]
  totalCostToken: number
  totalCostFiat: number
  totalRevenueFiat: number
  profitFiat: number
  profitMargin: number
  status: 'running' | 'completed' | 'failed'
  createdAt: string
  completedAt?: string
}

export interface ProfitSummary {
  totalRevenue: number
  totalCostFiat: number
  totalCostToken: number
  netProfit: number
  profitMargin: number
  roiPercent: number
  businessLineBreakdown: BusinessLineProfit[]
}

export interface BusinessLineProfit {
  businessLine: string
  revenue: number
  costToken: number
  costFiat: number
  profit: number
  margin: number
  taskCount: number
  completedTasks: number
}

export interface LlmUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  model: string
  provider: string
  durationMs: number
}

export interface LlmUsageLogItem {
  id: string
  agentId?: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCost: number
  callerFunction: string
  durationMs: number
  createdAt: string
}

export interface LlmCostByAgent {
  agentId: string
  agentName: string
  totalTokens: number
  estimatedCost: number
  callCount: number
}

export interface LlmUsageSummary {
  todayCost: number
  todayTokens: number
  todayCalls: number
  weeklyCost: number
  weeklyTokens: number
  weeklyCalls: number
  costByAgent: LlmCostByAgent[]
  recentLogs: LlmUsageLogItem[]
}

export interface AppSnapshot {
  agents: Agent[]
  tasks: TaskItem[]
  approvals: ApprovalItem[]
  ledger: LedgerItem[]
  revenues: RevenueItem[]
  auditEvents: AuditEvent[]
  storeItems: StoreItem[]
  storeOrders: StoreOrder[]
  treasury: TreasurySnapshot
  businessLines?: BusinessLine[]
  playbookRuns?: PlaybookRun[]
  performanceSummary?: PerformanceSummary
}
