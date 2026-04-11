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

export type TaskTimelineEventType = 'created' | 'resubmitted' | 'approval_requested' | 'approved' | 'rejected' | 'start' | 'approve'

export interface TaskTimelineEvent {
  id: string
  type: TaskTimelineEventType
  submissionIndex: number
  actor: string
  note: string
  createdAt: string
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
  type: 'thinking' | 'speaking' | 'task_plan'
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
}
